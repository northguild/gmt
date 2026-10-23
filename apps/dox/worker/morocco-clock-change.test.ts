import { beforeEach, describe, expect, it } from "vitest";
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import {
  getDstTransitions,
  getTimeZoneOffset,
} from "@northguild/gmt/zoned/get";
import {
  MOROCCO_FACTS,
  MOROCCO_STORED_PRESET,
  MOROCCO_ZONES,
  type MoroccoCheck,
  type StoredCheck,
} from "../src/lib/morocco-clock-change";
import { completeStoredLine } from "../src/lib/clock-check/stored-times";
import { handleCanadaClockChange } from "./canada-clock-change";
import { handleMoroccoClockChange } from "./morocco-clock-change";
import { resetRateLimitState } from "./rate-limit";

const NOW = "2026-10-22T12:00:00Z";
const URL = "https://northguild.dev/gmt/api/morocco-clock-change";

function get(ip = "1.2.3.4", method = "GET", now = NOW): Promise<Response> {
  return handleMoroccoClockChange(
    new Request(URL, { method, headers: { "cf-connecting-ip": ip } }),
    {},
    () => now,
  );
}

function post(
  fields: Record<string, string>,
  ip = "7.7.7.7",
  length = "100",
): Promise<Response> {
  const request = new Request(URL, {
    method: "POST",
    headers: {
      "cf-connecting-ip": ip,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields).toString(),
  });
  request.headers.set("content-length", length);
  return handleMoroccoClockChange(request, {});
}

describe("GET /gmt/api/morocco-clock-change", () => {
  beforeEach(() => resetRateLimitState());

  it("answers never-cached JSON with the four keys", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as MoroccoCheck;
    expect(Object.keys(body).sort()).toEqual([
      "now",
      "probe",
      "transitions",
      "zones",
    ]);
    expect(body.now).toBe(NOW);
  });

  it("probe rows equal the library's offsets at the probe instant", async () => {
    const { probe } = (await (await get()).json()) as MoroccoCheck;
    expect(probe.map((row) => row.zone)).toEqual([...MOROCCO_ZONES]);
    for (const row of probe) {
      expect(row.offset).toBe(
        getTimeZoneOffset(row.zone, MOROCCO_FACTS.probeInstant),
      );
    }
  });

  it("transition rows equal getDstTransitions for 2026 and 2027", async () => {
    const { transitions } = (await (await get()).json()) as MoroccoCheck;
    for (const zone of MOROCCO_ZONES) {
      for (const year of MOROCCO_FACTS.transitionYears) {
        const rows = transitions.filter(
          (row) => row.zone === zone && row.year === year,
        );
        expect(
          rows.map(({ instant, offsetBefore, offsetAfter }) => ({
            instant,
            offsetBefore,
            offsetAfter,
          })),
        ).toEqual(getDstTransitions(zone, year));
      }
    }
  });

  it("gives each zone's offset now and the library's last and next change", async () => {
    const { zones } = (await (await get()).json()) as MoroccoCheck;
    expect(zones.map((z) => z.zone)).toEqual([...MOROCCO_ZONES]);
    for (const z of zones) {
      expect(z.offset).toBe(getTimeZoneOffset(z.zone, NOW));
      const window = [2025, 2026, 2027, 2028].flatMap((y) =>
        getDstTransitions(z.zone, y),
      );
      const last = window.filter((c) => c.instant <= NOW).at(-1) ?? null;
      const next = window.find((c) => c.instant > NOW) ?? null;
      expect(z.last).toEqual(last);
      expect(z.next).toEqual(next);
    }
  });

  it("answers HEAD like GET with no body", async () => {
    const head = await get("2.2.2.2", "HEAD");
    const full = await get("2.2.2.2");
    expect(head.status).toBe(full.status);
    expect(head.headers.get("cache-control")).toBe("no-store");
    expect(head.headers.get("content-type")).toBe(
      full.headers.get("content-type"),
    );
    expect(await head.text()).toBe("");
  });

  it("answers 405 with Allow for PUT", async () => {
    const response = await get("3.3.3.3", "PUT");
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD, POST");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 429 with retry-after on the 21st call, apart from Canada's bucket", async () => {
    const canada = (ip: string) =>
      handleCanadaClockChange(
        new Request(URL, { headers: { "cf-connecting-ip": ip } }),
        {},
        () => NOW,
      );
    for (let i = 0; i < 20; i++)
      expect((await canada("5.5.5.5")).status).toBe(200);
    expect((await canada("5.5.5.5")).status).toBe(429);
    for (let i = 0; i < 20; i++)
      expect((await get("5.5.5.5")).status).toBe(200);
    const refused = await get("5.5.5.5");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await get("6.6.6.6")).status).toBe(200);
  });
});

describe("POST /gmt/api/morocco-clock-change", () => {
  beforeEach(() => resetRateLimitState());

  it("classifies each preset line as the library does", async () => {
    const response = await post({
      lines: MOROCCO_STORED_PRESET,
      zone: "Africa/Casablanca",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as StoredCheck;
    expect(body.rows).toHaveLength(5);
    for (const row of body.rows) {
      const value = completeStoredLine(row.input, "Africa/Casablanca");
      expect(row.value).toBe(value);
      expect(row.result).toEqual(classifyStoredZoned(value!));
    }
  });

  it("answers 400 for a zone outside the two", async () => {
    expect((await post({ lines: "", zone: "Europe/Paris" })).status).toBe(400);
    expect((await post({ lines: "", zone: "America/Toronto" })).status).toBe(
      400,
    );
  });

  it("answers 413 for a body of 65,537 bytes", async () => {
    const request = new Request(URL, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: new Uint8Array(65_537).fill(97),
    });
    expect((await handleMoroccoClockChange(request, {})).status).toBe(413);
  });

  it("answers 429 on the 21st POST from one client", async () => {
    for (let i = 0; i < 20; i++) {
      expect(
        (await post({ lines: "", zone: "Africa/Casablanca" }, "9.9.9.9"))
          .status,
      ).toBe(200);
    }
    const refused = await post(
      { lines: "", zone: "Africa/Casablanca" },
      "9.9.9.9",
    );
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
