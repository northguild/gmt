import { isRefusedZoneName } from "./refusedZoneNames";

describe("isRefusedZoneName", () => {
  it.each`
    name         | expected
    ${"CET"}     | ${true}
    ${"CST6CDT"} | ${true}
    ${"EET"}     | ${true}
    ${"EST5EDT"} | ${true}
    ${"Factory"} | ${true}
    ${"MET"}     | ${true}
    ${"MST7MDT"} | ${true}
    ${"PST8PDT"} | ${true}
    ${"WET"}     | ${true}
    ${"cet"}     | ${true}
    ${"est5edt"} | ${true}
    ${"factory"} | ${true}
    ${"FACTORY"} | ${true}
    ${"Pst8Pdt"} | ${true}
    ${"wEt"}     | ${true}
  `(
    "returns $expected for the refused spelling '$name'",
    ({ name, expected }) => {
      expect(isRefusedZoneName(name)).toBe(expected);
    },
  );

  it.each`
    name                  | reason
    ${"EST"}              | ${"a fixed-offset zone every host accepts"}
    ${"MST"}              | ${"a fixed-offset zone every host accepts"}
    ${"HST"}              | ${"a fixed-offset zone every host accepts"}
    ${"US/Eastern"}       | ${"a slashed Link every host accepts"}
    ${"GMT0"}             | ${"a Link every host accepts"}
    ${"UCT"}              | ${"a Link every host accepts"}
    ${"Zulu"}             | ${"a Link every host accepts"}
    ${"Japan"}            | ${"a Link every host accepts"}
    ${"Etc/GMT+5"}        | ${"a fixed-offset Zone"}
    ${"Asia/Calcutta"}    | ${"a slashed Link"}
    ${"Europe/Brussels"}  | ${"a slashed Zone"}
    ${"America/New_York"} | ${"a slashed Zone"}
    ${"+05:30"}           | ${"an offset"}
    ${""}                 | ${"empty"}
    ${"ESTEDT"}           | ${"not the name"}
    ${"CET "}             | ${"trailing space"}
    ${"CEİ"}              | ${"a non-ASCII letter does not fold to ASCII"}
    ${"Kactory"}          | ${"the Kelvin sign is not ASCII K"}
  `("returns false for '$name' ($reason)", ({ name }) => {
    expect(isRefusedZoneName(name)).toBe(false);
  });
});
