import { z, ZodType } from "zod/v4";
import { type Env, type Route } from "./types";

export const openAPI =
  <T extends Env, A>(
    title: string,
    release: string,
    noAuth: () => A,
    routes: Route<T, A>[],
  ) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async () => ({
    body: {
      openapi: "3.1.0",
      info: {
        title,
        version: release,
      },
      components: {
        securitySchemes: {
          auth: {
            type: "http",
            scheme: "bearer",
          },
        },
      },
      paths: Object.fromEntries(
        Object.entries(Object.groupBy(routes, ({ path }) => path)).map(
          ([path, rs]) => [
            path,
            Object.fromEntries(
              (rs ?? []).map((r) => [
                r.method.toLocaleLowerCase(),
                {
                  parameters: [
                    ...Object.entries(
                      (r.params?.shape ?? {}) as Record<string, ZodType>,
                    ).map(([k, v]) => ({
                      name: k,
                      in: "query",
                      required: !v.safeParse(undefined).success,
                      schema: z.toJSONSchema(v, { io: "input" }),
                    })),
                    ...Array.from(
                      r.path.matchAll(/\/{(?<name>[^}]*)}/g),
                      (match) => ({
                        name: match.groups!.name,
                        in: "path",
                        required: true,
                        schema: {
                          type: "string",
                        },
                      }),
                    ),
                  ],
                  ...(r.auth === noAuth ? {} : { security: [{ auth: [] }] }),
                  ...(r.method === "POST" || r.method === "PUT"
                    ? {
                        requestBody: {
                          required: true,
                          content: {
                            "application/json": r.input
                              ? {
                                  schema: z.toJSONSchema(r.input, {
                                    io: "input",
                                  }),
                                }
                              : undefined,
                          },
                        },
                      }
                    : {}),
                  responses: {
                    "200": {
                      description: "OK",
                      content: {
                        "application/json": {
                          schema: z.toJSONSchema(r.output),
                        },
                      },
                    },
                    "400": status400,
                    "500": status500,
                  },
                },
              ]),
            ),
          ],
        ),
      ),
    },
  });

const status500 = {
  description: "Invalid Request",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "string",
          },
        },
        required: ["error"],
      },
    },
  },
};
const status400 = {
  description: "Invalid Request",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "string",
          },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  enum: ["invalid_literal"],
                },
                expected: {
                  type: "string",
                },
                received: {
                  type: "string",
                },
                path: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
                message: {
                  type: "string",
                },
              },
              required: ["code", "expected", "received", "path", "message"],
            },
          },
        },
        required: ["error", "issues"],
      },
    },
  },
};
