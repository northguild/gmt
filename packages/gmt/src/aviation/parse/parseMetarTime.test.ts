import { Temporal } from "../../internal/temporal";
import {
  METAR_SENTINEL_ROWS,
  METAR_VALID_ROWS,
} from "../../test/metarTimeRows";
import {
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { NON_STRINGS } from "../../test/nonStrings";
import { parseMetarTime } from "./parseMetarTime";

const REF = "2024-06-25T12:20:00Z";

/**
 * Every expected instant is decided from the rule (nearest in exact time, a month lacking the
 * day skipped, ties to the earlier) and was checked by a brute-force search on the polyfill.
 */
describe("parseMetarTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(METAR_VALID_ROWS)(
    "reads '$value' against $reference as $expected ($reason)",
    ({ value, reference, expected }) => {
      expect(parseMetarTime(value, reference)).toBe(expected);
    },
  );

  it.each(METAR_SENTINEL_ROWS)(
    "returns '' for '$value' against '$reference' ($reason)",
    ({ value, reference }) => {
      expect(parseMetarTime(value, reference)).toBe("");
    },
  );

  describe("arguments", () => {
    it("returns '' for every non-string value", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(parseMetarTime(make() as string, REF), `value ${kind}`).toBe("");
        expect(
          parseMetarTime("251200Z", make() as string),
          `reference ${kind}`,
        ).toBe("");
      }
    });
  });

  it("reads no clock: the reference is the only 'now'", () => {
    const now = vi.spyOn(Temporal.Now, "instant");
    parseMetarTime("251200Z", REF);
    expect(now).not.toHaveBeenCalled();
  });

  it("returns '' when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(parseMetarTime("251200Z", REF)).toBe("");
  });

  it("returns '' when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(parseMetarTime("251200Z", REF)).toBe("");
  });

  it("gives the same answer under a non-English navigator.language", () => {
    if (typeof navigator !== "undefined") {
      vi.spyOn(navigator, "language", "get").mockReturnValue("ar-EG");
    }
    expect(parseMetarTime("251200Z", REF)).toBe("2024-06-25T12:00:00Z");
  });
});
