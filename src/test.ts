import { env, exports } from "cloudflare:workers";
import { type JWTPayload, SignJWT, exportJWK, generateKeyPair } from "jose";
import createClient from "openapi-fetch";
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/require-await
export const setupTests = async <Paths extends {}>() => {
  const url = new URL("https://example.com/");

  const client = createClient<Paths>({
    baseUrl: url.toString(),
    fetch: (...r) => exports.default.fetch(...r),
  });

  return {
    url,
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
    async fakeJWK(
      issuer: keyof typeof env,
      audience: keyof typeof env,
      claims: JWTPayload,
    ) {
      const { publicKey, privateKey } = await generateKeyPair("RS256");
      // Hack around Cloudflare not setting
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      publicKey[Symbol.toStringTag] = "CryptoKey";
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      privateKey[Symbol.toStringTag] = "CryptoKey";
      const jwk = await exportJWK(publicKey);
      jwk.kid = "test";
      jwk.alg = "RS256";
      beforeAll(() => {
        setupServer(...[
          http.get(`${env[issuer]}/.well-known/openid-configuration`, () =>
            HttpResponse.json({
              jwks_uri: `${env[issuer]}/.well-known/jwks`,
            })),
          http.get(`${env[issuer]}/.well-known/jwks`, () =>
            HttpResponse.json({
              keys: [jwk],
            }))
        ]).listen()
      });
      return await new SignJWT(claims)
        .setProtectedHeader({ typ: "JWT", alg: "RS256", kid: jwk.kid })
        .setIssuedAt()
        .setNotBefore("5 minutes ago")
        .setIssuer(env[issuer] as string)
        .setAudience([env[audience] as string])
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
  data: string | object | undefined,
  responseOptions?: {
    headers: Record<string, string | string[] | undefined>;
  },
) {
  return ({ body }: { body?: BodyInit }) => {
    cb(JSON.parse((body?.valueOf() as string) ?? ""));
    return { statusCode, data, responseOptions: responseOptions ?? {} };
  };
}

export function recordFormRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (data: any) => void,
  statusCode: number,
  data: string | object | undefined,
  responseOptions?: {
    headers: Record<string, string | string[] | undefined>;
  },
) {
  return ({ body }: { body?: BodyInit }) => {
    cb(
      Object.fromEntries(
        new URLSearchParams((body?.valueOf() as string) ?? "").entries(),
      ),
    );
    return { statusCode, data, responseOptions: responseOptions ?? {} };
  };
}

export function recordFirehoseRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (data: any) => void,
  statusCode: number,
  data: string | object | undefined,
  responseOptions?: {
    headers: Record<string, string | string[] | undefined>;
  },
) {
  return ({ body }: { body?: BodyInit }) => {
    cb(JSON.parse((body?.valueOf() as string) ?? ""));
    cb(
      JSON.parse(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        atob(JSON.parse((body?.valueOf() as string) ?? "")["Record"]["Data"]),
      ),
    );
    return { statusCode, data, responseOptions: responseOptions ?? {} };
  };
}
