import { describe, expect, it } from "vitest";
import { RUNNING_AUDIO, sinkless } from "./sound-scope.mjs";

const SEVEN = [
  "unlock",
  "click",
  "link",
  "link-hold",
  "chrome-cue",
  "control-pop",
  "control-still",
];

describe("sinkless", () => {
  it("names the seven running-audio rules", () => {
    expect([...RUNNING_AUDIO].sort()).toEqual([...SEVEN].sort());
  });

  it.each(["firefox", "webkit"])(
    "drops all seven rules in %s when CI is true",
    (browser) => {
      for (const rule of SEVEN)
        expect(sinkless(rule, browser, { CI: "true" })).toBe(true);
    },
  );

  it("keeps all seven rules in Chromium when CI is true", () => {
    for (const rule of SEVEN)
      expect(sinkless(rule, "chromium", { CI: "true" })).toBe(false);
  });

  it("keeps every rule in every engine outside CI", () => {
    for (const browser of ["chromium", "firefox", "webkit"])
      for (const rule of SEVEN) expect(sinkless(rule, browser, {})).toBe(false);
  });

  it("keeps the rules that hold without audio running, in every engine, in CI", () => {
    for (const browser of ["chromium", "firefox", "webkit"])
      for (const rule of ["mute", "no-autoplay", "control-keys"])
        expect(sinkless(rule, browser, { CI: "true" })).toBe(false);
  });
});
