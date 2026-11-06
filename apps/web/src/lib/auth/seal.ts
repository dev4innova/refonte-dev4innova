import { EncryptJWT, jwtDecrypt } from "jose";

/*
 * Authenticated encryption (JWE, A256GCM) of small server-side payloads stored in cookies:
 * the browser can neither read nor forge them.
 */

async function keyFrom(secret: string): Promise<Uint8Array> {
  if (secret.length < 32) throw new Error("AUTH_SESSION_SECRET must be at least 32 characters");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return new Uint8Array(digest);
}

export async function seal(
  payload: Record<string, unknown>,
  secret: string,
  maxAgeSeconds: number,
): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .encrypt(await keyFrom(secret));
}

/** Returns the payload, or null if the value is missing, tampered with or expired. */
export async function unseal<T>(value: string | undefined, secret: string): Promise<T | null> {
  if (!value) return null;
  try {
    const { payload } = await jwtDecrypt(value, await keyFrom(secret));
    return payload as T;
  } catch {
    return null;
  }
}
