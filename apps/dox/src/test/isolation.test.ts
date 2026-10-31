import { globSync, readFileSync } from "node:fs";
import { createVitest } from "vitest/node";
import path from "node:path";
import { needsIsolation, splitTestFiles, TEST_GLOBS } from "./isolation";

const appDir = path.resolve(import.meta.dirname, "../..");

describe("needsIsolation", () => {
  it.each`
    call
    ${'vi.mock("./x");'}
    ${'vi.doMock("./x", () => ({}));'}
    ${'vi.stubGlobal("fetch", vi.fn());'}
    ${'vi.stubEnv("TZ", "UTC");'}
  `("selects a file that calls $call", ({ call }) => {
    expect(needsIsolation(`it("a", () => { ${call} });`)).toBe(true);
  });

  it.each`
    source
    ${'vi.spyOn(console, "warn");'}
    ${"vi.useFakeTimers(); vi.setSystemTime(0);"}
    ${"vi.fn();"}
  `("leaves a file that only has $source in the shared group", ({ source }) => {
    expect(needsIsolation(source)).toBe(false);
  });
});

describe("splitTestFiles", () => {
  it("puts every test file of the app in exactly one group", () => {
    const { isolated, shared } = splitTestFiles(appDir);
    // The config's own patterns are the oracle: Vitest expands them, the module walks directories.
    const all = TEST_GLOBS.flatMap((glob) => globSync(glob, { cwd: appDir }));
    expect([...isolated, ...shared].sort()).toEqual([...new Set(all)].sort());
    expect(isolated.filter((file) => shared.includes(file))).toEqual([]);
  });

  it("selects a file that stubs a global and leaves a plain one shared", () => {
    const { isolated, shared } = splitTestFiles(appDir);
    expect(isolated).toContain("src/lib/canada-probe-inline.test.ts");
    expect(shared).toContain("src/widgets/builders/button.test.ts");
  });
});

describe("the Vitest projects", () => {
  it("run each file in the project its source selects", async () => {
    const vitest = await createVitest("test", {
      root: appDir,
      watch: false,
      reporters: [],
    });
    try {
      const specs = await vitest.globTestSpecifications();
      const projectOf = new Map<string, string[]>();
      for (const spec of specs) {
        const file = path.relative(appDir, spec.moduleId);
        projectOf.set(file, [
          ...(projectOf.get(file) ?? []),
          spec.project.name,
        ]);
      }
      const wrong: string[] = [];
      for (const [file, projects] of projectOf) {
        const want = needsIsolation(
          readFileSync(path.join(appDir, file), "utf8"),
        )
          ? "isolated"
          : "shared";
        if (projects.length !== 1 || projects[0] !== want) {
          wrong.push(`${file}: ran in ${projects.join(", ")}, wanted ${want}`);
        }
      }
      expect(wrong).toEqual([]);
      expect(projectOf.size).toBe(
        splitTestFiles(appDir).isolated.length +
          splitTestFiles(appDir).shared.length,
      );
      expect(
        [...projectOf.values()].some(([name]) => name === "isolated"),
      ).toBe(true);
      expect([...projectOf.values()].some(([name]) => name === "shared")).toBe(
        true,
      );
    } finally {
      await vitest.close();
    }
  }, 60_000);
});
