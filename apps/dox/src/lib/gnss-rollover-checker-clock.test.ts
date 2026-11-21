import { clockNow } from "./gnss-rollover-checker";

describe("the rollover checker's clock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the current instant to the second", () => {
    vi.setSystemTime("2026-11-16T12:34:56.789Z");
    expect(clockNow()).toBe("2026-11-16T12:34:56Z");
  });

  it("changes when the second changes", () => {
    vi.setSystemTime("2026-11-16T12:34:56.100Z");
    const first = clockNow();
    vi.setSystemTime("2026-11-16T12:34:57.100Z");
    expect(clockNow()).not.toBe(first);
  });
});
