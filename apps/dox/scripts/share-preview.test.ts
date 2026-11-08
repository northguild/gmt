import { readdirSync, readFileSync, existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { imageHash } from "../src/lib/og-image-version";
import { SITE_CARD_LINE } from "../src/lib/og-cards";
import { SITE_URL } from "../src/lib/site";
import { attributesOf } from "./build-utils/head-tags-scan";
import { distDirOrSkip as distRootOrSkip } from "./dist-dir";

/**
 * The share tags of every indexable built page, read off `dist/gmt`: one each of the locale, the
 * image with its type, size and alt, the Twitter image with its alt and the card type; both image
 * URLs the same, absolute and versioned with the hash of the PNG in `dist`; and an alt that
 * describes the card the page shows.
 *
 * Needs a build; each test returns early without one and throws under `DOX_DIST_REQUIRED`.
 */

type Meta = { key: string; content: string };

type Page = {
  file: string;
  /** Every share tag, by `property` or `name`, in document order. */
  tags: Meta[];
};

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

const SHARE_TAG = /^(?:og:|twitter:)/;

/** The pages to check: every built page that can be indexed. */
function sharePages(dist: string): Page[] {
  return htmlFiles(dist).flatMap((path) => {
    const html = readFileSync(path, "utf8");
    if (/http-equiv=["']refresh["']/i.test(html)) return [];
    const metas = [
      ...html.matchAll(/<meta\b(?:"[^"]*"|'[^']*'|[^>"'])*>/g),
    ].map((m) => attributesOf(m[0]));
    if (
      metas.some(
        (attrs) =>
          attrs.name === "robots" && /noindex/i.test(attrs.content ?? ""),
      )
    ) {
      return [];
    }
    const tags = metas.flatMap((attrs) => {
      const key = attrs.property ?? attrs.name;
      return key !== undefined &&
        SHARE_TAG.test(key) &&
        attrs.content !== undefined
        ? [{ key, content: attrs.content }]
        : [];
    });
    return [{ file: relative(dist, path).split("\\").join("/"), tags }];
  });
}

function valuesOf(page: Page, key: string): string[] {
  return page.tags.filter((t) => t.key === key).map((t) => t.content);
}

const ALT =
  /^(?:GMT share card|Share card): "(.+)" over the Earth seen from above the North Atlantic\.$/;

const IMAGE_URL = new RegExp(
  `^${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/og/(.+\\.png)\\?v=([0-9a-f]{12})$`,
);

function report(failures: string[]): string {
  const shown = failures.slice(0, 15).join("\n  ");
  const more =
    failures.length > 15 ? `\n  ... and ${failures.length - 15} more` : "";
  return `${failures.length} failure(s):\n  ${shown}${more}`;
}

describe("share tags of the built site", () => {
  it("gives every indexable page one of each share tag, with the values the platforms read", () => {
    const root = distRootOrSkip();
    if (root === null) return;
    const pages = sharePages(resolve(root, "gmt"));
    expect(pages.length).toBeGreaterThan(100);
    const expected: Array<[string, string | undefined]> = [
      ["og:locale", "en_US"],
      ["og:image:type", "image/png"],
      ["og:image", undefined],
      ["og:image:width", "1200"],
      ["og:image:height", "630"],
      ["og:image:alt", undefined],
      ["twitter:image", undefined],
      ["twitter:image:alt", undefined],
      ["twitter:card", "summary_large_image"],
    ];
    const failures: string[] = [];
    for (const page of pages) {
      for (const [key, value] of expected) {
        const found = valuesOf(page, key);
        if (found.length !== 1) {
          failures.push(`${page.file}: ${found.length} ${key} tag(s)`);
        } else if (value !== undefined && found[0] !== value) {
          failures.push(
            `${page.file}: ${key} is "${found[0]}", not "${value}"`,
          );
        }
      }
    }
    expect(failures, report(failures)).toEqual([]);
  });

  it("gives both images the same absolute URL, versioned with the hash of the PNG in dist", () => {
    const root = distRootOrSkip();
    if (root === null) return;
    const dist = resolve(root, "gmt");
    const failures: string[] = [];
    for (const page of sharePages(dist)) {
      const [og] = valuesOf(page, "og:image");
      const [twitter] = valuesOf(page, "twitter:image");
      if (og !== twitter) {
        failures.push(
          `${page.file}: og:image ${og} and twitter:image ${twitter}`,
        );
        continue;
      }
      const match = IMAGE_URL.exec(og ?? "");
      if (!match) {
        failures.push(
          `${page.file}: ${og} is not ${SITE_URL}/og/….png?v=<hash>`,
        );
        continue;
      }
      const png = resolve(dist, "og", match[1]);
      if (!existsSync(png)) {
        failures.push(`${page.file}: ${og} is not in dist`);
      } else if (imageHash(readFileSync(png)) !== match[2]) {
        failures.push(
          `${page.file}: ${og} is not the hash of the file in dist`,
        );
      }
    }
    expect(failures, report(failures)).toEqual([]);
  });

  it("gives every page an alt that describes its card and quotes the card's own title", () => {
    const root = distRootOrSkip();
    if (root === null) return;
    const failures: string[] = [];
    for (const page of sharePages(resolve(root, "gmt"))) {
      const [alt] = valuesOf(page, "og:image:alt");
      const [twitterAlt] = valuesOf(page, "twitter:image:alt");
      const [title] = valuesOf(page, "og:title");
      if (alt !== twitterAlt) {
        failures.push(`${page.file}: the two alts differ`);
      }
      if (alt === title)
        failures.push(`${page.file}: the alt is the page title`);
      if ((alt ?? "").length >= 420) {
        failures.push(`${page.file}: the alt is ${alt?.length} characters`);
      }
      const match = ALT.exec(alt ?? "");
      if (!match) {
        failures.push(
          `${page.file}: the alt "${alt}" does not describe a card`,
        );
        continue;
      }
      const [image] = valuesOf(page, "og:image");
      const key = IMAGE_URL.exec(image ?? "")?.[1]?.replace(/\.png$/, "");
      const quoted = match[1];
      const site = key === "site";
      if (site !== alt?.startsWith("GMT share card:")) {
        failures.push(
          `${page.file}: the alt's wording does not fit card ${key}`,
        );
      }
      if (site && quoted !== SITE_CARD_LINE) {
        failures.push(`${page.file}: the site card's alt quotes "${quoted}"`);
      }
      if (
        key?.startsWith("reference/") &&
        quoted !== `API reference: ${key.slice("reference/".length)}`
      ) {
        failures.push(
          `${page.file}: the alt quotes "${quoted}" for card ${key}`,
        );
      }
    }
    expect(failures, report(failures)).toEqual([]);
  });
});
