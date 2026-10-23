import type { ClockCheckFacts } from "../src/lib/clock-check/facts";
import {
  clockCheckHandler,
  computeStoredCheck,
  probeRows,
  transitionRows,
  zoneNow,
} from "./clock-check";
import { resetRateLimitState } from "./rate-limit";

const FACTS: ClockCheckFacts = {
  id: "demo",
  probeInstant: "2026-11-02T12:00:00Z",
  probe: [
    {
      zone: "America/Vancouver",
      offset: "-07:00",
      oldOffset: "-08:00",
      release: "2026b",
    },
  ],
  transitionYears: [2026, 2027],
  clockZones: ["America/Vancouver"],
  storedZones: ["America/Vancouver", "America/Toronto"],
};
const NOW = "2026-10-22T12:00:00Z";
const handler = clockCheckHandler({
  facts: FACTS,
  limit: { max: 3, windowSeconds: 60 },
  compute: (now) => ({
    now,
    probe: probeRows(FACTS),
    zones: [zoneNow("America/Vancouver", now)],
  }),
});

function call(method: string, init: RequestInit = {}, ip = "1.2.3.4") {
  return handler(
    new Request("https://example.test/gmt/api/demo-clock-change", {
      method,
      ...init,
      headers: { "cf-connecting-ip": ip, ...(init.headers as object) },
    }),
    {},
    () => NOW,
  );
}

function form(lines: string, zone = "America/Vancouver"): FormData {
  const body = new FormData();
  body.set("lines", lines);
  body.set("zone", zone);
  return body;
}

describe("the shared handler", () => {
  beforeEach(() => resetRateLimitState());

  it("answers the checker's compute, never cached", async () => {
    const response = await call("GET");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { now: string; probe: unknown[] };
    expect(body.now).toBe(NOW);
    expect(body.probe).toEqual([
      { zone: "America/Vancouver", offset: "-07:00" },
    ]);
  });

  it("refuses other methods with the allowed three", async () => {
    const response = await call("PUT");
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD, POST");
  });

  it("answers HEAD with the GET status and no body", async () => {
    const response = await call("HEAD");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("limits per checker and client", async () => {
    for (let i = 0; i < 3; i += 1) expect((await call("GET")).status).toBe(200);
    expect((await call("GET")).status).toBe(429);
    expect((await call("GET", {}, "5.6.7.8")).status).toBe(200);
  });

  it("checks posted lines, and rejects a zone that is not listed", async () => {
    const ok = await call("POST", {
      body: form("2026-11-15T09:00:00-08:00[America/Vancouver]"),
    });
    expect(ok.status).toBe(200);
    const check = (await ok.json()) as { zone: string; rows: unknown[] };
    expect(check.zone).toBe("America/Vancouver");
    expect(check.rows).toHaveLength(1);
    const bad = await call("POST", { body: form("x", "Europe/Paris") });
    expect(bad.status).toBe(400);
  });

  it("answers 413 before it looks at the bucket", async () => {
    const big = form("x".repeat(70_000));
    for (let i = 0; i < 4; i += 1) {
      expect((await call("POST", { body: big })).status).toBe(413);
    }
  });
});

describe("the shared computations", () => {
  it("reads the probe offsets from the library", () => {
    expect(probeRows(FACTS)).toEqual([
      { zone: "America/Vancouver", offset: "-07:00" },
    ]);
    expect(probeRows(FACTS)).toBe(probeRows(FACTS));
  });

  it("finds a zone's last and next change", () => {
    const now = zoneNow("America/Toronto", NOW);
    expect(now.offset).toBe("-04:00");
    expect(now.next?.instant.slice(0, 10)).toBe("2026-11-01");
  });

  it("lists the transitions of the years asked for", () => {
    const rows = transitionRows(["America/Toronto"], [2026, 2027]);
    expect(rows.filter((row) => row.year === 2026)).toHaveLength(2);
    expect(rows[0]!.wallBefore).not.toBe("");
  });

  it("caps and completes lines", () => {
    const check = computeStoredCheck(
      "2026-11-15T09:00:00-05:00",
      "America/Toronto",
    );
    expect(check.truncated).toBe(false);
    expect(check.rows[0]!.value).toBe(
      "2026-11-15T09:00:00-05:00[America/Toronto]",
    );
  });
});
