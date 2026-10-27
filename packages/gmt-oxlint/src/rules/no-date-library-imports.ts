import { dateLibraryImportMessage } from "../messages";
import type {
  CallExpressionNode,
  ExportFromNode,
  ImportDeclarationNode,
  ImportExpressionNode,
  Node,
  RuleContext,
  RuleModule,
} from "../types";
import { bannedDateLibraryOf, isIdentifier } from "../utils";

/**
 * Every form carries its specifier in a node with a `value`, so each visitor
 * narrows to that node and defers to the same predicate.
 */
const reportIfBanned = (
  context: RuleContext,
  source: Node | null | undefined,
): void => {
  const lib = bannedDateLibraryOf(source?.value);
  if (!source || lib === undefined) {
    return;
  }

  context.report({ node: source, message: dateLibraryImportMessage(lib) });
};

export const noDateLibraryImportsRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing date libraries that wrap native Date objects.",
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node: ImportDeclarationNode) {
        reportIfBanned(context, node.source);
      },

      // `export { format } from "date-fns"` re-exports the banned API just as
      // effectively as importing it. `source` is null for a local re-export.
      ExportNamedDeclaration(node: ExportFromNode) {
        reportIfBanned(context, node.source);
      },

      ExportAllDeclaration(node: ExportFromNode) {
        reportIfBanned(context, node.source);
      },

      ImportExpression(node: ImportExpressionNode) {
        reportIfBanned(context, node.source);
      },

      CallExpression(node: CallExpressionNode) {
        if (!isIdentifier(node.callee, "require")) {
          return;
        }

        reportIfBanned(context, node.arguments?.[0]);
      },
    };
  },
};
