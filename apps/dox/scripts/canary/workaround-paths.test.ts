import { readdirSync, readFileSync } from "node:fs";
import { join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { WORKAROUNDS } from "../../../../scripts/lib/workarounds.mjs";

const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const SEARCHED = ["packages/gmt/src", "scripts", "apps/dox/src"];
const README = join(ROOT, "packages/gmt/src/internal/temporalCompat/README.md");

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules") return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [relative(ROOT, path)];
  });
}

const FILES = SEARCHED.flatMap((directory) =>
  listFiles(join(ROOT, directory)),
).map((path) => path.split(sep).join("/"));

/**
 * The `.ts` and `.mjs` file names a block of removal text mentions, globs and placeholders aside.
 * A Markdown link `[name.ts](target.ts)` gives its label and its target, each on its own.
 */
function fileTokens(text: string): string[] {
  return text
    .split(/[\s`(),;]+/)
    .map((token) =>
      token.replace(/^[[\u0027"]+/, "").replace(/[.:\u0027"\])]+$/, ""),
    )
    .filter((token) => /\.(ts|mjs)$/.test(token) && !/[*<{]/.test(token));
}

/**
 * The file tokens in `texts` that no searched file's path equals or ends with. With `base`, the
 * directory of the file the text came from, a `./` or `../` token must resolve from it exactly.
 */
function missingPaths(texts: readonly string[], base?: string): string[] {
  return texts.flatMap(fileTokens).filter((token) => {
    if (base !== undefined && /^\.\.?\//.test(token)) {
      return !FILES.includes(normalize(join(base, token)).split(sep).join("/"));
    }
    return !FILES.some((file) => file === token || file.endsWith(`/${token}`));
  });
}

/** The README text from `## Removal steps` up to the next `## ` heading. */
function removalStepsSection(): string {
  const text = readFileSync(README, "utf8");
  const start = text.indexOf("## Removal steps");
  expect(start).toBeGreaterThan(-1);
  const next = text.indexOf("\n## ", start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

const ZONED_DIFFERENCE = "packages/gmt/src/internal/zonedDifference";
const MODULES = ["nudgeOrigin"];

/**
 * The text of the `Removal:` bullet in a module's header comment: from the `Removal:` line up to the
 * next header bullet, the blank line after it, or the end of the comment. Its leading ` * ` is removed.
 */
function headerRemoval(module: string): string {
  const lines = readFileSync(
    join(ROOT, ZONED_DIFFERENCE, `${module}.ts`),
    "utf8",
  ).split("\n");
  const start = lines.findIndex((line) => /^ \* {4}- Removal:/.test(line));
  const rest = lines.slice(start + 1);
  const length = rest.findIndex((line) => !/^ \* {6,}\S/.test(line));
  return [lines[start], ...rest.slice(0, length)]
    .map((line) => line.replace(/^ \*\s*(- )?/, ""))
    .join(" ");
}

/**
 * Every removal step names files that exist (CORE-105).
 *
 * A removal step that says "delete this file" is only useful while the file is where the step says.
 * The fixture rows pin what the extractor reads out of a step; the two real rows are the guard.
 */
describe("missing paths in removal steps", () => {
  it.each`
    steps                                                                | expected                                          | why
    ${["Delete internal/noSuchModule.ts and its call."]}                 | ${["internal/noSuchModule.ts"]}                   | ${"a path that no file ends with is reported"}
    ${["Run internal/zonedWallClock*.test.ts."]}                         | ${[]}                                             | ${"a glob is skipped"}
    ${["Delete probeRepros.ts."]}                                        | ${[]}                                             | ${"a basename resolves anywhere"}
    ${["See [probeRepros.ts](internal/temporalCompat/probeRepros.ts)."]} | ${[]}                                             | ${"a Markdown link resolves on its label and its target"}
    ${["See [noSuchModule.ts](nowhere/noSuchModule.ts)"]}                | ${["noSuchModule.ts", "nowhere/noSuchModule.ts"]} | ${"a Markdown link is read, not skipped, when it is missing"}
    ${["Delete 'probeRepros.ts', \"probeRepros.ts\"."]}                  | ${[]}                                             | ${"quotes around a name are stripped"}
  `("$why", ({ steps, expected }) => {
    expect(missingPaths(steps)).toEqual(expected);
  });

  it.each`
    text                              | expected                   | why
    ${"Delete ./operations.ts."}      | ${[]}                      | ${"a ./ token resolves from the file's own directory"}
    ${"Delete ../zonedWallClock.ts."} | ${[]}                      | ${"a ../ token resolves from the file's own directory"}
    ${"Delete ./zonedWallClock.ts."}  | ${["./zonedWallClock.ts"]} | ${"a ./ token naming a file in another directory is reported"}
    ${"Delete ../operations.ts."}     | ${["../operations.ts"]}    | ${"a ../ token naming a file in this directory is reported"}
  `("$why", ({ text, expected }) => {
    expect(missingPaths([text], `${ZONED_DIFFERENCE}`)).toEqual(expected);
  });

  it.each(MODULES)(
    "the %s header has a Removal text that names files",
    (module) => {
      expect(fileTokens(headerRemoval(module)).length).toBeGreaterThan(0);
    },
  );

  it("the removal steps in workarounds.mjs name at least one file", () => {
    expect(
      fileTokens(WORKAROUNDS.flatMap((w) => w.steps).join(" ")).length,
    ).toBeGreaterThan(0);
  });

  it("the README removal steps name at least one file", () => {
    expect(fileTokens(removalStepsSection()).length).toBeGreaterThan(0);
  });

  it("every removal step in workarounds.mjs names files that exist", () => {
    expect(
      missingPaths(WORKAROUNDS.flatMap((workaround) => workaround.steps)),
    ).toEqual([]);
  });

  it.each(MODULES)(
    "the Removal text in the zonedDifference/%s.ts header names files that exist",
    (module) => {
      expect(missingPaths([headerRemoval(module)], ZONED_DIFFERENCE)).toEqual(
        [],
      );
    },
  );

  it("every README removal step names files that exist", () => {
    expect(missingPaths([removalStepsSection()])).toEqual([]);
  });
});
