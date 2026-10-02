/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  layoutWidth,
  onWidthChange,
  pickLabelLeft,
  placeLabel,
  thinSpans,
  thinTickLabels,
} from "./label-fit";

describe("thinSpans", () => {
  it("keeps spans that clear the last kept one by the gap", () => {
    expect(
      thinSpans([
        { left: 0, right: 40 },
        { left: 50, right: 90 },
        { left: 100, right: 140 },
      ]),
    ).toEqual([true, true, true]);
  });

  it("drops a span that touches or crosses the previous kept one", () => {
    expect(
      thinSpans([
        { left: 0, right: 40 },
        { left: 44, right: 84 },
        { left: 90, right: 130 },
      ]),
    ).toEqual([true, false, true]);
  });

  it("measures the gap from the last kept span, not the dropped one", () => {
    expect(
      thinSpans([
        { left: 0, right: 40 },
        { left: 20, right: 60 },
        { left: 48, right: 88 },
      ]),
    ).toEqual([true, false, true]);
  });

  it("drops spans that run past the limit or start before zero", () => {
    expect(
      thinSpans(
        [
          { left: -10, right: 30 },
          { left: 60, right: 100 },
          { left: 180, right: 230 },
        ],
        8,
        200,
      ),
    ).toEqual([false, true, false]);
  });

  it("tolerates the 2px a tick label is nudged left of its row", () => {
    expect(thinSpans([{ left: -2, right: 30 }])).toEqual([true]);
  });

  it("is empty for no spans", () => {
    expect(thinSpans([])).toEqual([]);
  });
});

describe("placeLabel", () => {
  it("sits to the right of its marker when there is room", () => {
    expect(placeLabel({ atPx: 20, labelPx: 100, trackPx: 400 })).toBe("start");
  });

  it("flips to the left when the label would run past the track", () => {
    expect(placeLabel({ atPx: 350, labelPx: 100, trackPx: 400 })).toBe("end");
  });

  it("flips to the left when the label would cross a blocker", () => {
    expect(
      placeLabel({ atPx: 200, labelPx: 100, trackPx: 600, blockers: [280] }),
    ).toBe("end");
  });

  it("stays on the right when neither side is clear", () => {
    expect(placeLabel({ atPx: 40, labelPx: 100, trackPx: 100 })).toBe("start");
  });

  it("ignores a blocker the label does not reach", () => {
    expect(
      placeLabel({ atPx: 20, labelPx: 100, trackPx: 600, blockers: [500] }),
    ).toBe("start");
  });
});

describe("pickLabelLeft", () => {
  it("takes the first candidate that fits", () => {
    expect(pickLabelLeft([20, 200], 100, 400)).toBe(20);
  });

  it("skips a candidate a blocker would strike through", () => {
    expect(pickLabelLeft([20, 136, 300], 100, 400, [60])).toBe(136);
  });

  it("skips a candidate that runs past the track", () => {
    expect(pickLabelLeft([350, 280], 100, 400)).toBe(280);
  });

  it("falls back to the first candidate when none is clear", () => {
    expect(pickLabelLeft([20, 40], 100, 100, [50])).toBe(20);
  });

  it("returns 0 for no candidates", () => {
    expect(pickLabelLeft([], 100, 400)).toBe(0);
  });
});

describe("onWidthChange", () => {
  it("calls back on a width change and returns a disposer that disconnects", () => {
    const spy = spyOnResizeObservers();
    try {
      const el = { clientWidth: 100, isConnected: true } as HTMLElement;
      const fn = vi.fn();
      const dispose = onWidthChange(el, fn);
      expect(spy.live.size).toBe(1);
      spy.fire();
      expect(fn).not.toHaveBeenCalled(); // same width
      (el as { clientWidth: number }).clientWidth = 200;
      spy.fire();
      expect(fn).toHaveBeenCalledTimes(1);
      dispose();
      expect(spy.live.size).toBe(0);
      expect(() => dispose()).not.toThrow();
    } finally {
      spy.restore();
    }
  });

  it("returns a callable no-op where ResizeObserver does not exist", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    try {
      const dispose = onWidthChange({} as HTMLElement, () => {});
      expect(() => dispose()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("layoutWidth", () => {
  it("is the layout width, not the width after an ancestor's transform", () => {
    const el = {
      offsetWidth: 100,
      getBoundingClientRect: () => ({ width: 92 }),
    } as unknown as HTMLElement;
    expect(layoutWidth(el)).toBe(100);
  });

  it("falls back to the rect for an element with no layout box", () => {
    const el = {
      offsetWidth: 0,
      getBoundingClientRect: () => ({ width: 40 }),
    } as unknown as HTMLElement;
    expect(layoutWidth(el)).toBe(40);
  });
});

describe("thinTickLabels while an entrance scales the row", () => {
  /** A row `width` layout px wide and ticks `tickPx` wide at the given layout
   *  lefts, all drawn at `scale` (an entrance in progress). */
  function row(scale: number, width: number, lefts: number[], tickPx: number) {
    const ticks = lefts.map((left) => ({
      hidden: false,
      getBoundingClientRect: () => ({
        left: left * scale,
        right: (left + tickPx) * scale,
      }),
    }));
    return {
      ticks,
      el: {
        clientWidth: width,
        querySelectorAll: () => ticks,
        getBoundingClientRect: () => ({ left: 0, width: width * scale }),
      } as unknown as HTMLElement,
    };
  }

  it("hides the same ticks at 92% as at full size", () => {
    // Ticks 40px wide, 48.5px apart: 8.5px of room, over the 8px gap. Measured
    // at 92% the room is 7.8px, so an uncorrected fit hides ticks that fit.
    const lefts = [0, 48.5, 97, 145.5];
    const full = row(1, 200, lefts, 40);
    thinTickLabels(full.el);
    expect(full.ticks.map((t) => t.hidden)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    const scaled = row(0.92, 200, lefts, 40);
    thinTickLabels(scaled.el);
    expect(scaled.ticks.map((t) => t.hidden)).toEqual(
      full.ticks.map((t) => t.hidden),
    );
  });

  it("hides the same ticks at 92% when they do collide", () => {
    const lefts = [0, 45, 90, 135];
    const full = row(1, 200, lefts, 40);
    thinTickLabels(full.el);
    const scaled = row(0.92, 200, lefts, 40);
    thinTickLabels(scaled.el);
    expect(full.ticks.some((t) => t.hidden)).toBe(true);
    expect(scaled.ticks.map((t) => t.hidden)).toEqual(
      full.ticks.map((t) => t.hidden),
    );
  });

  it("keeps a tick that fits and drops one past the row's edge at 92%", () => {
    const scaled = row(0.92, 200, [0, 170], 40);
    thinTickLabels(scaled.el);
    expect(scaled.ticks.map((t) => t.hidden)).toEqual([false, true]);
  });
});
