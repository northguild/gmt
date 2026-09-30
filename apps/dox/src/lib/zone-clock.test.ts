/// <reference types="vitest/globals" />

/**
 * The caches in `zone-clock.ts`, which are the only place this module can be
 * wrong in a way the widgets cannot see.
 */

import { describe, expect, it, vi } from "vitest";
import { readZoneAt, readZoneNow } from "./zone-clock";

/* `readZoneAt` takes a zoned anchor, the shape `multi-zone-scrubber.ts`'s
   `anchorZoned` produces — a bare `…Z` instant sentinels. */
const at = (utc: string) => `${utc}+00:00[UTC]`;

describe("readZoneAt", () => {
  it("does not let one year's DST answer stand in for another's", () => {
    /* The cache is keyed on the zone, the year and the offset, and the year is
       what this pins. Turkey observed DST at +03:00 until 2016 and has been
       permanently +03:00 since, so the same zone and the same offset give
       opposite answers in the two years. Keyed on (zone, offset) alone, the
       first of these answered for both. */
    const then = readZoneAt("Europe/Istanbul", at("2016-07-01T09:00:00"));
    const now = readZoneAt("Europe/Istanbul", at("2026-07-01T09:00:00"));

    expect(then.ok).toBe(true);
    expect(now.ok).toBe(true);
    expect(then.offset).toBe("+03:00");
    expect(now.offset).toBe("+03:00");
    expect(then.inDst).toBe(true);
    expect(now.inDst).toBe(false);
  });

  it("gives the same answer whichever year is read first", async () => {
    /* The reverse order, to catch a cache that is merely order-dependent. The
       cache is module state and every test in this file shares one module, so
       by now the test above has filled both of these keys and plain reads
       would be cache hits whatever the cache did. A fresh module starts it
       empty, so the 2026 answer really is computed first. */
    vi.resetModules();
    const { readZoneAt: fresh } = await import("./zone-clock");
    const now = fresh("Europe/Istanbul", at("2026-07-01T09:00:00"));
    const then = fresh("Europe/Istanbul", at("2016-07-01T09:00:00"));
    expect(now.inDst).toBe(false);
    expect(then.inDst).toBe(true);
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
