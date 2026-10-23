import { isAfterUtc } from "@northguild/gmt/utc/compare";
import { convertUtcToPlainDateTime } from "@northguild/gmt/utc/convert";
import {
  getDstTransitions,
  getTimeZoneOffset,
} from "@northguild/gmt/zoned/get";
import canadaZones from "../src/lib/canada-zones.json";
import {
  PROBE_INSTANT,
  PROBE_ZONES,
  TRANSITION_ZONES,
  type CanadaCheck,
} from "../src/lib/canada-clock-change";
import { getUnixNowMs } from "./clock";
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import {
  STORED_MAX_BYTES,
  STORED_MAX_LINES,
  type StoredCheck,
} from "../src/lib/clock-change-stored-lines";
import { STORED_PRESET } from "../src/lib/canada-clock-change";
import { handleCanadaClockChange } from "./canada-clock-change";
import { resetRateLimitState } from "./rate-limit";
import { checkRateLimit } from "./rate-limit";

const NOW = "2026-10-22T12:00:00Z";

function get(ip = "1.2.3.4", now = NOW, method = "GET"): Promise<Response> {
  return handleCanadaClockChange(
    new Request("https://northguild.dev/gmt/api/canada-clock-change", {
      method,
      headers: { "cf-connecting-ip": ip },
    }),
    {},
    () => now,
  );
}

async function check(now = NOW): Promise<CanadaCheck> {
  const response = await get("9.9.9.9", now);
  expect(response.status).toBe(200);
  return (await response.json()) as CanadaCheck;
}

describe("GET /gmt/api/canada-clock-change", () => {
  beforeEach(() => resetRateLimitState());

  it("answers JSON that is never cached", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("echoes the injected now", async () => {
    expect((await check()).now).toBe(NOW);
  });

  it("probe rows equal the library's offsets in this runtime", async () => {
    const { probe } = await check();
    expect(probe.map((row) => row.zone)).toEqual(
      PROBE_ZONES.map((fact) => fact.zone),
    );
    for (const row of probe) {
      expect(row.offset).toBe(getTimeZoneOffset(row.zone, PROBE_INSTANT));
    }
  });

  it("transition rows equal getDstTransitions plus the wall time before", async () => {
    const { transitions } = await check();
    for (const zone of TRANSITION_ZONES) {
      for (const year of [2026, 2027] as const) {
        const rows = transitions.filter(
          (row) => row.zone === zone && row.year === year,
        );
        const expected = getDstTransitions(zone, year);
        expect(
          rows.map(({ instant, offsetBefore, offsetAfter }) => ({
            instant,
            offsetBefore,
            offsetAfter,
          })),
        ).toEqual(expected);
        for (const row of rows) {
          expect(row.wallBefore).toBe(
            convertUtcToPlainDateTime(row.instant, {
              timeZone: row.offsetBefore,
            }),
          );
        }
      }
    }
  });

  it("orders transitions by zone order, then instant", async () => {
    const { transitions } = await check();
    const order = transitions.map((row) => TRANSITION_ZONES.indexOf(row.zone));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const zone of TRANSITION_ZONES) {
      const instants = transitions
        .filter((row) => row.zone === zone)
        .map((row) => row.instant);
      expect(instants).toEqual([...instants].sort());
    }
  });

  it("has one map row per generated zone, each with exactly one kind", async () => {
    const { zones } = await check();
    expect(zones).toHaveLength(canadaZones.zones.length);
    expect(new Set(zones.map((z) => z.zone)).size).toBe(zones.length);
    for (const zone of zones) {
      const a = getDstTransitions(zone.zone, 2026).length;
      const b = getDstTransitions(zone.zone, 2027).length;
      const kind = b > 0 ? "changes-after" : a > 0 ? "stopped" : "none";
      expect(zone.kind).toBe(kind);
      expect(zone.offset).toBe(getTimeZoneOffset(zone.zone, NOW));
    }
  });

  it("finds last and next around a 2026 change", async () => {
    // Toronto changes its clocks: 2026-03-08 and 2026-11-01 (-05:00 -> -04:00 -> -05:00).
    const june = (await check("2026-06-01T00:00:00Z")).zones.find(
      (z) => z.zone === "America/Toronto",
    );
    expect(june?.last?.instant).toBe("2026-03-08T07:00:00Z");
    expect(june?.next?.instant).toBe("2026-11-01T06:00:00Z");

    const before = (await check("2026-01-15T00:00:00Z")).zones.find(
      (z) => z.zone === "America/Toronto",
    );
    expect(before?.last?.instant).toBe("2025-11-02T06:00:00Z");
    expect(before?.next?.instant).toBe("2026-03-08T07:00:00Z");
  });

  it("steps into the next year: Toronto in December has last in November and next in March", async () => {
    const toronto = (await check("2026-12-20T12:00:00Z")).zones.find(
      (z) => z.zone === "America/Toronto",
    );
    expect(toronto?.last?.instant).toBe("2026-11-01T06:00:00Z");
    expect(toronto?.next?.instant).toBe("2027-03-14T07:00:00Z");
  });

  it("gives next null for a zone that stopped changing, as the library says", async () => {
    // Whether Vancouver still changes depends on this runtime's tz data, so read it from the library.
    const after = "2026-12-20T12:00:00Z";
    const vancouver = (await check(after)).zones.find(
      (z) => z.zone === "America/Vancouver",
    );
    const later = [2026, 2027, 2028]
      .flatMap((y) => getDstTransitions("America/Vancouver", y))
      .filter((c) => isAfterUtc(c.instant, after));
    expect(vancouver?.next?.instant ?? null).toBe(later[0]?.instant ?? null);
  });

  it("returns the same answer on a repeat call (memoised tables)", async () => {
    const first = await check();
    const second = await check();
    expect(second).toEqual(first);
  });

  it("treats a change exactly at now as last, not next", async () => {
    const at = (await check("2026-03-08T07:00:00Z")).zones.find(
      (z) => z.zone === "America/Toronto",
    );
    expect(at?.last?.instant).toBe("2026-03-08T07:00:00Z");
    expect(at?.next?.instant).toBe("2026-11-01T06:00:00Z");
  });

  it("gives a zone with no change in the window null for both", async () => {
    const regina = (await check()).zones.find(
      (z) => z.zone === "America/Regina",
    );
    expect(regina?.kind).toBe("none");
    expect(regina?.last).toBeNull();
    expect(regina?.next).toBeNull();
  });

  it("answers 405 with Allow for other methods", async () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const response = await get("1.2.3.4", NOW, method);
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD, POST");
    }
  });

  it("answers HEAD like GET with no body, from the same bucket", async () => {
    const head = await get("4.4.4.4", NOW, "HEAD");
    const full = await get("4.4.4.4", NOW, "GET");
    expect(head.status).toBe(200);
    expect(head.headers.get("content-type")).toBe(
      full.headers.get("content-type"),
    );
    expect(head.headers.get("cache-control")).toBe("no-store");
    expect(await head.text()).toBe("");
    for (let i = 0; i < 18; i++) await get("4.4.4.4", NOW, "HEAD");
    const refused = await get("4.4.4.4", NOW, "HEAD");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await refused.text()).toBe("");
    expect((await get("4.4.4.4")).status).toBe(429);
  });

  it("answers 429 with retry-after on the 21st GET from one client in a window", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await get("5.5.5.5")).status).toBe(200);
    }
    const refused = await get("5.5.5.5");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await refused.json()).toEqual({
      error: "Too many requests. Please slow down.",
      retryable: true,
    });
    expect((await get("6.6.6.6")).status).toBe(200);
  });

  it("keeps its bucket apart from the chat's, in both directions", async () => {
    const policy = { max: 20, windowSeconds: 60 };
    for (let i = 0; i < 20; i++) await get("7.7.7.7");
    expect((await get("7.7.7.7")).status).toBe(429);
    // The chat key for the same client is untouched.
    expect(checkRateLimit("chat:7.7.7.7", getUnixNowMs(), policy).allowed).toBe(
      true,
    );

    resetRateLimitState();
    const t = getUnixNowMs();
    for (let i = 0; i < 20; i++) checkRateLimit("chat:8.8.8.8", t, policy);
    expect(checkRateLimit("chat:8.8.8.8", t, policy).allowed).toBe(false);
    expect((await get("8.8.8.8")).status).toBe(200);
  });
});

const URL = "https://northguild.dev/gmt/api/canada-clock-change";

function post(
  fields: Record<string, string | File>,
  options: { ip?: string; multipart?: boolean; length?: string | null } = {},
): Promise<Response> {
  // A constructed Request has no content-length; the wire has one, so state a small real one.
  const { ip = "7.7.7.7", multipart = true, length = "100" } = options;
  let body: BodyInit;
  const headers: Record<string, string> = { "cf-connecting-ip": ip };
  if (multipart) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    body = form;
  } else {
    body = new URLSearchParams(fields as Record<string, string>).toString();
    headers["content-type"] = "application/x-www-form-urlencoded";
  }
  const request = new Request(URL, { method: "POST", headers, body });
  if (length === null) request.headers.delete("content-length");
  else request.headers.set("content-length", length);
  return handleCanadaClockChange(request, {});
}

describe("POST /gmt/api/canada-clock-change", () => {
  beforeEach(() => resetRateLimitState());

  it("classifies each line with this runtime's library", async () => {
    const response = await post({
      lines: STORED_PRESET,
      zone: "America/Toronto",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as StoredCheck;
    expect(body.zone).toBe("America/Toronto");
    expect(body.truncated).toBe(false);
    expect(body.rows).toHaveLength(8);
    for (const row of body.rows) {
      expect(row.value).toBe(row.input);
      expect(row.result).toEqual(classifyStoredZoned(row.value!));
    }
  });

  it("gives the Toronto preset lines all five kinds on any tz data", async () => {
    const body = (await (
      await post({ lines: STORED_PRESET, zone: "America/Toronto" })
    ).json()) as StoredCheck;
    expect(body.rows.slice(0, 5).map((row) => row.result?.kind)).toEqual([
      "valid",
      "validInOverlap",
      "offsetMismatch",
      "ambiguous",
      "nonexistent",
    ]);
  });

  it("completes a zone from the typed or picked one, and answers url-encoded forms", async () => {
    const body = (await (
      await post(
        {
          lines: [
            "2026-07-01T12:00:00-04:00",
            "2026-07-01T12:00:00-04:00 America/Toronto",
            "2026-07-01T12:00:00-04:00 America/Toronto extra",
          ].join("\r\n"),
          zone: "America/Toronto",
        },
        { multipart: false },
      )
    ).json()) as StoredCheck;
    expect(body.rows.map((r) => r.value)).toEqual([
      "2026-07-01T12:00:00-04:00[America/Toronto]",
      "2026-07-01T12:00:00-04:00[America/Toronto]",
      null,
    ]);
    expect(body.rows[2]!.result).toBeNull();
  });

  it("counts a File in lines as empty and a File in zone as a bad zone", async () => {
    const file = new File(["2026-07-01T12:00:00-04:00"], "t.txt");
    const empty = await post({ lines: file, zone: "America/Toronto" });
    expect(empty.status).toBe(200);
    expect(((await empty.json()) as StoredCheck).rows).toEqual([]);
    const bad = await post({ lines: "x", zone: file });
    expect(bad.status).toBe(400);
  });

  it("answers 400 for a zone outside the five, and for a body that is not a form", async () => {
    expect((await post({ lines: "", zone: "Europe/Paris" })).status).toBe(400);
    const request = new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "2" },
      body: "{}",
    });
    expect((await handleCanadaClockChange(request, {})).status).toBe(400);
  });

  it("does not trust content-length: none or a wrong one still reads the form", async () => {
    const none = await post(
      { lines: "2026-07-01T12:00:00-04:00", zone: "America/Toronto" },
      { length: null },
    );
    expect(none.status).toBe(200);
    expect(((await none.json()) as StoredCheck).rows).toHaveLength(1);
    for (const length of ["1e3", "0x10", "-1", "9999999"]) {
      const odd = await post(
        { lines: "x", zone: "America/Toronto" },
        { length },
      );
      expect(odd.status).toBe(200);
    }
  });

  it("answers 400 for no body", async () => {
    const request = new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect((await handleCanadaClockChange(request, {})).status).toBe(400);
  });

  it("answers 413 at 65,537 streamed bytes without a length, and reads 65,536", async () => {
    const stream = (size: number) =>
      new Request(URL, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(size).fill(97));
            controller.close();
          },
        }),
        // @ts-expect-error `duplex` is required for a stream body and absent from the DOM type.
        duplex: "half",
      });
    const big = stream(65_537);
    expect(big.headers.has("content-length")).toBe(false);
    expect((await handleCanadaClockChange(big, {})).status).toBe(413);
    // 65,536 bytes is read, then is not a form: 400, not 413.
    expect((await handleCanadaClockChange(stream(65_536), {})).status).toBe(
      400,
    );
  });

  it("reads a form of exactly 65,536 bytes sent in many chunks", async () => {
    const head = "zone=America%2FToronto&lines=";
    const text = head + "a".repeat(65_536 - head.length);
    const bytes = new TextEncoder().encode(text);
    expect(bytes.byteLength).toBe(65_536);
    const request = new Request(URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "cf-connecting-ip": "6.6.6.6",
      },
      body: new ReadableStream({
        start(controller) {
          for (let at = 0; at < bytes.byteLength; at += 2_000)
            controller.enqueue(bytes.slice(at, at + 2_000));
          controller.close();
        },
      }),
      // @ts-expect-error `duplex` is required for a stream body and absent from the DOM type.
      duplex: "half",
    });
    const response = await handleCanadaClockChange(request, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as StoredCheck;
    expect(body.zone).toBe("America/Toronto");
    expect(body.truncated).toBe(true);
  });

  it("answers 400, not 500, when the body ends early", async () => {
    const request = new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("zone=Am"));
          controller.error(new TypeError("connection closed"));
        },
      }),
      // @ts-expect-error `duplex` is required for a stream body and absent from the DOM type.
      duplex: "half",
    });
    expect((await handleCanadaClockChange(request, {})).status).toBe(400);
  });

  it("refuses an oversize body before it counts against the rate-limit bucket", async () => {
    const oversize = () =>
      new Request(URL, {
        method: "POST",
        headers: { "cf-connecting-ip": "5.5.5.5" },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(65_537));
            controller.close();
          },
        }),
        // @ts-expect-error `duplex` is required for a stream body and absent from the DOM type.
        duplex: "half",
      });
    for (let i = 0; i < 25; i++)
      expect((await handleCanadaClockChange(oversize(), {})).status).toBe(413);
    expect((await get("5.5.5.5")).status).toBe(200);
  });

  it("reads the cap's worth of typed lines posted through FormData without saying any were dropped", async () => {
    // 19,999 bytes as typed; a FormData body sends each break as CR LF, so over 20,000 on the wire.
    const each = Math.floor(
      (STORED_MAX_BYTES - STORED_MAX_LINES) / STORED_MAX_LINES,
    );
    const typed = Array.from({ length: STORED_MAX_LINES }, () =>
      "x".repeat(each),
    ).join("\n");
    expect(new TextEncoder().encode(typed).length).toBeLessThan(
      STORED_MAX_BYTES,
    );
    const body = (await (
      await post({ lines: typed, zone: "America/Toronto" })
    ).json()) as StoredCheck;
    expect(body.truncated).toBe(false);
    expect(body.rows).toHaveLength(STORED_MAX_LINES);
  });

  it("shares the rate-limit bucket with GET", async () => {
    for (let i = 0; i < 10; i++)
      expect((await get("8.8.8.8")).status).toBe(200);
    for (let i = 0; i < 10; i++) {
      expect(
        (await post({ lines: "", zone: "America/Toronto" }, { ip: "8.8.8.8" }))
          .status,
      ).toBe(200);
    }
    const refused = await post(
      { lines: "", zone: "America/Toronto" },
      { ip: "8.8.8.8" },
    );
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ retryable: true });
    expect((await get("8.8.8.8")).status).toBe(429);
  });
});
