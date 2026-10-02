/// <reference types="vitest/globals" />

/**
 * `zone-clock.ts`: the readings every clock widget shows, where a wrong answer
 * is one the widgets cannot see.
 */

import { describe, expect, it } from "vitest";
import { readZoneAt, readZoneNow } from "./zone-clock";

/* `readZoneAt` takes a zoned anchor, the shape `multi-zone-scrubber.ts`'s
   `anchorZoned` produces — a bare `…Z` instant sentinels. */
const at = (utc: string) => `${utc}+00:00[UTC]`;

describe("readZoneAt", () => {
  it("answers for the instant read, not for another year at the same offset", () => {
    /* Turkey's clocks went forward in March 2016 and were never put back: until
       then +03:00 was summer time, after it +03:00 is the standard offset. The
       same zone and offset give different answers by date. */
    const in2015 = readZoneAt("Europe/Istanbul", at("2015-07-01T09:00:00"));
    const lastSummer = readZoneAt("Europe/Istanbul", at("2016-07-01T09:00:00"));
    const winter2016 = readZoneAt("Europe/Istanbul", at("2016-12-01T09:00:00"));
    const now = readZoneAt("Europe/Istanbul", at("2026-07-01T09:00:00"));

    for (const r of [in2015, lastSummer, winter2016, now]) {
      expect(r.ok).toBe(true);
    }
    expect(in2015.inDst).toBe(true);
    // The advance was never undone, so the library reads 2016 as standard time.
    expect(lastSummer.inDst).toBe(false);
    expect(winter2016.inDst).toBe(false);
    expect(now.inDst).toBe(false);
    expect(now.observesDst).toBe(false);
  });

  it("gives the same answer whichever date is read first", () => {
    const first = readZoneAt("Europe/Istanbul", at("2026-07-01T09:00:00"));
    const second = readZoneAt("Europe/Istanbul", at("2015-07-01T09:00:00"));
    const again = readZoneAt("Europe/Istanbul", at("2026-07-01T09:00:00"));
    expect(first.inDst).toBe(again.inDst);
    expect(second.inDst).toBe(true);
  });

  it("is not keyed on zone, year and offset: Asuncion in January and in December 2024", () => {
    /* Same zone, same year, same -03:00 offset; in daylight time in January and
       not in December (it kept -03:00 and left daylight time for good). */
    const january = readZoneAt("America/Asuncion", at("2024-01-15T15:00:00"));
    const december = readZoneAt("America/Asuncion", at("2024-12-01T15:00:00"));
    expect(january.offset).toBe("-03:00");
    expect(december.offset).toBe("-03:00");
    expect(january.inDst).toBe(true);
    expect(december.inDst).toBe(false);
    // And in the other order.
    expect(
      readZoneAt("America/Asuncion", at("2024-12-01T15:00:00")).inDst,
    ).toBe(false);
    expect(
      readZoneAt("America/Asuncion", at("2024-01-15T15:00:00")).inDst,
    ).toBe(true);
  });

  it("says whether a zone observes DST at the instant read", () => {
    expect(
      readZoneAt("America/New_York", at("2024-01-15T12:00:00")).observesDst,
    ).toBe(true);
    expect(
      readZoneAt("Asia/Tokyo", at("2024-01-15T12:00:00")).observesDst,
    ).toBe(false);
    expect(
      readZoneAt("Europe/Istanbul", at("2015-01-15T12:00:00")).observesDst,
    ).toBe(true);
    expect(
      readZoneAt("Europe/Istanbul", at("2026-01-15T12:00:00")).observesDst,
    ).toBe(false);
  });

  it("still separates the two sides of a transition within one year", () => {
    const winter = readZoneAt("Europe/London", at("2026-01-15T12:00:00"));
    const summer = readZoneAt("Europe/London", at("2026-07-15T12:00:00"));
    expect(winter.offset).toBe("+00:00");
    expect(summer.offset).toBe("+01:00");
    expect(winter.inDst).toBe(false);
    expect(summer.inDst).toBe(true);
  });

  it("reports a zone that never observes DST as such", () => {
    const tokyo = readZoneAt("Asia/Tokyo", at("2026-07-01T00:00:00"));
    expect(tokyo.observesDst).toBe(false);
    expect(tokyo.inDst).toBe(false);
  });
});

describe("readZoneNow", () => {
  it("returns a parsed reading for a real zone", () => {
    const reading = readZoneNow("Europe/London");
    expect(reading.ok).toBe(true);
    expect(reading.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(reading.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(reading.offset).toMatch(/^[+-]\d{2}:\d{2}$/);
  });

  it("sentinels rather than throwing on a zone that does not exist", () => {
    const reading = readZoneNow("Not/AZone");
    expect(reading.ok).toBe(false);
    expect(reading.date).toBe("");
    expect(reading.time).toBe("");
  });
});
