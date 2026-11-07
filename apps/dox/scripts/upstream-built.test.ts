import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { distDirOrSkip } from "./dist-dir";

/**
 * The built `/upstream/` page. It shows no raw backtick. Filing titles, summaries and notes mark code
 * with backticks, as GitHub titles do; the page renders those spans as `<code>`, and only the
 * text surfaces (`.md`, `llms-full.txt`) keep the backticks as Markdown. And each card names its
 * kind in words: the state icon is hidden from assistive technology, and the state badge says
 * Open or Closed for an issue and a pull request alike. Needs a build; returns early without one
 * and throws under `DOX_DIST_REQUIRED`.
 */
function builtMain(): string | null {
  const dist = distDirOrSkip();
  if (dist === null) return null;
  const html = readFileSync(
    resolve(dist, "gmt", "upstream", "index.html"),
    "utf8",
  );
  return html.slice(html.indexOf("<main"), html.lastIndexOf("</main>"));
}

describe("the built /upstream/ page", () => {
  it("renders backtick-marked code as <code>, leaving no raw backtick in its text", () => {
    const main = builtMain();
    if (main === null) return;
    const visible = main
      .replace(/<(script|style|pre|code)\b[\s\S]*?<\/\1>/g, "")
      .replace(/<[^>]*>/g, "\n");
    const raw = visible.split("\n").filter((text) => text.includes("`"));
    expect(raw).toEqual([]);
  });

  it("names each card's kind in words, as a pull request or an issue", () => {
    const main = builtMain();
    if (main === null) return;
    const heads = [
      ...main.matchAll(/<td class="gmt-upstream-head"[^>]*>([\s\S]*?)<\/td>/g),
    ].map((m) => m[1]);
    expect(heads.length).toBeGreaterThan(0);
    for (const head of heads) {
      const kind =
        /<span class="gmt-sr-only"[^>]*>(Pull request|Issue):<\/span>/.exec(
          head,
        )?.[1];
      const isPr = /class="gmt-upstream-ref" href="[^"]*\/pull\/\d+"/.test(
        head,
      );
      expect(kind).toBe(isPr ? "Pull request" : "Issue");
    }
  });
});
