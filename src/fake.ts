import { z } from "zod/v4";
import { twoStroke } from ".";

const app = twoStroke<Env>("fake", "0.1");

app.get(app.noAuth, "/hello/{name}", z.object({ hello: z.string() }), async ({ params }) => ({
  body: { hello: params.name },
}));

app.post(
  app.noAuth,
  "/echo",
  z.object({ message: z.string() }),
  z.object({ message: z.string() }),
  async ({ body }) => ({ body }),
);

app.get(app.pbkdf("API_KEY"), "/pbkdf", z.object({ ok: z.boolean() }), async () => ({
  body: { ok: true },
}));

app.get(
  app.jwt<{ sub: string }>("TOKEN_ISSUER", "TOKEN_AUDIENCE"),
  "/jwt",
  z.object({ sub: z.string() }),
  async ({ claims }) => ({ body: { sub: claims.sub } }),
);

app.get(app.noAuth, "/error", z.object({}), async () => {
  throw new Error("Boom");
});

app.queueHandler(z.object({ n: z.number() }), async ({ parsedBatch }) => {
  queueResults.push(...parsedBatch.map((p) => p.success));
});

app.schedule("0 * * * *", async () => {
  cronRuns.push("0 * * * *");
});

export const queueResults: boolean[] = [];
export const cronRuns: string[] = [];

export default app;
