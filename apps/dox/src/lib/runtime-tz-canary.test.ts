import { getTimeZoneOffset } from "@northguild/gmt/zoned/get";
import { describe, expect, it } from "vitest";
import { PROBE_INSTANT, PROBE_ZONES } from "./canada-clock-change";
import { MOROCCO_FACTS, MOROCCO_PROBE } from "./morocco-clock-change";

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
        `Node ${process.version} (tz ${process.versions.tz}) gives ${fact.zone} ${actual} at ${PROBE_INSTANT}; the reference (2026e) is ${fact.offset}. Update Node.`,
      ).toBe(fact.offset);
    },
  );
});

/**
 * The Morocco checker's verdict instant: every tzdb release from 2026c on gives both zones +00:00
 * there; older data gives +01:00. The Morocco tests build the Worker's answer from this runtime, so
 * a runtime older than 2026c fails here with a reason, not later with an offset nobody expects.
 */
describe("the runtime's time zone data for Morocco", () => {
  const verdict = MOROCCO_PROBE.find((item) => item.role === "verdict")!;
  it.each(MOROCCO_FACTS.map((fact) => [fact.zone, fact.offset] as const))(
    "%s is %s at the verdict instant",
    (zone, offset) => {
      const actual = getTimeZoneOffset(zone, verdict.iso);
      expect(
        actual,
        `Node ${process.version} (tz ${process.versions.tz}) gives ${zone} ${actual} at ${verdict.iso}; tzdb 2026c or later gives ${offset}. Update Node.`,
      ).toBe(offset);
    },
  );
});
