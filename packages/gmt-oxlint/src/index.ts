import { noDateGetTimezoneOffsetRule } from "./rules/no-date-getTimezoneOffset";
import { noDateGlobalRule } from "./rules/no-date-global";
import { noDateNowRule } from "./rules/no-date-now";
import { noDateParseRule } from "./rules/no-date-parse";
import { noDateUtcRule } from "./rules/no-date-utc";
import { noNewDateRule } from "./rules/no-new-date";
import type { OxlintPlugin } from "./types";

const plugin: OxlintPlugin = {
  meta: {
    name: "@burglekitt/gmt-oxlint",
  },
  rules: {
    "no-date-global": noDateGlobalRule,
    "no-new-date": noNewDateRule,
    "no-date-now": noDateNowRule,
    "no-date-parse": noDateParseRule,
    "no-date-utc": noDateUtcRule,
    "no-date-getTimezoneOffset": noDateGetTimezoneOffsetRule,
  },
  configs: {
    recommended: {
      rules: {
        "@burglekitt/gmt-oxlint/no-date-global": "error",
        "@burglekitt/gmt-oxlint/no-new-date": "error",
        "@burglekitt/gmt-oxlint/no-date-now": "error",
        "@burglekitt/gmt-oxlint/no-date-parse": "error",
        "@burglekitt/gmt-oxlint/no-date-utc": "error",
        "@burglekitt/gmt-oxlint/no-date-getTimezoneOffset": "error",
      },
    },
  },
};

export default plugin;
