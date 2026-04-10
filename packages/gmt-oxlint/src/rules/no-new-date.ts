import { MSG_NEW_DATE } from "../messages";
import type { RuleModule } from "../types";
import { isIdentifier } from "../utils";

export const noNewDateRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow new Date(...).",
    },
    schema: [],
  },
  create(context) {
    return {
      NewExpression(node) {
        if (!isIdentifier(node.callee, "Date")) {
          return;
        }

        context.report({
          node,
          message: MSG_NEW_DATE,
        });
      },
    };
  },
};
