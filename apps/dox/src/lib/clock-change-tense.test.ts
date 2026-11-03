/**
 * The words of the dated clock-change checkers (CORE-89, CORE-91): the date and time each region
 * states, the one past-tense class phrase, and the guard that no checker string writes the class
 * verbs of its own. The library is the real one, passed in as the parameter.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { CANADA_MOMENTS } from "./canada-clock-change";
import { loadClockLib } from "./clock-change-mount";
import {
  REGION_KEY,
  classPhrase,
  momentWords,
  tenseView,
} from "./clock-change-tense";
import { MOROCCO_CHANGES, MOROCCO_MOMENTS } from "./morocco-clock-change";

const lib = await loadClockLib();
const ms = (utc: string) => convertUtcToUnix(utc)!;

describe("the stated moments, pinned with the library", () => {
  it("writes Morocco's change as 02:00 local, 01:00 UTC", () => {
    expect(momentWords(lib, MOROCCO_MOMENTS[REGION_KEY]!)).toEqual({
      local: "20 September 2026 at 02:00",
      utc: "01:00",
    });
  });

  it("keeps Morocco's change equal to the stated change it duplicates", () => {
    const first = MOROCCO_CHANGES[0]!;
    for (const moment of Object.values(MOROCCO_MOMENTS)) {
      expect(moment).toEqual({ at: first.at, from: first.from });
    }
  });

  it("writes each Canadian zone at 02:00 on its own clock", () => {
    for (const [key, moment] of Object.entries(CANADA_MOMENTS)) {
      expect(momentWords(lib, moment)?.local, key).toBe(
        "1 November 2026 at 02:00",
      );
    }
  });

  it("makes the Canadian region's moment the latest zone's", () => {
    const latest = Math.max(
      ...Object.entries(CANADA_MOMENTS)
        .filter(([key]) => key !== REGION_KEY)
        .map(([, m]) => ms(m.at)),
    );
    expect(ms(CANADA_MOMENTS[REGION_KEY]!.at)).toBe(latest);
  });
});

describe("the checkers state the change in the past tense", () => {
  it("Morocco: states the change in the past tense only, with one form", () => {
    const view = tenseView(lib, MOROCCO_MOMENTS);
    expect(classPhrase("stopped", null, view, true)).toBe(
      "Stopped changing clocks on 20 September 2026 at 02:00 local time (01:00 UTC)",
    );
  });

  it("Canada: states the change in the past tense only, with one form", () => {
    const view = tenseView(lib, CANADA_MOMENTS);
    expect(classPhrase("stopped", "America/Vancouver", view, false)).toBe(
      "Stopped changing clocks on 1 November 2026 at 02:00 local time (09:00 UTC)",
    );
  });
});

describe("no checker string writes the class verbs of its own", () => {
  it("keeps the class verbs in the tense module", () => {
    const src = join(import.meta.dirname, "..");
    const hits = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((f) => /\.(?:ts|tsx|astro)$/.test(f))
      .filter((f) => !/\.test\.|\.fixture\.|clock-change-tense\.ts$/.test(f))
      .filter((f) =>
        /Stops changing clocks|Stopped changing clocks/.test(
          readFileSync(join(src, f), "utf8"),
        ),
      );
    expect(hits).toEqual([]);
  });
});
