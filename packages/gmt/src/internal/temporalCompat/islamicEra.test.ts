import { Temporal } from "../temporal";
import { printsInModernEra } from "./islamicEra";

// The era test compares two outputs of the runtime's own formatter, so the only value every engine
// agrees on is that a modern date prints in the modern era. Whether a date before the Hijra prints
// in a second era is the engine's choice (D18 in WebKit), and WebKit puts the first day of year 1
// in that earlier era as year 0; the test asks only that the answer is a boolean for every date GMT
// can hold, including the one day before the `Date` range. `capabilities.test.ts` holds the
// corrected fields of the epoch day to year 1 on every engine.
const calendars = [
  "islamic-civil",
  "islamic-tbla",
  "islamic-umalqura",
] as const;

describe("printsInModernEra", () => {
  it.each(calendars.map((calendarId) => ({ calendarId })))(
    "is true for a modern $calendarId date on every engine",
    ({ calendarId }) => {
      expect(
        printsInModernEra(Temporal.PlainDate.from("2024-03-15"), calendarId),
      ).toBe(true);
      expect(
        printsInModernEra(Temporal.PlainDate.from("0623-07-08"), calendarId),
      ).toBe(true);
    },
  );

  it.each(calendars.map((calendarId) => ({ calendarId })))(
    "answers for every $calendarId date GMT can hold",
    ({ calendarId }) => {
      for (const iso of [
        "-271821-04-19",
        "-271821-04-20",
        "0000-01-01",
        "0621-01-01",
        "0622-07-18",
        "0622-07-19",
        "+275760-09-13",
      ]) {
        expect(
          typeof printsInModernEra(Temporal.PlainDate.from(iso), calendarId),
        ).toBe("boolean");
      }
    },
  );

  it("reads a date of another calendar by its ISO day", () => {
    const date = Temporal.PlainDate.from("2024-03-15[u-ca=hebrew]");
    expect(printsInModernEra(date, "islamic-civil")).toBe(true);
  });
});
