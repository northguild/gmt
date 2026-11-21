import { LINT_RULES } from "./lint-rules";

describe("LINT_RULES", () => {
  it("names each recommended rule without the plugin prefix, with its description", () => {
    expect(LINT_RULES).toContainEqual({
      rule: "no-date-library-imports",
      description:
        "Disallow importing date libraries that wrap native Date objects.",
    });
    expect(LINT_RULES.every(({ rule }) => rule.startsWith("no-"))).toBe(true);
  });
});
