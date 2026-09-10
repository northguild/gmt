/// <reference types="vitest/globals" />

import {
  devCookieHeader,
  isDevRequest,
  readCookie,
  signDevToken,
  verifyDevToken,
} from "./dev-access";

const SECRET = "correct-horse-battery-staple";
const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);

describe("signDevToken / verifyDevToken", () => {
  it("accepts a token it just signed", async () => {
    const token = await signDevToken(SECRET, NOW);
    expect(await verifyDevToken(SECRET, token, NOW)).toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signDevToken(SECRET, NOW);
    expect(await verifyDevToken("wrong-secret", token, NOW)).toBe(false);
  });

  it("rejects a tampered expiry", async () => {
    // The expiry is inside the signed payload precisely so this cannot work:
    // extending the deadline invalidates the signature.
    const token = await signDevToken(SECRET, NOW);
    const [, signature] = token.split(".");
    const forged = `${NOW + 10 ** 12}.${signature}`;
    expect(await verifyDevToken(SECRET, forged, NOW)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const token = await signDevToken(SECRET, NOW);
    const [expiry, signature] = token.split(".");
    const flipped = signature.startsWith("0")
      ? `1${signature.slice(1)}`
      : `0${signature.slice(1)}`;
    expect(await verifyDevToken(SECRET, `${expiry}.${flipped}`, NOW)).toBe(
      false,
    );
  });

  it("rejects an expired token", async () => {
    const token = await signDevToken(SECRET, NOW);
    const wayLater = NOW + 1000 * 60 * 60 * 24 * 365;
    expect(await verifyDevToken(SECRET, token, wayLater)).toBe(false);
  });

  it("rejects junk without throwing", async () => {
    for (const junk of ["", "nonsense", ".", "123.", "123.zz", "1.2.3"]) {
      expect(await verifyDevToken(SECRET, junk, NOW)).toBe(false);
    }
  });
});

describe("readCookie", () => {
  it("finds a cookie among others", () => {
    const request = new Request("https://x.test/", {
      headers: { cookie: "a=1; dox_dev=token-here; b=2" },
    });
    expect(readCookie(request, "dox_dev")).toBe("token-here");
  });

  it("returns undefined when absent", () => {
    const request = new Request("https://x.test/");
    expect(readCookie(request, "dox_dev")).toBeUndefined();
  });

  it("keeps a value containing '='", () => {
    const request = new Request("https://x.test/", {
      headers: { cookie: "dox_dev=12345.abc=def" },
    });
    expect(readCookie(request, "dox_dev")).toBe("12345.abc=def");
  });
});

describe("devCookieHeader", () => {
  it("is HttpOnly so no script on the page can read it", () => {
    expect(devCookieHeader("t", true)).toContain("HttpOnly");
  });

  it("is Secure in production and not on plain-http localhost", () => {
    expect(devCookieHeader("t", true)).toContain("Secure");
    expect(devCookieHeader("t", false)).not.toContain("Secure");
  });
});

describe("isDevRequest", () => {
  it("is false when no secret is configured, whatever the cookie says", async () => {
    const request = new Request("https://x.test/", {
      headers: { cookie: "dox_dev=anything" },
    });
    expect(await isDevRequest(request, undefined, NOW)).toBe(false);
  });

  it("is true for a validly signed cookie", async () => {
    const token = await signDevToken(SECRET, NOW);
    const request = new Request("https://x.test/", {
      headers: { cookie: `dox_dev=${token}` },
    });
    expect(await isDevRequest(request, SECRET, NOW)).toBe(true);
  });
});
