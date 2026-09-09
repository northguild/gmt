/// <reference types="vitest/globals" />

/**
 * GMT never constructs a native `Date` — apps/dox's `oxlint` config lists
 * `apps/**\/*.ts` for the gmt-oxlint plugin, but doesn't actually catch these
 * (the plugin's relative path resolution appears to be CWD-sensitive when
 * oxlint runs from apps/dox), so this is a source-text scan standing in as
 * the enforcement until that's fixed.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const DATE_BAN = /\bnew\s+Date\b|\bDate\.(now|UTC|parse)\b/;

// agent-prompt.ts's AGENT_PROMPT is a string literal *telling* a coding
// agent never to use `new Date()` — the phrase appears as prompt copy, not
// as executable code, so it's exempt from the scan rather than a violation.
const EXEMPT = new Set(["agent-prompt.ts"]);

function sourceFiles(): string[] {
  return readdirSync(LIB_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .filter((name) => !EXEMPT.has(name));
}

describe("Date ban (src/lib)", () => {
  for (const file of sourceFiles()) {
    it(`${file} never constructs a native Date`, () => {
      const text = readFileSync(join(LIB_DIR, file), "utf8");
      expect(text).not.toMatch(DATE_BAN);
    });
  }

  it("scanned at least the known widget/library modules", () => {
    expect(sourceFiles()).toContain("dst-inspector.ts");
    expect(sourceFiles()).toContain("multi-zone-scrubber.ts");
  });
});
