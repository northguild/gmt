import { MSG_DATE_GLOBAL } from "../messages";
import type { ProgramNode, RuleContext, RuleModule } from "../types";
import { isIdentifier } from "../utils";

const reportThroughDateReferences = (
  context: RuleContext,
  node: ProgramNode,
  message: string,
): void => {
  const sourceScope = context.sourceCode.getScope(node);
  const through = sourceScope?.through;
  if (!through?.length) {
    return;
  }

  const seen = new Set<string>();
  for (const ref of through) {
    const id = ref.identifier;
    if (!isIdentifier(id, "Date")) {
      continue;
    }

    const [start, end] = id.range ?? [-1, -1];
    const key = `${start}:${end}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    context.report({
      node: id,
      message,
    });
  }
};

export const noDateGlobalRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the global Date object.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        reportThroughDateReferences(context, node, MSG_DATE_GLOBAL);
      },
    };
  },
};
