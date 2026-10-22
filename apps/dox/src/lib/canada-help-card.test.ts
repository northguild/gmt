/**
 * The "How gmt helps" card's claims, run against the real library on the host. Only cases that no
 * tzdb release changes: a 2024 New York value with the wrong offset, so the card cannot drift from
 * what the functions do.
 */
import { describe, expect, it } from "vitest";
import { addZoned } from "@northguild/gmt/zoned/calculate";
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import { convertPlainDateTimeToZoned, convertZonedToUtc } from "@northguild/gmt/zoned/convert";
import { formatZonedDateTime } from "@northguild/gmt/zoned/format";
import { HELP_BLOCKS, HELP_HEADING, helpMarkdown, partsText } from "../data/canada-key-points";
import { renderCanadaClockChangeTemplate } from "./canada-clock-change-mount";

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
    expect(convertPlainDateTimeToZoned("2024-01-15T09:00:00", "America/New_York")).toMatch(
      /^2024-01-15T09:00:00(\.0+)?-05:00\[America\/New_York\]$/,
    );
  });

  it("states what the new copy says and nothing it dropped", () => {
    const text = HELP_BLOCKS.map((block) =>
      block.kind === "p" ? partsText(block.parts) : block.items.map(partsText).join("\n"),
    ).join("\n");
    expect(HELP_HEADING).toBe("How gmt helps");
    expect(text).toContain("Once your runtime is updated, every gmt zoned function gives the right time");
    expect(text).toContain("Saved with an offset");
    expect(text).toContain("Saved as UTC only");
    for (const dropped of ["resolveLocal", "getDstTransitions", "getTimeZoneOffset", "Stored Time Audit"]) {
      expect(text).not.toContain(dropped);
      expect(helpMarkdown()).not.toContain(dropped);
    }
  });

  it("links each function name to its reference page and the saved-times link to the section", () => {
    const html = renderCanadaClockChangeTemplate();
    const card = html.slice(html.indexOf('class="gmt-canada-help"'), html.indexOf("</section>", html.indexOf('class="gmt-canada-help"')));
    expect(card).toMatch(/<a class="gmt-canada-help-fn" href="[^"]*\/reference\/zoned\/classify\/classifyStoredZoned\/"><code>classifyStoredZoned<\/code><\/a>/);
    expect(card).toMatch(/<a class="gmt-canada-help-fn" href="[^"]*\/reference\/zoned\/convert\/convertPlainDateTimeToZoned\/"><code>convertPlainDateTimeToZoned<\/code><\/a>/);
    expect(card).toContain('<a href="#canada-stored-title">Check saved times</a>');
  });
});
