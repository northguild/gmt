import { Temporal } from "../temporal";
import { getUnixNow } from "../../unix/get/getUnixNow";
import { getUtcYear } from "../../utc/get/getUtcYear";
import { getYear } from "../../plain/get/getYear";
import { getZonedNow } from "../../zoned/get/getZonedNow";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import {
  nowInstant,
  nowPlainDateISO,
  nowPlainDateTimeISO,
  nowPlainTimeISO,
  nowZonedDateTimeISO,
} from "./index";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

const MAX_MS = 8_640_000_000_000_000;
const LIMIT_NS = BigInt(MAX_MS) * 1_000_000n;

describe("D21: the clock readers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // The Temporal proposal defines the clock in milliseconds as the floor of the system time in
  // nanoseconds over 1e6 (spec/temporal.html SystemUTCEpochMilliseconds, wired into Date.now by
  // spec/mainadditions.html), and test262 Temporal/Now/instant/return-value-value.js asserts a reading is not earlier than a
  // Date.now() taken before it. Whatever the polyfill carries between readings, a reader returns
  // the clock it was set to: 1960-01-01T00:00:00Z is -315619200000 ms, 2027-01-01T00:00:00Z is
  // 1798761600000 ms.
  describe("after the clock was set before 1970", () => {
    beforeEach(() => {
      vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
      vi.useFakeTimers();
    });

    it("keeps the year of 1960-01-01T00:00:00Z across two readings", () => {
      vi.setSystemTime("1960-01-01T00:00:00Z");
      getUtcYear();
      expect(getUtcYear()).toBe("1960");
      expect(getYear()).toBe("1960");
      expect(getUnixNow()).toBe(-315619200000);
      expect(getZonedNow("UTC")).toBe("1960-01-01T00:00:00.000+00:00[UTC]");
    });

    it("keeps the year of 2027-01-01T00:00:00Z read after a 1960 clock", () => {
      vi.setSystemTime("1960-01-01T00:00:00Z");
      getUtcYear();
      getUtcYear();
      vi.setSystemTime("2027-01-01T00:00:00Z");
      expect(getUtcYear()).toBe("2027");
      expect(getYear()).toBe("2027");
      expect(getUnixNow()).toBe(1798761600000);
      expect(getZonedNow("UTC")).toBe("2027-01-01T00:00:00.000+00:00[UTC]");
    });
  });

  describe("the guard", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    // The clock is read before the polyfill, so a millisecond that passes during the polyfill's
    // read cannot make an honest reading look early. Here the polyfill's read takes the clock from
    // T to T + 1 and returns T: read in the other order, T would sit in the millisecond before
    // the clock and be moved up.
    it("nowInstant takes the system clock before the polyfill reading", () => {
      const start = 1_000_000;
      let clock = start;
      vi.spyOn(Date, "now").mockImplementation(() => clock); // date-ban: scripted clock for the read-order row
      vi.spyOn(Temporal.Now, "instant").mockImplementation(() => {
        clock = start + 1;
        return Temporal.Instant.fromEpochMilliseconds(start);
      });
      expect(nowInstant().epochMilliseconds).toBe(start);
    });

    it("nowZonedDateTimeISO takes the system clock before the polyfill reading", () => {
      const start = 1_000_000;
      let clock = start;
      vi.spyOn(Date, "now").mockImplementation(() => clock); // date-ban: scripted clock for the read-order row
      vi.spyOn(Temporal.Now, "zonedDateTimeISO").mockImplementation(() => {
        clock = start + 1;
        return Temporal.Instant.fromEpochMilliseconds(start).toZonedDateTimeISO(
          "UTC",
        );
      });
      expect(nowZonedDateTimeISO("UTC").epochMilliseconds).toBe(start);
    });

    // A reading in the millisecond before Date.now() can only be the polyfill's negative tail; it
    // moves up one millisecond, which is the floored-modulo result. A reading at or after
    // Date.now(), or a mocked reading well before it, is returned as it came.
    it.each`
      offsetNs       | expectedNs
      ${-500_000n}   | ${1_000_000n - 500_000n}
      ${-1n}         | ${1_000_000n - 1n}
      ${-1_000_000n} | ${0n}
      ${0n}          | ${0n}
      ${999_999n}    | ${999_999n}
      ${-1_000_001n} | ${-1_000_001n}
      ${-5_000_000n} | ${-5_000_000n}
    `(
      "nowInstant moves a reading $offsetNs ns from the system clock to $expectedNs ns",
      ({ offsetNs, expectedNs }: { offsetNs: bigint; expectedNs: bigint }) => {
        vi.setSystemTime(-315619200000);
        const base = -315619200000n * 1_000_000n;
        vi.spyOn(Temporal.Now, "instant").mockReturnValue(
          Temporal.Instant.fromEpochNanoseconds(base + offsetNs),
        );
        expect(nowInstant().epochNanoseconds).toBe(base + expectedNs);
      },
    );

    it("clamps to the Instant limit when a reading just under the maximum moves up", () => {
      vi.setSystemTime(MAX_MS);
      vi.spyOn(Temporal.Now, "instant").mockReturnValue(
        Temporal.Instant.fromEpochNanoseconds(LIMIT_NS - 1n),
      );
      expect(nowInstant().epochNanoseconds).toBe(LIMIT_NS);
    });

    it("clamps a zoned reading to the Instant limit and keeps its zone", () => {
      vi.setSystemTime(MAX_MS);
      vi.spyOn(Temporal.Now, "zonedDateTimeISO").mockReturnValue(
        new Temporal.ZonedDateTime(LIMIT_NS - 1_000_000n, "Asia/Tokyo"),
      );
      const zoned = nowZonedDateTimeISO("Asia/Tokyo");
      expect(zoned.epochNanoseconds).toBe(LIMIT_NS);
      expect(zoned.timeZoneId).toBe("Asia/Tokyo");
    });

    it("moves a zoned reading up by one millisecond and keeps its zone", () => {
      vi.setSystemTime(0);
      vi.spyOn(Temporal.Now, "zonedDateTimeISO").mockReturnValue(
        new Temporal.ZonedDateTime(-250_000n, "Asia/Tokyo"),
      );
      const zoned = nowZonedDateTimeISO("Asia/Tokyo");
      expect(zoned.epochNanoseconds).toBe(750_000n);
      expect(zoned.timeZoneId).toBe("Asia/Tokyo");
    });

    it("derives the plain readers from the corrected zoned reading", () => {
      vi.setSystemTime("1960-01-01T00:00:00Z");
      const base = -315619200000n * 1_000_000n;
      // 1 ns before Date.now() reads as 1959-12-31T23:59:59.999999999 until corrected.
      vi.spyOn(Temporal.Now, "zonedDateTimeISO").mockImplementation(
        (timeZone) =>
          new Temporal.ZonedDateTime(base - 1n, String(timeZone ?? "UTC")),
      );
      expect(nowPlainDateTimeISO("UTC").toString()).toBe(
        "1960-01-01T00:00:00.000999999",
      );
      expect(nowPlainDateISO("UTC").toString()).toBe("1960-01-01");
      expect(nowPlainTimeISO("UTC").toString()).toBe("00:00:00.000999999");
    });

    it("keeps the polyfill's RangeError for a bad zone argument", () => {
      expect(() => nowZonedDateTimeISO("Not/AZone")).toThrow(RangeError);
      expect(() => nowPlainDateISO("Not/AZone")).toThrow(RangeError);
    });
  });
});
