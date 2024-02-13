import { Toucan } from "toucan-js";
import { ZodObject, ZodSchema, z } from "zod";
export type Env = {
  [k: string]: string | Queue | KVNamespace | R2Bucket | D1Database;
};
export type Route<T extends Env> =
  | {
      auth: (c: { req: Request; env: T }) => unknown;
      method: "GET" | "DELETE";
      path: string;
      matcher: RegExp;
      output: ZodSchema;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: Handler<T, undefined, any, any, string>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params?: ZodObject<any>;
    }
  | {
      auth: (c: { req: Request; env: T }) => unknown;
      method: "POST" | "PUT";
      path: string;
      matcher: RegExp;
      input: ZodSchema;
      output: ZodSchema;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: Handler<T, any, any, any, string>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params?: ZodObject<any>;
    };

export type ExtractParameterNames<S extends string> =
  S extends `${string}{${infer Name}}${infer Rest}`
    ? Record<Name, string> & ExtractParameterNames<Rest>
    : Record<string, string>;

export type Handler<
  T extends Env,
  I extends ZodSchema | undefined,
  O extends ZodSchema,
  A,
  P extends string,
> = (c: {
  req: Request;
  env: T;
  body: I extends ZodSchema ? z.infer<I> : undefined;
  params: ExtractParameterNames<P>;
  searchParams: URLSearchParams;
  claims: A;
  sentry: Toucan;
}) => Promise<{
  body: z.infer<O>;
  status?: number;
  headers?: Record<string, string>;
}>;
