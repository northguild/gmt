import { ORIGIN_TRIAL_TOKENS } from "./origin-trial";

describe("ORIGIN_TRIAL_TOKENS", () => {
  it("is a list of non-empty strings with no repeats", () => {
    expect(Array.isArray(ORIGIN_TRIAL_TOKENS)).toBe(true);
    for (const token of ORIGIN_TRIAL_TOKENS) {
      expect(token.trim()).not.toBe("");
    }
    expect(new Set(ORIGIN_TRIAL_TOKENS).size).toBe(ORIGIN_TRIAL_TOKENS.length);
  });
});
