import { Temporal } from "./temporal";
import { imfFixdate } from "./englishCalendarNames";

describe("imfFixdate", () => {
  it.each`
    utc                                    | text
    ${"2024-03-15T14:30:00Z"}              | ${"Fri, 15 Mar 2024 14:30:00 GMT"}
    ${"0099-01-03T04:05:06Z"}              | ${"Sat, 03 Jan 0099 04:05:06 GMT"}
    ${"0000-01-01T00:00:00Z"}              | ${"Sat, 01 Jan 0000 00:00:00 GMT"}
    ${"2024-03-15T14:30:00.999Z"}          | ${"Fri, 15 Mar 2024 14:30:00 GMT"}
    ${"9999-12-31T23:59:59Z"}              | ${"Fri, 31 Dec 9999 23:59:59 GMT"}
    ${"-000001-12-31T23:59:59.999999999Z"} | ${""}
    ${"-000001-06-15T12:00:00Z"}           | ${""}
    ${"+010000-01-01T00:00:00Z"}           | ${""}
  `("$utc is '$text'", ({ utc, text }) => {
    expect(
      imfFixdate(Temporal.Instant.from(utc).toZonedDateTimeISO("UTC")),
    ).toBe(text);
  });
});
