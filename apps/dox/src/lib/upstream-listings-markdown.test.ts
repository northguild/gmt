import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listings } from "../data/upstream-filings";
import { stripMdx } from "./page-markdown";

/**
 * The Markdown twin of `/upstream/` (`.md`, `llms-full.txt`, retrieval chunks) carries the
 * "Beyond Temporal" section: the heading from the MDX and a table row for each listing.
 */
const source = readFileSync(
  resolve(import.meta.dirname, "../content/docs/upstream.mdx"),
  "utf8",
);
const twin = stripMdx(source.replace(/^---[\s\S]*?---\n/, ""), {});

describe("the /upstream/ twin", () => {
  it("has the Beyond Temporal heading", () => {
    expect(twin).toMatch(/^## Beyond Temporal$/m);
  });

  it("has a table row for every listing, including You-Dont-Need-Momentjs#159", () => {
    expect(twin).toContain("you-dont-need/You-Dont-Need-Momentjs#159");
    for (const l of listings) {
      expect(twin).toContain(`[${l.repo}#${l.number}](${l.url})`);
    }
    expect(twin).not.toContain("<UpstreamListings");
  });
});
