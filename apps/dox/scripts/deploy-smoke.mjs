#!/usr/bin/env node
/**
 * Live redirect and routing checks for Dox after a deploy: the live rows of the redirect matrix
 * (context/domination/issues/CORE-86.md, Decisions D3 to D5). Run by
 * .github/workflows/deploy-dox.yml after `wrangler deploy`; run it by hand with
 *
 *     node apps/dox/scripts/deploy-smoke.mjs
 *
 * Node 22+, no dependencies. Rows 26-29 (the landing page, the zone and the landing's
 * robots.txt) belong to the landing repo's deploy and are checked by hand (runbook section 5).
 *
 * Requests go through `node:https`, not `fetch`: undici adds its own `sec-fetch-mode`
 * header, and the (N) rows must send exactly the headers a browser following a link sends.
 * Redirects are never followed by the client; each hop is a step in the row's chain.
 *
 * The whole set is retried up to 6 times, 10 s apart, for route propagation. The exit code
 * is 1 with a table of failures when the last attempt still fails. It does not roll back.
 */
import { readFileSync } from "node:fs";
import { request } from "node:https";

const ND = "https://northguild.dev";
const WD = "https://gmt-dox.northguild.workers.dev";
const ATTEMPTS = 6;
const WAIT_MS = 10_000;

const NAV = {
  "sec-fetch-mode": "navigate",
  "sec-fetch-dest": "document",
  accept: "text/html",
};

/** One request, no redirect following. Resolves to `{ status, location, type, headers, body }`. */
function send(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method,
        headers: {
          "user-agent": "gmt-dox-deploy-smoke",
          ...headers,
          ...(body === undefined
            ? {}
            : { "content-length": Buffer.byteLength(body) }),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            location: res.headers.location
              ? new URL(res.headers.location, url).href
              : undefined,
            type: res.headers["content-type"] ?? "",
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(20_000, () => req.destroy(new Error("timeout")));
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/**
 * Run one row: send the request, then check each expected step in turn. A step with
 * `then` is a redirect: its `location` must match and the next request goes there with the
 * same headers and a GET. A step with `optional` is skipped when the status differs (a
 * slash-less page may answer 307 first). `check(response)` may return a failure message.
 */
async function run(row) {
  let url = row.url;
  let method = row.method ?? "GET";
  let body = row.body;
  let response;
  for (let i = 0; i < row.steps.length; i += 1) {
    const step = row.steps[i];
    response ??= await send(method, url, { headers: row.headers, body });
    if (step.optional && response.status !== step.status) continue;
    if (response.status !== step.status) {
      return `step ${i + 1}: expected ${step.status}, got ${response.status} from ${url}`;
    }
    if (step.type && !response.type.includes(step.type)) {
      return `step ${i + 1}: expected content-type ${step.type}, got ${response.type}`;
    }
    if (step.location && response.location !== step.location) {
      return `step ${i + 1}: expected Location ${step.location}, got ${response.location}`;
    }
    if (step.check) {
      const problem = step.check(response);
      if (problem) return `step ${i + 1}: ${problem}`;
    }
    if (step.location) {
      url = response.location;
      method = "GET";
      body = undefined;
      response = undefined;
    }
  }
  return undefined;
}

/** A row that redirects once to `to`, then lands on `status`. */
const hop = (rows, label, from, to, { headers, final = 200 } = {}) =>
  rows.push({
    label,
    url: from,
    headers,
    steps: [{ status: 301, location: to }, { status: final }],
  });

async function buildRows() {
  const rows = [];
  const add = (r) => rows.push(r);

  for (const [label, headers] of [
    ["", undefined],
    ["(N) ", NAV],
  ]) {
    const n = (row) => (label ? `${row} ${label.trim()}` : row);
    hop(rows, n("1"), `${WD}/`, `${ND}/gmt/`, { headers });
    hop(
      rows,
      n("5/32"),
      `${WD}/guides/concepts/dst-disambiguation/`,
      `${ND}/gmt/guides/concepts/dst-disambiguation/`,
      { headers },
    );
    add({
      label: n("12/33"),
      url: `${WD}/reference/duty/?a=1`,
      headers,
      steps: [
        { status: 301, location: `${ND}/gmt/reference/duty/?a=1` },
        { status: 301, location: `${ND}/gmt/reference/workforce/?a=1` },
        { status: 200 },
      ],
    });
  }

  hop(rows, "3", `${WD}/reference/`, `${ND}/gmt/reference/`);
  add({
    label: "6",
    url: `${WD}/reference`,
    steps: [
      { status: 301, location: `${ND}/gmt/reference` },
      { status: 307, location: `${ND}/gmt/reference/` },
      { status: 200 },
    ],
  });
  hop(rows, "7 install.md", `${WD}/install.md`, `${ND}/gmt/install.md`);
  hop(rows, "7 llms.txt", `${WD}/llms.txt`, `${ND}/gmt/llms.txt`);
  hop(
    rows,
    "7 llms-full.txt",
    `${WD}/llms-full.txt`,
    `${ND}/gmt/llms-full.txt`,
  );

  // Row 8 needs the stylesheet the live home page links.
  const home = await send("GET", `${ND}/gmt/`);
  const css = /href="(\/gmt\/_astro\/[^"]+\.css)"/.exec(home.body)?.[1];
  if (css) hop(rows, "8", `${WD}${css.slice("/gmt".length)}`, `${ND}${css}`);
  else
    add({
      label: "8",
      url: `${ND}/gmt/`,
      steps: [
        {
          status: 200,
          check: () => "no /gmt/_astro/*.css link on the home page",
        },
      ],
    });

  for (const path of [
    "/favicon.svg",
    "/fonts/michroma-latin-400-normal.woff2",
    "/pagefind/pagefind.js",
    "/sitemap-index.xml",
  ]) {
    hop(rows, `10 ${path}`, `${WD}${path}`, `${ND}/gmt${path}`);
  }
  add({
    label: "11",
    url: `${WD}/robots.txt`,
    steps: [{ status: 301, location: `${ND}/robots.txt` }],
  });
  add({
    label: "13",
    url: `${WD}/reference/duty.md`,
    steps: [
      { status: 301, location: `${ND}/gmt/reference/duty.md` },
      { status: 301, location: `${ND}/gmt/reference/workforce.md` },
      { status: 200 },
    ],
  });
  // A moved page without its slash: no dot and no slash, so the Worker runs and hands it to the
  // assets binding, and only `_redirects` stands between it and the 404 page.
  add({
    label: "13 no slash",
    url: `${WD}/reference/duty`,
    steps: [
      { status: 301, location: `${ND}/gmt/reference/duty` },
      { status: 301, location: `${ND}/gmt/reference/workforce/` },
      { status: 200 },
    ],
  });
  add({
    label: "15",
    method: "POST",
    body: "",
    url: `${WD}/api/chat`,
    steps: [{ status: 400 }],
  });
  add({
    label: "16",
    url: `${WD}/api/brains`,
    steps: [{ status: 200, type: "json" }],
  });
  add({ label: "18", url: `${WD}/gmt/reference/`, steps: [{ status: 200 }] });

  for (const [label, headers] of [
    ["", undefined],
    ["(N) ", NAV],
  ]) {
    const n = (row) => (label ? `${row} ${label.trim()}` : row);
    add({
      label: n("19/34 /gmt"),
      url: `${ND}/gmt`,
      headers,
      steps: [{ status: 301, location: `${ND}/gmt/` }, { status: 200 }],
    });
    add({
      label: n("19/34 /gmt?a=1"),
      url: `${ND}/gmt?a=1`,
      headers,
      steps: [{ status: 301, location: `${ND}/gmt/?a=1` }, { status: 200 }],
    });
    add({
      label: n("20/35"),
      url: `${ND}/gmt/${label ? "reference/" : ""}`,
      headers,
      steps: [{ status: 200, type: "text/html" }],
    });
    add({
      label: n("21/36 /gmt/nope/"),
      url: `${ND}/gmt/nope/`,
      headers,
      steps: [{ status: 404, type: "text/html" }],
    });
    add({
      label: n("36 /gmt/nope"),
      url: `${ND}/gmt/nope`,
      headers,
      steps: [
        { status: 307, location: `${ND}/gmt/nope/`, optional: true },
        { status: 404, type: "text/html" },
      ],
    });
  }

  add({
    label: "22",
    url: `${ND}/gmt/api/brains`,
    steps: [{ status: 200, type: "json" }],
  });
  // The tzdb 2026e offsets at PROBE_INSTANT (PROBE_ZONES in src/lib/canada-clock-change.ts;
  // this script cannot import TypeScript, so the five literals are repeated here). When a later
  // tzdb changes one of these zones again this row fails on purpose: the fix is a page update,
  // not a retry.
  add({
    label: "canada-clock-change probe",
    url: `${ND}/gmt/api/canada-clock-change`,
    steps: [
      {
        status: 200,
        type: "json",
        check: ({ body }) => {
          const expected = {
            "America/Vancouver": "-07:00",
            "America/Edmonton": "-06:00",
            "Africa/Casablanca": "+00:00",
            "America/Inuvik": "-06:00",
            "America/Winnipeg": "-05:00",
          };
          let probe;
          try {
            probe = JSON.parse(body).probe;
          } catch {
            return "body is not JSON";
          }
          if (!Array.isArray(probe)) return "no probe array";
          const got = Object.fromEntries(probe.map((r) => [r.zone, r.offset]));
          const bad = Object.entries(expected).filter(
            ([zone, offset]) => got[zone] !== offset,
          );
          return bad.length
            ? `probe differs from tzdb 2026e: ${bad.map(([z, o]) => `${z} wanted ${o}, got ${got[z]}`).join("; ")}`
            : undefined;
        },
      },
    ],
  });
  // Report only. A kind is a reading of the Worker's tz data, which a later tzdb can change
  // again, so this row prints the kinds and fails only on the status or the body's shape. The
  // 2026e expectation is checked by hand against the deployed Worker. The three lines are
  // STORED_PRESET's Canadian lines (src/lib/canada-clock-change.ts).
  add({
    label: "canada-clock-change stored times (report only)",
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      zone: "America/Vancouver",
      lines: [
        "2026-11-15T09:00:00-08:00[America/Vancouver]",
        "2027-03-14T02:30:00-07:00[America/Edmonton]",
        "2026-11-01T01:30:00-05:00[America/Winnipeg]",
      ].join("\n"),
    }).toString(),
    url: `${ND}/gmt/api/canada-clock-change`,
    steps: [
      {
        status: 200,
        type: "json",
        check: ({ body }) => {
          let rows;
          try {
            rows = JSON.parse(body).rows;
          } catch {
            return "body is not JSON";
          }
          if (!Array.isArray(rows) || rows.length !== 3)
            return "expected 3 rows";
          console.log(
            `   stored times: ${rows.map((r) => `${r.line} ${r.result?.kind ?? "null"}`).join(", ")}`,
          );
          return undefined;
        },
      },
    ],
  });
  add({
    label: "23 POST",
    method: "POST",
    body: "",
    url: `${ND}/gmt/api/chat`,
    steps: [{ status: 400 }],
  });
  // The cap is read from its source so this row follows it: a Worker over its CPU budget answers
  // Error 1102, so a full-size POST must still answer 200.
  const storedMax = Number(
    /STORED_MAX_LINES = (\d+);/.exec(
      readFileSync(
        new URL("../src/lib/clock-change-stored-lines.ts", import.meta.url),
        "utf8",
      ),
    )?.[1],
  );
  if (!Number.isInteger(storedMax))
    throw new Error("STORED_MAX_LINES not found");
  add({
    label: `canada-clock-change stored times (${storedMax} lines)`,
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      zone: "America/Toronto",
      lines: Array.from(
        { length: storedMax },
        (_, i) =>
          `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}T12:00:00-05:00[America/Toronto]`,
      ).join("\n"),
    }).toString(),
    url: `${ND}/gmt/api/canada-clock-change`,
    steps: [
      {
        status: 200,
        type: "json",
        // Every line read, or the CPU guard tests fewer lines than the cap.
        check: ({ body }) => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            return "body is not JSON";
          }
          const { rows, truncated } = parsed;
          if (truncated !== false) return "truncated is not false";
          return rows?.length === storedMax
            ? undefined
            : `${rows?.length} rows, not ${storedMax}`;
        },
      },
    ],
  });
  add({ label: "23 GET", url: `${ND}/gmt/api/chat`, steps: [{ status: 405 }] });
  // The Morocco rows make five calls to the `morocco:` bucket per run, under its 20 a minute.
  // The two expected values are the tzdb 2026c offsets (Morocco on permanent +00 from
  // 2026-09-20), repeated here because this script cannot import TypeScript. When a later tzdb
  // changes Morocco again this row fails on purpose: the fix is a page update, not a retry.
  const MOROCCO_API = `${ND}/gmt/api/morocco-clock-change`;
  add({
    label: "morocco-clock-change probe",
    url: MOROCCO_API,
    steps: [
      {
        status: 200,
        type: "json",
        check: ({ body }) => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            return "body is not JSON";
          }
          const { probe, changes } = parsed;
          if (!Array.isArray(probe) || probe.length !== 4)
            return "expected 4 probe rows";
          if (!Array.isArray(changes)) return "no changes array";
          const bad = probe.filter((r) => r.offset !== "+00:00");
          if (bad.length)
            return `probe differs from tzdb 2026c: ${bad.map((r) => `${r.zone} at ${r.instant} wanted +00:00, got ${r.offset}`).join("; ")}`;
          const stale = changes.filter(
            (c) => c.recordedBy === "2026b" && c.present !== false,
          );
          if (stale.length)
            return `a change tzdb 2026c removed is still present: ${stale.map((c) => `${c.zone} ${c.at}`).join("; ")}`;
          const missing = changes.filter(
            (c) => c.recordedBy === "2026c" && c.present !== true,
          );
          if (missing.length)
            return `a change tzdb 2026c added is missing: ${missing.map((c) => `${c.zone} ${c.at}`).join("; ")}`;
          return undefined;
        },
      },
    ],
  });
  add({
    label: "morocco-clock-change HEAD",
    method: "HEAD",
    url: MOROCCO_API,
    steps: [
      {
        status: 200,
        check: ({ headers, body }) => {
          if (headers["cache-control"] !== "no-store")
            return `cache-control is ${headers["cache-control"]}, not no-store`;
          return body === "" ? undefined : "HEAD body is not empty";
        },
      },
    ],
  });
  add({
    label: "morocco-clock-change PUT",
    method: "PUT",
    body: "",
    url: MOROCCO_API,
    steps: [
      {
        status: 405,
        check: ({ headers }) =>
          headers.allow === "GET, HEAD, POST"
            ? undefined
            : `allow is ${headers.allow}, not GET, HEAD, POST`,
      },
    ],
  });
  // Report only, for the same reason as the Canada row. The three lines are Moroccan lines from
  // the checker's examples (src/lib/morocco-clock-change.ts).
  add({
    label: "morocco-clock-change stored times (report only)",
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      zone: "Africa/Casablanca",
      lines: [
        "2026-11-16T09:00:00+01:00[Africa/Casablanca]",
        "2027-03-14T02:30:00+00:00",
        "2027-06-01T09:00:00+00:00 Africa/El_Aaiun",
      ].join("\n"),
    }).toString(),
    url: MOROCCO_API,
    steps: [
      {
        status: 200,
        type: "json",
        check: ({ body }) => {
          let rows;
          try {
            rows = JSON.parse(body).rows;
          } catch {
            return "body is not JSON";
          }
          if (!Array.isArray(rows) || rows.length !== 3)
            return "expected 3 rows";
          console.log(
            `   stored times: ${rows.map((r) => `${r.line} ${r.result?.kind ?? "null"}`).join(", ")}`,
          );
          return undefined;
        },
      },
    ],
  });
  add({
    label: `morocco-clock-change stored times (${storedMax} lines)`,
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      zone: "Africa/Casablanca",
      lines: Array.from(
        { length: storedMax },
        (_, i) =>
          `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}T12:00:00+01:00[Africa/Casablanca]`,
      ).join("\n"),
    }).toString(),
    url: MOROCCO_API,
    steps: [
      {
        status: 200,
        type: "json",
        check: ({ body }) => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            return "body is not JSON";
          }
          const { rows, truncated } = parsed;
          if (truncated !== false) return "truncated is not false";
          return rows?.length === storedMax
            ? undefined
            : `${rows?.length} rows, not ${storedMax}`;
        },
      },
    ],
  });
  add({
    label: "morocco-clock-change page",
    url: `${ND}/gmt/check/morocco-2026-clock-change/`,
    steps: [{ status: 200, type: "text/html" }],
  });
  add({
    label: "morocco boundary file",
    url: `${ND}/gmt/timezone-boundaries-morocco.json`,
    steps: [
      {
        status: 200,
        type: "json",
        check: ({ body }) => {
          try {
            return JSON.parse(body).license === "ODbL-1.0"
              ? undefined
              : "license is not ODbL-1.0";
          } catch {
            return "body is not JSON";
          }
        },
      },
    ],
  });
  add({
    label: "25",
    url: `${ND}/gmtx`,
    steps: [{ status: 301, location: `${ND}/gmt/gmtx` }, { status: 404 }],
  });
  add({
    label: "30",
    url: `${ND}/gmt/sitemap-index.xml`,
    steps: [
      {
        status: 200,
        check: ({ body }) => {
          const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
            (m) => m[1],
          );
          if (locs.length === 0) return "no <loc> entries";
          const bad = locs.filter((l) => !l.startsWith(`${ND}/gmt/`));
          return bad.length ? `<loc> outside ${ND}/gmt/: ${bad[0]}` : undefined;
        },
      },
    ],
  });
  return rows;
}

async function attempt() {
  const failures = [];
  for (const row of await buildRows()) {
    let problem;
    try {
      problem = await run(row);
    } catch (error) {
      problem = `request failed: ${error.message}`;
    }
    if (problem) failures.push({ row: row.label, url: row.url, problem });
  }
  return failures;
}

let failures = [];
for (let i = 1; i <= ATTEMPTS; i += 1) {
  failures = await attempt();
  if (failures.length === 0) {
    console.log(`deploy-smoke: every row passed (attempt ${i}).`);
    process.exit(0);
  }
  console.log(
    `deploy-smoke: attempt ${i}/${ATTEMPTS} failed ${failures.length} row(s).`,
  );
  if (i < ATTEMPTS) await new Promise((r) => setTimeout(r, WAIT_MS));
}
console.error("\ndeploy-smoke: failures after the last attempt\n");
console.table(failures);
process.exit(1);
