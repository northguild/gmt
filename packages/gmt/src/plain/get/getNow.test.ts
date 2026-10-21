import type { MockedFunction } from "vitest";
import {
  TomorrowTimeZone,
  YesterdayTimeZone,
  MustTestDstTimeZones,
  battleTestTimeZones,
} from "../../test";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { chopUtc } from "../../utc/chop";
import { chopMilliseconds, chopTime } from "../chop";
import { isAfterDateTime } from "../compare";
import { isValidDateTime } from "../validate";
import { getNow } from "./getNow";
import { getToday } from "./getToday";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

// Expected values per battle-test timeZone, verified against @js-temporal/polyfill.
const plainNowByZone = {
  UTC: "2024-02-29T00:00:00",
  GMT: "2024-02-29T00:00:00",
  "Etc/GMT": "2024-02-29T00:00:00",
  "America/Nome": "2024-02-28T15:00:00",
  "Asia/Anadyr": "2024-02-29T12:00:00",
  "Europe/Lisbon": "2024-02-29T00:00:00",
  "Europe/Dublin": "2024-02-29T00:00:00",
  "Europe/Berlin": "2024-02-29T01:00:00",
  "Europe/Helsinki": "2024-02-29T02:00:00",
  "Europe/Istanbul": "2024-02-29T03:00:00",
  "Asia/Kolkata": "2024-02-29T05:30:00",
  "Asia/Kathmandu": "2024-02-29T05:45:00",
  "Asia/Shanghai": "2024-02-29T08:00:00",
  "Australia/Lord_Howe": "2024-02-29T11:00:00",
  "Pacific/Chatham": "2024-02-29T13:45:00",
  "Pacific/Apia": "2024-02-29T13:00:00",
  "Pacific/Niue": "2024-02-28T13:00:00",
  "America/New_York": "2024-02-28T19:00:00",
  "America/Chicago": "2024-02-28T18:00:00",
  "America/Phoenix": "2024-02-28T17:00:00",
} satisfies Record<keyof typeof MustTestDstTimeZones, string>;

describe("getNow", () => {
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;
  const systemTime = "2024-02-29T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);

    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
    vi.useRealTimers();
  });

  it("returns an exact plain datetime for the mocked system timeZone", () => {
    const now = getNow();
    // ensure that now is greater or equal to system time
    expect(isAfterDateTime(now, chopUtc(systemTime))).toBe(true);
  });

  it("returns a valid ISO plain datetime string", () => {
    const now = getNow();
    expect(isValidDateTime(now)).toBe(true);
    expect(chopTime(now)).toBe(getToday());
  });

  // yesterday tomorrow tests
  it.each`
    timeZone             | expected
    ${"UTC"}             | ${"2024-02-29T00:00:00"}
    ${YesterdayTimeZone} | ${"2024-02-28T13:00:00"}
    ${TomorrowTimeZone}  | ${"2024-02-29T13:00:00"}
  `(
    "yesterday / today tests: returns $expected for system timeZone $timeZone",
    ({ timeZone, expected }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      const now = getNow();
      expect(chopMilliseconds(now)).toBe(expected);
    },
  );

  // 2024-02-29T00:00:00.000Z in each must-test timeZone: UTC → east → Pacific → Americas
  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: plainNowByZone[timeZone],
    })),
  )(
    "returns $expected for system timeZone $timeZone",
    ({ timeZone, expected }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      const now = getNow();
      expect(chopMilliseconds(now)).toBe(expected);
    },
  );
});

// A mocked row must not leak: the module is replaced with a spy for the whole file, and Vitest
// restores only spies it created itself, so each file resets this one explicitly.
describe("getSystemTimeZone after a mocked row", () => {
  afterEach(() => {
    vi.mocked(getSystemTimeZone).mockReset();
  });

  it("returns the mocked zone while a row replaces it", () => {
    vi.mocked(getSystemTimeZone).mockReturnValue("Pacific/Kiritimati");
    expect(getSystemTimeZone()).toBe("Pacific/Kiritimati");
  });

  it("returns the host's own zone again in the next row", () => {
    expect(getSystemTimeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});
