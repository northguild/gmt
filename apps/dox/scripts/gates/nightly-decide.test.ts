import { describe, expect, it } from "vitest";
import { inputFromEnv, shouldRun, WEEKLY_CRON } from "./nightly-decide.mjs";

const base = {
  event: "schedule",
  schedule: "23 4 * * *",
  lastSha: "abc1234",
  changed: [] as string[] | null,
};

describe("shouldRun", () => {
  it("skips a daily run when nothing under apps/dox or the lockfile changed", () => {
    const r = shouldRun(base);
    expect(r.run).toBe(false);
    expect(r.reason).toBe(
      "Skipped: nothing under apps/dox/ or pnpm-lock.yaml changed since abc1234",
    );
  });

  it("runs the weekly cron whatever changed", () => {
    expect(shouldRun({ ...base, schedule: WEEKLY_CRON }).run).toBe(true);
  });

  it("runs a dispatch with force or force_finding, not a plain dispatch", () => {
    const dispatch = { ...base, event: "workflow_dispatch", schedule: "" };
    expect(shouldRun({ ...dispatch, force: true }).run).toBe(true);
    expect(shouldRun({ ...dispatch, forceFinding: true }).run).toBe(true);
    expect(shouldRun(dispatch).run).toBe(false);
  });

  it("runs with no earlier run or one outside the history", () => {
    expect(shouldRun({ ...base, lastSha: null }).run).toBe(true);
  });

  it("runs when a file under apps/dox or the lockfile changed", () => {
    const r = shouldRun({ ...base, changed: ["pnpm-lock.yaml"] });
    expect(r.run).toBe(true);
    expect(r.reason).toContain("1 file");
  });

  it("fails open when the diff or the run list could not be read", () => {
    expect(shouldRun({ ...base, changed: null }).run).toBe(true);
    expect(shouldRun({ ...base, lastError: "HTTP 403" }).reason).toContain(
      "HTTP 403",
    );
  });
});

describe("inputFromEnv", () => {
  it("reads the workflow's variables", () => {
    expect(
      inputFromEnv({
        EVENT_NAME: "schedule",
        SCHEDULE: "x",
        LAST_SHA: " abc \n",
        CHANGED: "a\n\nb\n",
        FORCE: "true",
      }),
    ).toEqual({
      event: "schedule",
      schedule: "x",
      force: true,
      forceFinding: false,
      lastSha: "abc",
      changed: ["a", "b"],
      lastError: "",
    });
  });
});
