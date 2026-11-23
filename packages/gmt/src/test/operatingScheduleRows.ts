import { battleTestTimeZones } from "./index";
import { hostileProxy, revokedProxy } from "./hostileValues";

/** Saturday to Thursday: Monday 2024-06-10 09:00-17:00 local is inside it at every offset from -12 to +14. */
export const OPEN_RANGE = {
  start: "2024-06-08T00:00:00Z",
  end: "2024-06-13T00:00:00Z",
};

export const nineToFive = [{ from: "09:00", to: "17:00" }];
export const valid = { timeZone: "UTC", weekly: { 1: nineToFive } };

export interface ScheduleRow {
  schedule: unknown;
  reads: string;
}

const edge = (from: string, to: string) => ({
  ...valid,
  weekly: { 1: [{ from, to }] },
});
const withOverrideDate = (date: string) => ({
  ...valid,
  overrides: [{ date, windows: nineToFive }],
});
const nonEnumerableSymbolWeekly = Object.defineProperty(
  { 1: nineToFive },
  Symbol("hidden"),
  { value: [], enumerable: false },
);

/** Valid, and open somewhere in `OPEN_RANGE`. */
export const ACCEPTED_SCHEDULES: ScheduleRow[] = [
  { schedule: valid, reads: "the valid baseline" },
  ...battleTestTimeZones.map((zone) => ({
    schedule: { ...valid, timeZone: zone },
    reads: `zone ${zone}`,
  })),
  { schedule: { ...valid, timeZone: "-00:44:30" }, reads: "zone -00:44:30" },
  { schedule: { ...valid, timeZone: "utc" }, reads: "zone utc" },
  { schedule: { ...valid, timeZone: "+0530" }, reads: "zone +0530" },
  { schedule: { ...valid, timeZone: "-08" }, reads: "zone -08" },
  {
    schedule: { ...valid, holiday: ["2024-06-10"] },
    reads: "a misspelt holiday key",
  },
  {
    schedule: {
      ...valid,
      weekly: { 1: [{ from: "09:00", to: "17:00", note: "front desk" }] },
    },
    reads: "a window with an extra note key",
  },
  {
    schedule: { ...valid, weekly: { 1: nineToFive, 2: undefined } },
    reads: "a weekday set to undefined",
  },
  {
    schedule: Object.assign(() => {}, valid),
    reads: "a function carrying the fields",
  },
  {
    schedule: Object.assign(Object.create(null), valid),
    reads: "a null-prototype copy",
  },
  { schedule: Object.freeze({ ...valid }), reads: "a frozen copy" },
  { schedule: Object.create(valid), reads: "inherited fields" },
  {
    schedule: { ...valid, weekly: Object.create({ 1: nineToFive }) },
    reads: "an inherited weekday",
  },
  {
    schedule: { ...valid, weekly: nonEnumerableSymbolWeekly },
    reads: "a non-enumerable symbol key on weekly",
  },
  { schedule: edge("09:00:00.5", "17:00"), reads: "a fraction with a point" },
  { schedule: edge("09:00:00,5", "17:00"), reads: "a fraction with a comma" },
  { schedule: edge("00:00", "00:00"), reads: "a whole-day window" },
  { schedule: edge("09:00:00", "17:00:00"), reads: "windows with seconds" },
  {
    schedule: edge("22:00", "06:00"),
    reads: "a window that crosses midnight",
  },
  {
    schedule: { ...valid, weekly: { 7: nineToFive } },
    reads: "weekday 7, Sunday",
  },
  {
    schedule: { ...valid, weekly: { 1: nineToFive, 2: [] } },
    reads: "a weekday with no windows",
  },
  {
    schedule: {
      ...valid,
      weekly: {
        1: [
          { from: "09:00", to: "12:00" },
          { from: "13:00", to: "17:00" },
        ],
      },
    },
    reads: "two windows in one weekday",
  },
  { schedule: { ...valid, holidays: [] }, reads: "an empty holiday list" },
  { schedule: { ...valid, overrides: [] }, reads: "an empty override list" },
  {
    schedule: { ...valid, holidays: ["2024-06-11", "2024-06-11"] },
    reads: "a holiday listed twice",
  },
  {
    schedule: { ...valid, holidays: ["+002024-06-11"] },
    reads: "a holiday with an expanded year",
  },
  {
    schedule: {
      ...valid,
      overrides: [
        { date: "2024-06-11", windows: [] },
        { date: "2024-06-12", windows: [] },
      ],
    },
    reads: "two overrides for different dates",
  },
  { schedule: { ...valid, holidays: undefined }, reads: "holidays undefined" },
  {
    schedule: { ...valid, holidays: ["-271821-04-19"] },
    reads: "the first holiday Temporal allows",
  },
  {
    schedule: { ...valid, holidays: ["+275760-09-13"] },
    reads: "the last holiday Temporal allows",
  },
  {
    schedule: withOverrideDate("-271821-04-19"),
    reads: "an override on the first date Temporal allows",
  },
  {
    schedule: withOverrideDate("+275760-09-13"),
    reads: "an override on the last date Temporal allows",
  },
  {
    schedule: {
      ...valid,
      holidays: ["2024-06-10"],
      overrides: [{ date: "2024-06-10", windows: nineToFive }],
    },
    reads: "an override that beats a holiday",
  },
  {
    schedule: {
      ...valid,
      holidays: {
        weekend: [6, 7],
        holidays: ["2024-06-11"],
        timeZone: "UTC",
      },
    },
    reads: "a BusinessCalendar with an IANA zone",
  },
  {
    schedule: {
      ...valid,
      holidays: {
        weekend: [6, 7],
        holidays: ["2024-06-11"],
        timeZone: "+05:30",
      },
    },
    reads: "a BusinessCalendar with an offset zone",
  },
];

/** Valid, with no open instant in `OPEN_RANGE` and no override on 2024-06-12. */
export const CLOSED_SCHEDULES: ScheduleRow[] = [
  { schedule: { timeZone: "UTC", weekly: {} }, reads: "no weekday" },
  {
    schedule: { ...valid, weekly: new Map([[1, nineToFive]]) },
    reads: "a Map as weekly",
  },
  {
    schedule: { ...valid, holidays: ["2024-06-10"] },
    reads: "the open Monday a holiday",
  },
  {
    schedule: { ...valid, overrides: [{ date: "2024-06-10", windows: [] }] },
    reads: "the open Monday overridden closed",
  },
];

const day = (weekly: unknown) => ({ ...valid, weekly });
const holidays = (value: unknown) => ({ ...valid, holidays: value });
const overrides = (value: unknown) => ({ ...valid, overrides: value });

/** Invalid: each one is refused by `parseOperatingSchedule`. */
export const REJECTED_SCHEDULES: ScheduleRow[] = [
  { schedule: null, reads: "null" },
  { schedule: [valid], reads: "an array" },
  { schedule: "UTC", reads: "a string" },
  { schedule: { weekly: { 1: nineToFive } }, reads: "no timeZone" },
  {
    schedule: { ...valid, timeZone: "Invalid/Zone" },
    reads: "an invalid zone",
  },
  { schedule: { timeZone: "UTC" }, reads: "no weekly" },
  { schedule: day({ 1: nineToFive, 8: nineToFive }), reads: "weekday 8" },
  {
    schedule: day({ 1: [{ from: "09:00", to: "25:00" }] }),
    reads: "a malformed window",
  },
  { schedule: holidays("2024-06-10"), reads: "holidays as a string" },
  { schedule: holidays([20240610]), reads: "a numeric holiday" },
  { schedule: holidays(["2024-02-30"]), reads: "an impossible holiday" },
  { schedule: holidays(["2024-06-10T00:00"]), reads: "a date-time holiday" },
  {
    schedule: holidays(["2024-06-10[u-ca=hebrew]"]),
    reads: "a non-ISO holiday",
  },
  {
    schedule: holidays({
      weekend: [1, 2, 3, 4, 5, 6, 7],
      holidays: [],
      timeZone: "UTC",
    }),
    reads: "an invalid BusinessCalendar",
  },
  {
    schedule: holidays({ weekend: [6, 7], holidays: [] }),
    reads: "a BusinessCalendar without a zone",
  },
  {
    schedule: overrides({ date: "2024-06-10", windows: [] }),
    reads: "overrides not in an array",
  },
  {
    schedule: overrides([{ windows: [] }]),
    reads: "an override without a date",
  },
  {
    schedule: overrides([{ date: "2024-06-31", windows: [] }]),
    reads: "an impossible override date",
  },
  {
    schedule: overrides([{ date: "2024-06-10" }]),
    reads: "an override without windows",
  },
  {
    schedule: overrides([{ date: "2024-06-10", windows: [{ from: "09:00" }] }]),
    reads: "an override with a malformed window",
  },
  { schedule: overrides([null]), reads: "a null override" },
  {
    schedule: overrides([
      { date: "2024-06-10", windows: [] },
      { date: "2024-06-10", windows: nineToFive },
    ]),
    reads: "two overrides for one date",
  },
  {
    schedule: overrides([
      { date: "2024-06-10", windows: [] },
      { date: "+002024-06-10", windows: [] },
    ]),
    reads: "two spellings of one override date",
  },
  // Non-objects
  { schedule: undefined, reads: "undefined" },
  { schedule: 42, reads: "a number" },
  { schedule: 42n, reads: "a bigint" },
  { schedule: Symbol("s"), reads: "a symbol" },
  { schedule: true, reads: "a boolean" },
  { schedule: { ...valid, timeZone: "+24:00" }, reads: "zone +24:00" },
  {
    schedule: day({ 1: nineToFive, 2: "09:00" }),
    reads: "a weekday as a string",
  },
  { schedule: day({ 1: [null] }), reads: "a null window" },
  { schedule: day({ 1: [{ to: "17:00" }] }), reads: "a window without from" },
  { schedule: edge("24:00", "17:00"), reads: "from 24:00" },
  { schedule: edge("09:00", "T17:00"), reads: "to T17:00" },
  {
    schedule: holidays(["-271821-04-18"]),
    reads: "a holiday before Temporal's first date",
  },
  {
    schedule: holidays({
      weekend: [6, 7],
      holidays: ["2024-02-30"],
      timeZone: "UTC",
    }),
    reads: "a BusinessCalendar with an impossible holiday",
  },
  {
    schedule: overrides([{ date: "+275760-09-14", windows: [] }]),
    reads: "an override past Temporal's last date",
  },
  {
    schedule: overrides([{ date: "2024-06-10", windows: null }]),
    reads: "override windows null",
  },
  // Zone
  { schedule: { ...valid, timeZone: 0 }, reads: "a numeric zone" },
  { schedule: { ...valid, timeZone: "" }, reads: "an empty zone" },
  { schedule: { ...valid, timeZone: "Z" }, reads: "zone Z" },
  { schedule: { ...valid, timeZone: "[UTC]" }, reads: "a bracketed zone" },
  { schedule: { ...valid, timeZone: " UTC " }, reads: "a padded zone" },
  // weekly
  { schedule: day(null), reads: "weekly null" },
  { schedule: day([nineToFive]), reads: "weekly an array" },
  { schedule: day({ 1: nineToFive, 0: nineToFive }), reads: "weekday 0" },
  { schedule: day({ 1: nineToFive, "01": nineToFive }), reads: "weekday 01" },
  {
    schedule: day({ 1: nineToFive, Monday: nineToFive }),
    reads: "weekday Monday",
  },
  {
    schedule: day({ 1: nineToFive, [Symbol("day")]: nineToFive }),
    reads: "an enumerable symbol key on weekly",
  },
  // Weekday
  { schedule: day({ 1: nineToFive, 2: null }), reads: "a null weekday" },
  {
    schedule: day({ 1: nineToFive, 2: { from: "09:00", to: "17:00" } }),
    reads: "a window outside an array",
  },
  {
    schedule: day({
      1: nineToFive,
      // oxlint-disable-next-line unicorn/no-new-array -- the hole is the point of the row
      2: new Array(1),
    }),
    reads: "a hole in a weekday array",
  },
  // Window
  { schedule: edge("09:00", "24:00"), reads: "to 24:00" },
  { schedule: edge("T09:00", "17:00"), reads: "from T09:00" },
  { schedule: edge("9:00", "17:00"), reads: "from 9:00" },
  {
    schedule: edge("09:00:00.0000000001", "17:00"),
    reads: "a ten-digit fraction",
  },
  { schedule: edge("23:59:60", "17:00"), reads: "second 60" },
  { schedule: edge("09:00Z", "17:00"), reads: "from with an offset" },
  { schedule: day({ 1: [["09:00", "17:00"]] }), reads: "a window as a pair" },
  { schedule: day({ 1: [{ from: "09:00" }] }), reads: "a window without to" },
  // Holidays
  { schedule: holidays(null), reads: "holidays null" },
  {
    schedule: holidays(["2024-07-04[u-ca=iso8601]"]),
    reads: "a holiday with an iso8601 annotation",
  },
  {
    schedule: holidays(["2024-07-04[foo=bar]"]),
    reads: "a holiday with an elective annotation",
  },
  {
    schedule: holidays(["2024-07-04[UTC]"]),
    reads: "a holiday with a zone annotation",
  },
  {
    schedule: holidays(["+275760-09-14"]),
    reads: "a holiday past Temporal's last date",
  },
  {
    schedule: holidays({
      weekend: [6, 7],
      holidays: [],
      timeZone: "-00:44:30",
    }),
    reads: "a BusinessCalendar with a seconds offset",
  },
  // Overrides
  { schedule: overrides(null), reads: "overrides null" },
  {
    schedule: overrides([["2024-06-10", []]]),
    reads: "an override as a pair",
  },
  {
    schedule: overrides([{ date: 20240610, windows: [] }]),
    reads: "a numeric override date",
  },
  {
    schedule: overrides([{ date: "-271821-04-18", windows: [] }]),
    reads: "an override before Temporal's first date",
  },
  {
    schedule: overrides([{ date: "2024-06-10[u-ca=iso8601]", windows: [] }]),
    reads: "an override date with an annotation",
  },
];

/** Hostile: reading them throws, so each is built fresh per call. */
export const HOSTILE_SCHEDULES: { make: () => unknown; reads: string }[] = [
  { make: hostileProxy, reads: "a proxy whose every trap throws" },
  { make: revokedProxy, reads: "a revoked proxy" },
  {
    make: () => ({
      ...valid,
      get timeZone(): string {
        throw new TypeError("hostile timeZone");
      },
    }),
    reads: "a throwing timeZone getter",
  },
  {
    make: () => ({
      ...valid,
      weekly: {
        get 1(): unknown {
          throw new TypeError("hostile weekday");
        },
      },
    }),
    reads: "a throwing weekday getter",
  },
  {
    make: () => ({
      ...valid,
      get holidays(): unknown {
        throw new TypeError("hostile holidays");
      },
    }),
    reads: "a throwing holidays getter",
  },
];
