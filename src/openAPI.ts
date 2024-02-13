import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { Env, Route } from "./types";
import { ZodIssue, ZodType, z } from "zod";

const ZodErrorSchema: ZodType<{ issues: ZodIssue[] }> = z.object({
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
  <T extends Env>(
    title: string,
    release: string,
    noAuth: () => void,
    routes: Route<T>[],
  ) =>
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
                body: {
                  content: {
                    "application/json": {
                      schema: route.input,
                    },
                  },
                  required: true,
                },
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
        },
      });
    });
    const generator = new OpenApiGeneratorV31(openAPIRegistry.definitions);
    return {
      body: generator.generateDocument({
        openapi: "3.1",
        info: {
          title,
          version: release,
        },
      }),
    };
  };
