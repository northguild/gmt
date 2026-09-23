import { resolveReadingTimeZone } from "./resolveReadingTimeZone";

describe("resolveReadingTimeZone", () => {
  it.each`
    timeZone              | expected
    ${undefined}          | ${"UTC"}
    ${"UTC"}              | ${"UTC"}
    ${"America/New_York"} | ${"America/New_York"}
    ${"Asia/Kolkata"}     | ${"Asia/Kolkata"}
  `("returns $expected for timeZone $timeZone", ({ timeZone, expected }) => {
    expect(resolveReadingTimeZone(timeZone)).toBe(expected);
  });

  it.each`
    timeZone
    ${"Mars/Olympus"}
    ${""}
    ${null}
    ${42}
    ${{}}
  `("returns null for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(resolveReadingTimeZone(timeZone)).toBeNull();
  });
});
