import {
  clampRailWidth,
  KEY_BIG_STEP_PX,
  KEY_STEP_PX,
  railBounds,
  railWidthForKey,
} from "./rail-width";

const REM = 16;

describe("railBounds", () => {
  it("keeps today's width as the narrowest on a 1440 px desktop", () => {
    // 34vw of 1440 = 489.6, inside clamp(352, …, 544).
    expect(railBounds({ viewportWidth: 1440, bodyWidth: 1440, rem: REM })).toEqual({
      min: 489.6,
      max: 720,
    });
  });

  it("caps the narrowest at 34rem on a wide screen", () => {
    expect(
      railBounds({ viewportWidth: 2560, bodyWidth: 2560, rem: REM }).min,
    ).toBe(544);
  });

  it("lets the rail reach half the page", () => {
    expect(
      railBounds({ viewportWidth: 2560, bodyWidth: 2560, rem: REM }).max,
    ).toBe(1280);
  });

  it("keeps 28rem for the transcript when half the page would leave less", () => {
    // 20 px text on a 1100 px window: half the page is 550, but the transcript
    // needs 28 × 20 = 560, so the rail stops at 1100 - 560 = 540.
    expect(
      railBounds({ viewportWidth: 1100, bodyWidth: 1100, rem: 20 }),
    ).toEqual({ min: 440, max: 540 });
  });

  it("never sets the widest below the narrowest on a small window", () => {
    // Half of a 700 px body is 350, under the 22rem (352) default.
    const bounds = railBounds({ viewportWidth: 1000, bodyWidth: 700, rem: REM });
    expect(bounds).toEqual({ min: 352, max: 352 });
  });
});

describe("clampRailWidth", () => {
  const bounds = { min: 400, max: 800 };

  it("raises a width below the narrowest", () => {
    expect(clampRailWidth(100, bounds)).toBe(400);
  });

  it("lowers a width above the widest", () => {
    expect(clampRailWidth(5000, bounds)).toBe(800);
  });

  it("keeps a width inside the bounds", () => {
    expect(clampRailWidth(612, bounds)).toBe(612);
  });
});

describe("railWidthForKey", () => {
  const bounds = { min: 400, max: 800 };

  it("widens the rail on ArrowLeft", () => {
    expect(railWidthForKey("ArrowLeft", false, 500, bounds)).toBe(
      500 + KEY_STEP_PX,
    );
  });

  it("narrows the rail on ArrowRight", () => {
    expect(railWidthForKey("ArrowRight", false, 500, bounds)).toBe(
      500 - KEY_STEP_PX,
    );
  });

  it("takes a bigger step with Shift", () => {
    expect(railWidthForKey("ArrowLeft", true, 500, bounds)).toBe(
      500 + KEY_BIG_STEP_PX,
    );
  });

  it("stops at the widest", () => {
    expect(railWidthForKey("ArrowLeft", true, 790, bounds)).toBe(800);
  });

  it("jumps to the narrowest on Home", () => {
    expect(railWidthForKey("Home", false, 650, bounds)).toBe(400);
  });

  it("jumps to the widest on End", () => {
    expect(railWidthForKey("End", false, 650, bounds)).toBe(800);
  });

  it("ignores any other key", () => {
    expect(railWidthForKey("Enter", false, 650, bounds)).toBeUndefined();
  });
});
