# two-stroke

A minimalist framework for Cloudflare Workers with built-in routing, authentication, and validation.

## Installation

```bash
npm install two-stroke
```

## Quick Start

```typescript
import { twoStroke } from "two-stroke";
import { z } from "zod/v4";

type MyEnv = {
  MY_KV: KVNamespace;
};

const app = twoStroke<MyEnv>("My API", "1.0.0");

app.get(app.noAuth, "/hello", z.object({ message: z.string() }), async () => ({
  body: { message: "Hello, World!" },
}));

export default app;
```

The `twoStroke` function returns an object that directly satisfies the Cloudflare Workers `ExportedHandler` interface — export it as `default` and it handles `fetch`, `queue`, `scheduled`, and `email` events.

## API Reference

### `twoStroke<T>(title, release, origin?)`

Creates a new application instance.

| Parameter | Type                                 | Description                                                                                                                                                                           |
| --------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`   | `string`                             | API title, used in the generated OpenAPI spec.                                                                                                                                        |
| `release` | `string`                             | Release version, used for Sentry and OpenAPI.                                                                                                                                         |
| `origin`  | `(origin: string \| null) => string` | Optional. Returns the `Access-Control-Allow-Origin` value for a given request origin. If omitted, defaults to `"*"`. In staging environments, `localhost` origins are always allowed. |

The environment type `T` must extend `Env`, which allows values of type `string`, `Queue`, `KVNamespace`, `R2Bucket`, `D1Database`, `Fetcher`, `Hyperdrive`, `DurableObjectNamespace`, `Vectorize`, or `ImagesBinding`.

Every environment must also include `SENTRY_DSN` and `SENTRY_ENVIRONMENT` string bindings. These are used automatically to initialize Sentry on every request, queue batch, scheduled event, and email.

Returns an object with the following methods:

---

### Route Registration

All route methods register an HTTP endpoint with authentication, validation, and a handler.

#### `app.get(auth, path, output, handler, params?)`

Registers a `GET` route.

| Parameter | Type                              | Description                                                                                                  |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `auth`    | `(c: { req, env }) => Promise<A>` | Authentication function.                                                                                     |
| `path`    | `string`                          | URL path pattern (e.g. `"/users/{userId}"`).                                                                 |
| `output`  | `ZodType`                         | Zod schema validating the response body.                                                                     |
| `handler` | `Handler`                         | Async function handling the request.                                                                         |
| `params`  | `ZodObject`                       | Optional. Zod object schema for query parameters. When provided, these appear in the generated OpenAPI spec. |

#### `app.post(auth, path, input, output, handler, params?)`

Registers a `POST` route.

| Parameter | Type                              | Description                                                                                                                                                                                                                                      |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth`    | `(c: { req, env }) => Promise<A>` | Authentication function.                                                                                                                                                                                                                         |
| `path`    | `string`                          | URL path pattern.                                                                                                                                                                                                                                |
| `input`   | `ZodType \| undefined`            | Zod schema validating the request body. Pass `undefined` for routes that don't require a body, or if you want to handle the body yourself (e.g a stream). Accepts both `application/json` and `application/x-www-form-urlencoded` content types. |
| `output`  | `ZodType`                         | Zod schema validating the response body.                                                                                                                                                                                                         |
| `handler` | `Handler`                         | Async function handling the request.                                                                                                                                                                                                             |
| `params`  | `ZodObject`                       | Optional. Zod object schema for query parameters.                                                                                                                                                                                                |

#### `app.put(auth, path, input, output, handler)`

Registers a `PUT` route. Same signature as `post` (without the optional `params`).

#### `app.delete(auth, path, output, handler, params?)`

Registers a `DELETE` route. Same signature as `get`.

---

### Path Parameters

Path parameters use `{name}` syntax and are automatically extracted via regex:

```typescript
app.get(
  app.noAuth,
  "/users/{userId}/posts/{postId}",
  z.object({ title: z.string() }),
  async ({ params }) => {
    // params.userId and params.postId are typed as string
    return { body: { title: "Hello" } };
  },
);
```

The `ExtractParameterNames<P>` utility type extracts parameter names from the path string at compile time, so `params` is fully typed.

---

### Handler Context

Every route handler receives a single context object:

```typescript
async (c: {
  req: Request;              // Original Cloudflare Request
  env: T;                    // Environment bindings
  body: z.infer<I>;          // Parsed & validated request body (undefined for GET/DELETE)
  params: { ... };           // Extracted path parameters, typed from the path string
  searchParams: URLSearchParams;  // URL query parameters
  claims: A;                 // Authentication claims (type depends on auth method)
  sentry: Toucan;            // Sentry instance for error tracking
  waitUntil: (p: Promise<void>) => void;  // Extend request lifetime
}) => Promise<Response>
```

Handlers must return an object with a `body` and optional `status` and `headers`:

```typescript
// Success (200 is the default)
return { body: { id: "123" } };

// Redirect
return { body: { url: "/new-location" }, status: 302, headers: { Location: "/new-location" } };

// Error
return { body: { error: "Not found" }, status: 404 };
```

Valid status codes for typed success responses are `200` (default), `301`, and `302`. Any other numeric status is allowed when the body is `{ error: string }` or omitted.

---

### Authentication

#### `app.noAuth`

No authentication. The `claims` value is `null`.

```typescript
app.get(app.noAuth, "/public", outputSchema, handler);
```

#### `app.pbkdf(key, customHeaderName?)`

PBKDF2 key verification. Validates a `Bearer` or `token` scheme credential against a hashed secret stored in the environment. The `claims` value is `void`.

| Parameter          | Type      | Description                                                                       |
| ------------------ | --------- | --------------------------------------------------------------------------------- |
| `key`              | `keyof T` | Environment binding name containing the PBKDF2 hash.                              |
| `customHeaderName` | `string`  | Optional. Header name to read the credential from. Defaults to `"Authorization"`. |

```typescript
app.get(app.pbkdf("API_KEY_HASH"), "/protected", outputSchema, handler);

// With custom header
app.get(app.pbkdf("API_KEY_HASH", "X-Api-Key"), "/protected", outputSchema, handler);
```

#### `app.jwt<J>(key, audience)`

JWT verification using JWK (JSON Web Keys). Fetches the OIDC configuration and JWKS from the issuer URL, then verifies the token. The `claims` value is typed as `J`.

| Parameter  | Type      | Description                                                |
| ---------- | --------- | ---------------------------------------------------------- |
| `key`      | `keyof T` | Environment binding name containing the issuer URL.        |
| `audience` | `keyof T` | Environment binding name containing the expected audience. |

```typescript
type Claims = { sub: string; email: string };

app.get(
  app.jwt<Claims>("AUTH_ISSUER", "AUTH_AUDIENCE"),
  "/me",
  z.object({ email: z.string() }),
  async ({ claims }) => ({
    // claims is typed as Claims
    body: { email: claims.email },
  }),
);
```

Authentication failures return `401` with a `WWW-Authenticate: Bearer` header.

---

### Queue Handling

#### `app.queueHandler(input, handler)`

Registers a queue consumer. Only one queue handler can be registered per app.

| Parameter | Type                                                        | Description                                          |
| --------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `input`   | `ZodType`                                                   | Zod schema for validating each message in the batch. |
| `handler` | `(c: { env, batch, sentry, parsedBatch }) => Promise<void>` | Async function processing the batch.                 |

The `parsedBatch` is an array of `ZodSafeParseResult` objects, one per message, allowing you to handle valid and invalid messages individually.

```typescript
app.queueHandler(
  z.object({ userId: z.string(), action: z.string() }),
  async ({ batch, parsedBatch, env }) => {
    for (let i = 0; i < batch.messages.length; i++) {
      const result = parsedBatch[i];
      if (result.success) {
        console.log(result.data.userId, result.data.action);
        batch.messages[i].ack();
      } else {
        batch.messages[i].retry();
      }
    }
  },
);
```

### `addToQueue(queue, message, config?)`

Standalone utility for sending messages to a queue with exponential backoff retry.

```typescript
import { addToQueue } from "two-stroke";

await addToQueue(env.MY_QUEUE, { userId: "123", action: "sync" });
```

| Config Option   | Type     | Default | Description                                                  |
| --------------- | -------- | ------- | ------------------------------------------------------------ |
| `retries`       | `number` | `5`     | Maximum number of send attempts.                             |
| `backoffFactor` | `number` | `2`     | Base for exponential backoff (in seconds: `factor^attempt`). |

All other properties on `config` are forwarded to the Cloudflare `Queue.send()` options (e.g. `contentType`, `delaySeconds`).

---

### Scheduled Tasks

#### `app.schedule(cron, handler)`

Registers a cron-triggered handler. Multiple schedules can be registered.

| Parameter | Type                                    | Description                                                |
| --------- | --------------------------------------- | ---------------------------------------------------------- |
| `cron`    | `string`                                | Cron expression (must match a trigger in `wrangler.toml`). |
| `handler` | `(c: { env, sentry }) => Promise<void>` | Async function to run on schedule.                         |

```typescript
app.schedule("0 * * * *", async ({ env, sentry }) => {
  // Runs every hour
});

app.schedule("0 0 * * *", async ({ env }) => {
  // Runs daily at midnight
});
```

---

### Email Handling

#### `app.emailHandler(handler)`

Registers an email handler for Cloudflare Email Routing. Only one email handler can be registered per app.

| Parameter | Type                                             | Description                          |
| --------- | ------------------------------------------------ | ------------------------------------ |
| `handler` | `(c: { env, message, sentry }) => Promise<void>` | Async function processing the email. |

The `message` is a Cloudflare `ForwardableEmailMessage`.

```typescript
app.emailHandler(async ({ message, env }) => {
  console.log(`Email from ${message.from} to ${message.to}`);
  await message.forward("archive@example.com");
});
```

---

### OpenAPI Documentation

A `GET /doc` endpoint is automatically registered and serves an OpenAPI 3.1.0 specification generated from all registered routes. It includes:

- Path and query parameters (from path patterns and `params` schemas)
- Request body schemas (from `input`)
- Response body schemas (from `output`)
- Security requirements (routes using auth other than `noAuth` are marked with bearer auth)
- Standard `400` and `500` error response schemas

---

### Request & Response Behavior

**Request validation**: `POST` and `PUT` bodies are validated against the `input` schema. Invalid bodies return `400` with an `error` message and Zod `issues` array.

**Response validation**: `200` responses are validated against the `output` schema. Validation failures are logged but the response is still sent (the schema acts as a development-time warning, not a gate).

**CORS**: All responses include `Access-Control-Allow-Origin`. `OPTIONS` requests are handled automatically with a `204` and appropriate headers allowing `GET`, `HEAD`, `PUT`, `POST`, `DELETE` methods and `Authorization`, `Content-Type` headers.

**Security headers**: All responses include `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: default-src 'self'`. Custom headers from the handler are preserved and take precedence.

**Content types**: Responses default to `application/json`. Handlers can override this via the `headers` return value — when `Content-Type` is not `application/json`, the body is sent as-is without JSON serialization.

**Errors**: Unhandled exceptions return `500` and are reported to Sentry. Authentication failures return `401`.

**404**: Unmatched routes return an empty `404` response.

---

## Testing Utilities

Two-stroke exports testing utilities from `two-stroke/test` designed for use with Vitest and `@cloudflare/vitest-pool-workers`.

### `setupTests<Paths>()`

Initializes the test environment. Call once per test file. Returns:

| Property                            | Type                                              | Description                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`                               | `URL`                                             | Base URL (`https://example.com/`).                                                                                                                       |
| `fetchMock`                         | `MockAgent`                                       | Cloudflare's fetch mock (from `cloudflare:test`). Activated with `disableNetConnect()` in `beforeAll`.                                                   |
| `client`                            | `Client<Paths>`                                   | An `openapi-fetch` client pointed at the worker, typed with the `Paths` generic (typically generated from the OpenAPI spec).                             |
| `waitForQueue(trigger)`             | `(trigger: () => Promise<void>) => Promise<void>` | Triggers an action and waits until the queue batch finishes processing.                                                                                  |
| `fakeJWK(issuer, audience, claims)` | `(issuer, audience, claims) => Promise<string>`   | Generates an RS256-signed JWT for testing. Automatically mocks the OIDC discovery and JWKS endpoints on the issuer URL. Returns the signed token string. |

```typescript
import { setupTests } from "two-stroke/test";
import type { paths } from "./api";

const { client, fetchMock, fakeJWK, waitForQueue } = await setupTests<paths>();

describe("GET /hello", () => {
  it("returns a greeting", async () => {
    const { data, response } = await client.GET("/hello");
    expect(response.status).toBe(200);
    expect(data?.message).toBe("Hello, World!");
  });
});
```

### `recordRequest(cb, statusCode, data, responseOptions?)`

Creates a fetch mock reply handler that captures the JSON request body and returns a fixed response. Useful for intercepting outgoing API calls.

```typescript
let captured: unknown;
fetchMock
  .get("https://api.example.com")
  .intercept({ method: "POST", path: "/webhook" })
  .reply(
    recordRequest(
      (data) => {
        captured = data;
      },
      200,
      { ok: true },
    ),
  );
```

### `recordFormRequest(cb, statusCode, data, responseOptions?)`

Same as `recordRequest` but parses the body as `application/x-www-form-urlencoded`.

### `recordFirehoseRequest(cb, statusCode, data, responseOptions?)`

Same as `recordRequest` but also decodes and parses a base64-encoded `Record.Data` field from the JSON body (for AWS Firehose-style payloads). Calls `cb` twice: once with the raw body and once with the decoded inner payload.

---

## CLI Commands

Two-stroke provides executable bin scripts. In consuming projects, these are available directly as commands (e.g. `npx dev`, `npx test`). For framework development, run them with `pnpm`:

### `dev`

Starts a local development server via `wrangler dev`.

### `test`

Builds the worker with `wrangler deploy --dry-run`, generates TypeScript types from the OpenAPI spec into `test/api.d.ts`, then runs `vitest`. Passes all arguments through to vitest (e.g. `test --watch`, `test src/users.test.ts`).

### `lint`

Runs `eslint --cache --max-warnings=0` followed by `prettier --cache --check .`. Fails on any violation.

### `format`

Runs `eslint --cache --fix` followed by `prettier --cache --write .`.

### `type-check`

Runs `wrangler deploy --dry-run --outdir=dist` followed by `tsc --noEmit`.

### `deploy <env> <version>`

Deploys the worker to a Cloudflare environment with Sentry release tracking:

1. Writes the version to `src/release.ts`
2. Uploads secrets via `wrangler secret bulk`
3. Creates and finalizes a Sentry release
4. Runs `wrangler deploy`
5. Uploads sourcemaps to Sentry

### `api-types <urls>`

Generates TypeScript type definitions from live OpenAPI endpoints. Accepts a comma-separated list of service URLs. Fetches `/doc` from each, converts to TypeScript via `openapi-typescript`, and writes definition files to `src/__definitions__/`.

### `bulk <entry|rest> <entryfile>`

Uploads files from `dist/` to a Cloudflare KV namespace. Used for serving static assets.

- `bulk entry index.html` — uploads only the entry file (with `nocache` cache control)
- `bulk rest index.html` — uploads everything except the entry file (with immutable cache control)

Requires `NAMESPACE` and `DOMAIN` environment variables.

## License

MIT
