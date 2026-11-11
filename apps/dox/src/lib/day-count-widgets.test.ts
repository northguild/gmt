import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toJulianDate } from "@northguild/gmt/timescale/convert";
import { lib } from "~/test/day-count-lib";
import {
  FORMS,
  LAST_INSTANT,
  SCALES,
  microsText,
  numberText,
  parseNumber,
  parseParts,
  partsText,
  roundTrip,
  shiftNs,
  spell,
} from "./day-count-widgets";

describe("microsText", () => {
  it("writes zero without a sign", () => {
    expect(microsText(0n)).toBe("0 µs");
  });
  it("is exact to the nanosecond and signs both ways", () => {
    expect(microsText(20_000n)).toBe("+20.000 µs");
    expect(microsText(-20_001n)).toBe("−20.001 µs");
    expect(microsText(1n)).toBe("+0.001 µs");
    expect(microsText(-999n)).toBe("−0.999 µs");
  });
});

describe("numberText", () => {
  it("reads back to the same double", () => {
    for (const n of [2461042, 2461042.000800741, 61041.5, -1.5e-7, 1e21]) {
      expect(Number(numberText(n))).toBe(n);
    }
  });
});

describe("parseNumber and parseParts", () => {
  it("reads one plain decimal", () => {
    expect(parseNumber(" 2461042.5 ")).toBe(2461042.5);
    expect(parseNumber("-3")).toBe(-3);
    expect(parseNumber(".5")).toBe(0.5);
    for (const bad of ["", "abc", "1e3", "0x10", "1 + 2", "Infinity"]) {
      expect(parseNumber(bad)).toBeNull();
    }
  });
  it("reads two parts joined by a plus", () => {
    expect(parseParts("2461041 + 0.5")).toEqual({ jd1: 2461041, jd2: 0.5 });
    expect(parseParts("2461041+.5")).toEqual({ jd1: 2461041, jd2: 0.5 });
    expect(parseParts("2461041")).toBeNull();
    expect(parseParts("1 + -2")).toBeNull();
  });
  it("writes parts the way it reads them", () => {
    const parts = { jd1: 2461041, jd2: 0.5 };
    expect(parseParts(partsText(parts))).toEqual(parts);
  });
});

describe("shiftNs", () => {
  it("is back minus the instant, in nanoseconds", () => {
    expect(shiftNs(lib, "2026-01-01T12:00:00Z", "2026-01-01T12:00:01Z")).toBe(
      1_000_000_000n,
    );
    expect(shiftNs(lib, "2026-01-01T12:00:01Z", "2026-01-01T12:00:00Z")).toBe(
      -1_000_000_000n,
    );
  });
  it("is null when either end cannot be written on TAI", () => {
    expect(shiftNs(lib, "2026-01-01T12:00:00Z", "")).toBeNull();
    expect(shiftNs(lib, "", "2026-01-01T12:00:00Z")).toBeNull();
  });
  it("is null when the library can measure neither way", () => {
    expect(shiftNs(lib, "2026-01-01T12:00:00Z", "")).toBeNull();
  });
  it("agrees across a leap second whether TAI or the span recipe measures it", () => {
    const a = "2016-12-31T12:00:00Z";
    const b = "2017-01-01T12:00:00Z";
    const viaTai = shiftNs(lib, a, b);
    const recipe =
      lib.spanNs(a, b)! +
      BigInt(lib.leapSecondsBetween(a, b)!) * 1_000_000_000n;
    expect(viaTai).toBe(recipe);
    expect(viaTai).toBe(86_401_000_000_000n);
  });
  it("measures at the last instant, where TAI runs past 9999", () => {
    expect(lib.toTAI(LAST_INSTANT)).toBe("");
    expect(shiftNs(lib, LAST_INSTANT, LAST_INSTANT)).toBe(0n);
    expect(shiftNs(lib, "9999-12-31T23:59:59Z", LAST_INSTANT)).toBe(
      999_999_999n,
    );
  });
});

describe("spell and roundTrip", () => {
  const utc = "2026-01-01T12:00:00.00002Z";
  it("the two parts keep every nanosecond, on every scale", () => {
    for (const scale of SCALES) {
      const s = spell(lib, utc, "parts", scale);
      expect(s.value).not.toBeNull();
      // TCG can land one nanosecond off; the others are exact.
      const limit = scale === "TCG" ? 1n : 0n;
      const shift = s.shift ?? 99n;
      expect(shift >= -limit && shift <= limit).toBe(true);
    }
  });
  it("a single JD drops the twenty microseconds", () => {
    const s = spell(lib, utc, "jd", "UTC");
    expect(s.value).toBe(toJulianDate(utc, "UTC"));
    expect(s.shift).toBe(-20_000n);
  });
  it("a missing reading has no call back and no shift", () => {
    expect(roundTrip(lib, utc, "jd", null, "UTC")).toEqual({
      call: null,
      back: "",
      shift: null,
    });
  });
  it("writes all four forms", () => {
    for (const form of FORMS) {
      expect(spell(lib, utc, form, "UTC").to.fn).toBeTruthy();
    }
  });
});

describe("the sources hold no epoch or day length", () => {
  const sources = [
    "day-count-widgets.ts",
    "julian-day-counter.ts",
    "julian-day-counter-mount.ts",
  ].map((f) => readFileSync(join(__dirname, f), "utf8"));
  it("names none of the constants outside a preset's own text", () => {
    for (const source of sources) {
      const code = source.replace(
        /export const COUNTER_PRESETS[\s\S]*?\n\];\n/,
        "",
      );
      for (const banned of ["2400000.5", "2451545", "86400", "32.184"]) {
        expect(code).not.toContain(banned);
      }
    }
  });
});

describe("the scale list", () => {
  it("offers the four scales the library counts days on, never TDB", () => {
    expect([...SCALES]).toEqual(["UTC", "TAI", "TT", "TCG"]);
    expect(lib.toJulianDate("2026-01-01T12:00:00Z", "TDB" as never)).toBeNull();
  });
});
