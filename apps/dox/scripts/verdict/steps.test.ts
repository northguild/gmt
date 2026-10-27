import {
  plan,
  stepLabel,
  stepsFromChain,
} from "../../../../scripts/verdict.mjs";

/**
 * Slice 2 of #396: where the steps come from and what they are called.
 */

describe("steps come from the validate string", () => {
  it("turns a three-step chain into three labelled steps", () => {
    expect(
      stepsFromChain(
        "node scripts/deps.mjs check && pnpm -r --if-present run build && pnpm dox:docs-check",
      ),
    ).toEqual([
      { command: "node scripts/deps.mjs check", label: "deps check" },
      { command: "pnpm -r --if-present run build", label: "build" },
      { command: "pnpm dox:docs-check", label: "dox:docs-check" },
    ]);
  });

  it("builds `validate` from scripts.validate in package.json and nowhere else", () => {
    const chain = "node scripts/a.mjs check && node scripts/new-step.mjs go";
    const run = plan(["validate"], { scripts: { validate: chain } });
    expect(run.dir).toBe("validate");
    expect(run.steps?.map((step) => step.label)).toEqual([
      "a check",
      "new-step go",
    ]);
  });

  it("refuses to validate without scripts.validate", () => {
    expect(plan(["validate"], { scripts: {} }).error).toBe(
      "verdict: package.json has no scripts.validate",
    );
  });
});

describe("labels", () => {
  it.each([
    ["node scripts/deps.mjs check", "deps check"],
    [
      "node scripts/temporal-compat.mjs snapshot --check",
      "temporal-compat snapshot --check",
    ],
    ["node scripts/stats.mjs", "stats"],
    ["pnpm -r --if-present run lint", "lint"],
    ["pnpm run test", "test"],
    ["pnpm --filter dox run test", "test"],
    ["pnpm dox:docs-check", "dox:docs-check"],
    ["echo hi", "echo hi"],
  ])("%s -> %s", (command, label) => {
    expect(stepLabel(command)).toBe(label);
  });
});

describe("the other two commands", () => {
  it("run <filter> <script> -- args becomes one pnpm --filter step", () => {
    const run = plan(
      ["run", "@northguild/gmt", "test", "--", "src/plain"],
      null,
    );
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

  it("quotes an argument the shell would split", () => {
    const run = plan(["run", "dox", "test", "--", "-t", "a b"], null);
    expect(run.steps?.[0].command).toBe("pnpm --filter dox run test -t 'a b'");
  });

  it("all <script> runs it in every package that has it", () => {
    const run = plan(["all", "lint"], null);
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
    ]) {
      expect(plan(args, null).error).toContain("usage:");
    }
  });
});
