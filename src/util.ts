import {
  type FlattenedJWSInput,
  type JSONWebKeySet,
  type JWSHeaderParameters,
  createLocalJWKSet,
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
} from "jose";

export async function pbkdfVerify(key: string, password: string) {
  return (
    [
      ...new Uint8Array(
        await crypto.subtle.deriveBits(
          {
            name: "PBKDF2",
            hash: "SHA-256",
            salt: new Uint8Array([...atob(key).slice(3, 19)].map((ch) => ch.charCodeAt(0))),
            iterations: parseInt(
              [...atob(key).slice(19, 22)].map((ch) => ch.charCodeAt(0).toString(16)).join(""),
              16,
            ),
          },
          await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(password),
            "PBKDF2",
            false,
            ["deriveBits"],
          ),
          256,
        ),
      ),
    ]
      .map((byte) => String.fromCharCode(byte))
      .join("") === atob(key).slice(22, 54)
  );
}

export async function jwkVerifyMulti<J>(
  token: string,
  issuers: Record<string, JSONWebKeySet | true>,
  audiences: string[],
) {
  const unverifiedClaims = decodeJwt(token);
  if (!unverifiedClaims.iss) throw new Error("Invalid");
  const issuer = issuers[unverifiedClaims.iss];
  if (!issuer) throw new Error("Invalid");

  let JWKS: (
    protectedHeader?: JWSHeaderParameters,
    token?: FlattenedJWSInput,
  ) => Promise<CryptoKey>;

  if (issuer === true) {
    // OIDC
    const oidcRequest = await fetch(
      `${unverifiedClaims.iss}${unverifiedClaims.iss.endsWith("/") ? "" : "/"}.well-known/openid-configuration`,
    );
    const oidc = await oidcRequest.json<{ jwks_uri: string }>();
    JWKS = createRemoteJWKSet(new URL(oidc.jwks_uri));
  } else {
    JWKS = createLocalJWKSet(issuer);
  }

  const claims = (
    await jwtVerify<J>(token ?? "", JWKS, {
      algorithms: ["RS256", "ES256"],
      audience: audiences,
    })
  ).payload;
  if (!claims) {
    throw new Error("Invalid");
  }
  return claims;
}
