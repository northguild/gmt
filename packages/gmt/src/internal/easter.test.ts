import { epochDayOf, isoDateString, isoWeekdayOf } from "./epochDay";
import { easterEpochDay } from "./easter";

const floor = Math.floor;
const mod = (a: number, b: number): number => ((a % b) + b) % b;

/** Oudin's algorithm (Explanatory Supplement to the Astronomical Almanac), floor division. */
function oudinGregorian(year: number): string {
  const century = floor(year / 100);
  const g = mod(year, 19);
  const k = floor((century - 17) / 25);
  let i = mod(
    century - floor(century / 4) - floor((century - k) / 3) + 19 * g + 15,
    30,
  );
  i -=
    floor(i / 28) *
    (1 - floor(i / 28) * floor(29 / (i + 1)) * floor((21 - g) / 11));
  const j = mod(
    year + floor(year / 4) + i + 2 - century + floor(century / 4),
    7,
  );
  const l = i - j;
  const month = 3 + floor((l + 40) / 44);
  const day = l + 28 - 31 * floor(month / 4);
  return isoDateString(epochDayOf(year, month, day));
}

/**
 * Julian computus of the Explanatory Supplement (floor division), then the Julian-calendar date
 * to a Julian Day Number by the floor-based formula D + ⌊(153m+2)/5⌋ + 365y + ⌊y/4⌋ − 32083
 * (y from 4800 BC, m from March). Epoch day = JDN − 2440588. Returns the Julian-calendar
 * [month, day] too, for the date-range property.
 */
function julianOracle(year: number): {
  iso: string;
  month: number;
  day: number;
} {
  const i = mod(19 * mod(year, 19) + 15, 30);
  const j = mod(year + floor(year / 4) + i, 7);
  const l = i - j;
  const month = 3 + floor((l + 40) / 44);
  const day = l + 28 - 31 * floor(month / 4);
  const shift = floor((14 - month) / 12);
  const y = year + 4800 - shift;
  const m = month + 12 * shift - 3;
  const jdn = day + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4) - 32083;
  return { iso: isoDateString(jdn - 2440588), month, day };
}

const gregorian = (year: number): string | null => {
  const epoch = easterEpochDay(year, "gregorian");
  return epoch === null ? null : isoDateString(epoch);
};
const julian = (year: number): string | null => {
  const epoch = easterEpochDay(year, "julian");
  return epoch === null ? null : isoDateString(epoch);
};

describe("easterEpochDay worked years", () => {
  // Meeus ch. 8 worked years; 1818 and 2285 are the earliest possible date (22 March).
  it.each`
    year    | expected
    ${1991} | ${"1991-03-31"}
    ${1992} | ${"1992-04-19"}
    ${1993} | ${"1993-04-11"}
    ${1954} | ${"1954-04-18"}
    ${2000} | ${"2000-04-23"}
    ${1818} | ${"1818-03-22"}
    ${2285} | ${"2285-03-22"}
    ${2024} | ${"2024-03-31"}
  `("gregorian $year is $expected", ({ year, expected }) => {
    expect(gregorian(year)).toBe(expected);
  });

  // Julian Easter of Meeus ch. 8 is 12 April Julian in each of 179, 711, 1243; ISO adds -1, 4, 7 days.
  it.each`
    year    | expected
    ${179}  | ${"0179-04-11"}
    ${711}  | ${"0711-04-16"}
    ${1243} | ${"1243-04-19"}
    ${2024} | ${"2024-05-05"}
    ${2025} | ${"2025-04-20"}
    ${1582} | ${"1582-04-25"}
    ${1583} | ${"1583-04-10"}
  `("julian $year is $expected", ({ year, expected }) => {
    expect(julian(year)).toBe(expected);
  });
});

describe("easterEpochDay non-positive years and range edges", () => {
  it.each`
    year       | expected
    ${0}       | ${"0000-04-09"}
    ${-1}      | ${"-000001-04-18"}
    ${-271821} | ${null}
    ${-271820} | ${"-271820-04-16"}
    ${275760}  | ${"+275760-03-30"}
    ${275761}  | ${null}
  `(
    "gregorian $year at a non-positive or range edge is $expected",
    ({ year, expected }) => {
      expect(gregorian(year)).toBe(expected);
    },
  );

  it.each`
    year       | expected
    ${-271815} | ${"-271821-09-19"}
    ${-271816} | ${null}
    ${275754}  | ${"+275759-12-16"}
    ${275755}  | ${null}
    ${33808}   | ${"+033809-01-01"}
    ${-10663}  | ${"-010664-12-30"}
  `("julian $year at a range edge is $expected", ({ year, expected }) => {
    expect(julian(year)).toBe(expected);
  });
});

describe("easterEpochDay oracles and properties", () => {
  it("gregorian matches Oudin for years -3000..9999", () => {
    for (let year = -3000; year <= 9999; year++) {
      expect(gregorian(year), `year ${year}`).toBe(oudinGregorian(year));
    }
  });

  it("julian matches the Explanatory Supplement computus and floor-based JDN for years -4000..9999", () => {
    for (let year = -4000; year <= 9999; year++) {
      const { iso, month, day } = julianOracle(year);
      expect(julian(year), `year ${year}`).toBe(iso);
      // Julian Easter falls from 22 March to 25 April of the Julian calendar.
      expect(month * 100 + day, `year ${year}`).toBeGreaterThanOrEqual(322);
      expect(month * 100 + day, `year ${year}`).toBeLessThanOrEqual(425);
    }
  });

  it("gregorian is a Sunday between 22 March and 25 April for years 1583..4099", () => {
    for (let year = 1583; year <= 4099; year++) {
      const epoch = easterEpochDay(year, "gregorian") as number;
      expect(isoWeekdayOf(epoch), `year ${year}`).toBe(7);
      expect(epoch).toBeGreaterThanOrEqual(epochDayOf(year, 3, 22));
      expect(epoch).toBeLessThanOrEqual(epochDayOf(year, 4, 25));
    }
  });

  it("julian is an ISO Sunday for years -4000..9999", () => {
    for (let year = -4000; year <= 9999; year++) {
      const epoch = easterEpochDay(year, "julian") as number;
      expect(isoWeekdayOf(epoch), `year ${year}`).toBe(7);
    }
  });
});
