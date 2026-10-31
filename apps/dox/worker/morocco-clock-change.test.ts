import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import {
  getDstTransitions,
  getTimeZoneOffset,
} from "@northguild/gmt/zoned/get";
import {
  MOROCCO_CHANGES,
  MOROCCO_PROBE,
  MOROCCO_ZONES,
  type MoroccoCheck,
} from "../src/lib/morocco-clock-change";
import moroccoZones from "../src/lib/morocco-region-zones.json";
import { STORED_MAX_LINES } from "../src/lib/clock-change-stored-lines";
import type { StoredCheck } from "../src/lib/clock-change-stored-lines";
import { handleCanadaClockChange } from "./canada-clock-change";
import { handleMoroccoClockChange } from "./morocco-clock-change";
import { checkRateLimit, resetRateLimitState } from "./rate-limit";
import { getUnixNow } from "@northguild/gmt/unix/get";

const NOW = "2026-10-25T12:00:00Z";
const URL = "https://northguild.dev/gmt/api/morocco-clock-change";

function get(ip = "1.2.3.4", method = "GET"): Promise<Response> {
  return handleMoroccoClockChange(
    new Request(URL, { method, headers: { "cf-connecting-ip": ip } }),
    {},
    () => NOW,
  );
}

async function check(): Promise<MoroccoCheck> {
  const response = await get("9.9.9.9");
  expect(response.status).toBe(200);
  return (await response.json()) as MoroccoCheck;
}

describe("GET /gmt/api/morocco-clock-change", () => {
  beforeEach(() => resetRateLimitState());

  it("answers JSON that is never cached, with the injected now", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(((await response.json()) as MoroccoCheck).now).toBe(NOW);
  });

  it("has 4 probe rows whose offsets equal the library's in this runtime", async () => {
    const { probe } = await check();
    expect(probe).toHaveLength(4);
    expect(probe.map((r) => [r.zone, r.instant, r.role])).toEqual(
      MOROCCO_ZONES.flatMap((zone) =>
        MOROCCO_PROBE.map((p) => [zone, p.iso, p.role]),
      ),
    );
    for (const row of probe) {
      expect(row.offset).toBe(getTimeZoneOffset(row.zone, row.instant));
    }
  });

  it("has 6 change rows whose present flag equals the library's transitions", async () => {
    const { changes } = await check();
    expect(changes).toHaveLength(6);
    for (const row of changes) {
      const has = [2026, 2027].some((year) =>
        getDstTransitions(row.zone, year).some((c) => c.instant === row.at),
      );
      expect(row.present).toBe(has);
    }
    expect(changes.map((c) => [c.zone, c.at, c.recordedBy])).toEqual(
      MOROCCO_ZONES.flatMap((zone) =>
        MOROCCO_CHANGES.map((c) => [zone, c.at, c.recordedBy]),
      ),
    );
  });

  it("has transitions for 2026 and 2027 in both zones, as the library lists them", async () => {
    const { transitions } = await check();
    expect(transitions.map((t) => [t.zone, t.year])).toEqual(
      MOROCCO_ZONES.flatMap((zone) => [
        [zone, 2026],
        [zone, 2027],
      ]),
    );
    for (const row of transitions) {
      expect(row.changes).toEqual(getDstTransitions(row.zone, row.year));
    }
  });

  it("has one map row per region zone, each kind computed from the library", async () => {
    const { zones } = await check();
    expect(zones.map((z) => z.zone)).toEqual(moroccoZones.zones);
    for (const zone of zones) {
      const a = getDstTransitions(zone.zone, 2026).length;
      const b = getDstTransitions(zone.zone, 2027).length;
      expect(zone.kind).toBe(
        b > 0 ? "changes-after" : a > 0 ? "stopped" : "none",
      );
      expect(zone.offset).toBe(getTimeZoneOffset(zone.zone, NOW));
    }
  });

  it("returns the same answer on a repeat call", async () => {
    expect(await check()).toEqual(await check());
  });

  it("answers HEAD like GET with no body, from the same bucket, prefixed morocco:", async () => {
    const head = await get("4.4.4.4", "HEAD");
    expect(head.status).toBe(200);
    expect(head.headers.get("cache-control")).toBe("no-store");
    expect(head.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(await head.text()).toBe("");
    for (let i = 0; i < 18; i++) await get("4.4.4.4", "HEAD");
    expect((await get("4.4.4.4")).status).toBe(200); // the 20th call
    const refused = await get("4.4.4.4");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    const policy = { max: 20, windowSeconds: 60 };
    expect(
      checkRateLimit("morocco:4.4.4.4", getUnixNow(), policy).allowed,
    ).toBe(false);
    expect(checkRateLimit("canada:4.4.4.4", getUnixNow(), policy).allowed).toBe(
      true,
    );
  });

  it("answers 429 with retry-after on the 21st GET from one client", async () => {
    for (let i = 0; i < 20; i++)
      expect((await get("5.5.5.5")).status).toBe(200);
    const refused = await get("5.5.5.5");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await get("6.6.6.6")).status).toBe(200);
  });

  it("does not let a Canada call spend the Morocco bucket", async () => {
    const canada = await handleCanadaClockChange(
      new Request("https://northguild.dev/gmt/api/canada-clock-change", {
        headers: { "cf-connecting-ip": "7.7.7.7" },
      }),
      {},
      () => NOW,
    );
    expect(canada.status).toBe(200);
    for (let i = 0; i < 20; i++)
      expect((await get("7.7.7.7")).status).toBe(200);
  });

  it("answers 405 with Allow for other methods", async () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const response = await get("1.2.3.4", method);
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD, POST");
    }
  });
});

function post(
  fields: Record<string, string | File>,
  ip = "7.7.7.7",
): Promise<Response> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return handleMoroccoClockChange(
    new Request(URL, {
      method: "POST",
      headers: { "cf-connecting-ip": ip },
      body: form,
    }),
    {},
  );
}

function stream(size: number, ip?: string): Request {
  return new Request(URL, {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      ...(ip ? { "cf-connecting-ip": ip } : {}),
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(size).fill(97));
        controller.close();
      },
    }),
    // @ts-expect-error `duplex` is required for a stream body and absent from the DOM type.
    duplex: "half",
  });
}

describe("POST /gmt/api/morocco-clock-change", () => {
  beforeEach(() => resetRateLimitState());

  it("answers 413 for a body over 65,536 bytes streamed with no content-length", async () => {
    const big = stream(65_537);
    expect(big.headers.has("content-length")).toBe(false);
    expect((await handleMoroccoClockChange(big, {})).status).toBe(413);
  });

  it("answers 429 once the bucket is spent", async () => {
    for (let i = 0; i < 20; i++) {
      expect(
        (await post({ lines: "", zone: "Africa/Casablanca" }, "8.8.8.8"))
          .status,
      ).toBe(200);
    }
    const refused = await post(
      { lines: "", zone: "Africa/Casablanca" },
      "8.8.8.8",
    );
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("answers 400 for a zone outside the two", async () => {
    expect((await post({ lines: "", zone: "America/Toronto" })).status).toBe(
      400,
    );
    const file = new File(["x"], "t.txt");
    expect((await post({ lines: "x", zone: file })).status).toBe(400);
  });

  it("answers 400 for a body that is not a form", async () => {
    const request = new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect((await handleMoroccoClockChange(request, {})).status).toBe(400);
  });

  it("keeps the cap of rows from one line more and says it truncated", async () => {
    const lines = Array.from({ length: STORED_MAX_LINES + 1 }, () => "x").join(
      "\n",
    );
    const body = (await (
      await post({ lines, zone: "Africa/Casablanca" })
    ).json()) as StoredCheck;
    expect(body.rows).toHaveLength(STORED_MAX_LINES);
    expect(body.truncated).toBe(true);
  });

  it("completes a typed zone and classifies with the library", async () => {
    const body = (await (
      await post({
        lines: "2026-11-16T09:00:00+01:00 Africa/Casablanca",
        zone: "Africa/El_Aaiun",
      })
    ).json()) as StoredCheck;
    expect(body.rows).toHaveLength(1);
    const row = body.rows[0]!;
    expect(row.value).toBe("2026-11-16T09:00:00+01:00[Africa/Casablanca]");
    expect(row.result).toEqual(classifyStoredZoned(row.value!));
  });

  it("gives a bare line the picked zone", async () => {
    const body = (await (
      await post({
        lines: "2026-11-16T09:00:00+01:00",
        zone: "Africa/El_Aaiun",
      })
    ).json()) as StoredCheck;
    expect(body.zone).toBe("Africa/El_Aaiun");
    expect(body.rows[0]!.value).toBe(
      "2026-11-16T09:00:00+01:00[Africa/El_Aaiun]",
    );
  });

  it("counts a File in lines as empty", async () => {
    const file = new File(["2026-11-16T09:00:00+01:00"], "t.txt");
    const response = await post({ lines: file, zone: "Africa/Casablanca" });
    expect(response.status).toBe(200);
    expect(((await response.json()) as StoredCheck).rows).toEqual([]);
  });
});
