import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  importsNodeBuiltin,
  listTestFiles,
  mockTargets,
  needsIsolation,
  staticImportGraph,
} from "./isolationGroups";

const packageDir = path.resolve(import.meta.dirname, "../..");
// Vitest's own bin, not `npx`: the same way scripts/stats.mjs starts it.
const vitestPackage = createRequire(import.meta.url).resolve(
  "vitest/package.json",
);
const vitestBin = path.join(
  path.dirname(vitestPackage),
  JSON.parse(readFileSync(vitestPackage, "utf8")).bin.vitest,
);

describe("needsIsolation", () => {
  it.each`
    call
    ${'vi.mock("./x");'}
    ${'vi.doMock("./x", () => ({}));'}
    ${'vi.stubGlobal("Intl", {});'}
    ${'vi.stubEnv("TZ", "UTC");'}
  `("selects a file that calls $call", ({ call }) => {
    expect(needsIsolation(`it("a", () => { ${call} });`)).toBe(true);
  });

  it.each`
    source
    ${'vi.spyOn(Intl, "DateTimeFormat");'}
    ${"vi.useFakeTimers(); vi.setSystemTime(0);"}
    ${"vi.fn();"}
  `("leaves a file that only has $source in the shared group", ({ source }) => {
    expect(needsIsolation(source)).toBe(false);
  });
});

describe("the projects Vitest builds from the config", () => {
  // Vitest itself lists which project holds each file. Starting it and reading about 900 files are
  // the slow steps, so they run once for all the tests below.
  const membership = new Map<string, string[]>();
  const replacesModules = new Map<string, boolean>();
  beforeAll(() => {
    const listing = execFileSync(
      process.execPath,
      [vitestBin, "list", "--filesOnly"],
      { cwd: packageDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    for (const line of listing.split("\n")) {
      const match = /^\[(\w+)\] (.+\.test\.ts)$/.exec(line.trim());
      if (!match) continue;
      membership.set(match[2], [...(membership.get(match[2]) ?? []), match[1]]);
    }
    for (const file of membership.keys()) {
      const source = readFileSync(path.join(packageDir, file), "utf8");
      replacesModules.set(file, needsIsolation(source));
    }
  }, 120_000);

  it("holds every test file of the package in exactly one project", () => {
    const wrong = [...membership].filter(
      ([, projects]) => projects.length !== 1,
    );
    expect(wrong).toEqual([]);
    expect([...membership.keys()].sort()).toEqual(listTestFiles(packageDir));
  });

  it("puts a file in the isolated project exactly when its source replaces a module or a global", () => {
    const wrong = [...membership]
      .filter(
        ([file, [project]]) =>
          (project === "isolated") !== replacesModules.get(file),
      )
      .map(([file]) => file);
    expect(wrong).toEqual([]);
  });

  it("sends a file known to call vi.mock to the isolated project and a plain one to the shared project", () => {
    expect(
      membership.get("src/transport/calculate/cutoffSchedule.test.ts"),
    ).toEqual(["isolated"]);
    expect(membership.get("src/test/titleGuard.test.ts")).toEqual(["shared"]);
  });
});

describe("importsNodeBuiltin", () => {
  it.each`
    source
    ${'import { execFileSync } from "node:child_process";'}
    ${"import path from 'node:path';"}
    ${'const { tmpdir } = await import("node:os");'}
  `("selects a file with $source", ({ source }) => {
    expect(importsNodeBuiltin(source)).toBe(true);
  });

  it.each`
    source
    ${'import { Temporal } from "../internal/temporal";'}
    ${'// a comment that names "node:fs" without importing it'}
    ${'import type { Stats } from "node:fs";'}
  `("leaves out a file with only $source", ({ source }) => {
    expect(importsNodeBuiltin(source)).toBe(false);
  });
});

describe("mockTargets", () => {
  const testFile = path.join(packageDir, "src/plain/compare/isPast.test.ts");

  it.each`
    call                                                         | target
    ${'vi.mock("../../internal/resolveLocale", { spy: true });'} | ${"src/internal/resolveLocale.ts"}
    ${"vi.doMock('./isFuture', () => ({}));"}                    | ${"src/plain/compare/isFuture.ts"}
    ${'vi.mock("../../zoned/get")'}                              | ${"src/zoned/get/index.ts"}
  `("resolves $call to $target", ({ call, target }) => {
    expect(mockTargets(testFile, call)).toEqual([
      path.join(packageDir, target),
    ]);
  });

  it.each`
    call
    ${'vi.mock("node:fs");'}
    ${'vi.mock("./noSuchModule");'}
  `("leaves out $call, which names no source file", ({ call }) => {
    expect(mockTargets(testFile, call)).toEqual([]);
  });
});

describe("staticImportGraph", () => {
  const setupFile = path.join(packageDir, "src/test/setupTests.ts");
  const graph = staticImportGraph(setupFile);

  it("holds the setup file and the modules it imports at the top", () => {
    expect(graph.has(setupFile)).toBe(true);
    expect(graph.has(path.join(packageDir, "src/internal/temporal.ts"))).toBe(
      true,
    );
  });

  // `beforeEach` imports these after the test file has loaded and its `vi.mock` calls are in place.
  it("leaves out a module the setup file imports only inside a hook", () => {
    expect(
      graph.has(path.join(packageDir, "src/internal/formatterCache.ts")),
    ).toBe(false);
  });

  // A browser page loads the setup file before the test file, so `vi.mock` cannot replace a module
  // the setup file already loaded: the import stays the real function and `vi.mocked(fn)` has no
  // `mockReturnValue`. Node gives each isolated file a fresh module graph and never shows it.
  it("holds no module a test file replaces with vi.mock", () => {
    const clashes = listTestFiles(packageDir).flatMap((file) => {
      const absolute = path.join(packageDir, file);
      return mockTargets(absolute, readFileSync(absolute, "utf8"))
        .filter((target) => graph.has(target))
        .map((target) => `${file} -> ${path.relative(packageDir, target)}`);
    });
    expect(clashes).toEqual([]);
  });
});
