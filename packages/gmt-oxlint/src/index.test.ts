import plugin, { recommendedConfig, recommendedRules } from "./index";

describe("plugin", () => {
  it("has correct meta name", () => {
    expect(plugin.meta.name).toBe("@burglekitt/gmt-oxlint");
  });

  it("exports all expected rules", () => {
    expect(plugin.rules).toHaveProperty("no-date-global");
    expect(plugin.rules).toHaveProperty("no-new-date");
    expect(plugin.rules).toHaveProperty("no-date-now");
    expect(plugin.rules).toHaveProperty("no-date-parse");
    expect(plugin.rules).toHaveProperty("no-date-utc");
    expect(plugin.rules).toHaveProperty("no-date-getTimezoneOffset");
  });

  it("has recommended config with all rules", () => {
    expect(plugin.configs).toHaveProperty("recommended");
    const cfg = plugin.configs?.recommended;
    expect(cfg).toBeDefined();
    const rules = cfg?.rules;
    expect(rules).toBeDefined();
    expect(rules).toHaveProperty("@burglekitt/gmt-oxlint/no-date-global");
    expect(rules).toHaveProperty("@burglekitt/gmt-oxlint/no-new-date");
    expect(rules).toHaveProperty("@burglekitt/gmt-oxlint/no-date-now");
    expect(rules).toHaveProperty("@burglekitt/gmt-oxlint/no-date-parse");
    expect(rules).toHaveProperty("@burglekitt/gmt-oxlint/no-date-utc");
    expect(rules).toHaveProperty(
      "@burglekitt/gmt-oxlint/no-date-getTimezoneOffset",
    );
  });

  it("recommended config rules are set to error severity", () => {
    const rules = plugin.configs?.recommended?.rules;
    expect(rules).toBeDefined();
    expect(rules?.["@burglekitt/gmt-oxlint/no-date-global"]).toBe("error");
    expect(rules?.["@burglekitt/gmt-oxlint/no-new-date"]).toBe("error");
    expect(rules?.["@burglekitt/gmt-oxlint/no-date-now"]).toBe("error");
    expect(rules?.["@burglekitt/gmt-oxlint/no-date-parse"]).toBe("error");
    expect(rules?.["@burglekitt/gmt-oxlint/no-date-utc"]).toBe("error");
    expect(rules?.["@burglekitt/gmt-oxlint/no-date-getTimezoneOffset"]).toBe(
      "error",
    );
  });

  it("exports recommendedRules aligned with plugin recommended config", () => {
    expect(recommendedRules).toEqual(plugin.configs?.recommended?.rules);
  });

  it("exports recommendedConfig with jsPlugins and recommended rules", () => {
    expect(recommendedConfig.jsPlugins).toEqual(["@burglekitt/gmt-oxlint"]);
    expect(recommendedConfig.rules).toEqual(recommendedRules);
  });
});
