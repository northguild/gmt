import { MSG_DATE_NOW } from "../messages";
import type { RuleModule } from "../types";
import { hasDateStaticMemberCall } from "../utils";

export const noDateNowRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Date.now().",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!hasDateStaticMemberCall(node, "now")) {
          return;
        }

        context.report({
          node,
          message: MSG_DATE_NOW,
        });
      },
    };
  },
};
