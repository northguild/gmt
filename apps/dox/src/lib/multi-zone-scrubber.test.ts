/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { convertUnixToUtc, convertUtcToUnix } from "@northguild/gmt";
import {
  decodeState,
  encodeState,
  nextTransition,
} from "./multi-zone-scrubber";
import { offsetAt, readZoneAt, readZoneNow } from "./zone-clock";

/** UTC instant string -> epoch ms. */
function ms(utc: string): number {
  const value = convertUtcToUnix(utc, "milliseconds");
  if (value === null) throw new Error(`bad instant: ${utc}`);
  return value;
}

// ---------------------------------------------------------------------------
// zone-clock.ts — readings from the real @northguild/gmt functions
// ---------------------------------------------------------------------------

describe("readZoneNow", () => {
  it("reads a live zone with a plausible shape", () => {
    const reading = readZoneNow("America/New_York");
    expect(reading.ok).toBe(true);
    expect(reading.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(reading.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(reading.offset).toMatch(/^[+-]\d{2}:\d{2}$/);
    expect(reading.observesDst).toBe(true);
  });

  it("flags a zone that never observes DST", () => {
    expect(readZoneNow("Asia/Tokyo").observesDst).toBe(false);
    expect(readZoneNow("UTC").observesDst).toBe(false);
  });

  it("returns a sentinel reading for an invalid zone", () => {
    const reading = readZoneNow("Mars/Olympus_Mons");
    expect(reading.ok).toBe(false);
    expect(reading.offset).toBe("");
  });
});

describe("readZoneAt", () => {
  const springForwardUtc = "2026-03-08T06:30:00+00:00[UTC]"; // 01:30 EST, pre-jump

  it("reports standard time just before the US spring-forward", () => {
    const reading = readZoneAt("America/New_York", springForwardUtc);
    expect(reading.ok).toBe(true);
    expect(reading.offset).toBe("-05:00");
    expect(reading.inDst).toBe(false);
  });

  it("reports daylight time just after the US spring-forward", () => {
    const reading = readZoneAt(
      "America/New_York",
      "2026-03-08T07:30:00+00:00[UTC]",
    );
    expect(reading.offset).toBe("-04:00");
    expect(reading.inDst).toBe(true);
  });

  it("leaves a non-DST zone unchanged across that instant", () => {
    expect(readZoneAt("Asia/Tokyo", springForwardUtc).offset).toBe("+09:00");
    expect(
      readZoneAt("Asia/Tokyo", "2026-03-08T07:30:00+00:00[UTC]").offset,
    ).toBe("+09:00");
  });
});

describe("offsetAt", () => {
  it("changes across the US spring-forward boundary (DST 'bite')", () => {
    expect(offsetAt("America/New_York", "2026-03-08T06:59:00Z")).toBe("-05:00");
    expect(offsetAt("America/New_York", "2026-03-08T07:01:00Z")).toBe("-04:00");
  });
});

// ---------------------------------------------------------------------------
// Permalink encode / decode
// ---------------------------------------------------------------------------

describe("encodeState / decodeState", () => {
  it("round-trips pinned zones and the effective instant exactly", () => {
    const pinned = ["America/New_York", "Europe/London", "Asia/Tokyo"];
    const effectiveMs = ms("2026-03-08T09:30:00Z");
    const query = encodeState(pinned, effectiveMs);
    const decoded = decodeState(query);
    expect(decoded.pinned).toEqual(pinned);
    expect(decoded.effectiveMs).toBe(effectiveMs);
  });

  it("drops unknown zones on decode", () => {
    expect(decodeState("?tz=America/New_York,Not/AZone").pinned).toEqual([
      "America/New_York",
    ]);
  });

  it("ignores an unparseable time", () => {
    expect(decodeState("?t=not-a-time").effectiveMs).toBeUndefined();
  });

  it("returns an empty object for an empty query", () => {
    expect(decodeState("")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// nextTransition — powers the "jump to a DST boundary" preset
// ---------------------------------------------------------------------------

describe("nextTransition", () => {
  it("finds the US spring-forward as the next transition from Jan 2026", () => {
    const from = ms("2026-01-01T00:00:00Z");
    const result = nextTransition(["America/New_York", "Asia/Tokyo"], from);
    expect(result?.zone).toBe("America/New_York");
    expect(convertUnixToUtc(result?.instantMs ?? 0, "milliseconds")).toBe(
      "2026-03-08T07:00:00Z",
    );
  });

  it("returns null when no pinned zone observes DST", () => {
    const from = ms("2026-01-01T00:00:00Z");
    expect(nextTransition(["Asia/Tokyo", "UTC"], from)).toBeNull();
  });
});
