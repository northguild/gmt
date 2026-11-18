import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DECKS, deckDate, deckSchedule } from "./decks";

const pages = fileURLToPath(new URL("../pages/slides/", import.meta.url));
const dirs = readdirSync(pages).filter((n) =>
  statSync(`${pages}${n}`).isDirectory(),
);

describe("deck registry", () => {
  it("has a page for every slug", () => {
    for (const { slug } of DECKS)
      expect(readdirSync(`${pages}${slug}`)).toContain("index.astro");
  });

  it("has a registry row for every deck page", () => {
    expect(dirs.toSorted()).toEqual(DECKS.map((d) => d.slug).toSorted());
  });

  it("keeps slugs and labels unique and the question time inside the talk", () => {
    expect(new Set(DECKS.map((d) => d.slug)).size).toBe(DECKS.length);
    expect(new Set(DECKS.map((d) => d.label)).size).toBe(DECKS.length);
    for (const d of DECKS) expect(d.qa).toBeLessThan(d.minutes);
  });

  it("states a missing date in words", () => {
    expect(deckDate({ ...DECKS[0], start: null })).toBe("Date to be announced");
  });

  it("reads a start time in the venue's zone", () => {
    expect(
      deckDate({
        ...DECKS[0],
        start: "2026-12-01T18:00:00+02:00[Europe/Helsinki]",
      }),
    ).toBe("1 December 2026 at 18:00, Europe/Helsinki time");
  });

  it("says a date that is not valid in words too", () => {
    expect(deckDate({ ...DECKS[0], start: "2026-12-01T18:00" })).toBe(
      "Date to be announced",
    );
  });

  it("holds the Deck 0 talk at 18:00 on 16 December 2026, Helsinki time", () => {
    expect(deckDate(DECKS[0])).toBe(
      "16 December 2026 at 18:00, Europe/Helsinki time",
    );
  });

  it("lays out the Deck 0 talk as a calendar day and a start time, read by gmt", () => {
    expect(deckSchedule(DECKS[0])).toEqual({
      weekday: "Wednesday",
      day: "16",
      month: "December",
      year: "2026",
      weekdayShort: "Wed",
      monthShort: "Dec",
      start: "18:00",
      zone: "Europe/Helsinki",
      offset: "UTC+02:00",
      datetime: "2026-12-16T18:00:00+02:00",
    });
  });

  it("has no schedule while the date is not fixed or not valid", () => {
    expect(deckSchedule({ ...DECKS[0], start: null })).toBeNull();
    expect(deckSchedule({ ...DECKS[0], start: "2026-12-01T18:00" })).toBeNull();
  });

  it("holds a start that carries its zone, the venue's, or none yet", () => {
    for (const d of DECKS)
      if (d.start !== null)
        expect(d.start).toMatch(
          new RegExp(
            `^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d[+-]\\d\\d:\\d\\d\\[${d.zone}\\]$`,
          ),
        );
  });
});
