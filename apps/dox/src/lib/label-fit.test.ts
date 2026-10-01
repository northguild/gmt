/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { pickLabelLeft, placeLabel, thinSpans } from "./label-fit";

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
