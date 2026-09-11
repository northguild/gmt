import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../test";
import { mockTemporalInstantFromThrow } from "../test/mocks";
import { formatUtcOffset, parseUtcOffsetNanoseconds } from "./utcOffsetString";

/**
 * Every battle-test zone's real offset at two instants six months apart, read straight off
 * Temporal. This is the other route to the answer: the helpers are asserted against what
 * `ZonedDateTime.prototype.offset` and `offsetNanoseconds` actually report, not against
 * offsets typed out by hand.
 */
const zoneOffsetCases = [
  "2024-01-15T12:00:00Z",
  "2024-07-15T12:00:00Z",
].flatMap((instant) =>
  battleTestTimeZones.map((timeZone) => {
    const zoned = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
    return {
      instant,
      timeZone,
      offset: zoned.offset,
      offsetNanoseconds: BigInt(zoned.offsetNanoseconds),
    };
  }),
);

describe("parseUtcOffsetNanoseconds", () => {
  it.each`
    offset         | expected
    ${"+00:00"}    | ${0n}
    ${"-00:00"}    | ${0n}
    ${"-04:00"}    | ${-14_400_000_000_000n}
    ${"+05:30"}    | ${19_800_000_000_000n}
    ${"+05:45"}    | ${20_700_000_000_000n}
    ${"+13:45"}    | ${49_500_000_000_000n}
    ${"+14:00"}    | ${50_400_000_000_000n}
    ${"-11:00"}    | ${-39_600_000_000_000n}
    ${"-00:44:30"} | ${-2_670_000_000_000n}
    ${"+23:59:59"} | ${86_399_000_000_000n}
  `("parses $offset to $expected nanoseconds", ({ offset, expected }) => {
    expect(parseUtcOffsetNanoseconds(offset)).toBe(expected);
  });

  it.each`
    offset           | description
    ${"Z"}           | ${"UTC designator"}
    ${"-0400"}       | ${"basic format"}
    ${"+24:00"}      | ${"hour out of range"}
    ${"+01:00:00.5"} | ${"sub-second offset"}
    ${""}            | ${"empty string"}
    ${"invalid"}     | ${"non-offset text"}
  `("returns null for $offset ($description)", ({ offset }) => {
    expect(parseUtcOffsetNanoseconds(offset)).toBeNull();
  });

  it.each`
    input         | description
    ${null}       | ${"null"}
    ${undefined}  | ${"undefined"}
    ${-14400}     | ${"number"}
    ${true}       | ${"boolean"}
    ${["-04:00"]} | ${"array"}
    ${{}}         | ${"object"}
  `("returns null when offset is $description", ({ input }) => {
    expect(parseUtcOffsetNanoseconds(input as never)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(parseUtcOffsetNanoseconds("-04:00")).toBeNull();
  });

  it.each(zoneOffsetCases)(
    "parses $timeZone's own offset $offset at $instant back to its offsetNanoseconds",
    ({ offset, offsetNanoseconds }) => {
      expect(parseUtcOffsetNanoseconds(offset)).toBe(offsetNanoseconds);
    },
  );
});

describe("formatUtcOffset", () => {
  it.each`
    offsetNanoseconds       | expected
    ${0n}                   | ${"+00:00"}
    ${-14_400_000_000_000n} | ${"-04:00"}
    ${19_800_000_000_000n}  | ${"+05:30"}
    ${20_700_000_000_000n}  | ${"+05:45"}
    ${50_400_000_000_000n}  | ${"+14:00"}
    ${-39_600_000_000_000n} | ${"-11:00"}
    ${-2_670_000_000_000n}  | ${"-00:44:30"}
    ${86_399_000_000_000n}  | ${"+23:59:59"}
    ${-86_399_000_000_000n} | ${"-23:59:59"}
  `(
    "formats $offsetNanoseconds as $expected",
    ({ offsetNanoseconds, expected }) => {
      expect(formatUtcOffset(offsetNanoseconds)).toBe(expected);
    },
  );

  it.each`
    offsetNanoseconds       | description
    ${1n}                   | ${"one nanosecond"}
    ${-500_000_000n}        | ${"half a second"}
    ${86_400_000_000_000n}  | ${"exactly 24 hours"}
    ${-86_400_000_000_000n} | ${"exactly -24 hours"}
  `(
    "returns null for $offsetNanoseconds ($description)",
    ({ offsetNanoseconds }) => {
      expect(formatUtcOffset(offsetNanoseconds)).toBeNull();
    },
  );

  it.each(zoneOffsetCases)(
    "formats $timeZone's own offsetNanoseconds at $instant back to $offset",
    ({ offset, offsetNanoseconds }) => {
      expect(formatUtcOffset(offsetNanoseconds)).toBe(offset);
    },
  );

  it.each(zoneOffsetCases)(
    "round-trips $timeZone's offset $offset at $instant through both helpers",
    ({ offset }) => {
      expect(formatUtcOffset(parseUtcOffsetNanoseconds(offset) as bigint)).toBe(
        offset,
      );
    },
  );

  it.each`
    written        | canonical
    ${"+05:45:00"} | ${"+05:45"}
    ${"-04:00:00"} | ${"-04:00"}
    ${"-00:00"}    | ${"+00:00"}
  `("canonicalises $written to $canonical", ({ written, canonical }) => {
    expect(formatUtcOffset(parseUtcOffsetNanoseconds(written) as bigint)).toBe(
      canonical,
    );
  });
});
