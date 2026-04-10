import { MSG_GET_TIMEZONE_OFFSET } from "../messages";
import type { RuleModule } from "../types";
import { getMemberExpressionFromCall, isIdentifier } from "../utils";

export const noDateGetTimezoneOffsetRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow getTimezoneOffset().",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = getMemberExpressionFromCall(node);
        if (!callee || callee.computed) {
          return;
        }

        if (!isIdentifier(callee.property, "getTimezoneOffset")) {
          return;
        }

        context.report({
          node,
          message: MSG_GET_TIMEZONE_OFFSET,
        });
      },
    };
  },
};
