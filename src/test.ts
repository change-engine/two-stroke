import fs from "fs";
import { JWTPayload, SignJWT, exportJWK, generateKeyPair } from "jose";
import { Miniflare, createFetchMock } from "miniflare";
import nodefs from "node:fs/promises";
import path from "node:path";
import createClient from "openapi-fetch";
import consumers from "stream/consumers";
import toml from "toml";
import { URLSearchParams } from "url";
import { Env } from "./types";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const setupTests = async <Paths extends {}>(bindings: Env) => {
  const fetchMock = createFetchMock();
  fetchMock.disableNetConnect();

  const config = toml.parse(fs.readFileSync("wrangler.toml", "utf8")) as {
    compatibility_date: string;
    compatibility_flags: string[];
    queues?: {
      consumers?: { queue: string }[];
      producers?: { queue: string; binding: string }[];
    };
    r2_buckets?: { binding: string }[];
    kv_namespaces?: { binding: string }[];
    d1_databases?: { binding: string }[];
    services?: { binding: string; service: string }[];
    durable_objects?: { bindings?: { name: string; class_name: string }[] };
  };

  const miniflare = new Miniflare({
    modules: true,
    scriptPath: "dist/index.js",
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    bindings: {
      TOKEN_HASH:
        "djAxlhzT1IU9QIP3UKdipECQPAGGoPQK86/GnTBcbHLtPC3ni6JkTQ/iIeF0KG0y1CZ+J+9W",
      ...bindings,
    },
    queueConsumers: (config.queues?.consumers ?? []).map(({ queue }) => queue),
    queueProducers: Object.fromEntries(
      (config.queues?.producers ?? []).map(({ binding, queue: queueName }) => [
        binding,
        { queueName },
      ]),
    ),
    r2Buckets: (config.r2_buckets ?? []).map(({ binding }) => binding),
    kvNamespaces: (config.kv_namespaces ?? []).map(({ binding }) => binding),
    d1Databases: (config.d1_databases ?? []).map(({ binding }) => binding),
    serviceBindings: Object.fromEntries(
      (config.services ?? []).map(({ binding, service }) => [binding, service]),
    ),
    fetchMock,
    durableObjects: Object.fromEntries(
      (config.durable_objects?.bindings ?? []).map(({ name, class_name }) => [
        name,
        class_name,
      ]),
    ),
  });

  const url = await miniflare.ready;

  // Hack until miniflare supports auto running D1 migrations.
  // Note: Each migration file can contain only a single statement.
  await Promise.all(
    (config.d1_databases ?? []).map(
      async ({ binding }: { binding: string }) => {
        const d1 = await miniflare.getD1Database(binding);

        const migrationsDir = "./migrations";
        let fileNames: string[] = [];
        try {
          fileNames = await nodefs.readdir(migrationsDir);
        } catch (error) {
          console.log("Error loading migrations", error);
        }

        if (fileNames.length === 0)
          console.log("No migrations found in ./migrations");

        for (const migrationName of fileNames.sort((a, b) => {
          const migrationNumberA = parseInt(a.split("_")[0]!);
          const migrationNumberB = parseInt(b.split("_")[0]!);
          if (migrationNumberA < migrationNumberB) {
            return -1;
          }
          if (migrationNumberA > migrationNumberB) {
            return 1;
          }

          // numbers must be equal
          return 0;
        })) {
          const migrationPath = path.join(migrationsDir, migrationName);
          let migration = await nodefs.readFile(migrationPath, "utf8");
          // Remove migration comment
          migration = migration.split("\n").slice(1).join(" ");
          await d1.exec(migration);
        }
      },
    ),
  );

  const client = createClient<Paths>({ baseUrl: url.toString() });

  return {
    url,
    miniflare,
    fetchMock,
    client,
    async waitForQueue(trigger: () => Promise<void>) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const log: any[] = [];
      const orig = console.log;
      console.log = function (message) {
        orig(message);
        log.push(message);
      };
      await trigger();
      await waitUntil(() => expect(log).contains("Queue batch finished"));
      console.log = orig;
    },
    async fakeJWK(issuer: string, audience: string, claims: JWTPayload) {
      const { publicKey, privateKey } = await generateKeyPair("RS256");
      const jwk = await exportJWK(publicKey);
      jwk.kid = "test";
      jwk.alg = "RS256";
      fetchMock
        .get(bindings[issuer] as string)
        .intercept({ method: "GET", path: "/.well-known/openid-configuration" })
        .reply(
          200,
          {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            jwks_uri: `${bindings[issuer]}/.well-known/jwks`,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
        .persist();
      fetchMock
        .get(bindings[issuer] as string)
        .intercept({ method: "GET", path: "/.well-known/jwks" })
        .reply(
          200,
          {
            keys: [jwk],
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
        .persist();
      return await new SignJWT(claims)
        .setProtectedHeader({ typ: "JWT", alg: "RS256", kid: jwk.kid })
        .setIssuedAt()
        .setNotBefore("5 minutes ago")
        .setIssuer(bindings[issuer] as string)
        .setAudience([bindings[audience] as string])
        .setExpirationTime("1h")
        .sign(privateKey);
    },
  };
};

async function waitUntil(condition: () => void, time = 100) {
  try {
    condition();
    return;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, time));
    await waitUntil(condition, time);
  }
}

export function recordRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (data: any) => void,
  statusCode: number,
  data: string | object | Buffer | undefined,
  responseOptions?: {
    headers: Record<string, string | string[] | undefined>;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ body }: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    void consumers.json(body).then(cb);
    return { statusCode, data, responseOptions };
  };
}

export function recordFormRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (data: any) => void,
  statusCode: number,
  data: string | object | Buffer | undefined,
  responseOptions?: {
    headers: Record<string, string | string[] | undefined>;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ body }: any) => {
    void consumers
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .text(body)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-shadow
      .then((data: any) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        cb(Object.fromEntries(new URLSearchParams(data).entries())),
      );
    return { statusCode, data, responseOptions };
  };
}

export function recordFirehoseRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (data: any) => void,
  statusCode: number,
  data: string | object | Buffer | undefined,
  responseOptions?: {
    headers: Record<string, string | string[] | undefined>;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ body }: any) => {
    void consumers
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .json(body)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-shadow, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      .then((data: any) => cb(JSON.parse(atob(data["Record"]["Data"]))));
    return { statusCode, data, responseOptions };
  };
}
