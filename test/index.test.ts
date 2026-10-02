import {
  createExecutionContext,
  createMessageBatch,
  createScheduledController,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { HttpResponse, http } from "msw";
import app, { cronRuns, queueResults } from "../src/fake";
import { setupTests } from "../src/test";

const { msw, fakeJWK } = await setupTests();
const token = await fakeJWK("TOKEN_ISSUER", "TOKEN_AUDIENCE", { sub: "user-1" });

const request = async (path: string, init?: RequestInit) =>
  await exports.default.fetch(new Request(`https://example.com${path}`, init));

describe("routing", () => {
  it("GET with path params", async () => {
    const response = await request("/hello/two%20stroke");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.json()).resolves.toStrictEqual({ hello: "two stroke" });
  });

  it("hEAD is served by GET without a body", async () => {
    const response = await request("/hello/world", { method: "HEAD" });
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("");
  });

  it("unknown route is 404", async () => {
    const response = await request("/nope");
    expect(response.status).toBe(404);
  });

  it("oPTIONS returns CORS preflight", async () => {
    const response = await request("/hello/world", { method: "OPTIONS" });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET,HEAD,PUT,POST,DELETE");
  });

  it("GET /doc serves OpenAPI", async () => {
    const response = await request("/doc");
    expect(response.status).toBe(200);
    const doc = await response.json<{ openapi: string; paths: Record<string, unknown> }>();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toContain("/hello/{name}");
  });
});

describe("body validation", () => {
  it("valid JSON body", async () => {
    const response = await request("/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi" }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ message: "hi" });
  });

  it("form encoded body", async () => {
    const response = await request("/echo", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "message=hi",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ message: "hi" });
  });

  it("missing body is 400", async () => {
    const response = await request("/echo", { method: "POST" });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Request body is required" });
  });

  it("invalid body is 400", async () => {
    const response = await request("/echo", {
      method: "POST",
      body: JSON.stringify({ message: 1 }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Request body schema invalid" });
  });
});

describe("auth", () => {
  it("pbkdf accepts the right token", async () => {
    const response = await request("/pbkdf", { headers: { Authorization: "Bearer secret" } });
    expect(response.status).toBe(200);
  });

  it("pbkdf rejects the wrong token", async () => {
    const response = await request("/pbkdf", { headers: { Authorization: "Bearer wrong" } });
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("jwt passes claims to the handler", async () => {
    const response = await request("/jwt", { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ sub: "user-1" });
  });

  it("jwt rejects a missing token", async () => {
    const response = await request("/jwt");
    expect(response.status).toBe(401);
  });
});

describe("sentry", () => {
  it("unhandled error is 500 and reported", async () => {
    const envelopes: string[] = [];
    msw.use(
      http.post("https://sentry.example.com/api/1/envelope/", async ({ request: req }) => {
        envelopes.push(await req.text());
        return HttpResponse.json({});
      }),
    );
    const response = await request("/error");
    expect(response.status).toBe(500);
    await vi.waitFor(() => expect(envelopes.join("\n")).toContain("Boom"));
  });
});

describe("queue", () => {
  it("parses each message", async () => {
    const batch = createMessageBatch("queue", [
      { id: "1", timestamp: new Date(), attempts: 1, body: { n: 1 } },
      { id: "2", timestamp: new Date(), attempts: 1, body: { n: "x" } },
    ]);
    const ctx = createExecutionContext();
    await app.queue(batch, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(queueResults).toStrictEqual([true, false]);
  });
});

describe("scheduled", () => {
  it("runs the matching cron handler", async () => {
    const ctx = createExecutionContext();
    await app.scheduled(createScheduledController({ cron: "0 * * * *" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(cronRuns).toStrictEqual(["0 * * * *"]);
  });
});
