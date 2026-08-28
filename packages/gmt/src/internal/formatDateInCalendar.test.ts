import { Temporal } from "@js-temporal/polyfill";
import { formatDateInCalendar } from "./formatDateInCalendar";

describe("formatDateInCalendar", () => {
  it("formats an iso8601 PlainDate as a bare ISO string for gregorian", () => {
    const date = Temporal.PlainDate.from("2024-10-03");
    expect(formatDateInCalendar(date, "gregorian")).toBe("2024-10-03");
  });

  it("formats a hebrew PlainDate with calendar-native fields and annotation", () => {
    const date = Temporal.PlainDate.from("2024-10-03").withCalendar("hebrew");
    expect(formatDateInCalendar(date, "hebrew")).toBe(
      "5785-01-01[u-ca=hebrew]",
    );
  });

  it("routes ethiopic-amete-alem through formatEthiopicFamilyDate, not formatCalendarDate", () => {
    // Backed by Temporal's "ethioaa" id per ethiopicFamilyCalendar.ts — never "ethiopic" or
    // "coptic" directly, since those two throw under this environment's ICU (see the module
    // comment in ethiopicFamilyCalendar.ts).
    const date = Temporal.PlainDate.from("2024-10-03").withCalendar("ethioaa");
    expect(formatDateInCalendar(date, "ethiopic-amete-alem")).toBe(
      "7517-01-23[u-ca=ethiopic-amete-alem]",
    );
  });

  it("routes the same ethioaa-backed date differently depending on the known target calendar", () => {
    // The whole reason calendarSystemOfDateValue must be captured up front: an "ethioaa"-
    // calendared Temporal.PlainDate alone cannot distinguish "ethiopic" from "ethiopic-amete-
    // alem" from "coptic" — the caller must already know which one it is.
    const date = Temporal.PlainDate.from("2024-10-03").withCalendar("ethioaa");
    expect(formatDateInCalendar(date, "ethiopic")).toBe(
      "2017-01-23[u-ca=ethiopic;era=ethiopic]",
    );
    expect(formatDateInCalendar(date, "coptic")).toBe(
      "1741-01-23[u-ca=coptic]",
    );
  });

  it("re-derives a japanese date's era from the actual date, not a copied tag", () => {
    const heisei =
      Temporal.PlainDate.from("2019-04-30").withCalendar("japanese");
    const reiwa = heisei.add({ days: 1 });
    expect(formatDateInCalendar(heisei, "japanese")).toBe(
      "0031-04-30[u-ca=japanese;era=heisei]",
    );
    expect(formatDateInCalendar(reiwa, "japanese")).toBe(
      "0001-05-01[u-ca=japanese;era=reiwa]",
    );
  });
});
