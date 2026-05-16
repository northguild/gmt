import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { MustTestLocales } from "../../test";
import { formatUtc } from "./formatUtc";

describe("formatUtc", () => {
  // keep focused en-US behavior tests
  it.each`
    value                     | options                                         | expected
    ${"2024-02-03T14:30:45Z"} | ${{ dateStyle: "full", timeStyle: "full" }}     | ${"Saturday, February 3, 2024 at 2:30:45 PM"}
    ${"2024-02-03T14:30:45Z"} | ${{ dateStyle: "long", timeStyle: "long" }}     | ${"February 3, 2024 at 2:30:45 PM"}
    ${"2024-02-03T14:30:45Z"} | ${{ dateStyle: "medium", timeStyle: "medium" }} | ${"Feb 3, 2024, 2:30:45 PM"}
    ${"2024-02-03T14:30:45Z"} | ${{ dateStyle: "short", timeStyle: "short" }}   | ${"2/3/24, 2:30 PM"}
  `(
    "formats valid utc $value for en-US with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatUtc(value, MustTestLocales.enUS, options)).toEqual(expected);
    },
  );

  // timezone conversion checks (use en-US for stability)
  it("formats instant in UTC by default when timeZone is undefined", () => {
    expect(
      formatUtc("2024-02-03T14:30:45Z", MustTestLocales.enUS, {
        dateStyle: "long",
        timeStyle: "long",
      }),
    ).toEqual("February 3, 2024 at 2:30:45 PM");
  });

  it("converts instant to explicit timezone (Europe/Paris)", () => {
    expect(
      formatUtc("2024-02-03T14:30:45Z", MustTestLocales.enUS, {
        dateStyle: "long",
        timeStyle: "long",
        timeZone: "Europe/Paris",
      }),
    ).toEqual("February 3, 2024 at 3:30:45 PM");
  });

  it("uses getSystemTimeZone() when timeZone is 'local'", () => {
    const spy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("Europe/Paris");

    expect(
      formatUtc("2024-02-03T14:30:45Z", MustTestLocales.enUS, {
        dateStyle: "long",
        timeStyle: "long",
        timeZone: "local",
      }),
    ).toEqual("February 3, 2024 at 3:30:45 PM");

    spy.mockRestore();
  });

  it("falls back to UTC when an invalid timezone is provided", () => {
    expect(
      formatUtc("2024-02-03T14:30:45Z", MustTestLocales.enUS, {
        dateStyle: "long",
        timeStyle: "long",
        // invalid value
        timeZone: "Invalid/Zone",
      }),
    ).toEqual("February 3, 2024 at 2:30:45 PM");
  });

  it("does not include localized timezone name by default (ru-RU)", () => {
    const out = formatUtc("2024-02-03T14:30:45Z", "ru-RU", {
      dateStyle: "full",
      timeStyle: "full",
    });
    expect(out).toEqual("суббота, 3 февраля 2024 г. в 14:30:45");
  });

  it("includes localized timezone name when includeTimeZoneName is true (ru-RU)", () => {
    const out = formatUtc("2024-02-03T14:30:45Z", "ru-RU", {
      dateStyle: "full",
      timeStyle: "full",
      includeTimeZoneName: true,
    });
    expect(out).toContain("Всемирное координированное время");
  });

  it.each`
    invalidValue
    ${"not-a-datetime"}
    ${"2024-02-29"}
    ${"2024-02-29Z"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T24:00:00"}
    ${"2024-02-29T24:00:00Z"}
    ${""}
    ${null}
    ${undefined}
    ${true}
  `(
    "returns an empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(formatUtc(invalidValue as never)).toBe("");
    },
  );
});
