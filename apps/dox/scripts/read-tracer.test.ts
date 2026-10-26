import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const tracer = pathToFileURL(join(root, "scripts/lib/read-tracer.mjs")).href;
const dir = mkdtempSync(join(tmpdir(), "read-tracer-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Runs `code` as an ES module with the tracer loaded; returns its stdout and the trace log. */
function traced(code: string) {
  const log = join(dir, `${Math.random().toString(36).slice(2)}.log`);
  const out = execFileSync(
    process.execPath,
    [`--import=${tracer}`, "--input-type=module", "-e", code],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        AFFECTED_TRACE_ROOT: root,
        AFFECTED_TRACE_LOG: log,
      },
    },
  );
  // The tracer creates the log on its first record, so a run that reads nothing leaves none.
  return {
    out: out.trim(),
    log: existsSync(log) ? readFileSync(log, "utf8") : "",
  };
}

describe("read-tracer: a wrapped fs function behaves like the original", () => {
  it("promisify(fs.exists) still resolves true for a file that exists", () => {
    const { out, log } = traced(
      `import fs from "node:fs"; import { promisify } from "node:util";
       console.log(await promisify(fs.exists)("package.json"));`,
    );
    expect(out).toBe("true");
    expect(log).toContain("S package.json");
  });

  it("every wrapped function keeps the original's own properties", () => {
    // Prints each fs function's own keys with name and length; must match an untraced run.
    const code = `import fs from "node:fs";
      const fns = { ...Object.fromEntries(Object.entries(fs)),
        ...Object.fromEntries(Object.entries(fs.promises).map(([k, v]) => ["promises." + k, v])) };
      for (const [k, f] of Object.entries(fns)) {
        if (typeof f !== "function") continue;
        console.log(k, f.name, f.length, Reflect.ownKeys(f).map(String).sort().join(","));
      }`;
    const plain = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", code],
      { cwd: root, encoding: "utf8" },
    ).trim();
    expect(traced(code).out).toBe(plain);
  });
});
