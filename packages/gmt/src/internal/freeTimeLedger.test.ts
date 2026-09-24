import {
  bandsByTier,
  parseFreeDays,
  parseFreeTimeTerms,
  parseTiers,
} from "./freeTimeLedger";

const weekdays = { weekend: [6, 7], holidays: [], timeZone: "UTC" };

/** Sparse tier lists: `Array.prototype.every` skips a hole, so these must be rejected explicitly. */
const trailingHole: number[] = [5];
trailingHole.length = 2;
const leadingHole: number[] = [];
leadingHole[1] = 5;

describe("parseFreeTimeTerms", () => {
  it("reduces a calendar-basis bag and does not read its calendar", () => {
    expect(
      parseFreeTimeTerms({
        basis: "calendar",
        timeZone: "UTC",
        firstDay: "nextDay",
        calendar: "junk",
      }),
    ).toEqual({
      timeZone: "UTC",
      firstDay: "nextDay",
      calendar: null,
      chargeCalendar: null,
    });
  });

  it("requires a charge basis only when asked to read one", () => {
    const bag = { basis: "calendar", timeZone: "UTC", firstDay: "eventDay" };
    expect(parseFreeTimeTerms(bag)).not.toBeNull();
    expect(parseFreeTimeTerms(bag, true)).toBeNull();
    expect(parseFreeTimeTerms({ ...bag, chargeBasis: "calendar" }, true)).toEqual({
      timeZone: "UTC",
      firstDay: "eventDay",
      calendar: null,
      chargeCalendar: null,
    });
  });

  it("resolves one calendar for whichever basis is working", () => {
    const free = parseFreeTimeTerms(
      { basis: "working", chargeBasis: "calendar", timeZone: "UTC", firstDay: "eventDay", calendar: weekdays },
      true,
    );
    expect(free?.calendar?.weekend).toEqual(new Set([6, 7]));
    expect(free?.chargeCalendar).toBeNull();
    const charge = parseFreeTimeTerms(
      { basis: "calendar", chargeBasis: "working", timeZone: "UTC", firstDay: "eventDay", calendar: weekdays },
      true,
    );
    expect(charge?.calendar).toBeNull();
    expect(charge?.chargeCalendar?.weekend).toEqual(new Set([6, 7]));
    expect(
      parseFreeTimeTerms({ basis: "calendar", chargeBasis: "working", timeZone: "UTC", firstDay: "eventDay" }, true),
    ).toBeNull();
    // Without a charge basis to read, a stray `chargeBasis` is ignored, as freeTimeExpiry ignores it.
    expect(
      parseFreeTimeTerms({ basis: "calendar", chargeBasis: "working", timeZone: "UTC", firstDay: "eventDay" }),
    ).not.toBeNull();
  });

  it("resolves the calendar on the working basis", () => {
    const terms = parseFreeTimeTerms({
      basis: "working",
      timeZone: "UTC",
      firstDay: "eventDay",
      calendar: weekdays,
    });
    expect(terms?.calendar?.weekend).toEqual(new Set([6, 7]));
  });

  it.each`
    options                                                                      | reason
    ${undefined}                                                                 | ${"omitted"}
    ${null}                                                                      | ${"null"}
    ${"calendar"}                                                                | ${"a string"}
    ${{ basis: "calendar", timeZone: "UTC" }}                                    | ${"no firstDay"}
    ${{ timeZone: "UTC", firstDay: "eventDay" }}                                 | ${"no basis"}
    ${{ basis: "calendar", firstDay: "eventDay" }}                               | ${"no timeZone"}
    ${{ basis: "calendar", timeZone: 3, firstDay: "eventDay" }}                  | ${"timeZone not a string"}
    ${{ basis: "working", timeZone: "UTC", firstDay: "eventDay" }}               | ${"working without a calendar"}
    ${{ basis: "working", timeZone: "UTC", firstDay: "eventDay", calendar: {} }} | ${"working with an empty calendar"}
  `("returns null when the bag is $reason", ({ options }) => {
    expect(parseFreeTimeTerms(options)).toBeNull();
  });
});

describe("parseFreeDays", () => {
  it.each`
    freeDays    | minimum | expected
    ${3}        | ${1}    | ${3}
    ${1}        | ${1}    | ${1}
    ${0}        | ${1}    | ${null}
    ${0}        | ${0}    | ${0}
    ${-1}       | ${0}    | ${null}
    ${2.5}      | ${0}    | ${null}
    ${"3"}      | ${0}    | ${null}
    ${Infinity} | ${0}    | ${null}
    ${2 ** 53}   | ${0}    | ${null}
    ${NaN}      | ${0}    | ${null}
  `(
    "reads $freeDays with minimum $minimum as $expected",
    ({ freeDays, minimum, expected }) => {
      expect(parseFreeDays(freeDays, minimum)).toBe(expected);
    },
  );
});

describe("parseTiers", () => {
  it.each`
    tiers        | expected
    ${undefined} | ${[]}
    ${[]}        | ${[]}
    ${[5, 10]}   | ${[5, 10]}
    ${[1]}       | ${[1]}
    ${[10, 5]}   | ${null}
    ${[5, 5]}    | ${null}
    ${[0]}       | ${null}
    ${[2.5]}     | ${null}
    ${["5"]}     | ${null}
    ${trailingHole}     | ${null}
    ${leadingHole}       | ${null}
    ${[2 ** 53]}   | ${null}
    ${"5"}       | ${null}
    ${null}      | ${null}
  `("reads $tiers as $expected", ({ tiers, expected }) => {
    expect(parseTiers(tiers)).toEqual(expected);
  });
});

describe("bandsByTier", () => {
  it.each`
    tiers      | chargeable | bands
    ${[]}      | ${0}       | ${[{ from: 1, to: null, days: 0 }]}
    ${[]}      | ${7}       | ${[{ from: 1, to: null, days: 7 }]}
    ${[5, 10]} | ${12}      | ${[{ from: 1, to: 5, days: 5 }, { from: 6, to: 10, days: 5 }, { from: 11, to: null, days: 2 }]}
    ${[5, 10]} | ${7}       | ${[{ from: 1, to: 5, days: 5 }, { from: 6, to: 10, days: 2 }, { from: 11, to: null, days: 0 }]}
    ${[5, 10]} | ${0}       | ${[{ from: 1, to: 5, days: 0 }, { from: 6, to: 10, days: 0 }, { from: 11, to: null, days: 0 }]}
    ${[1]}     | ${1}       | ${[{ from: 1, to: 1, days: 1 }, { from: 2, to: null, days: 0 }]}
  `("splits $chargeable days by $tiers", ({ tiers, chargeable, bands }) => {
    expect(bandsByTier(tiers, chargeable)).toEqual(bands);
  });
});
