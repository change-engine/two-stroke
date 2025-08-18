import { Toucan } from "toucan-js";
import { ZodType, ZodObject, z } from "zod/v4";
export type Env = {
  [k: string]:
    | string
    | Queue
    | KVNamespace
    | R2Bucket
    | D1Database
    | Fetcher
    | Hyperdrive
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | DurableObjectNamespace<any>
    | Vectorize
    | ImagesBinding;
};
export type Route<T extends Env, A> =
  | {
      auth: (c: { req: Request; env: T }) => Promise<A>;
      method: "GET" | "DELETE";
      path: string;
      matcher: RegExp;
      output: ZodType;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: Handler<T, undefined, any, A, string>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params?: ZodObject<any>;
    }
  | {
      auth: (c: { req: Request; env: T }) => Promise<A>;
      method: "POST" | "PUT";
      path: string;
      matcher: RegExp;
      input: ZodType | undefined;
      output: ZodType;
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
  I extends ZodType | undefined,
  O extends ZodType,
  A,
  P extends string,
> = (c: {
  req: Request;
  env: T;
  body: I extends ZodType ? z.infer<I> : undefined;
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
      body: z.infer<O>;
      status: 301;
      headers?: Record<string, string>;
    }
  | {
      body: z.infer<O>;
      status: 302;
      headers?: Record<string, string>;
    }
  | {
      body?: { error: string };
      status: number;
      headers?: Record<string, string>;
    }
>;
