import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  OG_SAFE_LEFT,
  OG_SAFE_RIGHT,
  drawCard,
  placeCard,
  titleForLayout,
  type OgBox,
} from "./og-art";
import { SITE_CARD_LINE, ogCards, type OgDocEntry } from "./og-cards";

const docsRoot = resolve("src/content/docs");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** The docs pages as Astro's collection reads them: the id is the `slug` or the path. */
function docs(): OgDocEntry[] {
  return walk(docsRoot)
    .filter((path) => /\.mdx?$/.test(path))
    .map((path) => {
      const front = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path, "utf8"));
      const data = (front ? parse(front[1]) : {}) as Record<string, unknown>;
      const rel = relative(docsRoot, path)
        .replace(/\.mdx?$/, "")
        .replace(/\/index$/, "");
      return {
        id: typeof data.slug === "string" ? data.slug : rel,
        data: { title: String(data.title ?? "") },
      };
    });
}

const cards = ogCards(docs());
const keys = Object.keys(cards);

const inside = (box: OgBox) =>
  box.x >= OG_SAFE_LEFT && box.x + box.width <= OG_SAFE_RIGHT;

describe("share card layout", () => {
  it("has a card for the site, the guides and every reference namespace", () => {
    expect(keys).toContain("site");
    expect(keys).toContain("guides/how-to/add-business-days");
    expect(keys).toContain("reference/intermodal");
    expect(keys.length).toBeGreaterThan(100);
  });

  it("keeps every card's text in the centre square, in two lines at most, uncut", async () => {
    const failures: string[] = [];
    for (const key of keys) {
      const placed = await placeCard(cards[key]);
      const { layout } = placed;
      placed.dispose();
      if (layout.titleLines > 2)
        failures.push(`${key}: title ${layout.titleLines} lines`);
      const boxes: [string, OgBox][] = [
        ["eyebrow", layout.eyebrow],
        ["title", layout.title],
      ];
      if (layout.kind === "site") {
        if (layout.lineLines > 2)
          failures.push(`${key}: line ${layout.lineLines} lines`);
        boxes.push(["line", layout.line]);
      }
      for (const [name, box] of boxes) {
        if (!inside(box))
          failures.push(
            `${key}: ${name} outside x ${OG_SAFE_LEFT}-${OG_SAFE_RIGHT}`,
          );
        if (box.y < 0 || box.y + box.height > 340)
          failures.push(`${key}: ${name} outside the sky`);
      }
      const text = JSON.stringify(cards[key]);
      if (text.includes("…")) failures.push(`${key}: text holds an ellipsis`);
    }
    expect(failures).toEqual([]);
  });

  it("gives the site card the hero's first sentence and every other card its title alone", () => {
    expect(cards.site).toEqual({ kind: "site", line: SITE_CARD_LINE });
    for (const key of keys.filter((k) => k !== "site")) {
      expect(Object.keys(cards[key]).sort()).toEqual(["kind", "title"]);
    }
  });

  it("keeps the site line the first sentence of the home hero's tagline", () => {
    const home = readFileSync(resolve(docsRoot, "index.mdx"), "utf8");
    const tagline = /^\s*tagline:\s*(.+)$/m.exec(home)?.[1];
    expect(tagline?.startsWith(SITE_CARD_LINE)).toBe(true);
  });

  it("breaks a title at a space, never after a hyphen", async () => {
    // The plugin changelog titles, the longest hyphenated names the cards carry.
    const names = ["eslint", "oxlint", "biome"].map((tool) =>
      ["gmt", tool].join("-"),
    );
    const titles = [
      ...names.flatMap((name) => [
        `Changelog: ${name}`,
        `Changelog ${name} 1.0`,
      ]),
      ...keys.flatMap((key) => {
        const card = cards[key];
        return card.kind === "page" && card.title.includes("-")
          ? [card.title]
          : [];
      }),
    ];
    const broken: string[] = [];
    for (const title of titles) {
      const placed = await placeCard({ kind: "page", title });
      const text = titleForLayout(title);
      const lines = placed.paragraphs.title.getLineMetrics();
      placed.dispose();
      for (const line of lines.slice(0, -1)) {
        if (
          text
            .slice(0, line.endExcludingWhitespaces)
            .replaceAll("\u2060", "")
            .endsWith("-")
        )
          broken.push(title);
      }
    }
    expect(broken).toEqual([]);
  });

  it("throws and never cuts when text cannot fit", async () => {
    await expect(
      placeCard({ kind: "site", line: "word ".repeat(60) }),
    ).rejects.toThrow(/does not fit/);
    await expect(
      placeCard({ kind: "page", title: "W".repeat(200) }),
    ).rejects.toThrow(/does not fit/);
  });
});

describe("share card contrast", () => {
  const sample = [
    "site",
    "guides/how-to/add-business-days",
    "reference/intermodal",
  ];
  it.each(sample)(
    "keeps %s's text at 4.5:1 or better over the sky",
    async (key) => {
      const { contrast } = await drawCard(cards[key]);
      expect(contrast.title).toBeGreaterThanOrEqual(4.5);
      if (contrast.line !== null)
        expect(contrast.line).toBeGreaterThanOrEqual(4.5);
      expect(contrast.eyebrow).toBeGreaterThanOrEqual(4.5);
    },
  );
});
