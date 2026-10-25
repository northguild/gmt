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

/**
 * The IANA file's rows are NTP seconds since 1900-01-01: 1972-01-01 = 2 272 060 800 and
 * 1972-07-01 = 2 287 785 600. NTP 1900-01-01 is MJD 15020, so these are MJD 41317 and 41499.
 * Expiry is computed from the clock (seconds since 1900 = Unix seconds + 2 208 988 800).
 */
const NTP_OF_UNIX_EPOCH = 2_208_988_800;
const DAY = 86_400;
const IANA_ROWS = [
  "2272060800\t10\t# 1 Jan 1972",
  "2287785600\t11\t# 1 Jul 1972",
];

function ntpNow(): number {
  // oxlint-disable-next-line @northguild/gmt-oxlint/no-date-now -- the child process reads the same clock
  return Math.floor(Date.now() / 1000) + NTP_OF_UNIX_EPOCH;
}

function ianaFile(rows: string[], expiry = ntpNow() + 365 * DAY): string {
  return [
    "#\tUpdated through IERS Bulletin C (https://hpiers.obspm.fr/iers/bul/bulc/bulletinc.dat)",
    "#$\t3912345678",
    `#@\t${expiry}`,
    ...rows,
    "#h\t0 0 0 0 0",
    "",
  ].join("\n");
}

function run(root: string, iers: string | null, iana?: string) {
  const file = join(root, "Leap_Second.dat");
  if (iers !== null) writeFileSync(file, iers);
  const args = [`--file=${file}`];
  if (iana !== undefined) {
    const ianaPath = join(root, "leap-seconds.list");
    if (iana !== "") writeFileSync(ianaPath, iana);
    args.push(`--iana-file=${ianaPath}`);
  }
  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/leap-seconds.mjs"), "check", ...args],
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

  it("a matching IERS file records from IERS Leap_Second.dat", () => {
    run(root, iersFile(IERS_ROWS));
    expect(
      JSON.parse(
        readFileSync(join(root, "artifacts/leap-seconds.json"), "utf8"),
      ),
    ).toMatchObject({ from: "IERS Leap_Second.dat" });
  });

  describe("when the IERS file cannot be read", () => {
    const verdict = () =>
      JSON.parse(
        readFileSync(join(root, "artifacts/leap-seconds.json"), "utf8"),
      );

    it("a matching IANA copy exits 0, says why on stderr, and records IANA as the source", () => {
      const result = run(root, null, ianaFile(IANA_ROWS));
      expect(result.status).toBe(0);
      expect(result.stderr).toContain(
        "leap-seconds: IERS Leap_Second.dat unreachable (",
      );
      expect(result.stderr).toContain("reading IANA leap-seconds.list");
      expect(result.stdout).toContain(
        "leap-seconds: 2 rows match IANA leap-seconds.list (Updated through IERS Bulletin C",
      );
      expect(verdict()).toMatchObject({
        status: "ran",
        from: "IANA leap-seconds.list",
        differences: [],
      });
    });

    it("a differing IANA copy exits 1 and names IANA", () => {
      const result = run(
        root,
        null,
        ianaFile([IANA_ROWS[0], "2287785600\t12\t# 1 Jul 1972"]),
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "no longer matches IANA leap-seconds.list",
      );
      expect(result.stderr).toContain(
        "row 2: GMT has MJD 41499 (1972-07-01), TAI − UTC 11 s; IERS has MJD 41499 (1972-07-01), TAI − UTC 12 s",
      );
      expect(verdict()).toMatchObject({ from: "IANA leap-seconds.list" });
    });

    it("an IANA row whose comment date disagrees with its NTP value exits 1 with that problem", () => {
      const result = run(
        root,
        null,
        ianaFile([IANA_ROWS[0], "2287785600\t11\t# 1 Jan 1973"]),
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "IANA: 2287785600 is not 00:00:00 on 1973-01-01",
      );
    });

    it("an IANA row that is not a whole number of days exits 1 with that problem", () => {
      const result = run(
        root,
        null,
        ianaFile([IANA_ROWS[0], "2287785601\t11\t# 1 Jul 1972"]),
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("IANA: 2287785601 is not 00:00:00 on");
    });

    it("an IANA line that is not a row exits 1", () => {
      const result = run(root, null, ianaFile([...IANA_ROWS, "garbage line"]));
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("IANA: not a table row: garbage line");
    });

    it("an IANA copy with no expiry line exits 1 with a parse problem", () => {
      const text = ianaFile(IANA_ROWS)
        .split("\n")
        .filter((l) => !l.startsWith("#@"))
        .join("\n");
      const result = run(root, null, text);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("IANA: no expiry (#@) line");
    });

    it("an expired IANA copy exits 2, naming both the IERS failure and the expiry date", () => {
      const result = run(root, null, ianaFile(IANA_ROWS, ntpNow() - DAY));
      expect(result.status).toBe(2);
      expect(verdict()).toMatchObject({
        source: "leap-seconds",
        status: "could-not-run",
      });
      expect(verdict().message).toContain("IERS Leap_Second.dat");
      expect(verdict().message).toMatch(
        /IANA leap-seconds\.list expired on \d{4}-\d{2}-\d{2}/,
      );
    });

    it("both files missing exits 2 and the verdict names both failures", () => {
      const result = run(root, null, "");
      expect(result.status).toBe(2);
      expect(verdict().status).toBe("could-not-run");
      expect(verdict().message).toContain("IERS Leap_Second.dat");
      expect(verdict().message).toContain("IANA leap-seconds.list");
    });

    it("an IERS file that is read but differs does not fall back", () => {
      const result = run(
        root,
        iersFile([IERS_ROWS[0], "    41499.0    1  7 1972       12"]),
        ianaFile(IANA_ROWS),
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("no longer matches IERS Leap_Second.dat");
      expect(result.stderr).not.toContain("unreachable");
    });
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
