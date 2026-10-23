import { hostileProxy, revokedProxy } from "../test/hostileValues";
import { resolveArrowTimestampOptions } from "./arrowTimestampOptions";

const hostileOptions = [
  ["a hostile Proxy", hostileProxy()],
  ["a revoked Proxy", revokedProxy()],
  [
    "a throwing unit getter",
    {
      get unit(): never {
        throw new Error("hostile getter");
      },
    },
  ],
  [
    "a throwing timeZone getter",
    {
      unit: "second",
      get timeZone(): never {
        throw new Error("hostile getter");
      },
    },
  ],
] as const;

describe("resolveArrowTimestampOptions", () => {
  it.each`
    unit              | factor
    ${"second"}       | ${1_000_000_000n}
    ${"seconds"}      | ${1_000_000_000n}
    ${"millisecond"}  | ${1_000_000n}
    ${"milliseconds"} | ${1_000_000n}
    ${"microsecond"}  | ${1_000n}
    ${"microseconds"} | ${1_000n}
    ${"nanosecond"}   | ${1n}
    ${"nanoseconds"}  | ${1n}
  `("maps unit $unit to $factor ns", ({ unit, factor }) => {
    expect(resolveArrowTimestampOptions({ unit })).toStrictEqual({
      factor,
      zoned: false,
    });
  });

  it.each`
    timeZone              | zoned
    ${undefined}          | ${false}
    ${""}                 | ${false}
    ${"UTC"}              | ${true}
    ${"Europe/Paris"}     | ${true}
    ${"+07:30"}           | ${true}
    ${"America/New_York"} | ${true}
  `("reads timeZone $timeZone as zoned=$zoned", ({ timeZone, zoned }) => {
    expect(
      resolveArrowTimestampOptions({ unit: "second", timeZone }),
    ).toStrictEqual({ factor: 1_000_000_000n, zoned });
  });

  it.each`
    name                     | options
    ${"undefined"}           | ${undefined}
    ${"null"}                | ${null}
    ${"a string"}            | ${"second"}
    ${"a number"}            | ${1}
    ${"no unit"}             | ${{}}
    ${"abbreviated unit"}    | ${{ unit: "s" }}
    ${"unit day"}            | ${{ unit: "day" }}
    ${"unit not a string"}   | ${{ unit: 1 }}
    ${"unknown zone"}        | ${{ unit: "second", timeZone: "Not/AZone" }}
    ${"zone not a string"}   | ${{ unit: "second", timeZone: 0 }}
    ${"zone null"}           | ${{ unit: "second", timeZone: null }}
    ${"inherited name"}      | ${{ unit: "toString" }}
    ${"constructor name"}    | ${{ unit: "constructor" }}
    ${"proto name"}          | ${{ unit: "__proto__" }}
    ${"capitalised unit"}    | ${{ unit: "Second" }}
    ${"blank zone"}          | ${{ unit: "second", timeZone: " " }}
    ${"offset out of range"} | ${{ unit: "second", timeZone: "+25:00" }}
  `("returns null for $name", ({ options }) => {
    expect(resolveArrowTimestampOptions(options)).toBeNull();
  });

  it.each(hostileOptions)("returns null for %s", (_name, options) => {
    expect(resolveArrowTimestampOptions(options)).toBeNull();
  });
});
