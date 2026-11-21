import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pnpmFlags } from "./install.mjs";

test("a clone without its own workspace file is installed with --ignore-workspace", () => {
  const dir = mkdtempSync(join(tmpdir(), "zm-"));
  try {
    assert.deepEqual(pnpmFlags(dir), [
      "--ignore-workspace",
      "--pm-on-fail=ignore",
    ]);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("a clone with its own workspace file keeps it, so its catalogs survive", () => {
  const dir = mkdtempSync(join(tmpdir(), "zm-"));
  try {
    writeFileSync(join(dir, "pnpm-workspace.yaml"), "catalog: {}\n");
    assert.deepEqual(pnpmFlags(dir), ["--pm-on-fail=ignore"]);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("a step that names a pnpm runs that version through npx", async () => {
  const { stepCommand } = await import("./install.mjs");
  const dir = mkdtempSync(join(tmpdir(), "zm-"));
  try {
    const step = { cmd: "pnpm", args: ["install"], pnpm: "10.26.0" };
    const { cmd, args } = stepCommand(step, dir);
    assert.equal(cmd, "npx");
    assert.deepEqual(args.slice(0, 3), ["--yes", "pnpm@10.26.0", "install"]);
    assert.ok(!args.includes("--pm-on-fail=ignore"));
    assert.equal(stepCommand({ cmd: "npm", args: ["ci"] }, dir).cmd, "npm");
  } finally {
    rmSync(dir, { recursive: true });
  }
});
