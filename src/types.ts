import { Toucan } from "toucan-js";
import { ZodObject, ZodSchema, z } from "zod";
export type Env = {
  [k: string]:
    | string
    | Queue
    | KVNamespace
    | R2Bucket
    | D1Database
    | Fetcher
    | Hyperdrive;
};
export type Route<T extends Env, A, P extends string> =
  | {
      auth: (c: { req: Request; env: T }) => Promise<A>;
      method: "GET" | "DELETE";
      path: string;
      matcher: RegExp;
      output: ZodSchema;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: Handler<T, undefined, any, A, P>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params?: ZodObject<any>;
    }
  | {
      auth: (c: { req: Request; env: T }) => Promise<A>;
      method: "POST" | "PUT";
      path: string;
      matcher: RegExp;
      input:
        | ZodSchema
        | ((c: {
            req: Request;
            env: T;
            params: ExtractParameterNames<P>;
          }) => Promise<ZodSchema>);
      output: ZodSchema;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: Handler<T, any, any, A, string>;
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
}) => Promise<
  | {
      body: z.infer<O>;
      status?: 200;
      headers?: Record<string, string>;
    }
  | {
      body?: { error: string };
      status: number;
      headers?: Record<string, string>;
    }
>;
