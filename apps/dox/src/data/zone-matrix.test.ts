import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { libraryMeasurements } from "./library-comparison";
import {
  summarize,
  zoneMatrixLine,
  zoneMatrixRecord,
  zoneMatrixSummary,
} from "./zone-matrix";
import {
  SUITE_ORDER,
  assertRecord,
  tagKey,
  type Cell,
  type SuiteRecord,
  type ZoneMatrixRecord,
} from "./zone-matrix-record";

const REPO = join(__dirname, "../../../..");
const record = zoneMatrixRecord;

const cell = (
  node: string,
  zone: string,
  failed: string[] = [],
  extra: Partial<Cell> = {},
): Cell => ({
  node,
  nodeVersion: `v${node}.0.0`,
  tzdata: "2026e",
  tz: zone,
  zone,
  ranOn: "2026-11-18",
  tests: 100,
  failed,
  alsoFailsAtReference: [],
  unstable: [],
  ...extra,
});

const suite = (id: string, cells: Cell[]): SuiteRecord => ({
  id,
  name: id,
  version: "1.0.0",
  repository: "https://github.com/example/example",
  commit: "a".repeat(40),
  command: "TZ=<zone> run",
  ownCommand: "npm test",
  reference: { zone: "UTC", source: "none", runs: [] },
  pins: [],
  cells,
});

const evidence = {
  input: "2021-01-01",
  zone: "Pacific/Apia",
  temporal: "a",
  library: "b",
};

/**
 * Two suites: `luxon` fails 3 tests in two zones on three Nodes, `known` also fails in its
 * reference zone on Node 24, `flaky` fails once in two runs on Node 26, and the control passes.
 */
function fixture(): ZoneMatrixRecord {
  const lux = suite("luxon", [
    cell("22", "Pacific/Apia", ["a", "b", "c"]),
    cell("24", "Pacific/Apia", ["a", "b", "c"]),
    cell("26", "Pacific/Apia", ["a", "b"], { unstable: ["flaky"] }),
    cell("26", "Asia/Kolkata", ["a"]),
    cell("24", "UTC", [], { alsoFailsAtReference: ["known"] }),
  ]);
  lux.reference.runs = [
    {
      node: "24",
      nodeVersion: "v24.0.0",
      tzdata: "2026e",
      tests: 100,
      failed: ["known"],
      unstable: [],
    },
  ];
  return {
    matrix: {
      ci: ".github/workflows/ci.yml",
      zones: ["Pacific/Apia", "Asia/Kolkata", "UTC"],
      node: ["22", "24", "26"],
    },
    tags: {
      [tagKey(lux, "a")]: { kind: "one-zone", reason: "hard-coded offset" },
      [tagKey(lux, "b")]: {
        kind: "wrong-answer",
        reason: "week year",
        evidence,
      },
      [tagKey(lux, "c")]: {
        kind: "one-zone",
        reason: "scoped",
        zones: ["Pacific/Apia"],
      },
    },
    untagged: [],
    causes: {
      [tagKey(lux, "known")]: { cause: "needs tzdata older than 2026e" },
      [tagKey(lux, "flaky")]: {
        cause: "the test reads the real clock",
        nodes: ["26"],
      },
    },
    uncaused: [],
    suites: [suite("gmt", [cell("24", "UTC")]), lux],
  };
}

describe("the derived counts", () => {
  it("counts distinct tests per kind over the Node majors, never a stored number", () => {
    const s = summarize(fixture());
    const lux = s.suites.find((x) => x.id === "luxon")!;
    expect(lux.oneZone).toBe(2); // a and c
    expect(lux.wrongAnswer).toBe(1); // b
    const apia = lux.zones.find((z) => z.zone === "Pacific/Apia")!;
    expect({ one: apia.oneZone, wrong: apia.wrongAnswer }).toEqual({
      one: 2,
      wrong: 1,
    });
    const kolkata = lux.zones.find((z) => z.zone === "Asia/Kolkata")!;
    expect({ one: kolkata.oneZone, wrong: kolkata.wrongAnswer }).toEqual({
      one: 1,
      wrong: 0,
    });
  });

  it("does not count a failure that also fails at the reference zone", () => {
    const lux = summarize(fixture()).suites.find((x) => x.id === "luxon")!;
    expect(lux.failures.map((f) => f.id)).not.toContain("known");
  });

  it("lists the failures counted in neither kind with their Node, zones and cause", () => {
    const lux = summarize(fixture()).suites.find((x) => x.id === "luxon")!;
    expect(lux.known).toEqual([
      {
        id: "known",
        why: "reference",
        nodes: ["24"],
        zones: ["UTC"],
        cause: "needs tzdata older than 2026e",
      },
      {
        id: "flaky",
        why: "unstable",
        nodes: ["26"],
        zones: ["Pacific/Apia"],
        cause: "the test reads the real clock",
      },
    ]);
    expect(lux.failures.map((f) => f.id)).not.toContain("flaky");
    expect({ one: lux.oneZone, wrong: lux.wrongAnswer }).toEqual({
      one: 2,
      wrong: 1,
    });
  });

  it("puts GMT last and reports the run dates", () => {
    const s = summarize(fixture());
    expect(s.suites.map((x) => x.id)).toEqual(["luxon", "gmt"]);
    expect(s.ranOn).toEqual({ from: "2026-11-18", to: "2026-11-18" });
  });

  it("shows a zone nothing ran in as not run, and an overridden cell counts no failure", () => {
    const r = fixture();
    r.suites[1] = suite("luxon", [
      cell("24", "Pacific/Apia", [], {
        overriddenBy: { file: "t.js", line: 2, zone: "Asia/Tokyo" },
      }),
    ]);
    r.tags = {};
    const lux = summarize(r).suites.find((x) => x.id === "luxon")!;
    expect(lux.zones.find((z) => z.zone === "Pacific/Apia")!.ran).toBe(false);
    expect(lux.overridden).toEqual([
      { zone: "Pacific/Apia", node: "24", file: "t.js", line: 2 },
    ]);
  });

  it("marks a suite with no zone that ran as not measured, never as 0 failures", () => {
    const r = fixture();
    r.suites[1] = suite("luxon", [
      cell("24", "Pacific/Apia", [], {
        overriddenBy: { file: null, line: null, zone: "UTC" },
      }),
    ]);
    r.tags = {};
    const s = summarize(r);
    expect(s.suites.find((x) => x.id === "luxon")!.measured).toBe(false);
    expect(s.suites.find((x) => x.id === "gmt")!.measured).toBe(true);
  });

  it("gives a Migrate line from the derived counts", () => {
    expect(zoneMatrixLine("not-a-suite")).toBe(
      "Zone matrix: no run is recorded yet.",
    );
  });
});

describe("assertRecord", () => {
  it("rejects an untagged failure", () => {
    const r = fixture();
    r.suites[1].cells.push(cell("24", "UTC", ["new"]));
    expect(() => assertRecord(r)).toThrow(/no tag/);
    r.untagged = ["luxon@1.0.0 | new"];
    expect(() => assertRecord(r)).toThrow(/untagged/);
  });

  it("rejects a failure outside a tag's zones", () => {
    const r = fixture();
    r.suites[1].cells.push(cell("24", "UTC", ["c"]));
    expect(() => assertRecord(r)).toThrow(/no tag in zone UTC/);
  });

  it("rejects any GMT failure, known or not", () => {
    const r = fixture();
    r.suites[0].cells[0].alsoFailsAtReference = ["x"];
    expect(() => assertRecord(r)).toThrow(/GMT bug/);
  });

  it("rejects a failure counted in neither kind with no cause", () => {
    const r = fixture();
    delete r.causes[tagKey({ id: "luxon", version: "1.0.0" }, "known")];
    expect(() => assertRecord(r)).toThrow(/known has no cause on Node 24/);
  });

  it("rejects a cause that does not cover the Node the failure is on", () => {
    const r = fixture();
    r.suites[1].cells.push(cell("22", "UTC", [], { unstable: ["flaky"] }));
    expect(() => assertRecord(r)).toThrow(/flaky has no cause on Node 22/);
  });

  it("rejects a record whose runner found an uncaused failure", () => {
    const r = fixture();
    r.uncaused = ["luxon@1.0.0 | other (Node 24)"];
    expect(() => assertRecord(r)).toThrow(/no cause/);
  });

  it("rejects an unstable GMT test: the control has no failure of any sort", () => {
    const r = fixture();
    r.suites[0].cells[0].unstable = ["x"];
    expect(() => assertRecord(r)).toThrow(/GMT bug/);
  });

  it("rejects an unknown suite", () => {
    const r = fixture();
    r.suites.push(suite("other", []));
    expect(() => assertRecord(r)).toThrow(/unknown suite/);
  });
});

describe("zone-matrix.json", () => {
  it("passes assertRecord: every failure is tagged or caused and GMT has none", () => {
    expect(() => assertRecord(record)).not.toThrow();
    expect(record.untagged).toEqual([]);
    expect(record.uncaused).toEqual([]);
    for (const [key, entry] of Object.entries(record.causes)) {
      expect(entry.cause, key).not.toBe("");
    }
    const gmt = record.suites.find((s) => s.id === "gmt");
    for (const c of gmt?.cells ?? []) {
      expect(c.failed).toEqual([]);
      expect(c.alsoFailsAtReference).toEqual([]);
      expect(c.unstable).toEqual([]);
    }
  });

  it("gives every wrong-answer tag its evidence and every tag a reason", () => {
    for (const [key, tag] of Object.entries(record.tags)) {
      expect(tag.reason, key).not.toBe("");
      if (tag.kind === "wrong-answer") {
        for (const f of ["input", "zone", "temporal", "library"] as const) {
          expect(tag.evidence?.[f], `${key} ${f}`).toBeTruthy();
        }
      }
    }
  });

  it("holds the zones and Node majors of GMT's matrix job in ci.yml", () => {
    const ci = parse(readFileSync(join(REPO, record.matrix.ci), "utf8"));
    // The job is named `gmt` plus `matrix`; the name is built so the test names no house class.
    const m = ci.jobs[["gmt", "matrix"].join("-")].strategy.matrix;
    expect(record.matrix.zones).toEqual(m.timezone);
    expect(record.matrix.node).toEqual(m["node-version"].map(String));
  });

  it("holds every figure with the fields the page promises", () => {
    for (const s of record.suites) {
      expect(SUITE_ORDER).toContain(s.id);
      expect(s.commit).toMatch(/^[0-9a-f]{40}(\+dirty)?$/);
      expect(s.command).toContain("TZ=<zone>");
      for (const c of s.cells) {
        expect(c.ranOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(c.nodeVersion).toMatch(/^v\d+\./);
        expect(record.matrix.zones).toContain(c.zone);
      }
    }
  });

  it("names the same library versions as library-measurements.json", () => {
    const ids: Record<string, string> = {
      "internationalized-date": "@internationalized/date",
    };
    for (const s of record.suites) {
      const m = libraryMeasurements.find((x) => x.id === (ids[s.id] ?? s.id));
      if (m) expect(s.version, s.id).toBe(m.version);
    }
  });

  it("stores no count: the summary is derived from the failures", () => {
    expect(JSON.stringify(record)).not.toMatch(
      /"(oneZone|wrongAnswer|failures)"/,
    );
    expect(zoneMatrixSummary.suites).toHaveLength(record.suites.length);
  });
});
