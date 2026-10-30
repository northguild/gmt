import {
  dayKey,
  nextMidnightMs,
  nextPtMidnightMs,
  secondsUntilMidnight,
  secondsUntilVisitorReset,
  VISITOR_CAP_TIME_ZONE,
  nextVisitorMidnightMs,
  visitorDayKey,
} from "./pt-day";
import { convertUtcToUnix } from "@northguild/gmt";

/** 2026-03-08 is the US spring-forward date: Pacific loses an hour at 02:00,
 * making that local day 23 hours long. 2026-11-01 is fall-back, 25 hours. Both
 * are the reason this uses gmt's zoned arithmetic instead of adding 86_400_000. */
const SPRING_FORWARD_LOCAL_NOON = convertUtcToUnix("2026-03-08T19:00:00Z")!; // 12:00 PDT
const FALL_BACK_LOCAL_NOON = convertUtcToUnix("2026-11-01T20:00:00Z")!; // 12:00 PST

describe("the UTC clock (Workers AI)", () => {
  const noonPacific = convertUtcToUnix("2026-06-15T19:00:00Z")!; // 12:00 PDT = 19:00Z

  it("counts to UTC midnight, which is when Workers AI refills — not Pacific", () => {
    // Five hours to 00:00Z, twelve to Pacific midnight; both carry the same
    // 300 s margin.
    expect(secondsUntilMidnight(noonPacific, "UTC")).toBe(5 * 3600 + 300);
    expect(secondsUntilMidnight(noonPacific, "America/Los_Angeles")).toBe(
      12 * 3600 + 300,
    );
    expect(nextMidnightMs(noonPacific, "UTC")).toBe(
      convertUtcToUnix("2026-06-16T00:00:00Z")!,
    );
  });

  it("is unaffected by a Pacific DST change", () => {
    // UTC has no DST: noon PDT on spring-forward day is 19:00Z, five hours out.
    expect(secondsUntilMidnight(SPRING_FORWARD_LOCAL_NOON, "UTC")).toBe(
      5 * 3600 + 300,
    );
  });

  it("buckets by the UTC date, which rolls over hours before the Pacific one", () => {
    // 2026-06-16T00:30Z is the 16th in UTC but still 17:30 PDT on the 15th.
    const earlyUtc = convertUtcToUnix("2026-06-16T00:30:00Z")!;
    expect(dayKey(earlyUtc, "UTC")).toBe("2026-06-16");
    expect(dayKey(earlyUtc, "America/Los_Angeles")).toBe("2026-06-15");
  });

  it("does not throw on a nonsense clock", () => {
    expect(dayKey(Number.NaN, "UTC")).toBe("unknown");
  });
});

describe("nextPtMidnightMs", () => {
  it("lands on the next local midnight", () => {
    const noon = convertUtcToUnix("2026-06-15T19:00:00Z")!; // 12:00 PDT
    const next = nextPtMidnightMs(noon);
    // 00:00 PDT on the 16th is 07:00Z.
    expect(next).toBe(convertUtcToUnix("2026-06-16T07:00:00Z")!);
  });

  it("is 23 hours away at noon on the spring-forward day", () => {
    // The whole reason for zoned arithmetic: +24h would overshoot midnight.
    const hours =
      (nextPtMidnightMs(SPRING_FORWARD_LOCAL_NOON) -
        SPRING_FORWARD_LOCAL_NOON) /
      3_600_000;
    expect(hours).toBe(12);
    // ...and the day it just started was short:
    const startOfThatDay = convertUtcToUnix("2026-03-08T08:00:00Z")!; // 00:00 PST
    const dayLength =
      (nextPtMidnightMs(SPRING_FORWARD_LOCAL_NOON) - startOfThatDay) /
      3_600_000;
    expect(dayLength).toBe(23);
  });

  it("is 25 hours long on the fall-back day", () => {
    const startOfThatDay = convertUtcToUnix("2026-11-01T07:00:00Z")!; // 00:00 PDT
    const dayLength =
      (nextPtMidnightMs(FALL_BACK_LOCAL_NOON) - startOfThatDay) / 3_600_000;
    expect(dayLength).toBe(25);
  });
});

describe("the visitor cap's clock", () => {
  it("counts UTC days", () => {
    expect(VISITOR_CAP_TIME_ZONE).toBe("UTC");
    // 2026-06-16T00:30Z is the 16th in UTC but still the 15th in Pacific.
    const earlyUtc = convertUtcToUnix("2026-06-16T00:30:00Z")!;
    expect(visitorDayKey(earlyUtc)).toBe("2026-06-16");
    expect(dayKey(earlyUtc, "America/Los_Angeles")).toBe("2026-06-15");
  });

  it("rolls over at UTC midnight", () => {
    expect(visitorDayKey(convertUtcToUnix("2026-06-15T23:59:00Z")!)).toBe(
      "2026-06-15",
    );
    expect(visitorDayKey(convertUtcToUnix("2026-06-16T00:01:00Z")!)).toBe(
      "2026-06-16",
    );
  });

  it("does not throw on a nonsense clock", () => {
    expect(visitorDayKey(Number.NaN)).toBe("unknown");
  });

  it("resets at the next UTC midnight", () => {
    const noon = convertUtcToUnix("2026-06-15T12:00:00Z")!;
    expect(nextVisitorMidnightMs(noon)).toBe(
      convertUtcToUnix("2026-06-16T00:00:00Z")!,
    );
  });
});

describe("secondsUntilVisitorReset", () => {
  it("never returns a TTL short enough to expire a key early", () => {
    // One second before midnight, the naive answer is ~1s — far too short for a
    // key that still has to be readable right up to the boundary.
    const oneSecondBefore = convertUtcToUnix("2026-06-15T23:59:59Z")!;
    expect(secondsUntilVisitorReset(oneSecondBefore)).toBeGreaterThanOrEqual(
      60,
    );
  });

  it("covers the whole remaining day plus a margin", () => {
    const justAfterMidnight = convertUtcToUnix("2026-06-15T00:01:00Z")!;
    const ttl = secondsUntilVisitorReset(justAfterMidnight);
    expect(ttl).toBeGreaterThan(23 * 3600);
    expect(ttl).toBeLessThan(25 * 3600);
  });
});
