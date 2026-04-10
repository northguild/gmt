import type { ChainExpressionNode, Node } from "../types";

/**
 * Type guard to check if a node is a ChainExpression.
 * @param node The node to check.
 * @returns True if the node is a ChainExpression, otherwise false.
 */
export function isChainExpression(
  node: Node | undefined,
): node is ChainExpressionNode {
  return Boolean(node && node.type === "ChainExpression");
}
