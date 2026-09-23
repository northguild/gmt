/// <reference types="vitest/globals" />
import {
  createCoalescingRunner,
  isReferenceInput,
} from "./gmt-reference-watch";

describe("isReferenceInput — which gmt source changes regenerate the reference", () => {
  it.each([
    ["zoned/calculate/addZoned.ts", true],
    ["internal/zonedBucket.ts", true],
    ["index.ts", true],
    ["zoned/calculate/addZoned.test.ts", false],
    ["zoned/calculate/addZoned.spec.ts", false],
    ["test/timeZoneMatrix.ts", false],
    ["internal/temporalCompat/README.md", false],
    [null, false],
  ])("%s → %s", (file, expected) => {
    expect(isReferenceInput(file)).toBe(expected);
  });
});

describe("createCoalescingRunner", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once after a burst of triggers settles", async () => {
    const run = vi.fn(async () => {});
    const trigger = createCoalescingRunner(run, 300);

    trigger();
    await vi.advanceTimersByTimeAsync(200);
    trigger();
    await vi.advanceTimersByTimeAsync(200);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("queues exactly one rerun for triggers that land while a run is in flight", async () => {
    let finish!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const trigger = createCoalescingRunner(run, 10);

    trigger();
    await vi.advanceTimersByTimeAsync(10);
    expect(run).toHaveBeenCalledTimes(1);

    trigger();
    trigger();
    await vi.advanceTimersByTimeAsync(10);
    expect(run).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);

    finish();
    await vi.advanceTimersByTimeAsync(50);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("keeps running after a failed run", async () => {
    const run = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue();
    const onError = vi.fn();
    const trigger = createCoalescingRunner(run, 10, onError);

    trigger();
    await vi.advanceTimersByTimeAsync(10);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    trigger();
    await vi.advanceTimersByTimeAsync(10);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
