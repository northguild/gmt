import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LIMITS,
  SUBJECT_TERMS,
  TITLE_TERMS,
  isoOfHttpDate,
  main,
  titleMatches,
  tzSnapshot,
} from "../../../../scripts/us-clock-watch.mjs";

/**
 * CORE-90: the US clock-change canary. Everything is offline: `fetch` is a fake that serves
 * hand-built responses shaped like the documented Congress.gov and Open States bodies and a trimmed
 * excerpt of the IANA tz source (fixtures/us-clock-watch). Each test works in its own temporary
 * root, removed in `afterEach`.
 */

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const FIXTURES = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "fixtures/us-clock-watch",
);
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

const KEYS = {
  CONGRESS_GOV_API_KEY: "cg-key-0123456789",
  OPEN_STATES_API_KEY: "os-key-9876543210",
};
const ZONES = [
  "America/New_York",
  "America/Detroit",
  "Pacific/Guam",
  "Pacific/Saipan",
];
const DATE = "Fri, 13 Nov 2026 12:26:01 GMT";
const SNAPSHOT_DATE = "2026-11-01T00:00:00Z";

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;
type Call = { url: URL; headers: Record<string, string> };

const reply = (
  body: unknown,
  headers: Record<string, string> = {},
  status = 200,
) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { date: DATE, ...headers },
  });

const federalBill = (
  type: string,
  number: string,
  title: string,
  actionDate = "2026-01-02",
  text = "Introduced",
) => ({
  congress: 119,
  type,
  number,
  title,
  latestAction: { actionDate, text },
  updateDate: "2026-11-05",
});

const stateBill = (
  name: string,
  identifier: string,
  title: string,
  date = "2026-02-02",
  description = "Filed",
  classification = "state",
  id = `ocd-jurisdiction/country:us/state:${name.toLowerCase()}/government`,
) => ({
  jurisdiction: { id, name, classification },
  session: "2025",
  identifier,
  title,
  latest_action_date: date,
  latest_action_description: description,
});

/** A GovInfo search reply holding one package per id, as `BILLS-119hr139ih`. */
const packages = (ids: string[], offsetMark = "next") => ({
  count: ids.length,
  offsetMark,
  results: ids.map((packageId) => ({ packageId, collectionCode: "BILLS" })),
});

/** A response that never comes: it settles only when the request is aborted. */
const hang: Handler = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });

const page = (results: unknown[]) => ({
  results,
  pagination: {
    page: 1,
    max_page: 1,
    per_page: 20,
    total_items: results.length,
  },
});

/** The committed-snapshot stand-in: one federal and one state bill, the tz hashes of the fixtures. */
const snapshotOf = (tzText = fixture("northamerica")) => ({
  federal: {
    checkedAt: SNAPSHOT_DATE,
    congress: 119,
    bills: [federalBill("HR", "1", "A bill about daylight saving time")],
  },
  state: {
    checkedAt: SNAPSHOT_DATE,
    bills: [
      {
        jurisdiction: "Texas",
        session: "2025",
        identifier: "HB 9",
        title: "Relating to standard time",
        latestActionDate: "2026-02-02",
        latestActionDescription: "Filed",
      },
    ],
  },
  tz: tzSnapshot(
    "2026e",
    [tzText, fixture("australasia"), fixture("backward")].join("\n"),
    ZONES,
  ),
});

const tmpRoots: string[] = [];
const dirs: string[] = [];

/** A root folder holding the snapshot and the zone list, as the script reads them. */
function makeRoot(snapshot: unknown = snapshotOf()) {
  const root = mkdtempSync(join(tmpdir(), "us-clock-watch-"));
  tmpRoots.push(root);
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "apps/dox/src/lib"), { recursive: true });
  writeFileSync(
    join(root, "scripts/us-clock-watch.snapshot.json"),
    JSON.stringify(snapshot),
  );
  writeFileSync(
    join(root, "apps/dox/src/lib/us-region-zones.json"),
    JSON.stringify({ tzdb: "2026e", zones: ZONES }),
  );
  return root;
}

/** Serves every source from `overrides` over the defaults: nothing changed since the snapshot. */
function world(overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  const tz = (file: string) => () => reply(fixture(file));
  const handlers: Record<string, Handler> = {
    "api.congress.gov/v3/congress/current": () =>
      reply({ congress: { name: "119th Congress", startYear: "2025" } }),
    "api.congress.gov/v3/bill/119": () =>
      reply({
        bills: [federalBill("HR", "1", "A bill about daylight saving time")],
        pagination: { count: 1 },
      }),
    "api.govinfo.gov/search": () => reply(packages(["BILLS-119hr1ih"])),
    "v3.openstates.org/bills": () =>
      reply(
        page([
          stateBill(
            "Texas",
            "HB 9",
            "Relating to standard time",
            "2026-02-02",
            "Filed",
          ),
        ]),
      ),
    "data.iana.org/time-zones/tzdb/version": () => reply("2026e\n"),
    "data.iana.org/time-zones/tzdb/northamerica": tz("northamerica"),
    "data.iana.org/time-zones/tzdb/australasia": tz("australasia"),
    "data.iana.org/time-zones/tzdb/backward": tz("backward"),
    ...overrides,
  };
  const fetchFake = vi.fn(async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({
      url,
      headers: { ...(init?.headers as Record<string, string> | undefined) },
    });
    const handler = handlers[`${url.host}${url.pathname}`];
    if (!handler) return reply("not found", {}, 404);
    return await handler(url, init);
  });
  return { fetch: fetchFake as unknown as typeof fetch, calls };
}

type Run = {
  code: number;
  out: string;
  err: string;
  verdict: Record<string, any> | null;
  sleeps: number[];
  calls: Call[];
  root: string;
};

async function run(
  argv: string[],
  {
    env = KEYS,
    overrides = {},
    limits,
    snapshot,
    root = makeRoot(snapshot),
  }: {
    env?: Record<string, string | undefined>;
    overrides?: Record<string, Handler>;
    limits?: Record<string, number>;
    snapshot?: unknown;
    root?: string;
  } = {},
): Promise<Run> {
  const { fetch, calls } = world(overrides);
  let out = "";
  let err = "";
  const sleeps: number[] = [];
  const code: number = await main(argv, {
    root,
    env,
    fetch,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
    stdout: (t: string) => {
      out += t;
    },
    stderr: (t: string) => {
      err += t;
    },
    limits,
  });
  const file = join(root, "artifacts/us-clock-watch.json");
  const verdict = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, any>)
    : null;
  return { code, out, err, verdict, sleeps, calls, root };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tmpRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

const changeNorthAmerica = (from: string, to: string) => {
  const text = fixture("northamerica");
  expect(text).toContain(from);
  return text.replace(from, to);
};
const serveNorthAmerica = (text: string): Record<string, Handler> => ({
  "data.iana.org/time-zones/tzdb/northamerica": () => reply(text),
});

describe("the subject words", () => {
  it("are lower-case phrases with no proper noun", () => {
    for (const term of [...SUBJECT_TERMS, ...TITLE_TERMS]) {
      expect(term).toBe(term.toLowerCase());
    }
    expect(SUBJECT_TERMS).toEqual([
      "daylight saving time",
      "standard time",
      "time zone",
    ]);
  });

  it("match a bill title whatever its case, and ignore other titles", () => {
    expect(titleMatches("To END Daylight Saving Time")).toBe(true);
    expect(titleMatches("A bill on daylight time")).toBe(true);
    // #526: S 29's official title spells it this way.
    expect(titleMatches("To make daylight savings time permanent")).toBe(true);
    expect(titleMatches("A bill about farm subsidies")).toBe(false);
    expect(titleMatches("")).toBe(false);
  });
});

describe("isoOfHttpDate", () => {
  it("reads an HTTP date as ISO and rejects other text", () => {
    expect(isoOfHttpDate(DATE)).toBe("2026-11-13T12:26:01Z");
    expect(isoOfHttpDate("yesterday")).toBeNull();
    expect(isoOfHttpDate(null)).toBeNull();
  });
});

describe("the committed snapshot", () => {
  it("holds a hash for each zone in us-region-zones.json, for the same release", () => {
    const snapshot = JSON.parse(
      readFileSync(join(REPO, "scripts/us-clock-watch.snapshot.json"), "utf8"),
    );
    const zones = JSON.parse(
      readFileSync(join(REPO, "apps/dox/src/lib/us-region-zones.json"), "utf8"),
    );
    expect(Object.keys(snapshot.tz.zones).sort()).toEqual(
      [...zones.zones].sort(),
    );
    expect(snapshot.tz.release).toBe(zones.tzdb);
    for (const hash of Object.values(snapshot.tz.zones)) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  // #526: a placeholder federal part (congress 0) makes every weekly check report "run `refresh`".
  it("holds a refreshed federal and state part, not a placeholder", () => {
    const snapshot = JSON.parse(
      readFileSync(join(REPO, "scripts/us-clock-watch.snapshot.json"), "utf8"),
    );
    expect(Number.isInteger(snapshot.federal.congress)).toBe(true);
    expect(snapshot.federal.congress).toBeGreaterThan(0);
    expect(snapshot.federal.checkedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    );
    expect(snapshot.state.checkedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    );
  });
});

describe("check: nothing changed", () => {
  it("exits 0 and writes a verdict where every source ran with no difference", async () => {
    const r = await run(["check"]);
    expect(r.code).toBe(0);
    expect(r.err).toBe("");
    expect(r.out).toContain("federal matches the snapshot");
    expect(r.verdict).toMatchObject({
      source: "us-clock-watch",
      status: "ran",
      federal: { status: "ran", congress: 119, differences: [] },
      state: { status: "ran", differences: [] },
      tz: {
        status: "ran",
        release: "2026e",
        snapshotRelease: "2026e",
        differences: [],
      },
    });
  });

  it("does not mind a new tz release that changes no US zone", async () => {
    const r = await run(["check"], {
      overrides: {
        "data.iana.org/time-zones/tzdb/version": () => reply("2026f\n"),
      },
    });
    expect(r.code).toBe(0);
    expect(r.verdict?.tz).toMatchObject({
      release: "2026f",
      snapshotRelease: "2026e",
      differences: [],
    });
  });
});

describe("check: federal bills", () => {
  const listOf = (...bills: unknown[]): Record<string, Handler> => ({
    "api.congress.gov/v3/bill/119": () =>
      reply({ bills, pagination: { count: bills.length } }),
  });

  it("flags a new bill whose title names the subject", async () => {
    const r = await run(["check"], {
      overrides: listOf(
        federalBill("HR", "1", "A bill about daylight saving time"),
        federalBill("S", "7", "To adopt permanent standard time"),
      ),
    });
    expect(r.code).toBe(1);
    expect(r.verdict?.federal.differences).toEqual([
      "new: S 7: To adopt permanent standard time (latest action 2026-01-02: Introduced)",
    ]);
    expect(r.verdict?.state.differences).toEqual([]);
  });

  it("flags a changed latest action", async () => {
    const r = await run(["check"], {
      overrides: listOf(
        federalBill(
          "HR",
          "1",
          "A bill about daylight saving time",
          "2026-10-20",
          "Passed the House",
        ),
      ),
    });
    expect(r.code).toBe(1);
    expect(r.verdict?.federal.differences).toEqual([
      "changed: HR 1: A bill about daylight saving time (latest action 2026-01-02: Introduced became 2026-10-20: Passed the House)",
    ]);
  });

  it("ignores a bill whose title is about something else", async () => {
    const r = await run(["check"], {
      overrides: listOf(
        federalBill("HR", "1", "A bill about daylight saving time"),
        federalBill("HR", "88", "A bill about farm subsidies"),
      ),
    });
    expect(r.code).toBe(0);
    expect(r.verdict?.federal.differences).toEqual([]);
  });

  it("flags a new congress and lists it from the start", async () => {
    const r = await run(["check"], {
      overrides: {
        "api.congress.gov/v3/congress/current": () =>
          reply({ congress: [{ number: 120, name: "120th Congress" }] }),
        "api.congress.gov/v3/bill/120": () =>
          reply({
            bills: [federalBill("HR", "5", "A bill on time zone boundaries")],
            pagination: { count: 1 },
          }),
      },
    });
    expect(r.code).toBe(1);
    expect(r.verdict?.federal.differences).toEqual([
      "a new session began: congress 120 (the snapshot has 119)",
      "new: HR 5: A bill on time zone boundaries (latest action 2026-01-02: Introduced)",
    ]);
    const list = r.calls.find((c) => c.url.pathname === "/v3/bill/120");
    expect(list?.url.searchParams.has("fromDateTime")).toBe(false);
  });

  it("lists the whole congress when the snapshot has no congress number", async () => {
    const snapshot = snapshotOf();
    snapshot.federal = { checkedAt: SNAPSHOT_DATE, congress: 0, bills: [] };
    const r = await run(["check"], { snapshot });
    expect(r.code).toBe(1);
    expect(r.verdict?.federal.differences).toEqual([
      "the snapshot has no congress number, so the whole congress was listed",
      "new: HR 1: A bill about daylight saving time (latest action 2026-01-02: Introduced)",
    ]);
  });

  it("reads every page of the list", async () => {
    const filler = Array.from({ length: 250 }, (_, i) =>
      federalBill("HR", String(1000 + i), "A bill about farm subsidies"),
    );
    const r = await run(["check"], {
      overrides: {
        "api.congress.gov/v3/bill/119": (url) =>
          url.searchParams.get("offset") === "0"
            ? reply({ bills: filler, pagination: { count: 251, next: "x" } })
            : reply({
                bills: [federalBill("S", "9", "A bill on time zone changes")],
                pagination: { count: 251 },
              }),
      },
    });
    expect(r.verdict?.federal.differences).toEqual([
      expect.stringContaining("new: S 9"),
    ]);
  });

  it("sends the documented parameters and the key in a header only", async () => {
    const r = await run(["check"]);
    const list = r.calls.find((c) => c.url.pathname === "/v3/bill/119");
    expect(Object.fromEntries(list!.url.searchParams)).toEqual({
      format: "json",
      limit: "250",
      offset: "0",
      fromDateTime: SNAPSHOT_DATE,
      sort: "updateDate desc",
    });
    expect(list!.headers["X-Api-Key"]).toBe(KEYS.CONGRESS_GOV_API_KEY);
    for (const call of r.calls) {
      expect(call.url.href).not.toContain(KEYS.CONGRESS_GOV_API_KEY);
      expect(call.url.href).not.toContain(KEYS.OPEN_STATES_API_KEY);
    }
  });

  // #526: HR 139 and S 29 are listed under a short title that names no subject term.
  it("finds a bill by its GovInfo title when its list title is a short title", async () => {
    const r = await run(["check"], {
      overrides: {
        "api.govinfo.gov/search": () =>
          reply(packages(["BILLS-119hr1ih", "BILLS-119s29is"])),
        "api.congress.gov/v3/bill/119/s/29": () =>
          reply({ bill: federalBill("S", "29", "A Short Title Act of 2025") }),
      },
    });
    expect(r.code).toBe(1);
    expect(r.verdict?.federal.differences).toEqual([
      "new: S 29: A Short Title Act of 2025 (latest action 2026-01-02: Introduced)",
    ]);
  });

  it("takes a GovInfo match from the list when the list has it, with no request of its own", async () => {
    const r = await run(["check"], {
      overrides: {
        ...listOf(
          federalBill("HR", "1", "A bill about daylight saving time"),
          federalBill("HR", "5", "A Short Title Act"),
        ),
        "api.govinfo.gov/search": () =>
          reply(packages(["BILLS-119hr1ih", "BILLS-119hr5ih"])),
      },
    });
    expect(r.verdict?.federal.differences).toEqual([
      "new: HR 5: A Short Title Act (latest action 2026-01-02: Introduced)",
    ]);
    expect(r.calls.some((c) => c.url.pathname === "/v3/bill/119/hr/5")).toBe(
      false,
    );
  });

  it("tracks a snapshot bill by its number, whatever its title", async () => {
    const snapshot = snapshotOf();
    snapshot.federal.bills = [federalBill("HR", "1", "A Short Title Act")];
    const r = await run(["check"], {
      snapshot,
      overrides: {
        ...listOf(
          federalBill(
            "HR",
            "1",
            "A Short Title Act",
            "2026-10-20",
            "Passed the House",
          ),
        ),
        "api.govinfo.gov/search": () => reply(packages([])),
      },
    });
    expect(r.verdict?.federal.differences).toEqual([
      "changed: HR 1: A Short Title Act (latest action 2026-01-02: Introduced became 2026-10-20: Passed the House)",
    ]);
  });

  it("reads one bill for each printed version, and none from another congress", async () => {
    const r = await run(["check"], {
      overrides: {
        "api.govinfo.gov/search": () =>
          reply(
            packages([
              "BILLS-119hr1ih",
              "BILLS-119hres7rh",
              "BILLS-119hres7eh",
              "BILLS-118hr2ih",
            ]),
          ),
        "api.congress.gov/v3/bill/119/hres/7": () =>
          reply({ bill: federalBill("HRES", "7", "Providing for a bill") }),
      },
    });
    expect(r.verdict?.federal.differences).toEqual([
      "new: HRES 7: Providing for a bill (latest action 2026-01-02: Introduced)",
    ]);
    const reads = r.calls.filter((c) =>
      c.url.pathname.startsWith("/v3/bill/119/"),
    );
    expect(reads.map((c) => c.url.pathname)).toEqual(["/v3/bill/119/hres/7"]);
  });

  it("searches GovInfo titles in the current congress, every page, the key in a header only", async () => {
    const bodies: Record<string, unknown>[] = [];
    const full = Array.from(
      { length: 100 },
      (_, i) => `BILLS-119hr${1000 + i}ih`,
    );
    const r = await run(["check"], {
      overrides: {
        "api.govinfo.gov/search": (_url, init) => {
          const body = JSON.parse(String(init?.body));
          bodies.push(body);
          return body.offsetMark === "*"
            ? reply(packages(full, "page-2"))
            : reply(packages(["BILLS-119hr1ih"], "page-3"));
        },
        ...listOf(
          federalBill("HR", "1", "A bill about daylight saving time"),
          ...full.map((id) =>
            federalBill("HR", id.slice(11, -2), "A Short Title Act"),
          ),
        ),
      },
    });
    expect(r.code).toBe(1);
    expect(r.verdict?.federal.differences).toHaveLength(100);
    expect(bodies).toEqual([
      {
        query:
          'collection:BILLS AND congress:119 AND title:("daylight saving time" OR "standard time" OR "time zone" OR "daylight savings time" OR "daylight time")',
        pageSize: 100,
        offsetMark: "*",
      },
      expect.objectContaining({ offsetMark: "page-2" }),
    ]);
    const search = r.calls.find((c) => c.url.host === "api.govinfo.gov");
    expect(search!.headers["X-Api-Key"]).toBe(KEYS.CONGRESS_GOV_API_KEY);
    expect(search!.headers["Content-Type"]).toBe("application/json");
    expect(search!.url.search).toBe("");
  });
});

describe("check: state bills", () => {
  const found = (...results: unknown[]): Record<string, Handler> => ({
    "v3.openstates.org/bills": () => reply(page(results)),
  });
  const texas = stateBill("Texas", "HB 9", "Relating to standard time");

  it("flags a new state bill, DC included", async () => {
    const r = await run(["check"], {
      overrides: found(
        texas,
        stateBill(
          "District of Columbia",
          "B26-1",
          "Time zone study",
          "2026-10-01",
          "Introduced",
          "state",
          "ocd-jurisdiction/country:us/district:dc/government",
        ),
      ),
    });
    expect(r.code).toBe(1);
    expect(r.verdict?.state.differences).toEqual([
      "new: District of Columbia 2025 B26-1: Time zone study (latest action 2026-10-01: Introduced)",
    ]);
  });

  it("flags a changed latest action", async () => {
    const r = await run(["check"], {
      overrides: found(
        stateBill(
          "Texas",
          "HB 9",
          "Relating to standard time",
          "2026-10-03",
          "Signed",
        ),
      ),
    });
    expect(r.code).toBe(1);
    expect(r.verdict?.state.differences).toEqual([
      "changed: Texas 2025 HB 9: Relating to standard time (latest action 2026-02-02: Filed became 2026-10-03: Signed)",
    ]);
  });

  it("ignores a result that is not a US state, DC or PR", async () => {
    const r = await run(["check"], {
      overrides: found(
        texas,
        stateBill(
          "United States",
          "HR 3",
          "Federal clock bill",
          "2026-10-01",
          "Introduced",
          "country",
          "ocd-jurisdiction/country:us/government",
        ),
        stateBill(
          "Elsewhere",
          "X 1",
          "Foreign clock bill",
          "2026-10-01",
          "Introduced",
          "state",
          "ocd-jurisdiction/country:ca/province:on/government",
        ),
      ),
    });
    expect(r.code).toBe(0);
    expect(r.verdict?.state.differences).toEqual([]);
  });

  it("searches every subject term, every jurisdiction, under ten requests a minute", async () => {
    const r = await run(["check"]);
    const searches = r.calls.filter((c) => c.url.pathname === "/bills");
    expect(searches.map((c) => c.url.searchParams.get("q"))).toEqual(
      SUBJECT_TERMS.map((term) => `"${term}"`),
    );
    for (const call of searches) {
      expect(Object.fromEntries(call.url.searchParams)).toMatchObject({
        action_since: "2026-11-01",
        sort: "latest_action_desc",
        per_page: "20",
        page: "1",
      });
      expect(call.url.searchParams.has("jurisdiction")).toBe(false);
      expect(call.headers["X-API-KEY"]).toBe(KEYS.OPEN_STATES_API_KEY);
    }
    expect(r.sleeps).toEqual([7000, 7000]);
  });
});

describe("check: tz rules", () => {
  it("flags every zone that names a changed rule", async () => {
    const text = changeNorthAmerica(
      "Rule\tUS\t2007\tmax\t-\tMar\tSun>=8",
      "Rule\tUS\t2007\tmax\t-\tMar\tSun>=9",
    );
    const r = await run(["check"], { overrides: serveNorthAmerica(text) });
    expect(r.code).toBe(1);
    expect([...r.verdict!.tz.differences].sort()).toEqual([
      "America/Detroit",
      "America/New_York",
    ]);
  });

  it("flags a zone and the link that points at it", async () => {
    const text = fixture("australasia").replace(
      "Rule\tGuam\t1977\tonly\t-\tApr\t24",
      "Rule\tGuam\t1977\tonly\t-\tApr\t25",
    );
    const r = await run(["check"], {
      overrides: {
        "data.iana.org/time-zones/tzdb/australasia": () => reply(text),
      },
    });
    expect(r.code).toBe(1);
    expect([...r.verdict!.tz.differences].sort()).toEqual([
      "Pacific/Guam",
      "Pacific/Saipan",
    ]);
  });

  it("flags nothing for a changed rule no listed zone uses", async () => {
    const text = changeNorthAmerica(
      "Rule\tCuba\t2013\tmax\t-\tMar\tSun>=8",
      "Rule\tCuba\t2013\tmax\t-\tMar\tSun>=9",
    );
    const r = await run(["check"], { overrides: serveNorthAmerica(text) });
    expect(r.code).toBe(0);
    expect(r.verdict?.tz.differences).toEqual([]);
  });

  it("flags nothing for an edit to comments and spacing", async () => {
    const text = changeNorthAmerica(
      "Rule\tUS\t2007\tmax\t-\tMar\tSun>=8\t2:00\t1:00\tD",
      "# a new comment line\nRule  US   2007 max - Mar Sun>=8  2:00  1:00  D # reworded",
    );
    const r = await run(["check"], { overrides: serveNorthAmerica(text) });
    expect(r.code).toBe(0);
    expect(r.verdict?.tz.differences).toEqual([]);
  });
});

describe("check: a source could not run", () => {
  it("names a missing secret, and the other sources still report", async () => {
    const r = await run(["check"], { env: {} });
    expect(r.code).toBe(2);
    expect(r.verdict?.federal).toEqual({
      status: "could-not-run",
      message: "secret `CONGRESS_GOV_API_KEY` is not set",
    });
    expect(r.verdict?.state).toEqual({
      status: "could-not-run",
      message: "secret `OPEN_STATES_API_KEY` is not set",
    });
    expect(r.verdict?.tz.status).toBe("ran");
    expect(r.calls.every((c) => c.url.host === "data.iana.org")).toBe(true);
  });

  it("treats an empty secret as missing", async () => {
    const r = await run(["check"], {
      env: { ...KEYS, OPEN_STATES_API_KEY: "" },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.state.status).toBe("could-not-run");
    expect(r.verdict?.federal.status).toBe("ran");
  });

  it("does not retry a 429", async () => {
    const r = await run(["check"], {
      overrides: {
        "api.congress.gov/v3/congress/current": () =>
          reply({ error: { code: "OVER_RATE_LIMIT" } }, {}, 429),
      },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.federal.status).toBe("could-not-run");
    expect(r.verdict?.federal.message).toContain("429");
    expect(r.verdict?.state.status).toBe("ran");
    expect(r.verdict?.tz.status).toBe("ran");
    expect(
      r.calls.filter((c) => c.url.host === "api.congress.gov"),
    ).toHaveLength(1);
  });

  it("reports an HTTP error", async () => {
    const r = await run(["check"], {
      overrides: { "v3.openstates.org/bills": () => reply("oops", {}, 500) },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.state.message).toBe(
      "HTTP 500 from v3.openstates.org/bills",
    );
    expect(
      r.calls.filter((c) => c.url.host === "v3.openstates.org"),
    ).toHaveLength(1);
  });

  // #526: Open States answers a long search with the odd 502; one must not cost a whole run.
  it("tries a gateway error again, after a pause, and carries on", async () => {
    let sent = 0;
    const r = await run(["check"], {
      overrides: {
        "v3.openstates.org/bills": () =>
          (sent += 1) === 1
            ? reply("<html>502</html>", {}, 502)
            : reply(page([])),
      },
    });
    expect(r.verdict?.state.status).toBe("ran");
    expect(
      r.calls.filter((c) => c.url.host === "v3.openstates.org"),
    ).toHaveLength(SUBJECT_TERMS.length + 1);
    expect(r.sleeps).toEqual([10_000, 7000, 7000, 7000]);
  });

  it("gives up on a gateway error after two more tries", async () => {
    const r = await run(["check"], {
      overrides: {
        "v3.openstates.org/bills": () => reply("<html>503</html>", {}, 503),
      },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.state.message).toBe(
      "HTTP 503 from v3.openstates.org/bills",
    );
    expect(
      r.calls.filter((c) => c.url.host === "v3.openstates.org"),
    ).toHaveLength(3);
    expect(r.verdict?.tz.status).toBe("ran");
  });

  it("reports a body that is not JSON", async () => {
    const r = await run(["check"], {
      overrides: {
        "api.congress.gov/v3/congress/current": () => reply("<html></html>"),
      },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.federal.message).toContain("is not JSON");
  });

  it("reports a congress body with no number", async () => {
    const r = await run(["check"], {
      overrides: {
        "api.congress.gov/v3/congress/current": () => reply({ congress: {} }),
      },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.federal.message).toContain("no congress number");
  });

  it("stops when the federal request budget is spent", async () => {
    const r = await run(["check"], { limits: { federalRequests: 1 } });
    expect(r.code).toBe(2);
    expect(r.verdict?.federal.message).toBe("request budget of 1 is spent");
    expect(r.verdict?.state.status).toBe("ran");
  });

  it("stops when the GovInfo request budget is spent", async () => {
    const full = Array.from({ length: 100 }, (_, i) => `BILLS-119hr${i}ih`);
    const r = await run(["check"], {
      limits: { govinfoRequests: 1 },
      overrides: { "api.govinfo.gov/search": () => reply(packages(full)) },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.federal.message).toBe("request budget of 1 is spent");
  });

  it("stops when the state request budget is spent", async () => {
    const r = await run(["check"], { limits: { stateRequests: 2 } });
    expect(r.code).toBe(2);
    expect(r.verdict?.state.message).toBe("request budget of 2 is spent");
    expect(r.verdict?.federal.status).toBe("ran");
  });

  it("gives up on an Open States request that outlasts its timeout", async () => {
    const r = await run(["check"], {
      limits: { stateTimeoutMs: 20 },
      overrides: { "v3.openstates.org/bills": hang },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.state.message).toContain(
      "network error from v3.openstates.org/bills",
    );
    expect(r.verdict?.federal.status).toBe("ran");
    expect(r.verdict?.tz.status).toBe("ran");
  });

  // #526: Open States can take a minute a page, so the check stops itself before the job's
  // timeout does, and the could-not-run issue is still filed.
  it("stops every source once the check's time limit runs out", async () => {
    const r = await run(["check"], {
      limits: { checkDeadlineMs: 20 },
      overrides: { "v3.openstates.org/bills": hang },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.federal.status).toBe("ran");
    expect(r.verdict?.state.message).toBe("the check's time limit ran out");
    expect(r.verdict?.tz.message).toBe("the check's time limit ran out");
  });

  it("keeps the check's time limit inside the workflow job's timeout", () => {
    const workflow = readFileSync(
      join(REPO, ".github/workflows/us-clock-watch.yml"),
      "utf8",
    );
    const minutes = Number(/timeout-minutes: (\d+)/.exec(workflow)?.[1]);
    expect(LIMITS.checkDeadlineMs).toBeLessThan(minutes * 60_000);
    expect(LIMITS.stateTimeoutMs).toBeLessThan(LIMITS.checkDeadlineMs);
  });

  it("stops when the rate limit left is below the floor", async () => {
    const r = await run(["check"], {
      overrides: {
        "api.congress.gov/v3/congress/current": () =>
          reply(
            { congress: { name: "119th Congress" } },
            {
              "x-ratelimit-remaining": "99",
            },
          ),
      },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.federal.message).toContain("X-RateLimit-Remaining is 99");
  });

  it("carries on while the rate limit left is at the floor", async () => {
    const r = await run(["check"], {
      overrides: {
        "api.congress.gov/v3/congress/current": () =>
          reply(
            { congress: { name: "119th Congress" } },
            {
              "x-ratelimit-remaining": "100",
            },
          ),
      },
    });
    expect(r.verdict?.federal.status).toBe("ran");
  });

  it("reports a tz file that cannot be fetched", async () => {
    const r = await run(["check"], {
      overrides: {
        "data.iana.org/time-zones/tzdb/backward": () => reply("gone", {}, 503),
      },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.tz.status).toBe("could-not-run");
    expect(r.verdict?.federal.status).toBe("ran");
  });

  it("exits 2 rather than 1 when one source differs and another could not run", async () => {
    const text = changeNorthAmerica(
      "Rule\tUS\t2007\tmax\t-\tMar\tSun>=8",
      "Rule\tUS\t2007\tmax\t-\tMar\tSun>=9",
    );
    const r = await run(["check"], {
      env: {},
      overrides: serveNorthAmerica(text),
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.tz.differences).not.toEqual([]);
  });

  it("writes a could-not-run verdict when the snapshot is unreadable", async () => {
    const root = makeRoot();
    writeFileSync(join(root, "scripts/us-clock-watch.snapshot.json"), "{");
    const r = await run(["check"], { root });
    expect(r.code).toBe(2);
    expect(r.verdict).toMatchObject({
      source: "us-clock-watch",
      status: "could-not-run",
    });
  });
});

describe("check --carry", () => {
  const CARRY = "artifacts/carry/us-clock-watch.snapshot.json";
  const LATER = "2026-11-10T07:20:00Z";
  const carried = (root: string) =>
    JSON.parse(readFileSync(join(root, CARRY), "utf8")) as Record<string, any>;
  const carry = (root: string, value: unknown) => {
    mkdirSync(join(root, "artifacts/carry"), { recursive: true });
    writeFileSync(
      join(root, CARRY),
      typeof value === "string" ? value : JSON.stringify(value),
    );
  };
  const texasRow = {
    jurisdiction: "Texas",
    session: "2025",
    identifier: "HB 9",
    title: "Relating to standard time",
    latestActionDate: "2026-02-02",
    latestActionDescription: "Filed",
  };
  const ohioRow = {
    jurisdiction: "Ohio",
    session: "2025",
    identifier: "SB 4",
    title: "Permanent standard time",
    latestActionDate: "2026-11-02",
    latestActionDescription: "Introduced",
  };
  const withNewBills: Record<string, Handler> = {
    "api.congress.gov/v3/bill/119": () =>
      reply({
        bills: [
          federalBill("HR", "1", "A bill about daylight saving time"),
          federalBill("S", "7", "To adopt permanent standard time"),
        ],
        pagination: { count: 2 },
      }),
    "v3.openstates.org/bills": () =>
      reply(
        page([
          stateBill("Texas", "HB 9", "Relating to standard time"),
          stateBill(
            "Ohio",
            "SB 4",
            "Permanent standard time",
            "2026-11-02",
            "Introduced",
          ),
        ]),
      ),
  };

  it("starts from the committed snapshot and writes the next one", async () => {
    const root = makeRoot();
    const r = await run(["check", `--carry=${CARRY}`], {
      root,
      overrides: withNewBills,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("no carried snapshot");
    expect(r.verdict?.federal.since).toBe(SNAPSHOT_DATE);
    expect(r.verdict?.state.since).toBe(SNAPSHOT_DATE);
    expect(r.verdict?.federal).not.toHaveProperty("next");
    expect(r.verdict?.state).not.toHaveProperty("next");
    const next = carried(root);
    expect(next.federal).toMatchObject({
      checkedAt: "2026-11-13T12:26:01Z",
      congress: 119,
    });
    expect(next.federal.bills.map((b: any) => `${b.type} ${b.number}`)).toEqual(
      ["HR 1", "S 7"],
    );
    expect(next.state.checkedAt).toBe("2026-11-13T12:26:01Z");
    expect(next.state.bills).toEqual([ohioRow, texasRow]);
    expect(next.tz).toEqual(snapshotOf().tz);
  });

  it("reports each change once: the next run compares with what the last one carried", async () => {
    const root = makeRoot();
    await run(["check", `--carry=${CARRY}`], { root, overrides: withNewBills });
    const r = await run(["check", `--carry=${CARRY}`], {
      root,
      overrides: withNewBills,
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain(
      "carried federal of 2026-11-13T12:26:01Z, state of 2026-11-13T12:26:01Z",
    );
    expect(r.verdict?.federal.differences).toEqual([]);
    expect(r.verdict?.state.differences).toEqual([]);
    expect(r.verdict?.federal.since).toBe("2026-11-13T12:26:01Z");
    const list = r.calls.find((c) => c.url.pathname === "/v3/bill/119");
    expect(list?.url.searchParams.get("fromDateTime")).toBe(
      "2026-11-13T00:00:00Z",
    );
  });

  it("ignores a carried part no newer than the committed one", async () => {
    const root = makeRoot();
    carry(root, {
      federal: { checkedAt: "2026-10-01T00:00:00Z", congress: 119, bills: [] },
      state: { checkedAt: SNAPSHOT_DATE, bills: [] },
    });
    const r = await run(["check", `--carry=${CARRY}`], { root });
    expect(r.code).toBe(0);
    expect(r.out).toContain("the carried snapshot is no newer");
    expect(r.verdict?.federal.since).toBe(SNAPSHOT_DATE);
  });

  it("takes each newer part on its own and never the carried tz", async () => {
    const root = makeRoot();
    carry(root, {
      federal: { checkedAt: "2026-10-01T00:00:00Z", congress: 119, bills: [] },
      state: { checkedAt: LATER, bills: [texasRow, ohioRow] },
      tz: { release: "1999a", zones: {} },
    });
    const r = await run(["check", `--carry=${CARRY}`], {
      root,
      overrides: withNewBills,
    });
    expect(r.out).toContain(`carried state of ${LATER}`);
    expect(r.verdict?.federal.differences).toEqual([
      "new: S 7: To adopt permanent standard time (latest action 2026-01-02: Introduced)",
    ]);
    expect(r.verdict?.state.differences).toEqual([]);
    expect(r.verdict?.tz.differences).toEqual([]);
    expect(carried(root).tz).toEqual(snapshotOf().tz);
  });

  it("carries a part forward unchanged when its source could not run", async () => {
    const root = makeRoot();
    const state = { checkedAt: LATER, bills: [texasRow, ohioRow] };
    carry(root, { state });
    const r = await run(["check", `--carry=${CARRY}`], {
      root,
      overrides: {
        ...withNewBills,
        "v3.openstates.org/bills": () => reply("limit", {}, 429),
      },
    });
    expect(r.code).toBe(2);
    expect(r.verdict?.state.status).toBe("could-not-run");
    const next = carried(root);
    expect(next.state).toEqual(state);
    expect(next.federal.checkedAt).toBe("2026-11-13T12:26:01Z");
  });

  it("keeps a part when no response carried a Date header", async () => {
    const root = makeRoot();
    const r = await run(["check", `--carry=${CARRY}`], {
      root,
      overrides: {
        "v3.openstates.org/bills": () =>
          new Response(JSON.stringify(page([])), { status: 200 }),
      },
    });
    expect(r.verdict?.state.status).toBe("ran");
    expect(carried(root).state).toEqual(snapshotOf().state);
  });

  it("falls back to the committed snapshot when the carried file does not parse", async () => {
    const root = makeRoot();
    carry(root, "{ not json");
    const r = await run(["check", `--carry=${CARRY}`], { root });
    expect(r.code).toBe(0);
    expect(r.out).toContain("the carried snapshot does not parse");
    expect(carried(root).federal.checkedAt).toBe("2026-11-13T12:26:01Z");
  });

  it("rejects a carried part that is not a snapshot part", async () => {
    const root = makeRoot();
    carry(root, {
      federal: { checkedAt: LATER, bills: [] },
      state: { checkedAt: "next week", bills: [] },
    });
    const r = await run(["check", `--carry=${CARRY}`], { root });
    expect(r.out).toContain("the carried snapshot is no newer");
    expect(r.verdict?.federal.since).toBe(SNAPSHOT_DATE);
  });

  it("writes no carried file without the option", async () => {
    const root = makeRoot();
    await run(["check"], { root });
    expect(existsSync(join(root, CARRY))).toBe(false);
  });
});

describe("no key leaks", () => {
  it("keeps both keys out of stdout, stderr and the verdict, even from an error that holds one", async () => {
    const r = await run(["check"], {
      overrides: {
        "api.congress.gov/v3/congress/current": () => {
          throw new Error(`socket closed for ${KEYS.CONGRESS_GOV_API_KEY}`);
        },
        "v3.openstates.org/bills": () => {
          throw new Error(`reset (${KEYS.OPEN_STATES_API_KEY})`);
        },
      },
    });
    expect(r.code).toBe(2);
    const verdictText = readFileSync(
      join(r.root, "artifacts/us-clock-watch.json"),
      "utf8",
    );
    for (const key of Object.values(KEYS)) {
      expect(r.out).not.toContain(key);
      expect(r.err).not.toContain(key);
      expect(verdictText).not.toContain(key);
    }
    expect(r.verdict?.federal.status).toBe("could-not-run");
    expect(r.verdict?.federal.message).toContain("socket closed");
  });

  it("names the host and path of a failed request, never its query", async () => {
    const r = await run(["check"], {
      overrides: {
        "v3.openstates.org/bills": () => reply("oops", {}, 500),
      },
    });
    expect(r.verdict?.state.message).not.toContain("?");
    expect(r.verdict?.state.message).not.toContain("action_since");
  });
});

describe("refresh", () => {
  it("needs both keys, exits 2 and writes nothing", async () => {
    const root = makeRoot();
    const before = readFileSync(
      join(root, "scripts/us-clock-watch.snapshot.json"),
      "utf8",
    );
    const r = await run(["refresh"], {
      root,
      env: { CONGRESS_GOV_API_KEY: KEYS.CONGRESS_GOV_API_KEY },
    });
    expect(r.code).toBe(2);
    expect(r.err).toContain("OPEN_STATES_API_KEY");
    expect(r.calls).toEqual([]);
    expect(
      readFileSync(join(root, "scripts/us-clock-watch.snapshot.json"), "utf8"),
    ).toBe(before);
  });

  it("writes the federal and state parts, which a later check then matches", async () => {
    const root = makeRoot({
      federal: { checkedAt: "", congress: 0, bills: [] },
      state: { checkedAt: "", bills: [] },
      tz: snapshotOf().tz,
    });
    const r = await run(["refresh"], { root });
    expect(r.code).toBe(0);
    expect(r.out).toContain("snapshot written: 1 federal bills (congress 119)");
    const written = JSON.parse(
      readFileSync(join(root, "scripts/us-clock-watch.snapshot.json"), "utf8"),
    );
    expect(written.federal).toEqual({
      checkedAt: "2026-11-13T12:26:01Z",
      congress: 119,
      bills: [federalBill("HR", "1", "A bill about daylight saving time")].map(
        ({ type, number, title, latestAction }) => ({
          type,
          number,
          title,
          latestAction,
        }),
      ),
    });
    expect(written.state.bills).toHaveLength(1);
    expect(r.calls.some((c) => c.url.searchParams.has("fromDateTime"))).toBe(
      false,
    );

    const again = await run(["check"], { root });
    expect(again.code).toBe(0);
  });

  it("takes in a bill GovInfo finds by title", async () => {
    const root = makeRoot();
    const r = await run(["refresh"], {
      root,
      overrides: {
        "api.govinfo.gov/search": () =>
          reply(packages(["BILLS-119hr1ih", "BILLS-119s29is"])),
        "api.congress.gov/v3/bill/119": () =>
          reply({
            bills: [
              federalBill("HR", "1", "A bill about daylight saving time"),
              federalBill("S", "29", "A Short Title Act of 2025"),
              federalBill("S", "30", "A bill about farm subsidies"),
            ],
            pagination: { count: 3 },
          }),
      },
    });
    expect(r.code).toBe(0);
    const written = JSON.parse(
      readFileSync(join(root, "scripts/us-clock-watch.snapshot.json"), "utf8"),
    );
    expect(
      written.federal.bills.map((b: { number: string }) => b.number),
    ).toEqual(["1", "29"]);
  });

  // The tz part follows the release the zone map is built from (`snapshot-tz`), not the newest.
  it("keeps the tz part, whatever the newest tz release holds", async () => {
    const root = makeRoot();
    const r = await run(["refresh"], {
      root,
      overrides: {
        "data.iana.org/time-zones/tzdb/version": () => reply("2026f\n"),
        ...serveNorthAmerica(
          changeNorthAmerica("Rule\tUS\t2007\tmax", "Rule\tUS\t2008\tmax"),
        ),
      },
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain("tz 2026e kept");
    expect(r.calls.some((c) => c.url.host === "data.iana.org")).toBe(false);
    const written = JSON.parse(
      readFileSync(join(root, "scripts/us-clock-watch.snapshot.json"), "utf8"),
    );
    expect(written.tz).toEqual(snapshotOf().tz);
  });

  // #526: a full listing is about 100 Open States pages, more than the 60 a check may send.
  it("lists the state bills under their own budget, paced like a check", async () => {
    const r = await run(["refresh"], { limits: { stateRequests: 1 } });
    expect(r.code).toBe(0);
    expect(r.sleeps).toEqual([7000, 7000]);

    const spent = await run(["refresh"], {
      limits: { stateRefreshRequests: 2 },
    });
    expect(spent.code).toBe(2);
    expect(spent.err).toContain("request budget of 2 is spent");
  });

  // Open States' 429 body: "exceeded limit of 250/day".
  it("keeps a refresh and a check inside the Open States daily limit", () => {
    expect(
      LIMITS.stateRefreshRequests + LIMITS.stateRequests,
    ).toBeLessThanOrEqual(250);
  });

  it("writes nothing when a source fails", async () => {
    const root = makeRoot();
    const before = readFileSync(
      join(root, "scripts/us-clock-watch.snapshot.json"),
      "utf8",
    );
    const r = await run(["refresh"], {
      root,
      overrides: { "v3.openstates.org/bills": () => reply("oops", {}, 500) },
    });
    expect(r.code).toBe(2);
    expect(r.err).toContain("refresh failed");
    expect(
      readFileSync(join(root, "scripts/us-clock-watch.snapshot.json"), "utf8"),
    ).toBe(before);
  });
});

describe("snapshot-tz", () => {
  it("rewrites only the tz part from an unpacked release", async () => {
    const root = makeRoot();
    const dir = mkdtempSync(join(tmpdir(), "us-clock-watch-tz-"));
    dirs.push(dir);
    for (const file of ["northamerica", "australasia", "backward"]) {
      cpSync(join(FIXTURES, file), join(dir, file));
    }
    writeFileSync(join(dir, "version"), "2026f\n");
    const r = await run(["snapshot-tz", `--dir=${dir}`], { root });
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([]);
    const written = JSON.parse(
      readFileSync(join(root, "scripts/us-clock-watch.snapshot.json"), "utf8"),
    );
    expect(written.tz.release).toBe("2026f");
    expect(written.tz.zones).toEqual(snapshotOf().tz.zones);
    expect(written.federal).toEqual(snapshotOf().federal);
  });

  it("needs a folder", async () => {
    const r = await run(["snapshot-tz"]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("Usage:");
  });
});

describe("the command line", () => {
  it("rejects an unknown command", async () => {
    const r = await run(["publish"]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("Usage: node scripts/us-clock-watch.mjs");
    expect(r.calls).toEqual([]);
  });

  it.each([["--carry="], ["--carry"], ["--dir=x"]])(
    "rejects check %s",
    async (arg) => {
      const r = await run(["check", arg]);
      expect(r.code).toBe(1);
      expect(r.err).toContain("Usage: node scripts/us-clock-watch.mjs");
      expect(r.calls).toEqual([]);
    },
  );
});
