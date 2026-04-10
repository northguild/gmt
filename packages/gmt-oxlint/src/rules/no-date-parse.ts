import { MSG_DATE_PARSE } from "../messages";
import type { RuleModule } from "../types";
import { hasDateStaticMemberCall } from "../utils";

export const noDateParseRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Date.parse().",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!hasDateStaticMemberCall(node, "parse")) {
          return;
        }

        context.report({
          node,
          message: MSG_DATE_PARSE,
        });
      },
    };
  },
};
