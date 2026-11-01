import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = {
  google: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
  microsoft: createRemoteJWKSet(new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"))
};

export async function verifierIdToken(token, provider, clientId) {
  const issuers = {
    google: "https://accounts.google.com",
    microsoft: "https://login.microsoftonline.com/common/v2.0"
  };

  const { payload } = await jwtVerify(token, JWKS[provider], {
    issuer: issuers[provider],
    audience: clientId,
    algorithms: ["RS256"]
  });

  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified ?? true,
    name: payload.name || payload.given_name || null
  };
}
