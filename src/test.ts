import { env, exports } from "cloudflare:workers";
import { type JWTPayload, SignJWT, exportJWK, generateKeyPair } from "jose";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import createClient from "openapi-fetch";

const msw = setupServer();
msw.listen();

export const setupTests = async <Paths extends {}>() => {
  const url = new URL("https://example.com/");

  const client = createClient<Paths>({
    baseUrl: url.toString(),
    fetch: (...r) => exports.default.fetch(...r),
  });

  return {
    url,
    client,
    msw,
    waitForQueue: async (trigger: () => Promise<void>) => {
      const log: any[] = [];
      const orig = console.log;
      console.log = (message) => {
        orig(message);
        log.push(message);
      };
      await trigger();
      await waitUntil(() => expect(log).contains("Queue batch finished"));
      console.log = orig;
    },
    fakeJWK: async (issuer: keyof typeof env, audience: keyof typeof env, claims: JWTPayload) => {
      const { publicKey, privateKey } = await generateKeyPair("RS256");
      // Hack around Cloudflare not setting
      // @ts-expect-error
      publicKey[Symbol.toStringTag] = "CryptoKey";
      // @ts-expect-error
      privateKey[Symbol.toStringTag] = "CryptoKey";
      const jwk = await exportJWK(publicKey);
      jwk.kid = "test";
      jwk.alg = "RS256";
      beforeAll(() => {
        msw.use(
          http.get(`${env[issuer]}/.well-known/openid-configuration`, () =>
            HttpResponse.json({
              jwks_uri: `${env[issuer]}/.well-known/jwks`,
            }),
          ),
          http.get(`${env[issuer]}/.well-known/jwks`, () =>
            HttpResponse.json({
              keys: [jwk],
            }),
          ),
        );
      });
      return await new SignJWT(claims)
        .setProtectedHeader({ typ: "JWT", alg: "RS256", kid: jwk.kid })
        .setIssuedAt()
        .setNotBefore("5 minutes ago")
        // oxlint-disable-next-line typescript/no-unnecessary-type-assertion
        .setIssuer(env[issuer] as string)
        // oxlint-disable-next-line typescript/no-unnecessary-type-assertion
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
