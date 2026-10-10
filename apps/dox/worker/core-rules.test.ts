import { describe, expect, it } from "vitest";

import { CORE_RULES_CONTENT } from "./core-rules";

/**
 * The text the chat's system prompt carries for the library's core rules: the
 * whole of `worker/core-rules.md`, which the Worker owns. This test pins it
 * byte for byte, so an edit to that file is a deliberate change to the prompt
 * and is made here too.
 */
const EXPECTED = [
  "| Rule                    | Current behavior                                                                   |",
  "| ----------------------- | ---------------------------------------------------------------------------------- |",
  "| String-first API        | Public helpers consume ISO strings and return normalized strings where appropriate |",
  "| Temporal-only internals | `Temporal` does the parsing and timezone math                                      |",
  "| Plain/zoned separation  | `plain/*` is timezone-free, `zoned/*` is timezone-aware                            |",
  "| No-throw public helpers | Invalid input returns a typed fallback instead of throwing                         |",
  "",
  "Invalid input fallbacks are consistent across the library:",
  "",
  '- string-returning helpers return `""`',
  "- number-returning helpers return `null`",
  "- boolean-returning helpers return `false`",
  "- array-returning helpers return `[]`",
].join("\n");

describe("CORE_RULES_CONTENT", () => {
  it("is byte-identical to the pinned core-rules text", () => {
    expect(CORE_RULES_CONTENT).toBe(EXPECTED);
  });

  it("is not empty and names the four rules", () => {
    expect(CORE_RULES_CONTENT.length).toBeGreaterThan(0);
    for (const rule of [
      "String-first API",
      "Temporal-only internals",
      "Plain/zoned separation",
      "No-throw public helpers",
    ]) {
      expect(CORE_RULES_CONTENT).toContain(rule);
    }
  });

  it("names all four sentinels", () => {
    for (const sentinel of ['`""`', "`null`", "`false`", "`[]`"]) {
      expect(CORE_RULES_CONTENT).toContain(sentinel);
    }
  });
});
