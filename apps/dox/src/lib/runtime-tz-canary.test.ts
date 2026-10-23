import { getTimeZoneOffset } from "@northguild/gmt/zoned/get";
import { describe, expect, it } from "vitest";
import { PROBE_INSTANT, PROBE_ZONES } from "./canada-clock-change";

/**
 * A canary for the machine running the tests. The page states what tzdb 2026e gives for each
 * probe zone; a runtime with older time zone data gives another offset, and the Canada checker's
 * own tests then disagree with the page for a reason that has nothing to do with the code.
 */
describe("the runtime's time zone data", () => {
  it.each(PROBE_ZONES.map((fact) => [fact.zone, fact] as const))(
    "%s matches the tzdb 2026e reference",
    (_zone, fact) => {
      const actual = getTimeZoneOffset(fact.zone, PROBE_INSTANT);
      expect(
        actual,
        `Node ${process.version} (tz ${process.versions.tz}) gives ${fact.zone} ${actual} at ${PROBE_INSTANT}; the reference (2026e) is ${fact.tzdb2026e}. Update Node.`,
      ).toBe(fact.tzdb2026e);
    },
  );
});
