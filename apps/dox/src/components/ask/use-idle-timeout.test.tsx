/**
 * @vitest-environment jsdom
 *
 * The chat's two stall timers: a long wait for the first output, and a short
 * one for silence once the answer is streaming.
 */
import { renderHook } from "@testing-library/react";
import { FIRST_OUTPUT_TIMEOUT_MS, IDLE_TIMEOUT_MS } from "~/lib/chat-constants";
import { useIdleTimeout } from "./use-idle-timeout";

interface Props {
  status: string;
  messages: readonly unknown[];
  activity?: unknown;
}

function setup(status: string, messages: readonly unknown[] = [1]) {
  const stop = vi.fn();
  const onStall = vi.fn();
  const hook = renderHook(
    (props: Props) => useIdleTimeout({ ...props, stop, onStall }),
    { initialProps: { status, messages } as Props },
  );
  return { stop, onStall, ...hook };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIdleTimeout", () => {
  it("waits for the first output far longer than the idle limit", () => {
    // Before any answer text arrives the Worker may be failing over past spent
    // or slow brains. The idle limit alone stopped answers that were coming.
    expect(FIRST_OUTPUT_TIMEOUT_MS).toBeGreaterThan(IDLE_TIMEOUT_MS);
    const { stop, onStall } = setup("submitted");

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1_000);
    expect(onStall).not.toHaveBeenCalled();

    vi.advanceTimersByTime(FIRST_OUTPUT_TIMEOUT_MS - IDLE_TIMEOUT_MS);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it("stops a stream that goes silent for the idle limit", () => {
    const { stop, onStall } = setup("streaming");

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);
    expect(onStall).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it("restarts the idle clock on every streamed chunk", () => {
    const { onStall, rerender } = setup("streaming", [1]);

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1_000);
    rerender({ status: "streaming", messages: [1, 2] });
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1_000);
    expect(onStall).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it("restarts the first-output clock on each progress line", () => {
    // A walk past several slow brains can outlast the limit in total while
    // every step of it is reported.
    const { onStall, rerender } = setup("submitted", [1]);

    vi.advanceTimersByTime(FIRST_OUTPUT_TIMEOUT_MS - 1_000);
    rerender({ status: "submitted", messages: [1], activity: "Asking B" });
    vi.advanceTimersByTime(FIRST_OUTPUT_TIMEOUT_MS - 1_000);
    expect(onStall).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it("switches to the idle limit once output starts", () => {
    const { onStall, rerender } = setup("submitted", [1]);

    vi.advanceTimersByTime(10_000);
    rerender({ status: "streaming", messages: [1, 2] });

    // 40 s in total — well short of the first-output limit, so only the idle
    // limit can have fired.
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it("does nothing while no request is in flight", () => {
    for (const status of ["ready", "error"]) {
      const { onStall } = setup(status);
      vi.advanceTimersByTime(FIRST_OUTPUT_TIMEOUT_MS * 2);
      expect(onStall).not.toHaveBeenCalled();
    }
  });

  it("clears its timer on unmount", () => {
    const { onStall, unmount } = setup("streaming");
    unmount();
    vi.advanceTimersByTime(FIRST_OUTPUT_TIMEOUT_MS * 2);
    expect(onStall).not.toHaveBeenCalled();
  });
});
