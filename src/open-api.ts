import { z } from "zod/v4";
import { type Route } from "./types";

import type { ZodType } from "zod/v4";

const REF_PREFIX = "#/components/schemas/";
const DEFS_PREFIX = "#/$defs/";

const rewriteRefs = (node: unknown, defs: Record<string, string>, self?: string): unknown => {
  if (Array.isArray(node)) return node.map((n) => rewriteRefs(n, defs, self));
  if (typeof node !== "object" || node === null) return node;
  return Object.fromEntries(
    Object.entries(node).map(([k, v]) => {
      if (k === "$ref" && typeof v === "string") {
        if (v === "#" && self !== undefined) return [k, REF_PREFIX + self];
        const def = v.startsWith(DEFS_PREFIX) ? defs[v.slice(DEFS_PREFIX.length)] : undefined;
        if (def !== undefined) return [k, REF_PREFIX + def];
      }
      return [k, rewriteRefs(v, defs, self)];
    }),
  );
};

const uniqueName = (schemas: Record<string, unknown>, base: string) => {
  if (!(base in schemas)) return base;
  for (let i = 2; ; i++) if (!(`${base}_${i}` in schemas)) return `${base}_${i}`;
};

const jsonSchema = (
  schemas: Record<string, unknown>,
  name: string,
  schema: ZodType,
  io: "input" | "output",
) => {
  const {
    $schema: _$schema,
    $defs,
    ...json
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  } = z.toJSONSchema(schema, { io }) as Record<string, unknown> & {
    $defs?: Record<string, unknown>;
  };
  // Self references (`#`) only resolve if the schema itself lives in `components.schemas`.
  if ($defs === undefined && !JSON.stringify(json).includes(`"$ref":"#"`)) return json;

  // Reserve every name before rewriting so sibling `$defs` can reference each other.
  const root = uniqueName(schemas, name);
  schemas[root] = null;
  const defs: Record<string, string> = {};
  for (const key of Object.keys($defs ?? {})) {
    const def = uniqueName(schemas, `${root}_${key}`);
    defs[key] = def;
    schemas[def] = null;
  }
  schemas[root] = rewriteRefs(json, defs, root);
  for (const [key, def] of Object.entries($defs ?? {})) {
    schemas[defs[key] ?? key] = rewriteRefs(def, defs, root);
  }
  return { $ref: REF_PREFIX + root };
};

const schemaName = (method: string, path: string, suffix: string) =>
  `${method.toLocaleLowerCase()}${path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/_$/, "")}_${suffix}`;

export const openAPI =
  <T, A>(title: string, release: string, noAuth: () => A, routes: Route<T, A>[]) =>
  async () => {
    const schemas: Record<string, unknown> = {};
    const paths = Object.fromEntries(
      Object.entries(Object.groupBy(routes, ({ path }) => path)).map(([path, rs]) => [
        path,
        Object.fromEntries(
          (rs ?? []).map((r) => [
            r.method.toLocaleLowerCase(),
            {
              parameters: [
                // oxlint-disable-next-line typescript/no-unsafe-type-assertion
                ...Object.entries((r.params?.shape ?? {}) as Record<string, ZodType>).map(
                  ([k, v]) => ({
                    name: k,
                    in: "query",
                    required: !v.safeParse(undefined).success,
                    schema: jsonSchema(
                      schemas,
                      schemaName(r.method, r.path, `param_${k}`),
                      v,
                      "input",
                    ),
                  }),
                ),
                ...Array.from(r.path.matchAll(/\/{(?<name>[^}]*)}/g), (match) => ({
                  name: match.groups!.name,
                  in: "path",
                  required: true,
                  schema: {
                    type: "string",
                  },
                })),
              ],
              ...(r.auth === noAuth ? {} : { security: [{ auth: [] }] }),
              ...(r.method === "POST" || r.method === "PUT"
                ? {
                    requestBody: {
                      required: true,
                      content: {
                        "application/json": r.input
                          ? {
                              schema: jsonSchema(
                                schemas,
                                schemaName(r.method, r.path, "request"),
                                r.input,
                                "input",
                              ),
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
                      schema: jsonSchema(
                        schemas,
                        schemaName(r.method, r.path, "response"),
                        r.output,
                        "output",
                      ),
                    },
                  },
                },
                "400": status400,
                "500": status500,
              },
            },
          ]),
        ),
      ]),
    );
    return {
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
          ...(Object.keys(schemas).length > 0 ? { schemas } : {}),
        },
        paths,
      },
    };
  };

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
