import { MSG_DATE_UTC } from "../messages";
import type { RuleModule } from "../types";
import { hasDateStaticMemberCall } from "../utils";

export const noDateUtcRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Date.UTC().",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!hasDateStaticMemberCall(node, "UTC")) {
          return;
        }

        context.report({
          node,
          message: MSG_DATE_UTC,
        });
      },
    };
  },
};
