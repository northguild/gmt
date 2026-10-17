import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * `leap-seconds.mjs check` run as a process, in a scratch copy of the repo layout (the script
 * finds its source and `artifacts/` from its own location). The verdict file is an extra: a
 * failed write must never change what the check prints or how it exits. The fixture is two rows
 * written by hand: 1972-01-01 (MJD 41317, 730 days after the Unix epoch = 63 072 000 s) with
 * TAI - UTC 10 s, and 1972-07-01 (MJD 41499, 912 days = 78 796 800 s) with 11 s.
 */
const REPO = join(import.meta.dirname, "../../../..");

const SOURCE = `const ROWS: ReadonlyArray<readonly [bigint, bigint]> = [
  [63072000000000000n, 10n], // 1972-01-01T00:00:00Z
  [78796800000000000n, 11n], // 1972-07-01T00:00:00Z
];
`;
const IERS_HEADER = "#  Updated through IERS Bulletin C 72\n";
const IERS_ROWS = [
  "    41317.0    1  1 1972       10",
  "    41499.0    1  7 1972       11",
];

function iersFile(rows: string[]): string {
  return `${IERS_HEADER}${rows.join("\n")}\n`;
}

function run(root: string, iers: string) {
  const file = join(root, "Leap_Second.dat");
  writeFileSync(file, iers);
  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/leap-seconds.mjs"), "check", `--file=${file}`],
    { encoding: "utf8" },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe("leap-seconds.mjs check", () => {
  let root = "";
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "leap-cli-"));
    mkdirSync(join(root, "scripts"), { recursive: true });
    cpSync(
      join(REPO, "scripts/leap-seconds.mjs"),
      join(root, "scripts/leap-seconds.mjs"),
    );
    cpSync(join(REPO, "scripts/lib"), join(root, "scripts/lib"), {
      recursive: true,
    });
    mkdirSync(join(root, "packages/gmt/src/internal"), { recursive: true });
    writeFileSync(
      join(root, "packages/gmt/src/internal/leapSeconds.ts"),
      SOURCE,
    );
    writeFileSync(join(root, "package.json"), "{}\n");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("a matching file exits 0, says 2 rows match, and writes a ran verdict", () => {
    const result = run(root, iersFile(IERS_ROWS));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "leap-seconds: 2 rows match IERS Leap_Second.dat",
    );
    expect(
      JSON.parse(
        readFileSync(join(root, "artifacts/leap-seconds.json"), "utf8"),
      ),
    ).toMatchObject({ source: "leap-seconds", status: "ran", differences: [] });
  });

  it("a matching file with `artifacts` a plain file still exits 0 and prints the match line", () => {
    writeFileSync(join(root, "artifacts"), "not a folder");
    const result = run(root, iersFile(IERS_ROWS));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "leap-seconds: 2 rows match IERS Leap_Second.dat",
    );
    expect(result.stderr).toContain("leap-seconds: cannot write verdict: ");
  });

  it("a differing file with `artifacts` a plain file still exits 1 and lists the difference", () => {
    writeFileSync(join(root, "artifacts"), "not a folder");
    const result = run(
      root,
      iersFile([IERS_ROWS[0], "    41499.0    1  7 1972       12"]),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no longer matches IERS Leap_Second.dat");
    expect(result.stderr).toContain(
      "row 2: GMT has MJD 41499 (1972-07-01), TAI − UTC 11 s",
    );
    expect(result.stderr).toContain("leap-seconds: cannot write verdict: ");
  });
});
