import type { MemberExpressionNode, Node } from "../types";

/**
 * Type guard to check if a node is a MemberExpression.
 * @param node The node to check.
 * @returns True if the node is a MemberExpression, otherwise false.
 */
export function isMemberExpression(
  node: Node | undefined,
): node is MemberExpressionNode {
  return Boolean(node && node.type === "MemberExpression");
}
