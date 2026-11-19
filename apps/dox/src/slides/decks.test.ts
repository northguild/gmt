import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NO_STAGE_DATA } from "~/lib/slides/stage-data";
import { deckStage, loadDeckRuntime, RUNTIME_SLUGS } from "./deck-runtime";
import { DECKS, deckDate, deckSchedule } from "./decks";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

describe("deck registry", () => {
  it("serves every slug from the one [slug] page pair", () => {
    expect(existsSync(here("../pages/slides/[slug]/index.astro"))).toBe(true);
    expect(existsSync(here("../pages/slides/[slug]/presenter.astro"))).toBe(
      true,
    );
  });

  it("has a deck component row and a folder for every slug", () => {
    const pages = readFileSync(here("./deck-pages.ts"), "utf8");
    for (const { slug } of DECKS) {
      expect(pages).toContain(`"${slug}": `);
      expect(existsSync(here(`./${slug}/`))).toBe(true);
    }
  });

  it("keeps a runtime row only for a registered deck", () => {
    const slugs = DECKS.map((d) => d.slug);
    for (const slug of RUNTIME_SLUGS) expect(slugs).toContain(slug);
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

describe("Deck 0's start", () => {
  it("is 18:00 on 16 December 2026 in Helsinki, with the offset gmt gives", () => {
    expect(DECKS[0]!.start).toBe("2026-12-16T18:00:00+02:00[Europe/Helsinki]");
  });
});

describe("deckStage", () => {
  it("gives a deck's slides its stage data, and none to a deck without a runtime", async () => {
    for (const slug of RUNTIME_SLUGS)
      expect(await deckStage(slug)).toBe((await loadDeckRuntime(slug))!.stage);
    expect(await deckStage("no-such-deck")).toBe(NO_STAGE_DATA);
  });

  it("fails outside a deck page", async () => {
    await expect(deckStage(undefined)).rejects.toThrow(/deck page/);
  });
});
