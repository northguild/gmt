/**
 * The dev bypass.
 *
 * ## What this actually grants, and what it cannot
 *
 * It exempts the holder from the per-visitor daily cap. It does **not** grant
 * more requests — on the free tier the pool is a fixed project-wide ceiling and
 * nothing in this Worker can raise it. A dev with the cookie and a visitor
 * without it are drawing on the same budget; the cookie only decides who is
 * allowed to keep drawing after ten. Saying otherwise in the UI would be a lie.
 *
 * ## Why a signed cookie and not an IP allowlist
 *
 * It has to work for the whole dev team, across machines, on mobile networks,
 * and without a per-person setup step. One shared secret plus an HMAC keeps the
 * secret off the page (the cookie carries a signature, never the key), survives
 * an IP change, and costs nothing to add a person to.
 *
 * The cookie is HttpOnly, so the client cannot read it — the browser sends it,
 * and `/api/brains` reports the resulting capability back. That keeps the
 * secret out of reach of any script on the page, including a compromised
 * dependency.
 */

/** Signed cookie name. */
export const DEV_COOKIE = "dox_dev";

/** How long a dev stays signed in before re-presenting the key. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** `<expiresAtMs>.<hmac>` — the expiry is in the signed payload, so a cookie
 * cannot be extended by editing it. */
export async function signDevToken(
  secret: string,
  nowMs: number,
): Promise<string> {
  const expiresAt = nowMs + COOKIE_MAX_AGE_SECONDS * 1000;
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(expiresAt)),
  );
  return `${expiresAt}.${toHex(signature)}`;
}

/**
 * Verify a token.
 *
 * Uses `crypto.subtle.verify` rather than comparing hex strings, so the
 * comparison is constant-time — a hand-rolled `===` on the signature would leak
 * timing information about how much of a forged signature was correct.
 */
export async function verifyDevToken(
  secret: string,
  token: string | undefined,
  nowMs: number,
): Promise<boolean> {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const expiresAtRaw = token.slice(0, separator);
  const signatureHex = token.slice(separator + 1);

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) return false;

  const bytes = signatureHex.match(/../g);
  if (!bytes || bytes.length !== 32) return false;

  const signature = new Uint8Array(
    bytes.map((byte) => Number.parseInt(byte, 16)),
  );
  if (signature.some(Number.isNaN)) return false;

  try {
    return await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      signature,
      new TextEncoder().encode(expiresAtRaw),
    );
  } catch {
    return false;
  }
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export function devCookieHeader(token: string, secure: boolean): string {
  return [
    `${DEV_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/** Is this request from someone holding a valid dev cookie? */
export async function isDevRequest(
  request: Request,
  secret: string | undefined,
  nowMs: number,
): Promise<boolean> {
  if (!secret) return false;
  return verifyDevToken(secret, readCookie(request, DEV_COOKIE), nowMs);
}
