import { unguardedInGmt } from "~/data/upstream-filings";
import { unguardedClause } from "./upstream-summary";

describe("unguardedClause", () => {
  it("names the filings GMT has no workaround for, and is empty when there are none", () => {
    if (unguardedInGmt === 0) expect(unguardedClause).toBe("");
    else {
      expect(unguardedClause).toMatch(
        /^ For (one|\d+) more, GMT has no workaround\.$/,
      );
      expect(unguardedClause).toContain(
        unguardedInGmt === 1 ? "one" : String(unguardedInGmt),
      );
    }
  });
});
