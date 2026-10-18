import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * `temporal-compat.mjs check` run as a process, in a scratch repo layout: the script is copied
 * (it finds `artifacts/` from its own location) and everything it reads, such as `packages`,
 * `apps` and `node_modules`, is a symlink to the real repo. The verdict file is an extra: a
 * failed write must never change what `check` prints or how it exits, the same promise
 * `leap-seconds.mjs` makes.
 */
const REPO = join(import.meta.dirname, "../../../..");

function run(root: string) {
  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/temporal-compat.mjs"), "check"],
    { encoding: "utf8" },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe("temporal-compat.mjs check", () => {
  let root = "";
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "compat-cli-"));
    cpSync(join(REPO, "scripts"), join(root, "scripts"), { recursive: true });
    for (const name of ["packages", "apps", "node_modules"]) {
      symlinkSync(join(REPO, name), join(root, name));
    }
    writeFileSync(join(root, "package.json"), "{}\n");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("a writable folder: exits 0 and writes a ran verdict", () => {
    const result = run(root);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("workarounds removable on this runtime");
    expect(
      JSON.parse(
        readFileSync(
          join(root, "artifacts/temporal-compat-check.json"),
          "utf8",
        ),
      ),
    ).toMatchObject({ source: "temporal-compat-check", status: "ran" });
  });

  it("`artifacts` a plain file: same exit code and stdout as a writable folder, and a stderr warning", () => {
    const writable = run(root);
    rmSync(join(root, "artifacts"), { recursive: true, force: true });
    writeFileSync(join(root, "artifacts"), "not a folder");
    const result = run(root);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(writable.stdout);
    expect(result.stderr).toContain(
      "temporal-compat-check: cannot write verdict: ",
    );
  });

  it("no dist and `artifacts` a plain file: still exits 2 with the build message, and warns", () => {
    // packages/gmt without `dist`: every other entry stays a link to the real one.
    rmSync(join(root, "packages"));
    mkdirSync(join(root, "packages/gmt"), { recursive: true });
    for (const name of readdirSync(join(REPO, "packages/gmt"))) {
      if (name === "dist") continue;
      symlinkSync(
        join(REPO, "packages/gmt", name),
        join(root, "packages/gmt", name),
      );
    }
    writeFileSync(join(root, "artifacts"), "not a folder");
    const result = run(root);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "packages/gmt/dist is missing: run pnpm build first",
    );
    expect(result.stderr).toContain(
      "temporal-compat-check: cannot write verdict: ",
    );
  });
});
