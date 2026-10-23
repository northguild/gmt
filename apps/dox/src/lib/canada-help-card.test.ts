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
import { helpMarkdown, helpText } from "./clock-change-help";
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
    expect(
      convertPlainDateTimeToZoned("2024-01-15T09:00:00", "America/New_York"),
    ).toMatch(/^2024-01-15T09:00:00(\.0+)?-05:00\[America\/New_York\]$/);
  });

  it("states what the new copy says and nothing it dropped", () => {
    const text = helpText(HELP);
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

  it("links each function name to its reference page and the saved-times link to the section", () => {
    const html = renderCanadaClockChangeTemplate();
    const card = html.slice(
      html.indexOf('class="gmt-clockcheck-help"'),
      html.indexOf("</section>", html.indexOf('class="gmt-clockcheck-help"')),
    );
    expect(card).toMatch(
      /<a class="gmt-clockcheck-help-fn" href="[^"]*\/reference\/zoned\/classify\/classifyStoredZoned\/"><code>classifyStoredZoned<\/code><\/a>/,
    );
    expect(card).toMatch(
      /<a class="gmt-clockcheck-help-fn" href="[^"]*\/reference\/zoned\/convert\/convertPlainDateTimeToZoned\/"><code>convertPlainDateTimeToZoned<\/code><\/a>/,
    );
    expect(card).toMatch(
      /<a class="gmt-clockcheck-help-btn" href="#canada-stored-title">Did your saved events move\?/,
    );
    // An absolute address is left as written, not put under the site's base path.
    expect(card).toContain(
      '<a href="https://github.com/northguild/gmt/blob/main/packages/gmt/src/test/oh-canada.test.ts">See the tests</a>',
    );
    expect(helpMarkdown(HELP)).toContain(
      "[See the tests](https://github.com/northguild/gmt/blob/main/packages/gmt/src/test/oh-canada.test.ts)",
    );
  });

  it("draws the two saved-time cases as cards with input, output and why", () => {
    const html = renderCanadaClockChangeTemplate();
    expect(html).toContain(
      '<span class="gmt-clockcheck-help-tag">Saved with an offset</span>',
    );
    expect(html).toContain(
      '<code class="gmt-clockcheck-help-in">2026-11-15T09:00:00-08:00[America/Vancouver]</code>',
    );
    expect(html).toContain('<code class="gmt-clockcheck-help-out">""</code>');
    expect(html).toContain(
      '<code class="gmt-clockcheck-help-in">2026-11-15T17:00:00Z</code>',
    );
    expect(html).toContain(
      '<code class="gmt-clockcheck-help-out">10:00</code>',
    );
    expect(html).toContain("an hour late");
  });

  it("words every link to the saved-events section with the heading's own text", () => {
    const html = renderCanadaClockChangeTemplate({ keyPoints: true });
    const heading = html.match(
      /<h4 id="canada-stored-title">([^<]*)<\/h4>/,
    )?.[1];
    expect(heading).toBe("Did your saved events move?");
    const links = [
      ...html.matchAll(
        /<a [^>]*href="#canada-stored-title"[^>]*>([\s\S]*?)<\/a>/g,
      ),
    ].map((m) => m[1]!.replace(/<[^>]*>/g, "").trim());
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const text of links)
      expect(text.replace(/\s*\u2193$/, "")).toBe(heading);
    for (const m of keyPointsMarkdown(KEY_POINTS)
      .concat(helpMarkdown(HELP))
      .matchAll(/\[([^\]]*)\]\(#canada-stored-title\)/g)) {
      expect(m[1]).toBe(heading);
    }
  });
});
