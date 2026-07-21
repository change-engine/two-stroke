import { Toucan } from "toucan-js";
import { z } from "zod/v4";
import { openAPI } from "./open-api";
import { type Handler, type Route } from "./types";
import { jwkVerifyMulti, pbkdfVerify } from "./util";

import type { JSONWebKeySet } from "jose";
import type { ZodObject, ZodSafeParseResult, ZodType } from "zod/v4";

const noAuth = async () => null;

const escapeRegex = (str: string) => str.replace(/(?<seg>[.*+?^=!:$()|[\]\\])/g, String.raw`\$&`);

export function twoStroke<T>(
  title: string,
  release: string,
  origin?: (o: string | null) => string,
) {
  let _queue: (c: { batch: MessageBatch<any>; env: T; sentry: Toucan }) => Promise<void>;
  const routes: Route<T, any>[] = [];
  routes.push({
    auth: noAuth,
    method: "GET",
    path: "/doc",
    matcher: /^\/doc$/,
    output: z.any(),
    handler: openAPI(title, release, noAuth, routes),
  });
  const crons: {
    [cron: string]: (c: { env: T; sentry: Toucan }) => Promise<void>;
  } = {};
  let _email: (c: { message: ForwardableEmailMessage; env: T; sentry: Toucan }) => Promise<void>;
  return {
    async fetch(
      req: Request,
      env: T & {
        readonly SENTRY_DSN: string;
        readonly SENTRY_ENVIRONMENT: string;
      },
      context: ExecutionContext,
    ): Promise<Response> {
      const defaultHeaders = {
        Very: "Origin",
        "Access-Control-Allow-Origin": origin
          ? (env.SENTRY_ENVIRONMENT === "staging" || env.SENTRY_ENVIRONMENT === "dev") &&
            req.headers.get("Origin")?.split(":")[1]?.endsWith("localhost")
            ? (req.headers.get("Origin") ?? "")
            : origin(req.headers.get("Origin"))
          : "*",
      };
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
        if (req.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              ...defaultHeaders,
              "Access-Control-Max-Age": "86400",
              "Access-Control-Allow-Methods": "GET,HEAD,PUT,POST,DELETE",
              "Access-Control-Allow-Headers": "Authorization,Content-Type",
              "Access-Control-Allow-Credentials": "true",
            },
          });
        }
        const { pathname } = new URL(req.url);
        let response;
        for (const route of routes) {
          if (req.method === route.method && route.matcher.test(pathname)) {
            const params = Object.fromEntries(
              Object.entries(pathname.match(route.matcher)?.groups ?? {}).map(([k, v]) => [
                k,
                decodeURIComponent(v),
              ]),
            );
            let claims;
            try {
              // oxlint-disable-next-line no-await-in-loop
              claims = await route.auth({ req, env });
            } catch (error) {
              console.warn(error);
              return new Response("", {
                status: 401,
                statusText: "Invalid Authorization",
                headers: {
                  ...defaultHeaders,
                  "WWW-Authenticate": "Bearer",
                },
              });
            }
            if (route.method === "POST" || route.method === "PUT") {
              let rawBody;
              try {
                rawBody = route.input
                  ? req.headers.get("Content-Type") === "application/x-www-form-urlencoded"
                    ? // oxlint-disable-next-line no-await-in-loop
                      Object.fromEntries(new URLSearchParams(await req.text()))
                    : // oxlint-disable-next-line no-await-in-loop
                      await req.json()
                  : undefined;
              } catch (error) {
                console.error({
                  message: "Request body is required'",
                  error: error instanceof Error ? error.message : "Error",
                });
                return Response.json(
                  {
                    error: "Request body is required",
                    issues: [],
                  },
                  {
                    status: 400,
                    headers: defaultHeaders,
                  },
                );
              }
              const body = route.input
                ? route.input.safeParse(rawBody)
                : {
                    success: true,
                    data: undefined,
                    error: undefined,
                  };
              if (body.success)
                // oxlint-disable-next-line no-await-in-loop
                response = await route.handler({
                  req,
                  env,
                  body: body.data,
                  claims,
                  params,
                  searchParams: new URL(req.url).searchParams,
                  sentry,
                  waitUntil: (p: Promise<void>) => context.waitUntil(p),
                });
              else {
                console.error({
                  message: "Request body schema invalid",
                  error: body.error,
                  body: rawBody,
                });
                return Response.json(
                  {
                    error: "Request body schema invalid",
                    issues: JSON.parse(body.error?.message ?? "{}") as unknown,
                    name: body.error?.name,
                  },
                  {
                    status: 400,
                    headers: defaultHeaders,
                  },
                );
              }
            } else {
              // oxlint-disable-next-line no-await-in-loop
              response = await route.handler({
                req,
                env,
                claims,
                body: undefined,
                params,
                searchParams: new URL(req.url).searchParams,
                sentry,
                waitUntil: (p: Promise<void>) => context.waitUntil(p),
              });
            }
            if (response.status === undefined || response.status === 200) {
              const output = route.output.safeParse(response.body);
              if (!output.success) {
                console.error({
                  message: "Response body schema invalid",
                  error: output.error,
                  body: response.body,
                });
              }
            }
            const responseWithHeaders: Omit<typeof response, "headers"> & {
              headers: Headers;
            } = {
              ...response,
              headers: new Headers(response.headers ?? {}),
            };
            Object.entries({
              ...defaultHeaders,
              "Content-Type": "application/json",
              "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "default-src 'self'",
            }).forEach(([k, v]) => {
              if (!responseWithHeaders.headers.has(k)) responseWithHeaders.headers.set(k, v);
            });

            return new Response(
              responseWithHeaders.headers.get("Content-Type") === "application/json"
                ? JSON.stringify(response.body)
                : response.body,
              responseWithHeaders,
            );
          }
        }
        return new Response("", {
          status: 404,
          headers: defaultHeaders,
        });
      } catch (error) {
        console.warn(error);
        sentry.captureException(error);
        return new Response("", {
          status: 500,
          statusText: "Internal Server Error",
          headers: defaultHeaders,
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
      try {
        return await _queue({ batch, env, sentry });
      } catch (error) {
        console.warn(error);
        sentry.captureException(error);
      }
    },
    async scheduled(
      event: ScheduledController,
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
      try {
        const handler = crons[event.cron];
        if (!handler) {
          throw new Error("CRON Handler not found");
        }
        await handler({ env, sentry });
      } catch (error) {
        console.warn(error);
        sentry.captureException(error);
      }
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
      try {
        await _email({ message, env, sentry });
      } catch (error) {
        console.warn(error);
        sentry.captureException(error);
      }
    },
    emailHandler(
      handler: (c: { env: T; message: ForwardableEmailMessage; sentry: Toucan }) => Promise<void>,
    ) {
      _email = handler;
    },
    schedule(cron: string, handler: (c: { env: T; sentry: Toucan }) => Promise<void>) {
      crons[cron] = handler;
    },
    noAuth,
    pbkdf:
      (k: keyof T, customHeaderName = "Authorization") =>
      async ({ req, env }: { req: Request; env: T }) => {
        const [scheme, token] = (req.headers.get(customHeaderName) ?? " ").split(" ");
        if (
          (scheme === "token" || scheme === "Bearer") &&
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          (await pbkdfVerify(env[k] as string, token ?? ""))
        )
          return;
        throw new Error("Invalid");
      },
    jwt:
      <J>(k: keyof T, ak: keyof T) =>
      async ({ req, env }: { req: Request; env: T }) => {
        const [scheme, token] = (req.headers.get("Authorization") ?? " ").split(" ");
        if (scheme === "Bearer") {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          const rawIssuer = env[k] as string;
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          const rawAudience = env[ak] as string;
          const issuer = rawIssuer.startsWith("{")
            ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              (JSON.parse(rawIssuer) as Record<string, JSONWebKeySet | true>)
            : { [rawIssuer]: true as const };
          const audience = rawAudience.startsWith("[")
            ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              (JSON.parse(rawAudience) as string[])
            : [rawAudience];
          const claims = await jwkVerifyMulti<J>(token ?? "", issuer, audience);
          if (!claims) {
            throw new Error("Invalid");
          }
          return claims;
        }
        throw new Error("Invalid");
      },
    queueHandler<I extends ZodType>(
      input: I,
      handler: (c: {
        env: T;
        batch: MessageBatch<z.input<I>>;
        sentry: Toucan;
        parsedBatch: ZodSafeParseResult<z.output<I>>[];
      }) => Promise<void>,
    ) {
      _queue = async ({
        batch,
        env,
        sentry,
      }: {
        batch: MessageBatch<z.input<I>>;
        env: T;
        sentry: Toucan;
      }) => {
        const parsedBatch = batch.messages.map((message) => {
          const passed = input.safeParse(message.body);
          if (!passed.success) {
            console.error(passed.error, message);
          }
          return passed;
        });
        await handler({ batch, env, sentry, parsedBatch });
        console.log("Queue batch finished");
      };
    },
    put<I extends ZodType | undefined, O extends ZodType, A, P extends string>(
      auth: Route<T, A>["auth"],
      path: P,
      input: I,
      output: O,
      handler: Handler<T, I, O, A, P>,
      params?: ZodObject<any>,
    ) {
      routes.push({
        auth,
        method: "PUT",
        path,
        matcher: new RegExp(
          `^${escapeRegex(path).replaceAll(/\/{(?<seg>[^}]*)}/g, String.raw`/(?<$<seg>>[^\/]*)`)}$`,
        ),
        input,
        output,
        handler,
        params,
      });
    },

    post<I extends ZodType | undefined, O extends ZodType, A, P extends string>(
      auth: Route<T, A>["auth"],
      path: P,
      input: I,
      output: O,
      handler: Handler<T, I, O, A, P>,
      params?: ZodObject<any>,
    ) {
      routes.push({
        auth,
        method: "POST",
        path,
        matcher: new RegExp(
          `^${escapeRegex(path).replaceAll(/\/{(?<seg>[^}]*)}/g, String.raw`/(?<$<seg>>[^\/]*)`)}$`,
        ),
        input,
        output,
        handler,
        params,
      });
    },

    get<O extends ZodType, A, P extends string>(
      auth: Route<T, A>["auth"],
      path: P,
      output: O,
      handler: Handler<T, undefined, O, A, P>,
      params?: ZodObject<any>,
    ) {
      routes.push({
        auth,
        method: "GET",
        path,
        matcher: new RegExp(
          `^${escapeRegex(path).replaceAll(/\/{(?<seg>[^}]*)}/g, String.raw`/(?<$<seg>>[^\/]*)`)}$`,
        ),
        output,
        handler,
        params,
      });
    },
    delete<O extends ZodType, A, P extends string>(
      auth: Route<T, A>["auth"],
      path: P,
      output: O,
      handler: Handler<T, undefined, O, A, P>,
      params?: ZodObject<any>,
    ) {
      routes.push({
        auth,
        method: "DELETE",
        path,
        matcher: new RegExp(
          `^${escapeRegex(path).replaceAll(/\/{(?<seg>[^}]*)}/g, String.raw`/(?<$<seg>>[^\/]*)`)}$`,
        ),
        output,
        handler,
        params,
      });
    },
  };
}

type AddToQueueConfig = QueueSendOptions & {
  retries?: number;
  backoffFactor?: number;
};

export async function addToQueue<T>(queue: Queue<T>, message: T, config: AddToQueueConfig = {}) {
  const { retries, backoffFactor, ...options } = config;

  for (let i = 0; i < (retries ?? 5); i++) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      await queue.send(message, options);
      return;
    } catch (error) {
      const backoff = (backoffFactor ?? 2) ** i;
      // oxlint-disable-next-line typescript/restrict-template-expressions
      console.log(`Error adding to queue: ${error}`);
      console.log(`Retrying in ${backoff} seconds`);
      // oxlint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, backoff * 1000));
    }
  }
  throw new Error("Failed to add to queue");
}
