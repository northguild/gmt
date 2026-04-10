import type { CallExpressionNode, MemberExpressionNode } from "../types";
import { isChainExpression } from "./isChainExpression";
import { isMemberExpression } from "./isMemberExpression";

/**
 * Extracts the MemberExpression from a CallExpression if it exists, handling both direct and optional chaining cases.
 * @param node The CallExpression node to analyze.
 * @returns The MemberExpression node if found, otherwise null.
 */
export function getMemberExpressionFromCall(
  node: CallExpressionNode,
): MemberExpressionNode | null {
  const { callee } = node;

  if (isMemberExpression(callee)) {
    return callee;
  }

  if (isChainExpression(callee) && isMemberExpression(callee.expression)) {
    return callee.expression;
  }

  return null;
}
