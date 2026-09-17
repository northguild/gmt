/**
 * Cross-function contract of the `unix/` namespace: one epoch grammar, one `epochUnit` vocabulary
 * and one `timeZone` default for every function that reads them.
 *
 * - Epoch grammar: a safe-integer number, or a string of optionally signed ASCII digits. POSIX
 *   epoch time is an integer count with no other notation, so anything else is the sentinel.
 * - `epochUnit`: singular and plural names are the same unit (Temporal §13.17
 *   GetTemporalUnitValuedOption); an explicit `undefined` is the same as omitted.
 * - `timeZone`: omitted → UTC; `"local"` → the system zone; an unknown zone → the sentinel
 *   (ECMA-402 / Temporal throw RangeError for it).
 */
import { Temporal } from "@js-temporal/polyfill";
import { mockSystemTimeZone } from "../test";
import {
  addUnix,
  diffUnix,
  diffUnixAsDuration,
  endOfQuarterForUnix,
  endOfUnix,
  isBetweenUnix,
  maxUnix,
  minUnix,
  roundUnix,
  setUnix,
  sortUnix,
  startOfQuarterForUnix,
  startOfUnix,
  subtractUnix,
} from "./calculate";
import {
  areUnixEqual,
  areUnixEqualBy,
  isAfterUnix,
  isBeforeUnix,
} from "./compare";
import {
  convertUnixToPlainDate,
  convertUnixToPlainDateTime,
  convertUnixToPlainTime,
  convertUnixToUtc,
  convertUnixToZoned,
} from "./convert";
import { formatCalendarUnix, formatRelativeUnix, formatUnix } from "./format";
import {
  intervalCountUnix,
  intervalFromDurationUnix,
  intervalLengthUnix,
  intervalOverlappingDaysUnix,
  splitIntervalByUnitUnix,
} from "./interval";
import { isValidUnixInterval } from "./interval/validate";
import {
  parseDateFromUnix,
  parseDayFromUnix,
  parseDayOfWeekFromUnix,
  parseHourFromUnix,
  parseMicrosecondFromUnix,
  parseMillisecondFromUnix,
  parseMinuteFromUnix,
  parseMonthFromUnix,
  parseNanosecondFromUnix,
  parseSecondFromUnix,
  parseTimeFromUnix,
  parseUnitFromUnix,
  parseWeekFromUnix,
  parseYearFromUnix,
} from "./parse";
import {
  isValidUnixMilliseconds,
  isValidUnixRange,
  isValidUnixSeconds,
} from "./validate";

// 2024-01-30T20:30:45.123Z — already 2024-01-31T05:30:45.123+09:00 in Asia/Tokyo, so the local
// date, hour and month arithmetic all differ between UTC and the mocked system zone.
const EPOCH_MS = Temporal.Instant.from(
  "2024-01-30T20:30:45.123Z",
).epochMilliseconds;
const EPOCH_S = Math.floor(EPOCH_MS / 1000);
const SYSTEM_ZONE = "Asia/Tokyo";

type Options = Record<string, unknown> | undefined;
type Call = (value: unknown, options: Options) => unknown;

/** Every `unix/` function that reads an epoch argument. `zone`: takes a `timeZone` option. */
const epochFunctions: Array<{
  name: string;
  call: Call;
  sentinel: unknown;
  zone: boolean;
  unit: boolean;
}> = [
  {
    name: "addUnix",
    call: (v, o) => addUnix(v as number, { months: 1 }, o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "subtractUnix",
    call: (v, o) => subtractUnix(v as number, { months: 1 }, o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "setUnix",
    call: (v, o) => setUnix(v as number, { hour: 0 }, o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "roundUnix",
    call: (v, o) => roundUnix(v as number, { smallestUnit: "day", ...o }),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "isBetweenUnix",
    call: (v, o) => isBetweenUnix(v as number, v as number, v as number, o),
    sentinel: false,
    zone: true,
    unit: true,
  },
  {
    name: "diffUnix",
    call: (v, o) => diffUnix(v as number, v as number, "days", o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "diffUnixAsDuration",
    call: (v, o) => diffUnixAsDuration(v as number, v as number, "days", o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "startOfUnix",
    call: (v, o) => startOfUnix(v as number, "day", o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "endOfUnix",
    call: (v, o) => endOfUnix(v as number, "day", o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "startOfQuarterForUnix",
    call: (v, o) => startOfQuarterForUnix(v as number, o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "endOfQuarterForUnix",
    call: (v, o) => endOfQuarterForUnix(v as number, o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "areUnixEqual",
    call: (v, o) => areUnixEqual(v as number, v as number, o),
    sentinel: false,
    zone: false,
    unit: true,
  },
  {
    name: "areUnixEqualBy",
    call: (v, o) => areUnixEqualBy(v as number, v as number, "day", o),
    sentinel: false,
    zone: true,
    unit: true,
  },
  {
    name: "isAfterUnix",
    call: (v, o) => isAfterUnix(v as number, "-8640000000000", o),
    sentinel: false,
    zone: false,
    unit: true,
  },
  {
    name: "isBeforeUnix",
    call: (v, o) => isBeforeUnix("-8640000000000", v as number, o),
    sentinel: false,
    zone: false,
    unit: true,
  },
  {
    name: "convertUnixToPlainDate",
    call: (v, o) => convertUnixToPlainDate(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "convertUnixToPlainDateTime",
    call: (v, o) => convertUnixToPlainDateTime(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "convertUnixToPlainTime",
    call: (v, o) => convertUnixToPlainTime(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "convertUnixToUtc",
    call: (v, o) => convertUnixToUtc(v as number, o),
    sentinel: "",
    zone: false,
    unit: true,
  },
  {
    name: "convertUnixToZoned",
    call: (v, o) => convertUnixToZoned(v as number, "Europe/Paris", o),
    sentinel: "",
    zone: false,
    unit: true,
  },
  {
    name: "formatUnix",
    call: (v, o) => formatUnix(v as number, "en-US", o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "formatCalendarUnix",
    call: (v, o) =>
      formatCalendarUnix(v as number, "en-US", {
        reference: v as number,
        ...o,
      }),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "formatRelativeUnix",
    call: (v, o) =>
      formatRelativeUnix(v as number, "en-US", {
        reference: v as number,
        ...o,
      }),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "intervalFromDurationUnix",
    call: (v, o) => intervalFromDurationUnix(v as number, "P1M", "start", o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "intervalOverlappingDaysUnix",
    call: (v, o) =>
      intervalOverlappingDaysUnix(
        v as number,
        v as number,
        v as number,
        v as number,
        o,
      ),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "intervalLengthUnix",
    call: (v, o) => intervalLengthUnix(v as number, v as number, "day", o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "intervalCountUnix",
    call: (v, o) => intervalCountUnix(v as number, v as number, "day", o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "splitIntervalByUnitUnix",
    call: (v, o) =>
      splitIntervalByUnitUnix(v as number, v as number, "day", 1, o),
    sentinel: [],
    zone: true,
    unit: true,
  },
  {
    name: "parseDateFromUnix",
    call: (v, o) => parseDateFromUnix(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "parseDayFromUnix",
    call: (v, o) => parseDayFromUnix(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "parseDayOfWeekFromUnix",
    call: (v, o) => parseDayOfWeekFromUnix(v as number, o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "parseHourFromUnix",
    call: (v, o) => parseHourFromUnix(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "parseMicrosecondFromUnix",
    call: (v, o) => parseMicrosecondFromUnix(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "parseMillisecondFromUnix",
    call: (v, o) => parseMillisecondFromUnix(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "parseMinuteFromUnix",
    call: (v, o) => parseMinuteFromUnix(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "parseMonthFromUnix",
    call: (v, o) => parseMonthFromUnix(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "parseNanosecondFromUnix",
    call: (v, o) => parseNanosecondFromUnix(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "parseSecondFromUnix",
    call: (v, o) => parseSecondFromUnix(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "parseTimeFromUnix",
    call: (v, o) => parseTimeFromUnix(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "parseUnitFromUnix",
    call: (v, o) => parseUnitFromUnix(v as number, "hour", o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "parseWeekFromUnix",
    call: (v, o) => parseWeekFromUnix(v as number, o),
    sentinel: null,
    zone: true,
    unit: true,
  },
  {
    name: "parseYearFromUnix",
    call: (v, o) => parseYearFromUnix(v as number, o),
    sentinel: "",
    zone: true,
    unit: true,
  },
  {
    name: "sortUnix",
    call: (v) => sortUnix([v as number]),
    sentinel: [],
    zone: false,
    unit: false,
  },
  {
    name: "minUnix",
    call: (v) => minUnix([v as number]),
    sentinel: null,
    zone: false,
    unit: false,
  },
  {
    name: "maxUnix",
    call: (v) => maxUnix([v as number]),
    sentinel: null,
    zone: false,
    unit: false,
  },
  {
    name: "isValidUnixMilliseconds",
    call: (v) => isValidUnixMilliseconds(v),
    sentinel: false,
    zone: false,
    unit: false,
  },
  {
    name: "isValidUnixSeconds",
    call: (v) => isValidUnixSeconds(v),
    sentinel: false,
    zone: false,
    unit: false,
  },
  {
    name: "isValidUnixInterval",
    call: (v) => isValidUnixInterval(v as number, v as number),
    sentinel: false,
    zone: false,
    unit: false,
  },
  {
    name: "isValidUnixRange",
    call: (v) =>
      isValidUnixRange({
        value1: v as number,
        value2: v as number,
        options: { allowEqual: true },
      }),
    sentinel: false,
    zone: false,
    unit: false,
  },
];

/** Values outside the epoch grammar: each must give the sentinel. */
const notEpochs: Array<[string, unknown]> = [
  ["a fraction", 1.5],
  ["2^53", 2 ** 53],
  ["NaN", Number.NaN],
  ["Infinity", Infinity],
  ["an empty string", ""],
  ["a leading space", ` ${EPOCH_MS}`],
  ["a trailing newline", `${EPOCH_MS}\n`],
  ["a plus sign", `+${EPOCH_MS}`],
  ["exponent notation", "1.706646645123e12"],
  ["a decimal string", `${EPOCH_MS}.0`],
  ["a hex string", "0x18D5C0C4E23"],
  ["a bigint", BigInt(EPOCH_MS)],
  ["a boolean", true],
  ["an object", {}],
];

const grammarRows = epochFunctions.flatMap((row) =>
  notEpochs.map(([description, value]) => ({ ...row, description, value })),
);

describe("unix/ epoch grammar", () => {
  it.each(epochFunctions)(
    "$name reads a digit string as the same epoch as the number",
    ({ call, sentinel }) => {
      const fromNumber = call(EPOCH_MS, undefined);

      expect(fromNumber).not.toEqual(sentinel);
      expect(call(String(EPOCH_MS), undefined)).toEqual(fromNumber);
    },
  );

  it.each(grammarRows)(
    "$name returns its sentinel for $description",
    ({ call, sentinel, value }) => {
      expect(call(value, undefined)).toEqual(sentinel);
    },
  );
});

describe("unix/ epochUnit option", () => {
  const unitRows = epochFunctions.filter((row) => row.unit);

  it.each(unitRows)(
    "$name reads second and seconds as the same unit",
    ({ call, sentinel }) => {
      const plural = call(EPOCH_S, { epochUnit: "seconds" });

      expect(plural).not.toEqual(sentinel);
      expect(call(EPOCH_S, { epochUnit: "second" })).toEqual(plural);
      expect(call(String(EPOCH_S), { epochUnit: "second" })).toEqual(plural);
    },
  );

  it.each(unitRows)(
    "$name reads millisecond, an explicit undefined and omitted as milliseconds",
    ({ call, sentinel }) => {
      const plural = call(EPOCH_MS, { epochUnit: "milliseconds" });

      expect(plural).not.toEqual(sentinel);
      expect(call(EPOCH_MS, { epochUnit: "millisecond" })).toEqual(plural);
      expect(call(EPOCH_MS, { epochUnit: undefined })).toEqual(plural);
      expect(call(EPOCH_MS, undefined)).toEqual(plural);
    },
  );

  it.each(unitRows)(
    "$name returns its sentinel for epochUnit nanoseconds",
    ({ call, sentinel }) => {
      expect(call(EPOCH_MS, { epochUnit: "nanoseconds" })).toEqual(sentinel);
    },
  );
});

describe("unix/ timeZone option", () => {
  let restore: () => void;

  beforeEach(() => {
    restore = mockSystemTimeZone(SYSTEM_ZONE);
  });

  afterEach(() => {
    restore();
  });

  const zoneRows = epochFunctions.filter((row) => row.zone);

  it.each(zoneRows)(
    "$name reads an omitted timeZone as UTC, not the system zone",
    ({ call, sentinel }) => {
      const utc = call(EPOCH_MS, { timeZone: "UTC" });

      expect(utc).not.toEqual(sentinel);
      expect(call(EPOCH_MS, undefined)).toEqual(utc);
      expect(call(EPOCH_MS, { timeZone: undefined })).toEqual(utc);
    },
  );

  it.each(zoneRows)(
    "$name reads local as the system zone",
    ({ call, sentinel }) => {
      const system = call(EPOCH_MS, { timeZone: SYSTEM_ZONE });

      expect(system).not.toEqual(sentinel);
      expect(call(EPOCH_MS, { timeZone: "local" })).toEqual(system);
    },
  );

  it.each(
    zoneRows.flatMap((row) =>
      ["Asia/Tokio", "", "UTC+9"].map((timeZone) => ({ ...row, timeZone })),
    ),
  )(
    "$name returns its sentinel for timeZone $timeZone",
    ({ call, sentinel, timeZone }) => {
      expect(call(EPOCH_MS, { timeZone })).toEqual(sentinel);
    },
  );

  // Independent values from the polyfill: the omitted zone is UTC, "local" the mocked system zone.
  it.each`
    timeZone     | zone
    ${undefined} | ${"UTC"}
    ${"local"}   | ${SYSTEM_ZONE}
  `(
    "parses and shifts in $zone for timeZone $timeZone",
    ({ timeZone, zone }) => {
      const zoned =
        Temporal.Instant.fromEpochMilliseconds(EPOCH_MS).toZonedDateTimeISO(
          zone,
        );

      expect(parseDateFromUnix(EPOCH_MS, { timeZone })).toBe(
        zoned.toPlainDate().toString(),
      );
      expect(parseHourFromUnix(EPOCH_MS, { timeZone })).toBe(
        String(zoned.hour).padStart(2, "0"),
      );
      expect(addUnix(EPOCH_MS, { months: 1 }, { timeZone })).toBe(
        zoned.add({ months: 1 }).epochMilliseconds,
      );
      expect(startOfUnix(EPOCH_MS, "day", { timeZone })).toBe(
        zoned.startOfDay().epochMilliseconds,
      );
    },
  );
});
