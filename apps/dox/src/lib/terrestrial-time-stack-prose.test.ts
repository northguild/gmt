/**
 * The Terrestrial Time Stack's page states figures in prose. This guard reads the page as text
 * and holds each figure to a library call, so the prose cannot drift from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lib } from "~/test/timescale-lib";
import { durationSecondsText } from "./gnss-widgets";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/terrestrial-time-stack.mdx"),
  "utf8",
);

/** TT − UTC at a UTC instant, in seconds, as the library writes it. */
const ttMinusUtc = (utc: string): string | null =>
  durationSecondsText(
    lib.diffUtcAsDuration(utc, `${lib.toTT(utc).split(" ")[0]}Z`, "seconds"),
  );

describe("the key point", () => {
  it("TT − UTC is the figure the page gives, at the start of 2017", () => {
    const gap = ttMinusUtc("2017-01-01T00:00:00Z");
    expect(gap).toBe("69.184");
    expect(page).toContain(`since 2017 the two are ${gap} seconds apart`);
  });

  it("holds while no leap second is scheduled after 2017-01-01", () => {
    // Fails when IERS schedules a new second: reword "since 2017" and "69.184 seconds" then.
    expect(lib.nextLeapSecond("2016-01-01T00:00:00Z")).toBe(
      "2016-12-31T23:59:60Z",
    );
    expect(lib.nextLeapSecond("2017-01-01T00:00:00Z")).toBe("");
  });

  it("TCG − TT is zero in 1977 and grows by about 22 milliseconds a year", () => {
    expect(lib.tcgMinusTt(lib.fromTT("1977-01-01T00:00:32.184 TT"))).toBe(0);
    const year =
      lib.tcgMinusTt("2027-01-01T00:00:00Z")! -
      lib.tcgMinusTt("2026-01-01T00:00:00Z")!;
    const ms = Math.round(year * 1000);
    expect(ms).toBe(22);
    expect(page).toContain(
      `the gap was zero in 1977 and grows by about ${ms} milliseconds a year`,
    );
  });
});

describe("worth trying", () => {
  it("the TCG label is the figure the page gives further on than TT", () => {
    const drift = lib.tcgMinusTt("2026-01-01T00:00:00Z")!;
    expect(page).toContain(`${drift.toFixed(2)} seconds further on`);
  });
});
