import { utcOffset } from "./utc-offset";

describe("utcOffset", () => {
  it.each`
    value          | description
    ${"+00:00"}    | ${"zero offset"}
    ${"-00:00"}    | ${"negative zero, which ISO 8601 permits"}
    ${"-04:00"}    | ${"whole-hour western offset"}
    ${"+14:00"}    | ${"maximum IANA offset"}
    ${"-11:00"}    | ${"Pacific/Niue"}
    ${"+05:30"}    | ${"half-hour offset"}
    ${"+05:45"}    | ${"quarter-hour offset"}
    ${"+13:45"}    | ${"Pacific/Chatham in DST"}
    ${"-00:44:30"} | ${"sub-minute offset with seconds"}
    ${"+23:59:59"} | ${"maximum representable offset"}
    ${"-23:59"}    | ${"minimum whole-minute offset"}
  `("matches $value ($description)", ({ value }) => {
    expect(utcOffset.test(value)).toBe(true);
  });

  it.each`
    value                          | description
    ${"Z"}                         | ${"UTC designator, not an offset"}
    ${"z"}                         | ${"lowercase UTC designator"}
    ${"-0400"}                     | ${"basic format, no colon"}
    ${"-04"}                       | ${"hour-only offset"}
    ${"04:00"}                     | ${"no sign"}
    ${"+24:00"}                    | ${"hour out of range"}
    ${"+04:60"}                    | ${"minute out of range"}
    ${"+04:00:60"}                 | ${"second out of range"}
    ${"+4:00"}                     | ${"unpadded hour"}
    ${"+01:00:00.5"}               | ${"sub-second offset"}
    ${"−04:00"}                    | ${"U+2212 minus sign"}
    ${" -04:00"}                   | ${"leading whitespace"}
    ${"-04:00 "}                   | ${"trailing whitespace"}
    ${"2024-03-10T12:00:00-04:00"} | ${"a whole datetime string"}
    ${""}                          | ${"empty string"}
  `("rejects $value ($description)", ({ value }) => {
    expect(utcOffset.test(value)).toBe(false);
  });
});
