import { Temporal } from "./temporal";
import { exactSeconds } from "./exactSeconds";

describe("exactSeconds", () => {
  it.each`
    iso                                | expected
    ${"PT1.5S"}                        | ${"1.5"}
    ${"PT0S"}                          | ${"0"}
    ${"-PT0.5S"}                       | ${"-0.5"}
    ${"PT0.000000001S"}                | ${"0.000000001"}
    ${"PT1.0005S"}                     | ${"1.0005"}
    ${"PT9007199254740991.999999999S"} | ${"9007199254740991.999999999"}
    ${"PT1H"}                          | ${"0"}
    ${"PT0.001002003S"}                | ${"0.001002003"}
    ${"-PT5.001002003S"}               | ${"-5.001002003"}
    ${"PT9007199254740991S"}           | ${"9007199254740991"}
  `("$iso → $expected", ({ iso, expected }) => {
    expect(exactSeconds(Temporal.Duration.from(iso))).toBe(expected);
  });
});
