import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { builtPage, footerDate, sitemapLastmod } from "./sitemap-lastmod";

const DATE = "2026-10-19T05:35:38.000Z";
const dated = `<main><time datetime="2020-01-01T00:00:00.000Z">x</time></main><footer class="sl-flex"><div class="meta"><p>Last updated: <time datetime="${DATE}">Oct 19, 2026</time></p></div></footer>`;
const undated = `<main>body</main><footer class="sl-flex"><div class="meta"></div></footer>`;

let out = "";

function page(path: string, html: string) {
  mkdirSync(join(out, path), { recursive: true });
  writeFileSync(join(out, path, "index.html"), html);
}

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), "sitemap-lastmod-"));
  page("", dated);
  page("install", undated);
  page("guides/a", dated);
});

afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

describe("footerDate", () => {
  it("reads the time in the footer, not one in the body", () => {
    expect(footerDate(dated)).toBe(DATE);
  });

  it("is undefined for a footer without a date, or a page without a footer", () => {
    expect(footerDate(undated)).toBeUndefined();
    expect(footerDate(`<time datetime="${DATE}">x</time>`)).toBeUndefined();
  });
});

describe("builtPage", () => {
  it("maps a sitemap URL to its built file", () => {
    expect(builtPage(out, "https://northguild.dev/gmt/")).toBe(
      join(out, "index.html"),
    );
    expect(builtPage(out, "https://northguild.dev/gmt/guides/a/")).toBe(
      join(out, "guides", "a", "index.html"),
    );
  });

  it("is undefined outside the base or without a file", () => {
    expect(builtPage(out, "https://northguild.dev/")).toBeUndefined();
    expect(builtPage(out, "https://northguild.dev/gmtx/")).toBeUndefined();
    expect(
      builtPage(out, "https://northguild.dev/gmt/missing/"),
    ).toBeUndefined();
  });
});

describe("sitemapLastmod", () => {
  it("sets lastmod to the footer date", () => {
    expect(
      sitemapLastmod(out, { url: "https://northguild.dev/gmt/guides/a/" }),
    ).toEqual({ url: "https://northguild.dev/gmt/guides/a/", lastmod: DATE });
  });

  it("sets none for a page without a footer date, and drops one it was given", () => {
    expect(
      sitemapLastmod(out, {
        url: "https://northguild.dev/gmt/install/",
        lastmod: "2020-01-01",
      }),
    ).toEqual({ url: "https://northguild.dev/gmt/install/" });
  });
});
