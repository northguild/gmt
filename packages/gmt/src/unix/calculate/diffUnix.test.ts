import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { diffUnix } from "./diffUnix";

describe("diffUnix", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
  });

  it.each`
    value1        | value2        | unit       | expected
    ${1704067200} | ${1704153600} | ${"days"}  | ${1}
    ${1704067200} | ${1704153600} | ${"hours"} | ${24}
    ${1704067200} | ${1704153600} | ${"weeks"} | ${0}
  `(
    "returns $expected for single unit difference between $value1 and $value2 for unit $unit",
    ({ value1, value2, unit, expected }) => {
      expect(diffUnix(value1, value2, unit, { epochUnit: "seconds" })).toEqual(
        expected,
      );
    },
  );

  it.each`
    value1        | value2        | units                | expected
    ${1704067200} | ${1704153600} | ${["days"]}          | ${{ days: 1 }}
    ${1704067200} | ${1704153600} | ${["hours"]}         | ${{ hours: 24 }}
    ${1704067200} | ${1704326400} | ${["days", "hours"]} | ${{ days: 3, hours: 0 }}
  `(
    "returns $expected for $units difference between $value1 and $value2",
    ({ value1, value2, units, expected }) => {
      expect(diffUnix(value1, value2, units, { epochUnit: "seconds" })).toEqual(
        expected,
      );
    },
  );

  it.each`
    value1        | value2
    ${"invalid"}  | ${1704153600}
    ${1704067200} | ${"invalid"}
    ${-1}         | ${1704153600}
    ${1704067200} | ${-1}
    ${null}       | ${1704153600}
    ${1704067200} | ${null}
  `(
    "returns null for invalid inputs: $value1 | $value2",
    ({ value1, value2 }) => {
      expect(diffUnix(value1 as never, value2 as never, "days" as never)).toBe(
        null,
      );
    },
  );
});
