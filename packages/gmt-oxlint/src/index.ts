import { noDateGetTimezoneOffsetRule } from "./rules/no-date-getTimezoneOffset";
import { noDateGlobalRule } from "./rules/no-date-global";
import { noDateNowRule } from "./rules/no-date-now";
import { noDateParseRule } from "./rules/no-date-parse";
import { noDateUtcRule } from "./rules/no-date-utc";
import { noNewDateRule } from "./rules/no-new-date";
import type { OxlintPlugin } from "./types";

export const recommendedRules = {
  "@northguild/gmt-oxlint/no-date-global": "error",
  "@northguild/gmt-oxlint/no-new-date": "error",
  "@northguild/gmt-oxlint/no-date-now": "error",
  "@northguild/gmt-oxlint/no-date-parse": "error",
  "@northguild/gmt-oxlint/no-date-utc": "error",
  "@northguild/gmt-oxlint/no-date-getTimezoneOffset": "error",
} as const;

export const recommendedConfig = {
  jsPlugins: ["@northguild/gmt-oxlint"],
  rules: recommendedRules,
} as const;

const plugin: OxlintPlugin = {
  meta: { name: "@northguild/gmt-oxlint" },
  rules: {
    "no-date-global": noDateGlobalRule,
    "no-new-date": noNewDateRule,
    "no-date-now": noDateNowRule,
    "no-date-parse": noDateParseRule,
    "no-date-utc": noDateUtcRule,
    "no-date-getTimezoneOffset": noDateGetTimezoneOffsetRule,
  },
  configs: { recommended: { rules: recommendedRules } },
};

export default plugin;
