import { chopMilliseconds, chopTime, chopUtc } from "../chop";
import { isAfterDateTime } from "../compare";
import { isValidDateTime } from "../validate";
import { getNow } from "./getNow";
import * as getSystemTimeZoneModule from "./getSystemTimeZone";
import { getToday } from "./getToday";

describe("getNow", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;
  const systemTime = "2024-02-29T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);

    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
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

  // 2024-02-29T00:00:00.000Z in each must-test timeZone: UTC → east → Pacific → Americas
  it.each`
    timeZone                 | expected
    ${"UTC"}                 | ${"2024-02-29T00:00:00"}
    ${"Etc/GMT"}             | ${"2024-02-29T00:00:00"}
    ${"GMT"}                 | ${"2024-02-29T00:00:00"}
    ${"Europe/Lisbon"}       | ${"2024-02-29T00:00:00"}
    ${"Europe/Dublin"}       | ${"2024-02-29T00:00:00"}
    ${"Europe/Berlin"}       | ${"2024-02-29T01:00:00"}
    ${"Europe/Helsinki"}     | ${"2024-02-29T02:00:00"}
    ${"Europe/Istanbul"}     | ${"2024-02-29T03:00:00"}
    ${"Asia/Kolkata"}        | ${"2024-02-29T05:30:00"}
    ${"Asia/Kathmandu"}      | ${"2024-02-29T05:45:00"}
    ${"Asia/Shanghai"}       | ${"2024-02-29T08:00:00"}
    ${"Australia/Lord_Howe"} | ${"2024-02-29T11:00:00"}
    ${"Pacific/Chatham"}     | ${"2024-02-29T13:45:00"}
    ${"Pacific/Apia"}        | ${"2024-02-29T13:00:00"}
    ${"Pacific/Niue"}        | ${"2024-02-28T13:00:00"}
    ${"America/New_York"}    | ${"2024-02-28T19:00:00"}
    ${"America/Chicago"}     | ${"2024-02-28T18:00:00"}
    ${"America/Phoenix"}     | ${"2024-02-28T17:00:00"}
  `(
    "returns $expected for system timeZone $timeZone",
    ({ timeZone, expected }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      const now = getNow();
      expect(chopMilliseconds(now)).toBe(expected);
    },
  );
});
