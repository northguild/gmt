/**
 * The close passes of `prepare-sky-orbits.ts`, on answers recorded from JPL (no network, a fixed
 * clock). `scripts/fixtures/sky-orbits/answers.json` holds each reply by its URL; the run instant
 * is 1795699667528 (2026-11-26). Queries, each recorded once:
 *   CAD       https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.002&date-min=2026-11-26&date-max=2036-11-23&body=Earth
 *   SBDB      https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=99942&phys-par=1   (and sstr=153814)
 *   Horizons  COMMAND='99942' VECTORS CENTER='500@399' REF_PLANE=FRAME VEC_TABLE=2 OUT_UNITS=KM-S
 *             VEC_CORR=NONE TIME_TYPE=UT STEP_SIZE='10 min' (and COMMAND='153814')
 * The spells check Vesta against `fixtures/sky-orbits/vesta-apmag.json`: Horizons' own APmag,
 * hourly, from the Earth's centre (the query is in the file).
 */
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Orbits } from "../src/lib/ephemeris";
import { SKY_BODIES } from "../src/lib/sky-registry";
import {
  boundMagnitude,
  parseApproaches,
  parseVectors,
  prefilter,
  trimWindow,
} from "./lib/close-approach";
import { parseSolution } from "./lib/jpl-sbdb";
import {
  candidateJds,
  chain,
  parseElements,
  SET_TOLERANCE,
} from "./lib/pass-sets";
import { readDistant } from "./lib/small-bodies";
import { readPasses, type Get } from "./lib/passes";
import { closestOf, skyEvents, spells } from "./lib/spells";
import { bodyFromCamera } from "../src/lib/ephemeris";
import { DAY_MS } from "../src/lib/globe/sun";
import { hgMagnitude } from "../src/lib/magnitude";
import { passPlacer } from "../src/lib/pass-table";
import type { SkyEventData } from "../src/lib/sky-events";

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const { now, answers } = read("./fixtures/sky-orbits/answers.json") as {
  now: number;
  answers: Record<string, unknown>;
};
const orbits = read("../src/assets/sky-orbits.json") as Orbits;

const urls = Object.keys(answers);
const cad = answers[urls.find((u) => u.includes("cad.api"))!];
const sbdb = (id: string) =>
  answers[urls.find((u) => u.includes(`sstr=${id}&`))!];
const vectors = (id: string) =>
  answers[
    urls.find(
      (u) =>
        u.includes(`COMMAND='${id}'`) &&
        u.includes("VEC_TABLE=2") &&
        u.includes("STEP_SIZE='10 min'"),
    )!
  ];

/** Serves the recorded answers, and records what was asked. */
const recorded =
  (asked: string[] = [], drop?: (url: string) => boolean): Get =>
  async (url) => {
    asked.push(url);
    if (!(url in answers) || drop?.(url))
      throw new Error(`not recorded: ${url}`);
    return answers[url];
  };

describe("the close-approach rule on the recorded answers", () => {
  const approaches = parseApproaches(cad);

  it("reads the seven recorded approaches", () => {
    expect(approaches.map((a) => a.des)).toEqual([
      "153814",
      "2024 QP2",
      "99942",
      "2008 DB",
      "2024 YR4",
      "2017 FU102",
      "2023 EB",
    ]);
  });

  it("the cheap bound drops the faint ones and keeps the two it cannot rule out", () => {
    expect(prefilter(approaches, 5.5).map((a) => a.des)).toEqual([
      "153814",
      "99942",
    ]);
    expect(boundMagnitude(approaches[2]!)).toBeLessThan(0);
  });

  it("keeps Apophis alone: the exact bound drops 2001 WN5 (6.47 at its best)", async () => {
    const { passes, sources } = await readPasses(now, 5.5, orbits, recorded());
    expect(Object.keys(passes)).toEqual(["apophis"]);
    expect(Object.keys(sources)).toEqual(["apophis"]);
  });

  it("writes the window and the rows the shipped JSON holds", async () => {
    const { passes, rows } = await readPasses(now, 5.5, orbits, recorded());
    expect(passes["apophis"]).toEqual(orbits.passes["apophis"]);
    expect(rows).toEqual(read("../src/assets/sky-passes.json"));
  });

  it("records every field of the sidecar", async () => {
    const { sources } = await readPasses(now, 5.5, orbits, recorded());
    const source = sources["apophis"]!;
    expect(source).toMatchObject({
      designation: "99942",
      solution: "220",
      epoch: 2461200.5,
      solutionDate: "2024-06-25 10:48:08",
      observations: 7370,
      producer: "Davide Farnocchia",
      closestApproach: "2029-04-13T21:46:00Z",
      closestKm: 38011,
      window: { from: "2029-04-13T08:40:00Z", to: "2029-04-14T00:10:00Z" },
      table: { from: "2029-04-12T08:40:00Z", to: "2029-04-15T00:00:00Z" },
      tolerance: SET_TOLERANCE,
    });
    expect(source.sets.length).toBe(orbits.passes["apophis"]!.sets.length);
    expect(source.peak).toBeLessThan(-9);
    expect(source.queries.approaches).toContain("cad.api");
    expect(source.queries.photometry).toContain("sbdb.api");
    expect(source.queries.vectors).toContain("horizons.api");
  });

  it("asks only for the bodies the cheap bound leaves", async () => {
    const asked: string[] = [];
    await readPasses(now, 5.5, orbits, recorded(asked));
    expect(asked.filter((u) => u.includes("sbdb")).length).toBe(2);
    expect(asked.some((u) => u.includes("QP2") || u.includes("YR4"))).toBe(
      false,
    );
  });

  it("stops the run for a body that qualifies and has no fitted G", async () => {
    const bright = { ...(sbdb("99942") as object), phys_par: [] };
    const get: Get = async (url) =>
      url.includes("sstr=99942") ? bright : recorded()(url);
    await expect(readPasses(now, 5.5, orbits, get)).rejects.toThrow(
      /no fitted G/,
    );
  });

  it("fails loudly for a body with no orbit solution", async () => {
    const get: Get = async (url) =>
      url.includes("sstr=99942") ? {} : recorded()(url);
    await expect(readPasses(now, 5.5, orbits, get)).rejects.toThrow(
      /no orbit solution/,
    );
  });
});

describe("parseVectors and trimWindow", () => {
  const table = parseVectors(vectors("99942"));

  it("reads even 10-minute rows with the state to 0.1 km", () => {
    expect(table.stepMs).toBe(600_000);
    expect(table.rows.length % 6).toBe(0);
    expect(table.rows[0]! * 10).toBeCloseTo(Math.round(table.rows[0]! * 10), 6);
  });

  it("rejects uneven rows and a table of one row", () => {
    const text = (vectors("99942") as { result: string }).result;
    const lines = text.slice(text.indexOf("$$SOE") + 6, text.indexOf("$$EOE"));
    const rows = lines.trim().split("\n");
    const uneven = [rows[0], rows[1], rows[3]].join("\n");
    expect(() => parseVectors({ result: `$$SOE\n${uneven}\n$$EOE` })).toThrow(
      /evenly/,
    );
    expect(() => parseVectors({ result: `$$SOE\n${rows[0]}\n$$EOE` })).toThrow(
      /fewer/,
    );
  });

  it("cuts the rows at or under the limit plus the margin, 30 minutes either side", () => {
    const n = table.rows.length / 6;
    const v = Array.from({ length: n }, (_, i) =>
      i >= 20 && i <= 25 ? 5 : 20,
    );
    const cut = trimWindow(table, v, 5.5)!;
    expect(cut.startMs).toBe(table.startMs + 17 * table.stepMs);
    expect(cut.rows.length / 6).toBe(6 + 6);
    expect(
      trimWindow(
        table,
        v.map(() => 20),
        5.5,
      ),
    ).toBeNull();
  });
});

describe("parseSolution", () => {
  it("reads Apophis's solution 220", () => {
    expect(parseSolution(sbdb("99942"))).toMatchObject({
      id: "220",
      observations: 7370,
    });
  });

  it("is null for a reply with no orbit", () => {
    expect(parseSolution({})).toBeNull();
  });
});

describe("the registry and the JSON", () => {
  it("has a point row for each pass, and no other", () => {
    const points: string[] = SKY_BODIES.filter((b) => b.kind === "point").map(
      (b) => b.id,
    );
    expect(Object.keys(orbits.passes).every((id) => points.includes(id))).toBe(
      true,
    );
    expect(points).toContain("apophis");
  });
});

describe("the spells of sky-events.json", () => {
  const shipped = read("../src/assets/sky-events.json") as SkyEventData;
  const rows = read("../src/assets/sky-passes.json");
  const sidecar = read("../src/assets/sky-orbits.source.json");
  const closest = closestOf(sidecar.passSource.bodies);
  const made = skyEvents(orbits, rows, closest, now, 5.5);
  const spellOf = (id: string) => made.events.find((e) => e.id === id)!;
  const horizons = read("./fixtures/sky-orbits/vesta-apmag.json") as {
    rows: [number, number][];
  };

  it("is what the generator makes, from the run instant to 3,650 days on", () => {
    expect(
      skyEvents(orbits, rows, closest, shipped.spanEndMs - 3650 * DAY_MS, 5.5),
    ).toEqual(shipped);
    expect(made.spanEndMs).toBe(now + 3650 * DAY_MS);
  });

  it("is sorted by start, and no planet is rare", () => {
    const starts = made.events.map((e) => e.startMs);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    const planets = Object.keys(orbits.bodies);
    expect(made.events.every((e) => e.rare === !planets.includes(e.id))).toBe(
      true,
    );
    expect(made.events.filter((e) => e.rare).map((e) => e.id)).toEqual([
      "apophis",
      "vesta",
    ]);
  });

  /* Measured against Horizons: the start is to the hour (2029-07-05 02:00 UT, both), the end 2 hours
     early (13:00 here; Horizons' last row at or under 5.5 is 15:00). V moves 0.0015 mag an hour
     there, so a few thousandths of a magnitude is hours; the spec allows a day. */
  it("dates Vesta's 2029 spell from the 2026 elements within a day of Horizons' APmag of 5.5", () => {
    const edge = (side: "from" | "to") => {
      const at = horizons.rows.filter(([, V]) => V <= 5.5).map(([ms]) => ms);
      return side === "from" ? at[0]! : at.at(-1)!;
    };
    const vesta = spellOf("vesta");
    expect(Math.abs(vesta.startMs - edge("from"))).toBeLessThanOrEqual(DAY_MS);
    expect(Math.abs(vesta.endMs - edge("to"))).toBeLessThanOrEqual(DAY_MS);
  });

  it("dates Apophis's pass within 2 minutes of the table's own crossing, with JPL's closest approach", () => {
    const pass = orbits.passes["apophis"]!;
    const placer = passPlacer({
      apophis: { startMs: pass.startMs, ...rows.apophis },
    });
    const bright = (ms: number) => {
      const view = bodyFromCamera(orbits, "apophis", ms, undefined, placer);
      return !!view && hgMagnitude(pass.H, pass.G, view) <= 5.5;
    };
    const [[from, to]] = spells(bright, pass.startMs, pass.endMs, 60_000, 1);
    const apophis = spellOf("apophis");
    expect(Math.abs(apophis.startMs - from!)).toBeLessThanOrEqual(120_000);
    expect(Math.abs(apophis.endMs - to!)).toBeLessThanOrEqual(120_000);
    expect(apophis).toMatchObject({
      unit: "minute",
      closestMs: closest["apophis"],
    });
    expect(convertUnixToUtc(apophis.closestMs!)).toBe("2029-04-13T21:46:00Z");
  });

  it("keeps Uranus's first spell for 2033, when the law first reaches 5.5 (5.60 today)", () => {
    const first = made.events.find((e) => e.id === "uranus")!;
    expect(first.rare).toBe(false);
    expect(convertUnixToUtc(first.startMs).slice(0, 7)).toBe("2033-12");
  });
});

describe("the element sets that place Apophis outside its table", () => {
  const pass = orbits.passes["apophis"]!;
  const { sets } = pass;

  it("are what the generator measures on the recorded answers", async () => {
    const { passes } = await readPasses(now, 5.5, orbits, recorded());
    expect(passes["apophis"]!.sets).toEqual(sets);
  });

  it("are contiguous, run from the run instant to the span's end, and meet the table at its edges", () => {
    expect(sets[0]!.fromMs).toBe(Math.floor(now / 60_000) * 60_000);
    sets.slice(1).forEach((s, i) => {
      const before = sets[i]!;
      expect(s.fromMs).toBeLessThanOrEqual(
        before.toMs === pass.startMs ? pass.endMs : before.toMs,
      );
    });
    expect(sets.some((s) => s.toMs === pass.startMs)).toBe(true);
    expect(sets.some((s) => s.fromMs === pass.endMs)).toBe(true);
    expect(sets.at(-1)!.toMs).toBe(now + 3650 * DAY_MS);
  });

  it("hold every recorded truth sample within the tolerance of the set that covers it", async () => {
    const { sources } = await readPasses(now, 5.5, orbits, recorded());
    const worst = sources["apophis"]!.sets.map((s) => s.worstDegrees);
    expect(Math.max(...worst)).toBeLessThanOrEqual(SET_TOLERANCE);
  });

  it("sit beside a table of one 20 minute step, a day either side of the brightness window", async () => {
    const { rows } = await readPasses(now, 5.5, orbits, recorded());
    const steps = (pass.endMs - pass.startMs) / (20 * 60_000);
    expect(Number.isInteger(steps)).toBe(true);
    expect(rows["apophis"]!.rows.length).toBe(6 * (steps + 1));
    expect(pass.startMs).toBe(
      convertUtcToUnix("2029-04-12T08:40:00Z", { epochUnit: "milliseconds" }),
    );
    expect(pass.endMs).toBe(
      convertUtcToUnix("2029-04-15T00:00:00Z", { epochUnit: "milliseconds" }),
    );
  });
});

describe("chain", () => {
  const els = (epoch: number) => ({
    a: 1,
    e: 0,
    i: 0,
    node: 0,
    peri: 0,
    M: 0,
    n: 1,
    epoch,
  });
  const samples = [0, 1, 2, 3, 4, 5].map((d) => ({
    ms: d * DAY_MS,
    p: [0, 0, 0] as [number, number, number],
  }));

  it("hands over at the last sample the held set keeps, then continues with the next", () => {
    const error = (c: { epoch: number }, t: { ms: number }) =>
      Math.abs(t.ms / DAY_MS - c.epoch) * 0.015;
    const made = chain([els(1), els(4)], samples, 0, 5 * DAY_MS, error);
    expect(
      made.map((m) => [m.set.fromMs / DAY_MS, m.set.toMs / DAY_MS]),
    ).toEqual([
      [0, 3],
      [3, 5],
    ]);
    expect(made[0]!.worst).toBeLessThanOrEqual(SET_TOLERANCE);
  });

  it("throws where no candidate holds", () => {
    expect(() => chain([els(0)], samples, 0, 5 * DAY_MS, () => 1)).toThrow(
      /no element set holds/,
    );
  });
});

describe("parseElements and candidateJds", () => {
  it("refuses a reply for another orbit solution", () => {
    expect(() =>
      parseElements({ result: "soln ref.= JPL#99\n$$SOE\n$$EOE" }, "220"),
    ).toThrow(/not solution 220/);
  });

  it("lists midnights only, sorted, with the ladder either side of the table", () => {
    const table = { startMs: 40 * DAY_MS, endMs: 43 * DAY_MS };
    const jds = candidateJds(0, 100 * DAY_MS, table);
    expect(jds).toEqual([...jds].sort((a, b) => a - b));
    expect(jds.every((jd) => jd % 1 === 0.5)).toBe(true);
    expect(jds).toContain(2440587.5 + 39);
    expect(jds).toContain(2440587.5 + 43 + 32);
  });
});

describe("readDistant on the recorded MPC row", () => {
  const fixture = read("./fixtures/sky-orbits/distant.json") as {
    url: string;
    bytes: number;
    sha256: string;
    rows: string[];
  };
  const sidecar = read("../src/assets/sky-orbits.source.json");

  it("makes the shipped Pluto elements from the Pluto row", async () => {
    const text = Buffer.from(fixture.rows.join("\n"), "latin1");
    const { small, source } = await readDistant(now, 720, async () => text);
    expect(small.pluto).toEqual(orbits.small["pluto"]);
    expect(source.bodies).toEqual(["pluto"]);
    expect(source.file.bytes).toBe(text.length);
  });

  it("records the file the shipped elements were read from", () => {
    expect(sidecar.distantSource.file).toMatchObject({
      url: fixture.url,
      bytes: fixture.bytes,
      sha256: fixture.sha256,
    });
  });

  it("stops the run when the file has no Pluto row", async () => {
    const text = Buffer.from(fixture.rows[0]!, "latin1");
    await expect(readDistant(now, 720, async () => text)).rejects.toThrow(
      /no Pluto row/,
    );
  });
});
