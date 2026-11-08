import { describe, expect, it } from "vitest";
import { imageHash, versionImageUrls } from "./og-image-version";

const SITE = "https://northguild.dev/gmt";

const page = (image: string) =>
  [
    "<!doctype html><html><head>",
    '<meta charset="utf-8"><title>T</title>',
    `<meta property="og:image" content="${image}">`,
    '<meta property="og:image:alt" content="Share card">',
    `<meta name="twitter:image" content="${image}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    "</head><body>  <p>x</p>\n</body></html>",
  ].join("\n");

const hashes: Record<string, string> = {
  "site.png": "aaaaaaaaaaaa",
  "reference/zoned.png": "bbbbbbbbbbbb",
};
const hashOf = (path: string) => hashes[path];

describe("versionImageUrls", () => {
  it("adds the hash to og:image and twitter:image", () => {
    const out = versionImageUrls(
      page(`${SITE}/og/reference/zoned.png`),
      SITE,
      hashOf,
    );
    expect(out).toBe(page(`${SITE}/og/reference/zoned.png?v=bbbbbbbbbbbb`));
    expect(out).toContain(
      '<meta property="og:image:alt" content="Share card">',
    );
  });

  it("leaves a page without share images byte-identical", () => {
    const html = "<html><head><title>404</title></head><body></body></html>\n";
    expect(versionImageUrls(html, SITE, hashOf)).toBe(html);
  });

  it("throws on a PNG that is not in the build", () => {
    expect(() =>
      versionImageUrls(page(`${SITE}/og/guides/missing.png`), SITE, hashOf),
    ).toThrow(/not in the build/);
  });

  it("throws on a URL outside the site's og folder", () => {
    expect(() =>
      versionImageUrls(page("https://example.com/x.png"), SITE, hashOf),
    ).toThrow(/not a PNG under/);
  });

  it("throws on a URL that already has a version", () => {
    expect(() =>
      versionImageUrls(
        page(`${SITE}/og/site.png?v=aaaaaaaaaaaa`),
        SITE,
        hashOf,
      ),
    ).toThrow(/not a PNG under/);
  });
});

describe("imageHash", () => {
  it("is the first 12 hex digits of the SHA-256", () => {
    expect(imageHash(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01");
  });
});
