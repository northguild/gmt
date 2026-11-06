import config from "../oxlint.config.mts";

// The config spreads the plugin's recommended rules, which come from its build. The Tests job does
// not build `@northguild/gmt-oxlint`, and this test reads only the import ban, so the rules are empty.
vi.mock("@northguild/gmt-oxlint", () => ({ recommendedRules: {} }));

type Override = { files: string[]; rules?: Record<string, unknown> };

const RULE = "no-restricted-imports";
const overrides = (config.overrides ?? []) as Override[];
const setters = overrides.filter((o) => o.rules && RULE in o.rules);

// In oxlint, as in ESLint flat config, a later override that sets a rule replaces its options for
// the files it matches. The polyfill ban holds for every Dox file only while it is the one place
// that sets the rule.
describe("the polyfill import ban", () => {
  it("is the only setting of no-restricted-imports", () => {
    expect(config.rules ?? {}).not.toHaveProperty(RULE);
    expect(setters).toHaveLength(1);
    expect(setters[0]!.files).toEqual(["src/**", "scripts/**", "tests/**"]);
  });

  it("bans both polyfills and their subpaths", () => {
    const [, options] = setters[0]!.rules![RULE] as [
      string,
      { paths: { name: string }[]; patterns: { group: string[] }[] },
    ];
    expect(options.paths.map((p) => p.name)).toEqual(["@js-temporal/polyfill"]);
    expect(options.patterns.flatMap((p) => p.group)).toEqual([
      "@js-temporal/polyfill/**",
      "temporal-polyfill",
      "temporal-polyfill/**",
    ]);
  });
});
