/**
 * The "How gmt helps" card's claims, run against the real library on the host. Only cases that no
 * tzdb release changes: a 2024 New York value with the wrong offset, so the card cannot drift from
 * what the functions do.
 */
import { describe, expect, it } from "vitest";
import { addZoned } from "@northguild/gmt/zoned/calculate";
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import {
  convertPlainDateTimeToZoned,
  convertZonedToUtc,
} from "@northguild/gmt/zoned/convert";
import { formatZonedDateTime } from "@northguild/gmt/zoned/format";
import { HELP, KEY_POINTS } from "../data/canada-key-points";
import { HELP_HEADING, keyPointsMarkdown } from "../data/clock-change-text";
import { helpMarkdown } from "./clock-change-help";

/** New York was at -05:00 on this date; the value claims -08:00. */
const WRONG_OFFSET = "2024-01-15T09:00:00-08:00[America/New_York]";

describe("the How gmt helps card", () => {
  it("returns an empty string from the zoned functions for a stored offset that no longer fits", () => {
    expect(formatZonedDateTime(WRONG_OFFSET)).toBe("");
    expect(convertZonedToUtc(WRONG_OFFSET)).toBe("");
    expect(addZoned(WRONG_OFFSET, { days: 1 })).toBe("");
  });

  it("has classifyStoredZoned say why, and give both readings", () => {
    expect(classifyStoredZoned(WRONG_OFFSET)).toMatchObject({
      kind: "offsetMismatch",
      storedOffset: "-08:00",
      zoneOffset: "-05:00",
      atStoredOffset: "2024-01-15T17:00:00Z", // keep the old moment
      atZoneOffset: "2024-01-15T14:00:00Z", // keep 9:00 local
    });
  });

  it("fixes a UTC-only value by converting its local time and place again", () => {
    // 17:00Z read in New York is 12:00; the kept local time and place give a different moment.
    expect(
      convertPlainDateTimeToZoned("2024-01-15T09:00:00", "America/New_York"),
    ).toMatch(/^2024-01-15T09:00:00(\.0+)?-05:00\[America\/New_York\]$/);
  });

  it("states what the new copy says and nothing it dropped", () => {
    const text = helpMarkdown(HELP);
    expect(HELP_HEADING).toBe("How gmt helps");
    expect(text).toContain(
      "Once your runtime is updated, every gmt zoned function gives the right time",
    );
    // Backed by runtime-tz-canary.test.ts on every Node in ci.yml's matrix and by
    // deploy-smoke.mjs's probe row on deploy-dox's daily run.
    expect(text).toContain(
      "gmt’s tests run on the newest release of every Node.js version gmt supports",
    );
    expect(text).toContain(
      "The server behind this page is checked for it every day.",
    );
    expect(text).toContain("Saved with an offset");
    expect(text).toContain("Saved as UTC only");
    for (const dropped of [
      "resolveLocal",
      "getDstTransitions",
      "getTimeZoneOffset",
      "Stored Time Audit",
    ]) {
      expect(text).not.toContain(dropped);
      expect(helpMarkdown(HELP)).not.toContain(dropped);
    }
  });

  it("words every markdown link to the saved-events section with the heading's own text", () => {
    const heading = "Did your saved events move?";
    const links = [
      ...keyPointsMarkdown(KEY_POINTS)
        .concat(helpMarkdown(HELP))
        .matchAll(/\[([^\]]*)\]\(#canada-stored-heading\)/g),
    ];
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const m of links) expect(m[1]).toBe(heading);
    expect(helpMarkdown(HELP)).toContain(
      "[See the tests](https://github.com/northguild/gmt/blob/main/packages/gmt/src/test/oh-canada.test.ts)",
    );
  });
});
