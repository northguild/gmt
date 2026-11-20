import {
  canonicalCalendar,
  sharedCalendarKeyword,
  withNamedCalendar,
} from "./namedCalendar";

describe("sharedCalendarKeyword", () => {
  it.each`
    label                                | locales                                    | calendar
    ${"one tag"}                         | ${"gl-u-ca-hebrew"}                        | ${"hebrew"}
    ${"an alias"}                        | ${"ar-u-ca-islamicc"}                      | ${"islamic-civil"}
    ${"two tags with the same calendar"} | ${["fur-u-ca-hebrew", "en-u-ca-hebrew"]}   | ${"hebrew"}
    ${"two tags with different ones"}    | ${["fur-u-ca-hebrew", "en-u-ca-buddhist"]} | ${undefined}
    ${"a tag with none"}                 | ${["fur-u-ca-hebrew", "en"]}               | ${undefined}
    ${"another keyword only"}            | ${"en-u-nu-arab"}                          | ${undefined}
    ${"no tag"}                          | ${undefined}                               | ${undefined}
    ${"an empty list"}                   | ${[]}                                      | ${undefined}
    ${"a tag Intl.Locale cannot read"}   | ${"en-u-ca-hebrew-"}                       | ${undefined}
  `(
    "$label gives $calendar",
    ({
      locales,
      calendar,
    }: {
      locales: string | string[] | undefined;
      calendar: string | undefined;
    }) => {
      expect(sharedCalendarKeyword(locales)).toBe(calendar);
    },
  );
});

describe("withNamedCalendar", () => {
  it("passes the keyword as the calendar option", () => {
    expect(withNamedCalendar("fur-u-ca-hebrew", { year: "numeric" })).toEqual({
      year: "numeric",
      calendar: "hebrew",
    });
  });

  it("keeps a calendar option the caller gave", () => {
    const options: Intl.DateTimeFormatOptions = { calendar: "gregory" };
    expect(withNamedCalendar("fur-u-ca-hebrew", options)).toBe(options);
  });

  it("returns the same options when no keyword is shared", () => {
    const options: Intl.DateTimeFormatOptions = { year: "numeric" };
    expect(withNamedCalendar("en", options)).toBe(options);
  });
});

describe("canonicalCalendar", () => {
  it.each`
    calendar                 | canonical
    ${"islamicc"}            | ${"islamic-civil"}
    ${"ethiopic-amete-alem"} | ${"ethioaa"}
    ${"gregory"}             | ${"gregory"}
    ${"not a calendar"}      | ${"not a calendar"}
  `(
    "$calendar is $canonical",
    ({ calendar, canonical }: { calendar: string; canonical: string }) => {
      expect(canonicalCalendar(calendar)).toBe(canonical);
    },
  );
});
