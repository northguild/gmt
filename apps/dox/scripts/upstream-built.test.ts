import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { distDirOrSkip } from "./dist-dir";

/**
 * The built `/upstream/` page shows no raw backtick. Filing titles, summaries and notes mark code
 * with backticks, as GitHub titles do; the page renders those spans as `<code>`, and only the
 * text surfaces (`.md`, `llms-full.txt`) keep the backticks as Markdown. Needs a build; returns
 * early without one and throws under `DOX_DIST_REQUIRED`.
 */
describe("the built /upstream/ page", () => {
  it("renders backtick-marked code as <code>, leaving no raw backtick in its text", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const html = readFileSync(
      resolve(dist, "gmt", "upstream", "index.html"),
      "utf8",
    );
    const main = html.slice(html.indexOf("<main"), html.lastIndexOf("</main>"));
    const visible = main
      .replace(/<(script|style|pre|code)\b[\s\S]*?<\/\1>/g, "")
      .replace(/<[^>]*>/g, "\n");
    const raw = visible.split("\n").filter((text) => text.includes("`"));
    expect(raw).toEqual([]);
  });
});
