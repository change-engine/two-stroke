import type { Toucan } from "toucan-js";
import type { ZodObject, ZodType, z } from "zod/v4";

export type Route<T, A> =
  | {
      auth: (c: { req: Request; env: T }) => Promise<A>;
      method: "GET" | "DELETE";
      path: string;
      matcher: RegExp;
      output: ZodType;
      handler: Handler<T, undefined, any, A, string>;
      params?: ZodObject<any>;
    }
  | {
      auth: (c: { req: Request; env: T }) => Promise<A>;
      method: "POST" | "PUT";
      path: string;
      matcher: RegExp;
      input: ZodType | undefined;
      output: ZodType;
      handler: Handler<T, any, any, A, string>;
      params?: ZodObject<any>;
    };

type ExtractParameterNames<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Record<Name, string> & ExtractParameterNames<Rest>
  : Record<string, string>;

export type Handler<
  T,
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
  waitUntil: (p: Promise<void>) => void;
}) => Promise<
  | {
      body: z.infer<O>;
      status?: 200;
      headers?: HeadersInit;
    }
  | {
      body: z.infer<O>;
      status: 301;
      headers?: HeadersInit;
    }
  | {
      body: z.infer<O>;
      status: 302;
      headers?: HeadersInit;
    }
  | {
      body?: { error: string };
      status: number;
      headers?: HeadersInit;
    }
>;
