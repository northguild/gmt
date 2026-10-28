import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendStepSummary } from "./step-summary.mjs";

const scratch = () =>
  path.join(mkdtempSync(path.join(tmpdir(), "gates-summary-")), "summary.md");

describe("appendStepSummary", () => {
  it("appends the screen in a fenced text block when GITHUB_STEP_SUMMARY is set", () => {
    const file = scratch();
    writeFileSync(file, "earlier step\n");
    const wrote = appendStepSummary("gates: FAIL  1 of 5 failed\n", {
      GITHUB_STEP_SUMMARY: file,
    });
    expect(wrote).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(
      "earlier step\n```text\ngates: FAIL  1 of 5 failed\n```\n",
    );
  });

  it("writes nothing and reports false when the variable is unset", () => {
    expect(appendStepSummary("gates: PASS", {})).toBe(false);
  });

  it("does not throw when the summary file cannot be written", () => {
    const dir = path.dirname(scratch());
    expect(appendStepSummary("gates: PASS", { GITHUB_STEP_SUMMARY: dir })).toBe(
      false,
    );
  });
});
