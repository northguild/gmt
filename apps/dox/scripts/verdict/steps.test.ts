import { CHECKS } from "../../../../scripts/lib/affected.mjs";
import {
  plan,
  skippedLine,
  validateChecks,
} from "../../../../scripts/verdict.mjs";

/**
 * Slice 2 of #396: where the steps come from and what they are called.
 */

describe("validate runs the checks `pnpm run validate` runs", () => {
  const twoOfThree = {
    header: "3 changed files against origin/main (merge base 0123456789)",
    run: [
      { id: "deps", run: "node scripts/deps.mjs check" },
      { id: "build:gmt", run: "pnpm --filter @northguild/gmt run build" },
    ],
    skipped: ["test:gmt"],
  };

  it("makes one step per check, labelled with its id", () => {
    const run = plan(["validate"], () => twoOfThree);
    expect(run.dir).toBe("validate");
    expect(run.steps).toEqual([
      { command: "node scripts/deps.mjs check", label: "deps" },
      {
        command: "pnpm --filter @northguild/gmt run build",
        label: "build:gmt",
      },
    ]);
    expect(run.skipped).toEqual(["test:gmt"]);
    expect(run.title).toBe(
      "verdict validate for 3 changed files against origin/main (merge base 0123456789)",
    );
  });

  it("passes --full and --base to the plan", () => {
    const seen: unknown[] = [];
    const record = (opts: unknown) => (seen.push(opts), twoOfThree);
    expect(plan(["validate", "--full"], record).title).toBe(
      "verdict validate --full",
    );
    plan(["validate", "--base", "v1.2.0"], record);
    expect(seen).toEqual([{ full: true }, { base: "v1.2.0" }]);
  });

  it("with --full, runs every check CI does not keep to itself, in order", () => {
    const { run, skipped } = validateChecks({ full: true });
    expect(run.map((check) => check.id)).toEqual(
      CHECKS.filter((check) => check.local !== false).map((check) => check.id),
    );
    expect(run.map((check) => check.id)).not.toContain("dox-dist");
    expect(skipped).toEqual([]);
  });

  it("names the skipped checks under the screen, and says nothing when none were", () => {
    expect(skippedLine(["stats", "test:gmt"])).toBe(
      "skipped: stats, test:gmt (nothing they read changed; --full runs every check)",
    );
    expect(skippedLine([])).toBeNull();
  });
});

describe("the other two commands", () => {
  it("run <filter> <script> -- args becomes one pnpm --filter step", () => {
    const run = plan(["run", "@northguild/gmt", "test", "--", "src/plain"]);
    expect(run.steps).toEqual([
      {
        command: "pnpm --filter @northguild/gmt run test src/plain",
        label: "test",
        script: "test",
      },
    ]);
    expect(run.dir).toBe("northguild-gmt-test");
    expect(run.title).toBe("verdict run @northguild/gmt test -- src/plain");
  });

  it("never logs into `.verdict` itself", () => {
    expect(plan(["run", "@", "."]).dir).toBe("run");
  });

  it("quotes an argument the shell would split", () => {
    const run = plan(["run", "dox", "test", "--", "-t", "a b"]);
    expect(run.steps?.[0].command).toBe("pnpm --filter dox run test -t 'a b'");
  });

  it("all <script> runs it in every package that has it", () => {
    const run = plan(["all", "lint"]);
    expect(run.steps).toEqual([
      {
        command: "pnpm -r --if-present run lint",
        label: "lint",
        script: "lint",
      },
    ]);
    expect(run.dir).toBe("all-lint");
  });

  it("answers anything else with the usage text", () => {
    for (const args of [
      [],
      ["bogus"],
      ["run", "dox"],
      ["all"],
      ["validate", "extra"],
      ["validate", "--base"],
    ]) {
      expect(plan(args).error).toContain("usage:");
    }
  });
});
