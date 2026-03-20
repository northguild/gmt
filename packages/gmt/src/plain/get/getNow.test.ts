import { chopTime, chopUtc } from "../chop";
import { isAfterDateTime } from "../compare";
import { isValidDateTime } from "../validate";
import { getNow } from "./getNow";
import * as getSystemTimezoneModule from "./getSystemTimezone";
import { getToday } from "./getToday";

describe("getNow", () => {
  let timezoneSpy: ReturnType<typeof vi.spyOn>;
  const systemTime = "2024-02-29T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);

    timezoneSpy = vi
      .spyOn(getSystemTimezoneModule, "getSystemTimezone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timezoneSpy.mockRestore();
    vi.useRealTimers();
  });

  it("returns an exact plain datetime for the mocked system timezone", () => {
    const now = getNow();
    // ensure that now is greater or equal to system time
    expect(isAfterDateTime(now, chopUtc(systemTime))).toBe(true);
  });

  it("returns a valid ISO plain datetime string", () => {
    const now = getNow();
    expect(isValidDateTime(now)).toBe(true);
    expect(chopTime(now)).toBe(getToday());
  });
});
