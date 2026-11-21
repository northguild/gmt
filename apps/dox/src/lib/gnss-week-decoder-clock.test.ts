import { clockNow } from "./gnss-week-decoder";

describe("the week decoder's clock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the current instant with its fraction of a second", () => {
    vi.setSystemTime("2026-11-16T12:34:56.789Z");
    expect(clockNow()).toMatch(/^2026-11-16T12:34:56\.789\d*Z$/);
  });
});
