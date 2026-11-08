import { describe, expect, it } from "vitest";

import { distTestFiles, isDistTest } from "./dist-tests.mjs";

describe("isDistTest", () => {
  it.each([
    [
      "sibling import",
      "a.test.ts",
      'import { distDirOrSkip } from "./dist-dir";',
    ],
    [
      "renamed import",
      "a.test.ts",
      'import { distDirOrSkip as d } from "./dist-dir";',
    ],
    [
      "parent folder",
      "a.test.ts",
      "import { distDirOrSkip } from '../dist-dir';",
    ],
    [
      "deep path",
      "a.test.ts",
      'import { distDirOrSkip } from "../../scripts/dist-dir";',
    ],
    [
      "with extension",
      "a.test.ts",
      'import { distDirOrSkip } from "./dist-dir.ts";',
    ],
  ])(
    "counts a Node test that imports dist-dir (%s)",
    (_label, name, source) => {
      expect(isDistTest(name, source)).toBe(true);
    },
  );

  it.each([
    [
      "browser test",
      "a.browser.test.ts",
      'import { distDirOrSkip } from "./dist-dir";',
    ],
    ["not a test", "dist-dir.ts", 'import { existsSync } from "node:fs";'],
    ["other helper", "a.test.ts", 'import { x } from "./dist-dirs";'],
    ["no import", "a.test.ts", "const distDir = 'dist-dir';"],
  ])(
    "leaves out a file that is not a built-site Node test (%s)",
    (_label, name, source) => {
      expect(isDistTest(name, source)).toBe(false);
    },
  );
});

describe("distTestFiles", () => {
  // The six the hand-kept CI list named and the five it missed. A new
  // built-site test needs no entry here; the rule finds it.
  it("finds the known built-site tests and no browser test", () => {
    const files = distTestFiles();
    expect(files.some((file) => file.endsWith(".browser.test.ts"))).toBe(false);
    expect(files).toEqual(
      expect.arrayContaining([
        "scripts/data-credits-built.test.ts",
        "scripts/display-font-built.test.ts",
        "scripts/dist-base.test.ts",
        "scripts/gates/registry.test.ts",
        "scripts/head-tags.test.ts",
        "scripts/header-built.test.ts",
        "scripts/llms.test.ts",
        "scripts/select-options.test.ts",
        "scripts/share-preview.test.ts",
        "scripts/sidebar-reach.test.ts",
        "scripts/upstream-built.test.ts",
      ]),
    );
  });
});
