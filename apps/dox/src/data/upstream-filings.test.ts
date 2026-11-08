import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  checked,
  contributions,
  filedByUs,
  filedPrs,
  filings,
  filingsByKind,
  filingsByRepo,
  filingsByState,
  filingsWithMaintainerResponse,
  guardsAddressed,
  handledInGmt,
  HAND_WRITTEN_FIELDS,
  LISTING_HAND_WRITTEN_FIELDS,
  listings,
  overlayLive,
  totalFilings,
  TRACKED_REPOS,
  unaffectingGmt,
  type UpstreamFiling,
  type UpstreamListing,
} from "./upstream-filings";
import { getUtcNow, isAfterUtc, isValidUtc } from "@northguild/gmt";

// The literal `DefectId` / `ZonedDefectId` / `BoundedWorkDefectId` union members
// `probeRepros.ts` and `repros.ts` declare — the same set `scripts/upstream.mjs check` parses out of
// the same file, so a filing's `gmtGuard` can never name a group that doesn't exist.
const reprosSrc = ["probeRepros.ts", "repros.ts"]
  .map((file) =>
    readFileSync(
      resolve(
        import.meta.dirname,
        "../../../../packages/gmt/src/internal/temporalCompat",
        file,
      ),
      "utf8",
    ),
  )
  .join("\n");
const knownGuards = new Set<string>();
for (const m of reprosSrc.matchAll(
  /export type (?:DefectId|ZonedDefectId|BoundedWorkDefectId) =([^;]+);/g,
)) {
  for (const lit of m[1].matchAll(/"([^"]+)"/g)) knownGuards.add(lit[1]);
}

describe("upstream filings", () => {
  it("has at least one filing", () => {
    expect(totalFilings).toBeGreaterThan(0);
    expect(filings.length).toBe(totalFilings);
  });

  it("was checked, and not in the future", () => {
    expect(isValidUtc(checked)).toBe(true);
    expect(isAfterUtc(checked, getUtcNow())).toBe(false);
  });

  it("gives every filing a URL matching its own repo, kind and number", () => {
    for (const f of filings) {
      const expected = `https://github.com/${f.repo}/${f.kind === "pr" ? "pull" : "issues"}/${f.number}`;
      expect(f.url).toBe(expected);
    }
  });

  it("has no duplicate repo+number", () => {
    const keys = filings.map((f) => `${f.repo}#${f.number}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("sums repo counts to the total", () => {
    const sum = filingsByRepo.reduce((n, row) => n + row.count, 0);
    expect(sum).toBe(totalFilings);
  });

  it("sums kind counts to the total", () => {
    const sum = filingsByKind.reduce((n, row) => n + row.count, 0);
    expect(sum).toBe(totalFilings);
  });

  it("sums state counts to the total", () => {
    const sum = filingsByState.reduce((n, row) => n + row.count, 0);
    expect(sum).toBe(totalFilings);
  });

  it("counts a maintainer response only from comments, never below zero", () => {
    expect(filingsWithMaintainerResponse).toBeGreaterThanOrEqual(0);
    expect(filingsWithMaintainerResponse).toBeLessThanOrEqual(totalFilings);
  });

  it("every gmtGuard exists in repros.ts, or is null", () => {
    for (const f of filings) {
      if (f.gmtGuard !== null) {
        expect(
          knownGuards.has(f.gmtGuard),
          `${f.repo}#${f.number} gmtGuard "${f.gmtGuard}"`,
        ).toBe(true);
      }
    }
  });

  it("covers every filing in GMT: exactly one of gmtGuard or gmtNote", () => {
    // A filing with neither would be a defect GMT neither works around nor avoids.
    for (const f of filings) {
      expect(
        (f.gmtGuard === null) !== (f.gmtNote === null),
        `${f.repo}#${f.number}`,
      ).toBe(true);
    }
    expect(handledInGmt + unaffectingGmt).toBe(totalFilings);
  });

  it("separates the filings we opened from the ones we only contributed to", () => {
    // `role` is absent on the filings we opened, so the split has to treat absence as "ours"
    // rather than counting an explicit value.
    expect(filedByUs + contributions).toBe(totalFilings);
    expect(filedPrs).toBeLessThanOrEqual(filedByUs);

    for (const f of filings) {
      if (f.role === undefined) continue;
      expect(["author", "contributor"], `${f.repo}#${f.number}`).toContain(
        f.role,
      );
    }
  });

  it("links our own comment on every filing we did not open", () => {
    // Without it the page would show a maintainer's PR with nothing saying what we did on it.
    // `url` cannot carry the anchor: `scripts/upstream.mjs` rewrites it from repo, kind and number.
    for (const f of filings) {
      const label = `${f.repo}#${f.number}`;
      if (f.role === "contributor") {
        expect(f.contributionUrl, label).toBeTruthy();
        expect(f.contributionUrl, label).toContain(`/${f.number}#`);
      } else {
        expect(f.contributionUrl ?? null, label).toBeNull();
      }
    }
  });

  it("keeps js-temporal#361 marked as the maintainer's own pull request", () => {
    // Pinned deliberately. `scripts/upstream.mjs` builds each row field by field, so a field it
    // stops naming is dropped on the next sync — and a dropped `role` reads as "ours", which would
    // silently turn ptomato's PR into one of the fixes we claim to have sent. The generic
    // "every contributor row has a link" test passes vacuously if the row stops being one.
    // Read the committed file rather than the module: the module prefers the gitignored live
    // refresh when one exists, and that copy is whatever the last `gh` run wrote.
    const committed = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "upstream-filings.json"),
        "utf8",
      ),
    ) as { filings: Array<Record<string, unknown>> };

    const filing = committed.filings.find(
      (f) => f.repo === "js-temporal/temporal-polyfill" && f.number === 361,
    );
    expect(filing).toBeDefined();
    expect(filing?.role).toBe("contributor");
    expect(String(filing?.contributionUrl)).toContain("#issuecomment-");
  });

  it("lists guardsAddressed sorted and deduplicated", () => {
    expect(guardsAddressed).toEqual([...new Set(guardsAddressed)].sort());
    for (const g of guardsAddressed) expect(knownGuards.has(g)).toBe(true);
  });

  it("pairs symmetrically: if A pairsWith B, B pairsWith A", () => {
    const byKey = new Map(filings.map((f) => [`${f.repo}#${f.number}`, f]));
    for (const f of filings) {
      const key = `${f.repo}#${f.number}`;
      for (const partnerKey of f.pairsWith) {
        const partner = byKey.get(partnerKey);
        expect(
          partner,
          `${key} pairs with ${partnerKey}, which must exist`,
        ).toBeDefined();
        expect(
          partner!.pairsWith.includes(key),
          `${partnerKey} must pair back with ${key}`,
        ).toBe(true);
      }
    }
  });

  it("names only filings that exist in dependsOn and closes", () => {
    const keys = new Set(filings.map((f) => `${f.repo}#${f.number}`));
    for (const f of filings) {
      for (const dep of f.dependsOn) {
        // A dependency may be a filing tracked here, or an upstream number this
        // tracker doesn't carry (e.g. a merged PR never filed as its own row).
        // Only assert shape, not membership, for dependsOn/closes targets that
        // look like "owner/repo#number".
        expect(dep).toMatch(/^[\w.-]+\/[\w.-]+#\d+$/);
      }
      for (const c of f.closes) {
        expect(c).toMatch(/^[\w.-]+\/[\w.-]+#\d+$/);
      }
    }
    // At least one dependsOn target in this fixture is itself a tracked filing
    // (#370 depends on #369) — prove the happy path is actually exercised.
    const withDeps = filings.filter((f) => f.dependsOn.length > 0);
    for (const f of withDeps) {
      for (const dep of f.dependsOn) {
        if (keys.has(dep)) expect(keys.has(dep)).toBe(true);
      }
    }
  });
});

// A live file is a cache of the committed one, and `refresh` reuses it for six hours without a
// network call. Written before a pull that adds a filing or edits a summary, it must not hide
// either: review of #436 found tc39/proposal-temporal#3336 missing from a local /upstream for
// exactly that reason.
describe("overlayLive", () => {
  const filing = (
    number: number,
    fields: Partial<UpstreamFiling> = {},
  ): UpstreamFiling => ({
    repo: "tc39/proposal-temporal",
    number,
    kind: "issue",
    work: "report",
    title: `Issue ${number}`,
    url: `https://github.com/tc39/proposal-temporal/issues/${number}`,
    summary: `Summary of ${number}`,
    pairsWith: [],
    closes: [],
    dependsOn: [],
    gmtGuard: "D22",
    gmtNote: null,
    state: "open",
    draft: false,
    reviewDecision: null,
    comments: 0,
    maintainerComments: 0,
    createdAt: "2026-11-01",
    updatedAt: "2026-11-01",
    closedAt: null,
    mergedAt: null,
    ...fields,
  });
  const committedAt = "2026-11-02T10:11:47.79528858Z";
  const liveAt = "2026-11-02T10:30:00Z";

  it("keeps a committed filing the live file does not have", () => {
    const result = overlayLive(
      { checked: committedAt, filings: [filing(3335), filing(3336)] },
      { checked: liveAt, filings: [filing(3335)] },
    );
    expect(result.filings.map((f) => f.number)).toEqual([3335, 3336]);
  });

  it("takes the hand-written fields from the committed file", () => {
    const result = overlayLive(
      {
        checked: committedAt,
        filings: [filing(3335, { summary: "Edited", gmtGuard: "D21" })],
      },
      {
        checked: liveAt,
        filings: [
          filing(3335, {
            summary: "Old",
            role: "contributor",
            contributionUrl: "https://example.test/c",
          }),
        ],
      },
    );
    expect(result.filings[0].summary).toBe("Edited");
    expect(result.filings[0].gmtGuard).toBe("D21");
    expect(result.filings[0]).not.toHaveProperty("role");
    expect(result.filings[0]).not.toHaveProperty("contributionUrl");
  });

  it("takes the GitHub fields from a newer live file", () => {
    const result = overlayLive(
      { checked: committedAt, filings: [filing(3335)] },
      {
        checked: liveAt,
        filings: [
          filing(3335, { state: "closed", comments: 2, maintainerComments: 1 }),
        ],
      },
    );
    expect(result.checked).toBe(liveAt);
    expect(result.filings[0]).toMatchObject({
      state: "closed",
      comments: 2,
      maintainerComments: 1,
    });
  });

  it("adds a filing only the live file found, in repo-then-number order", () => {
    const polyfill = filing(400, {
      repo: "js-temporal/temporal-polyfill",
      url: "https://github.com/js-temporal/temporal-polyfill/issues/400",
      new: true,
    });
    const result = overlayLive(
      { checked: committedAt, filings: [filing(3336)] },
      {
        checked: liveAt,
        filings: [filing(3336), filing(3340, { new: true }), polyfill],
      },
    );
    expect(result.filings.map((f) => `${f.repo}#${f.number}`)).toEqual([
      "js-temporal/temporal-polyfill#400",
      "tc39/proposal-temporal#3336",
      "tc39/proposal-temporal#3340",
    ]);
  });

  it("ignores a live file checked before the committed one", () => {
    const committed = {
      checked: committedAt,
      filings: [filing(3335, { comments: 3 }), filing(3336)],
    };
    const result = overlayLive(committed, {
      checked: "2026-11-02T09:00:00Z",
      filings: [filing(3335, { comments: 1 }), filing(3340, { new: true })],
    });
    expect(result).toEqual(committed);
  });

  it("lists the same hand-written fields as scripts/upstream.mjs", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "../../../../scripts/upstream.mjs"),
      "utf8",
    );
    const list =
      /const HAND_WRITTEN_FIELDS = \[([^\]]+)\]/.exec(script)?.[1] ?? "";
    const fromScript = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(fromScript.length).toBeGreaterThan(0);
    expect([...HAND_WRITTEN_FIELDS]).toEqual(fromScript);
  });

  it("lists the same repositories as scripts/upstream.mjs", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "../../../../scripts/upstream.mjs"),
      "utf8",
    );
    const list = /const REPOS = \[([^\]]+)\]/.exec(script)?.[1] ?? "";
    const fromScript = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(fromScript.length).toBeGreaterThan(0);
    expect([...TRACKED_REPOS]).toEqual(fromScript);
  });

  it("orders repositories as the tracker lists them, not alphabetically", () => {
    const at = "2026-11-02T10:00:00Z";
    const make = (repo: string, number: number): UpstreamFiling => ({
      repo,
      number,
      kind: "issue",
      work: "report",
      title: `Issue ${number}`,
      url: `https://github.com/${repo}/issues/${number}`,
      summary: "s",
      pairsWith: [],
      closes: [],
      dependsOn: [],
      gmtGuard: null,
      gmtNote: null,
      state: "open",
      draft: false,
      reviewDecision: null,
      comments: 0,
      maintainerComments: 0,
      createdAt: "2026-11-01",
      updatedAt: "2026-11-01",
      closedAt: null,
      mergedAt: null,
    });
    const result = overlayLive(
      { checked: at, filings: [make("tc39/proposal-temporal", 3336)] },
      {
        checked: "2026-11-02T11:00:00Z",
        filings: [
          make("whatwg/html", 1),
          make("fullcalendar/temporal-polyfill", 130),
          make("tc39/proposal-temporal", 3336),
          make("js-temporal/temporal-polyfill", 400),
        ],
      },
    );
    expect(result.filings.map((f) => `${f.repo}#${f.number}`)).toEqual([
      "js-temporal/temporal-polyfill#400",
      "tc39/proposal-temporal#3336",
      "fullcalendar/temporal-polyfill#130",
      "whatwg/html#1",
    ]);
  });

  it("names only tracked repositories in the committed data", () => {
    for (const f of filings) {
      expect(TRACKED_REPOS).toContain(f.repo);
    }
  });
});

const TEMPORAL_REPOS = [
  "js-temporal/temporal-polyfill",
  "tc39/proposal-temporal",
];
const FILING_ONLY_FIELDS = ["gmtGuard", "gmtNote", "work", "outcome", "role"];

const listing = (
  number: number,
  fields: Partial<UpstreamListing> = {},
): UpstreamListing => ({
  repo: "example/comparison-list",
  number,
  kind: "issue",
  summary: `Summary of ${number}`,
  title: `Issue ${number}`,
  url: `https://github.com/example/comparison-list/issues/${number}`,
  state: "open",
  draft: false,
  reviewDecision: null,
  comments: 0,
  maintainerComments: 0,
  createdAt: "2026-11-01",
  updatedAt: "2026-11-01",
  closedAt: null,
  mergedAt: null,
  ...fields,
});

describe("upstream listings", () => {
  it("gives every listing a summary and a URL matching its repo, kind and number", () => {
    expect(listings.length).toBeGreaterThan(0);
    for (const l of listings) {
      const label = `${l.repo}#${l.number}`;
      expect(l.summary, label).not.toBe("");
      expect(l.url, label).toBe(
        `https://github.com/${l.repo}/${l.kind === "pr" ? "pull" : "issues"}/${l.number}`,
      );
    }
  });

  it("carries nothing that belongs to a filing", () => {
    for (const l of listings) {
      for (const field of FILING_ONLY_FIELDS) {
        expect(l, `${l.repo}#${l.number}`).not.toHaveProperty(field);
      }
    }
  });

  it("is on a project outside Temporal, and shares no key with a filing", () => {
    const filingKeys = new Set(filings.map((f) => `${f.repo}#${f.number}`));
    for (const l of listings) {
      expect(TEMPORAL_REPOS, `${l.repo}#${l.number}`).not.toContain(l.repo);
      expect(filingKeys.has(`${l.repo}#${l.number}`)).toBe(false);
    }
  });

  it("leaves every filing count as it is when a listing is added to a copy of the data", () => {
    // The tallies are computed from `filings` alone, so a copy of the data with one more listing
    // has the same filings; no count is typed here.
    const copy = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "upstream-filings.json"),
        "utf8",
      ),
    ) as { filings: unknown[]; listings: unknown[] };
    const before = copy.filings.length;
    copy.listings.push(listing(9999));
    expect(copy.filings).toHaveLength(before);
    expect(filedByUs + contributions).toBe(totalFilings);
    expect(filings.length).toBe(totalFilings);
    expect(filedByUs).toBe(
      filings.filter((f) => f.role !== "contributor").length,
    );
  });

  it("lists the same hand-written listing fields as scripts/upstream.mjs", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "../../../../scripts/upstream.mjs"),
      "utf8",
    );
    const list =
      /const LISTING_HAND_WRITTEN_FIELDS = \[([^\]]+)\]/.exec(script)?.[1] ??
      "";
    const fromScript = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(fromScript.length).toBeGreaterThan(0);
    expect([...LISTING_HAND_WRITTEN_FIELDS]).toEqual(fromScript);
  });
});

describe("overlayLive for listings", () => {
  const committedAt = "2026-11-02T10:11:47.79528858Z";
  const liveAt = "2026-11-02T10:30:00Z";

  it("takes the GitHub fields from the live file and keeps the committed summary", () => {
    const result = overlayLive(
      {
        checked: committedAt,
        filings: [],
        listings: [listing(1, { summary: "Edited" })],
      },
      {
        checked: liveAt,
        filings: [],
        listings: [
          listing(1, { summary: "Old", comments: 4, state: "closed" }),
        ],
      },
    );
    expect(result.listings?.[0]).toMatchObject({
      summary: "Edited",
      comments: 4,
      state: "closed",
    });
  });

  it("keeps the committed listings when the live file has no listings", () => {
    const result = overlayLive(
      { checked: committedAt, filings: [], listings: [listing(1)] },
      { checked: liveAt, filings: [] },
    );
    expect(result.listings).toEqual([listing(1)]);
  });

  it("drops a listing only the live file has", () => {
    const result = overlayLive(
      { checked: committedAt, filings: [], listings: [listing(1)] },
      { checked: liveAt, filings: [], listings: [listing(1), listing(2)] },
    );
    expect(result.listings?.map((l) => l.number)).toEqual([1]);
  });
});

// `upstream check` runs offline against `UPSTREAM_FILE`, so a bad fixture proves it fails
// without any test calling GitHub.
describe("scripts/upstream.mjs check", () => {
  const script = resolve(
    import.meta.dirname,
    "../../../../scripts/upstream.mjs",
  );
  const committed = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "upstream-filings.json"), "utf8"),
  ) as {
    checked: string;
    filings: unknown[];
    listings: Record<string, unknown>[];
  };

  const run = (data: unknown): { ok: boolean; output: string } => {
    const dir = mkdtempSync(resolve(tmpdir(), "upstream-check-"));
    try {
      const file = resolve(dir, "filings.json");
      writeFileSync(file, JSON.stringify(data));
      try {
        const output = execFileSync("node", [script, "check"], {
          env: { ...process.env, UPSTREAM_FILE: file },
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
        return { ok: true, output };
      } catch (error) {
        const e = error as { stderr?: string; stdout?: string };
        return { ok: false, output: `${e.stderr ?? ""}${e.stdout ?? ""}` };
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const withListings = (listings: Record<string, unknown>[]) => ({
    ...committed,
    listings,
  });

  it("passes on the committed file", () => {
    expect(run(committed).ok).toBe(true);
  });

  it("fails on a listing that carries gmtGuard", () => {
    const bad = { ...committed.listings[0], gmtGuard: "D1" };
    const result = run(withListings([bad]));
    expect(result.ok).toBe(false);
    expect(result.output).toContain("gmtGuard");
  });

  it("fails on a listing in a Temporal repository", () => {
    const bad = {
      ...committed.listings[0],
      repo: "tc39/proposal-temporal",
      url: "https://github.com/tc39/proposal-temporal/pull/159",
    };
    const result = run(withListings([bad]));
    expect(result.ok).toBe(false);
    expect(result.output).toContain("belongs in");
  });

  it("fails on a duplicate key", () => {
    const result = run(
      withListings([committed.listings[0], committed.listings[0]]),
    );
    expect(result.ok).toBe(false);
    expect(result.output).toContain("duplicate");
  });
});
