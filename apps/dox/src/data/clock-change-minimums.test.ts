import { describe, expect, it } from "vitest";
import { CANADA_MINIMUMS } from "./canada-runtime-minimums";
import {
  minimumsCardHtml,
  minimumsMarkdown,
  type MinimumsText,
} from "./clock-change-minimums";
import { MOROCCO_MINIMUMS } from "./morocco-runtime-minimums";

const cards: [string, MinimumsText][] = [
  ["Canada", CANADA_MINIMUMS],
  ["Morocco", MOROCCO_MINIMUMS],
];

describe.each(cards)("the %s Upgrade to at least card", (_name, text) => {
  it("gives every row with a version an https source", () => {
    for (const row of text.rows) {
      if (!row.parts.some((p) => typeof p !== "string")) continue;
      expect(row.sources.length, row.name).toBeGreaterThan(0);
      for (const source of row.sources) {
        expect(source.href, `${row.name}: ${source.label}`).toMatch(
          /^https:\/\/\S+$/,
        );
      }
    }
  });
  it("carries no future tense, stale-row wording or statute", () => {
    const all = [
      text.heading,
      text.intro,
      text.footer,
      text.note,
      ...text.rows.flatMap((row) => [
        row.name,
        ...row.parts.map((p) => (typeof p === "string" ? p : p.code)),
        ...row.sources.map((s) => s.label),
      ]),
    ];
    for (const line of all) {
      expect(line).not.toMatch(
        /\bwill\b|not fixed|not yet|coming soon|statute/i,
      );
    }
  });
  it("renders every source into the Markdown, which ends with the note", () => {
    const md = minimumsMarkdown(text);
    for (const row of text.rows) {
      for (const source of row.sources) expect(md).toContain(source.href);
    }
    expect(md.trimEnd().endsWith(text.note)).toBe(true);
  });
  it("renders the card with the shared classes, a heading id and every row", () => {
    const html = minimumsCardHtml("x", text);
    expect(html).toContain('class="gmt-clockcheck-minimums"');
    expect(html).toContain('aria-labelledby="x-minimums-title"');
    expect(html).toContain('id="x-minimums-title"');
    expect(html).toContain('class="gmt-clockcheck-minimums-list"');
    expect(html).toContain('class="gmt-clockcheck-minimums-note"');
    expect(html.match(/<li>/g)).toHaveLength(text.rows.length);
  });
});

describe("the Morocco card", () => {
  it("names tz data 2026c", () => {
    expect(MOROCCO_MINIMUMS.intro).toContain("2026c");
  });
  it("lists the runtimes the research found, and the Windows row", () => {
    const names = MOROCCO_MINIMUMS.rows.map((row) => row.name);
    expect(names).toContain("Windows");
    expect(names).not.toContain("Mac and iPhone");
    const openjdk = MOROCCO_MINIMUMS.rows.find((r) => r.name === "OpenJDK");
    expect(JSON.stringify(openjdk?.parts)).toContain("27.0.1");
  });
});
