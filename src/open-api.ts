import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { Env, Route } from "./types";
import { ZodIssue, ZodType, z } from "zod";

const ZodErrorSchema: ZodType<{ issues: ZodIssue[] }> = z.object({
  error: z.string(),
  issues: z.array(
    z.object({
      code: z.literal("invalid_literal"),
      expected: z.string(),
      received: z.string(),
      path: z.array(z.string()),
      message: z.string(),
    }),
  ),
});

type Method =
  | "get"
  | "post"
  | "put"
  | "delete"
  | "patch"
  | "head"
  | "options"
  | "trace";

extendZodWithOpenApi(z);

export const openAPI =
  <T extends Env, A>(
    title: string,
    release: string,
    noAuth: () => A,
    routes: Route<T, A>[],
  ) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async () => {
    const openAPIRegistry = new OpenAPIRegistry();
    openAPIRegistry.registerComponent("securitySchemes", "auth", {
      type: "http",
      scheme: "bearer",
    });
    routes.map((route): void => {
      const params = z.object(
        Object.fromEntries(
          Array.from(route.path.matchAll(/\/{(?<name>[^}]*)}/g), (match) => [
            match.groups!.name,
            z.string(),
          ]),
        ),
      );
      openAPIRegistry.registerPath({
        method: route.method.toLowerCase() as Method,
        path: route.path.toString(),
        ...(route.auth === noAuth ? {} : { security: [{ auth: [] }] }),
        request:
          route.method === "POST" || route.method === "PUT"
            ? {
                body: route.input
                  ? {
                      content: {
                        "application/json": {
                          schema: route.input,
                        },
                      },
                      required: true,
                    }
                  : undefined,
                query: route.params,
                params,
              }
            : { query: route.params, params },
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: route.output,
              },
            },
          },
          400: {
            description: "Invalid Request",
            content: {
              "application/json": {
                schema: ZodErrorSchema,
              },
            },
          },
          500: {
            description: "Invalid Request",
            content: {
              "application/json": {
                schema: z.object({
                  error: z.string(),
                }),
              },
            },
          },
        },
      });
    });
    const generator = new OpenApiGeneratorV31(openAPIRegistry.definitions);
    return {
      body: generator.generateDocument({
        openapi: "3.1.0",
        info: {
          title,
          version: release,
        },
      }),
    };
  };
