import { Toucan } from "toucan-js";
import { ZodObject, ZodSchema, z } from "zod";
import { verify as pbkdfVerify } from "pbkdf-subtle";
import { verify as jwkVerify } from "jwk-subtle";
import { Env, Handler, Route } from "./types";
import { openAPI } from "./openAPI";

const noAuth = async () => null;

const escapeRegex = (str: string) =>
  str.replace(/([.*+?^=!:$()|[\]\\])/g, "\\$&");

export function twoStroke<T extends Env>(title: string, release: string) {
  let _queue: (c: {
    batch: MessageBatch;
    env: T;
    sentry: Toucan;
  }) => Promise<void>;
  const routes: Route<T>[] = [];
  routes.push({
    auth: noAuth,
    method: "GET",
    path: "/doc/",
    matcher: /^\/doc\/$/,
    output: z.object({}),
    handler: openAPI(title, release, noAuth, routes),
  });
  const crons: {
    [cron: string]: (c: { env: T; sentry: Toucan }) => Promise<void>;
  } = {};
  let _email: (c: {
    message: ForwardableEmailMessage;
    env: T;
    sentry: Toucan;
  }) => Promise<void>;
  return {
    async fetch(
      req: Request,
      env: T & {
        readonly SENTRY_DSN: string;
        readonly SENTRY_ENVIRONMENT: string;
      },
      context: ExecutionContext,
    ): Promise<Response> {
      const sentry = new Toucan({
        dsn: env.SENTRY_DSN,
        context,
        request: req,
        requestDataOptions: {
          allowedHeaders: ["user-agent"],
        },
        environment: env.SENTRY_ENVIRONMENT,
        release,
      });
      try {
        const { pathname } = new URL(req.url);
        let response;
        for (const route of routes) {
          if (req.method === route.method && route.matcher.test(pathname)) {
            const params = pathname.match(route.matcher)?.groups ?? {};
            let claims;
            try {
              claims = await route.auth({ req, env });
            } catch (err) {
              console.warn(err);
              return new Response("", {
                status: 401,
                statusText: "Invalid Authorization",
                headers: {
                  "WWW-Authenticate": "Bearer",
                },
              });
            }
            if (route.method === "POST" || route.method === "PUT") {
              const rawBody =
                req.headers.get("Content-Type") ===
                "application/x-www-form-urlencoded"
                  ? Object.fromEntries(new URLSearchParams(await req.text()))
                  : await req.json();
              const body = route.input.safeParse(rawBody);
              if (body.success)
                response = await route.handler({
                  req,
                  env,
                  body: body.data,
                  claims,
                  params,
                  searchParams: new URL(req.url).searchParams,
                  sentry,
                });
              else {
                console.error({
                  message: "Request body schema invalid",
                  error: body.error,
                  body: rawBody,
                });
                return new Response(JSON.stringify(body.error), {
                  status: 400,
                });
              }
            } else {
              response = await route.handler({
                req,
                env,
                claims,
                body: undefined,
                params,
                searchParams: new URL(req.url).searchParams,
                sentry,
              });
            }
            const output = route.output.safeParse(response.body);
            if (!output.success) {
              console.error({
                message: "Response body schema invalid",
                error: output.error,
                body: response.body,
              });
            }
            response.headers = response.headers ?? {};
            response.headers["Content-Type"] =
              response.headers["Content-Type"] ?? "application/json";
            return new Response(
              response.headers["Content-Type"] == "application/json"
                ? JSON.stringify(response.body)
                : response.body,
              response,
            );
          }
        }
        return new Response("", { status: 404 });
      } catch (err) {
        console.warn(err);
        sentry.captureException(err);
        return new Response("", {
          status: 500,
          statusText: "Internal Server Error",
        });
      }
    },
    async queue(
      batch: MessageBatch,
      env: T & {
        readonly SENTRY_DSN: string;
        readonly SENTRY_ENVIRONMENT: string;
      },
      context: ExecutionContext,
    ) {
      const sentry = new Toucan({
        dsn: env.SENTRY_DSN,
        context,
        environment: env.SENTRY_ENVIRONMENT,
        release,
      });
      return await _queue({ batch, env, sentry });
    },
    async scheduled(
      event: ScheduledEvent,
      env: T & {
        readonly SENTRY_DSN: string;
        readonly SENTRY_ENVIRONMENT: string;
      },
      context: ExecutionContext,
    ) {
      const sentry = new Toucan({
        dsn: env.SENTRY_DSN,
        context,
        environment: env.SENTRY_ENVIRONMENT,
        release,
      });
      const handler = crons[event.cron];
      if (!handler) {
        throw new Error("CRON Handler not found");
      }
      await handler({ env, sentry });
    },
    async email(
      message: ForwardableEmailMessage,
      env: T & {
        readonly SENTRY_DSN: string;
        readonly SENTRY_ENVIRONMENT: string;
      },
      context: ExecutionContext,
    ) {
      const sentry = new Toucan({
        dsn: env.SENTRY_DSN,
        context,
        environment: env.SENTRY_ENVIRONMENT,
        release,
      });
      await _email({ message, env, sentry });
    },
    emailHandler(
      handler: (c: {
        env: T;
        message: ForwardableEmailMessage;
        sentry: Toucan;
      }) => Promise<void>,
    ) {
      _email = handler;
    },
    schedule(
      cron: string,
      handler: (c: { env: T; sentry: Toucan }) => Promise<void>,
    ) {
      crons[cron] = handler;
    },
    noAuth,
    pbkdf:
      (k: keyof T) =>
      async ({ req, env }: { req: Request; env: T }) => {
        const [scheme, token] = (req.headers.get("Authorization") ?? " ").split(
          " ",
        );
        if (
          (scheme === "token" || scheme === "Bearer") &&
          (await pbkdfVerify(env[k] as string, token ?? ""))
        )
          return;
        throw Error("Invalid");
      },
    jwt:
      <J>(k: keyof T, ak: keyof T) =>
      async ({ req, env }: { req: Request; env: T }) => {
        const [scheme, token] = (req.headers.get("Authorization") ?? " ").split(
          " ",
        );
        if (scheme == "Bearer") {
          const claims = await jwkVerify<J>(
            token ?? "",
            env[k] as string,
            env[ak] as string,
          );
          if (!claims) {
            throw Error("Invalid");
          }
          return claims;
        }
        throw Error("Invalid");
      },
    queueHandler<I extends ZodSchema>(
      input: I,
      handler: (c: {
        env: T;
        batch: MessageBatch<z.infer<I>>;
        sentry: Toucan;
      }) => Promise<void>,
    ) {
      _queue = async ({ batch, env, sentry }) => {
        batch.messages.map((message): void => {
          const body = input.safeParse(message.body);
          if (!body.success) {
            console.error(body.error, message);
          }
        });
        await handler({ batch, env, sentry });
        console.log("Queue batch finished");
      };
    },
    put<I extends ZodSchema, O extends ZodSchema, A, P extends string>(
      auth: Route<T>["auth"],
      path: P,
      input: I,
      output: O,
      handler: Handler<T, I, O, A, P>,
    ) {
      routes.push({
        auth,
        method: "PUT",
        path,
        matcher: new RegExp(
          `^${escapeRegex(path).replaceAll(/\/{([^}]*)}/g, "/(?<$1>[^\\/]*)")}$`,
        ),
        input,
        output,
        handler,
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    post<
      I extends ZodSchema,
      O extends ZodSchema,
      A,
      P extends string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      PP extends ZodObject<any> | undefined,
    >(
      auth: Route<T>["auth"],
      path: P,
      input: I,
      output: O,
      handler: Handler<T, I, O, A, P>,
      params?: PP,
    ) {
      routes.push({
        auth,
        method: "POST",
        path,
        matcher: new RegExp(
          `^${escapeRegex(path).replaceAll(/\/{([^}]*)}/g, "/(?<$1>[^\\/]*)")}$`,
        ),
        input,
        output,
        handler,
        params,
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get<
      O extends ZodSchema,
      A,
      P extends string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      PP extends ZodObject<any> | undefined,
    >(
      auth: Route<T>["auth"],
      path: P,
      output: O,
      handler: Handler<T, undefined, O, A, P>,
      params?: PP,
    ) {
      routes.push({
        auth,
        method: "GET",
        path,
        matcher: new RegExp(
          `^${escapeRegex(path).replaceAll(/\/{([^}]*)}/g, "/(?<$1>[^\\/]*)")}$`,
        ),
        output,
        handler,
        params,
      });
    },
    delete<O extends ZodSchema, A, P extends string>(
      auth: Route<T>["auth"],
      path: P,
      output: O,
      handler: Handler<T, undefined, O, A, P>,
    ) {
      routes.push({
        auth,
        method: "DELETE",
        path,
        matcher: new RegExp(
          `^${escapeRegex(path).replaceAll(/\/{([^}]*)}/g, "/(?<$1>[^\\/]*)")}$`,
        ),
        output,
        handler,
      });
    },
  };
}
