import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const spawned = vi.hoisted(
  () => [] as { args: string[]; env: Record<string, string | undefined> }[],
);
vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawnSync: (
    _command: string,
    args: string[],
    options: { env: Record<string, string | undefined> },
  ) => {
    spawned.push({ args, env: options.env });
    return { status: 0 };
  },
}));

import { runPass } from "../../../../scripts/native-suite.mjs";

/**
 * `runPass` hands a pass's environment to the Vitest child it starts. The browser legs pick the
 * Temporal implementation through `GMT_TEMPORAL`, so a pass that lost the variable would run the
 * wrong implementation and still produce a report.
 */

const roots: string[] = [];
afterEach(() => {
  spawned.length = 0;
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const rootDir = () => {
  const root = mkdtempSync(join(tmpdir(), "run-pass-"));
  roots.push(root);
  return root;
};

describe("runPass", () => {
  it.each`
    leg           | pass         | variable
    ${"chromium"} | ${"swap"}    | ${"temporal-polyfill"}
    ${"firefox"}  | ${"control"} | ${"polyfill"}
  `(
    "starts the $leg $pass pass's Vitest with GMT_TEMPORAL=$variable",
    ({ leg, pass, variable }) => {
      expect(runPass(leg, pass, rootDir())).toBe(0);
      expect(spawned).toHaveLength(1);
      expect(spawned[0]?.env.GMT_TEMPORAL).toBe(variable);
      expect(spawned[0]?.args).toContain(
        "packages/gmt/vitest.browser.config.ts",
      );
    },
  );

  // Vitest's module cache is keyed by file path, not contents. A pass that reused it after
  // `temporal-polyfill` changed version under the same path would test the old version.
  it.each`
    leg           | pass
    ${"node"}     | ${"control"}
    ${"node"}     | ${"swap"}
    ${"chromium"} | ${"swap"}
    ${"webkit"}   | ${"native"}
  `(
    "starts the $leg $pass pass's Vitest with the module cache off",
    ({ leg, pass }) => {
      runPass(leg, pass, rootDir());
      expect(spawned[0]?.args).toContain("--fsModuleCache=false");
    },
  );

  it("starts the native browser pass without GMT_TEMPORAL, keeping the parent's other variables", () => {
    vi.stubEnv("GMT_TEMPORAL", undefined as never);
    vi.stubEnv("RUN_PASS_PROBE", "kept");
    try {
      runPass("webkit", "native", rootDir());
      expect(spawned[0]?.env.GMT_TEMPORAL).toBeUndefined();
      expect(spawned[0]?.env.RUN_PASS_PROBE).toBe("kept");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
