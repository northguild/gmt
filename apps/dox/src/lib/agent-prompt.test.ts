import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AGENT_PROMPT } from "./agent-prompt";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");

/** The text of every fenced code block in a Markdown file. */
function fencedBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const lines = markdown.split("\n");
  let open: { fence: string; body: string[] } | null = null;
  for (const line of lines) {
    if (open) {
      if (line.trim() === open.fence) {
        blocks.push(open.body.join("\n"));
        open = null;
      } else open.body.push(line);
      continue;
    }
    const match = /^\s*(`{3,}|~{3,})/.exec(line);
    if (match) open = { fence: match[1], body: [] };
  }
  return blocks;
}

// The same prompt is published in three places and nothing else keeps them in
// step with the copy button's text.
describe("AGENT_PROMPT", () => {
  it("appears verbatim in a fenced block of README.md, packages/gmt/README.md and CONTRIBUTING.md", () => {
    const missing = [
      "README.md",
      "packages/gmt/README.md",
      "CONTRIBUTING.md",
    ].filter((file) => {
      const markdown = readFileSync(path.join(repoRoot, file), "utf8");
      return !fencedBlocks(markdown).includes(AGENT_PROMPT.trimEnd());
    });
    expect(missing).toEqual([]);
  });
});
