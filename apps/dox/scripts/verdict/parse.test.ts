import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  countPassedTests,
  emptyRunProblem,
  failureLines,
  formatCount,
  normalizeLines,
  parseLog,
  stripAnsi,
} from "../../../../scripts/lib/verdict-parse.mjs";

/**
 * Slice 2 of #396: the parsers. The fixtures are real logs, captured from deliberate breaks that
 * were reverted straight after; each one's first line names the command. Every expected string is
 * written out here, never read back from the module.
 */

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixture = (name: string): string =>
  readFileSync(join(FIXTURES, name), "utf8");

describe("vitest 5", () => {
  it("names the project, the test, the first error line and the first location", () => {
    const parsed = parseLog(fixture("vitest-fail.log"));
    expect(parsed.tool).toBe("vitest");
    expect(parsed.failures).toEqual([
      {
        head: "dox  scripts/verdict/scratch-fail.test.ts > select > maps a widget file to its page",
        lines: [
          "AssertionError: expected [] to deeply equal [ '/tools/dst-inspector/' ]",
          "❯ scripts/verdict/scratch-fail.test.ts:3:16",
        ],
      },
      {
        head: "dox  scripts/verdict/scratch-fail.test.ts > select > second failing",
        lines: [
          "AssertionError: expected 1 to be 2 // Object.is equality",
          "❯ scripts/verdict/scratch-fail.test.ts:6:15",
        ],
      },
    ]);
  });

  it("lists failures in two projects, each under its own project", () => {
    const log = [
      "Test Files  2 failed (2)",
      " FAIL  |dox| a.test.ts > one",
      "Error: boom",
      " ❯ a.test.ts:1:2",
      " FAIL  |gmt-node| b.test.ts > two",
      "Error: bang",
      " ❯ b.test.ts:3:4",
    ].join("\n");
    expect(parseLog(log).failures.map((f) => f.head)).toEqual([
      "dox  a.test.ts > one",
      "gmt-node  b.test.ts > two",
    ]);
  });

  it("falls back to the tail when the summary shows no failing test", () => {
    const parsed = parseLog("Test Files  1 passed (1)\nUnhandled error: x");
    expect(parsed.tool).toBe("generic");
    expect(parsed.tail).toEqual([
      "Test Files  1 passed (1)",
      "Unhandled error: x",
    ]);
  });

  it("counts passed tests, summed over every Tests line", () => {
    const log = [
      " Test Files  3 passed (3)",
      "      Tests  36412 passed | 12 skipped (36424)",
      "apps/dox test:       Tests  102 passed (102)",
    ].join("\n");
    expect(countPassedTests(log)).toBe(36514);
    expect(countPassedTests("nothing here")).toBe(0);
  });

  it("formats a count with thousands separators", () => {
    expect(formatCount(36412)).toBe("36,412");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1000000)).toBe("1,000,000");
  });
});

describe("tsc", () => {
  it("gives file:line, the code and the message", () => {
    const parsed = parseLog(fixture("tsc-fail.log"));
    expect(parsed.tool).toBe("tsc");
    expect(parsed.failures).toEqual([
      {
        head: "src/scratch-verdict.ts:1",
        lines: ["TS2322 Type 'string' is not assignable to type 'number'."],
      },
    ]);
  });
});

describe("astro check", () => {
  it("gives file:line and the message, after stripping the ANSI codes Astro keeps", () => {
    const text = fixture("astro-check-fail.log");
    expect(text).toContain("\u001b[");
    const parsed = parseLog(text);
    expect(parsed.tool).toBe("astro-check");
    expect(parsed.failures).toEqual([
      {
        head: "src/components/ScratchVerdict.astro:2",
        lines: ["Type 'string' is not assignable to type 'number'."],
      },
    ]);
  });

  it("ignores warnings and hints", () => {
    const text = fixture("astro-check-fail.log");
    expect(text).toContain("warning");
    expect(parseLog(text).failures).toHaveLength(1);
  });
});

describe("oxlint", () => {
  it("reads the graphical frame: file:line, the rule and the message", () => {
    const parsed = parseLog(fixture("oxlint-fail.log"));
    expect(parsed.tool).toBe("oxlint");
    expect(parsed.failures).toEqual([
      {
        head: "src/lib/scratch-verdict.ts:2",
        lines: ["eslint(no-debugger): `debugger` statement is not allowed"],
      },
    ]);
  });

  it("reads the one-line format oxlint prints when an agent runs it", () => {
    const parsed = parseLog(fixture("oxlint-agent-fail.log"));
    expect(parsed.tool).toBe("oxlint");
    expect(parsed.failures).toEqual([
      {
        head: "src/lib/scratch-verdict.ts:2",
        lines: ["eslint(no-debugger): `debugger` statement is not allowed"],
      },
    ]);
  });

  it("does not count a warning as a failure", () => {
    const log =
      "\n  ! eslint(no-unused-vars): unused\n   ,-[src/a.ts:1:1]\n 1 | x\n   `----\n";
    expect(parseLog(log).failures).toEqual([]);
  });
});

describe("the generic tail", () => {
  it("shows the last 15 non-empty lines of a log no parser knows", () => {
    const log = Array.from({ length: 30 }, (_, i) =>
      i % 5 === 4 ? "" : `line ${i + 1}`,
    ).join("\n");
    const parsed = parseLog(log);
    expect(parsed.tool).toBe("generic");
    expect(parsed.failures).toEqual([]);
    expect(parsed.tail).toHaveLength(15);
    expect(parsed.tail.at(-1)).toBe("line 29");
    expect(parsed.tail[0]).toBe("line 12");
    expect(parsed.tail).not.toContain("");
  });

  it("shows pnpm's own message when the package has no such script", () => {
    const parsed = parseLog(fixture("generic-fail.log"));
    expect(parsed.tool).toBe("generic");
    expect(parsed.tail).toHaveLength(15);
    expect(parsed.tail).toContain("Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL");
  });
});

describe("the pnpm -r prefix and ANSI codes", () => {
  it("strips `<dir> <script>: ` and keeps the directory for tsc", () => {
    const log = [
      "packages/gmt-oxlint typecheck$ tsc --noEmit",
      "packages/gmt-oxlint typecheck: src/a.ts(3,4): error TS2322: bad type",
    ].join("\n");
    expect(normalizeLines(log).lines[1]).toBe(
      "src/a.ts(3,4): error TS2322: bad type",
    );
    expect(parseLog(log).failures).toEqual([
      { head: "packages/gmt-oxlint/src/a.ts:3", lines: ["TS2322 bad type"] },
    ]);
  });

  it("does not mistake a tsc line for a prefix", () => {
    expect(normalizeLines("src/a.ts(3,4): error TS2322: bad").lines[0]).toBe(
      "src/a.ts(3,4): error TS2322: bad",
    );
  });

  it("reads a vitest failure behind the prefix", () => {
    const log = [
      "apps/dox test:  Test Files  1 failed (1)",
      "apps/dox test:  FAIL  |dox| a.test.ts > x",
      "apps/dox test: Error: nope",
      "apps/dox test:  ❯ a.test.ts:9:9",
    ].join("\n");
    expect(parseLog(log).failures).toEqual([
      { head: "dox  a.test.ts > x", lines: ["Error: nope", "❯ a.test.ts:9:9"] },
    ]);
  });

  it("strips ANSI codes before parsing", () => {
    expect(stripAnsi("\u001b[96ma.ts\u001b[0m:\u001b[93m2\u001b[0m")).toBe(
      "a.ts:2",
    );
    const log = "\u001b[31msrc/a.ts(1,1): error TS1005: x\u001b[0m";
    expect(parseLog(log).failures[0].head).toBe("src/a.ts:1");
  });
});

describe("failureLines", () => {
  const many = {
    tool: "tsc",
    tail: [] as string[],
    failures: Array.from({ length: 8 }, (_, i) => ({
      head: `f${i + 1}.ts:1`,
      lines: [`TS1 m${i + 1}`],
    })),
  };

  it("caps at 5 failures and says how many more the log holds", () => {
    const lines = failureLines(many, {
      logPath: ".verdict/validate/11-typecheck.log",
    });
    expect(lines).toEqual([
      "f1.ts:1",
      "  TS1 m1",
      "f2.ts:1",
      "  TS1 m2",
      "f3.ts:1",
      "  TS1 m3",
      "f4.ts:1",
      "  TS1 m4",
      "f5.ts:1",
      "  TS1 m5",
      "3 more in .verdict/validate/11-typecheck.log",
    ]);
  });

  it("prints no 'more' line when everything fits", () => {
    const lines = failureLines(
      { ...many, failures: many.failures.slice(0, 5) },
      { logPath: "x" },
    );
    expect(lines).toHaveLength(10);
  });

  it("prints the tail, never nothing, for an unparsed log", () => {
    expect(
      failureLines(
        { tool: "generic", failures: [], tail: ["a", "b "] },
        { logPath: "x" },
      ),
    ).toEqual(["a", "b"]);
  });

  it("clips a very long line", () => {
    const [line] = failureLines(
      { tool: "generic", failures: [], tail: ["x".repeat(500)] },
      { logPath: "x" },
    );
    expect(line).toHaveLength(140);
    expect(line.endsWith("…")).toBe(true);
  });
});

describe("a run that measured nothing", () => {
  it("fails a filter that matches no package, with pnpm's own message", () => {
    const log = [
      "Scope: 0 of 6 workspace projects",
      'No projects matched the filters in "/abs/repo"',
    ].join("\n");
    expect(emptyRunProblem(log, "test")).toBe(
      "No projects matched the filters",
    );
  });

  it("fails `-r --if-present` when no package has the script", () => {
    expect(
      emptyRunProblem("Scope: 5 of 6 workspace projects\n", "no-such-script"),
    ).toBe("no package ran no-such-script");
  });

  it("passes a run in which a script ran", () => {
    expect(
      emptyRunProblem("Scope: 5 of 6 workspace projects\n$ oxlint\n", "lint"),
    ).toBeNull();
    expect(emptyRunProblem("packages/gmt lint$ oxlint\n", "lint")).toBeNull();
  });
});
