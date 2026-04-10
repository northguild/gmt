import type { CallExpressionNode } from "../types";
import { getMemberExpressionFromCall } from "./getMemberExpressionFromCall";
import { isIdentifier } from "./isIdentifier";

/**
 * Checks if a CallExpression is a call to a static member of the Date object with a specific member name.
 * @param node The CallExpression node to check.
 * @param memberName The name of the static member to match.
 * @returns True if the CallExpression is a call to Date.memberName, otherwise false.
 */
export function hasDateStaticMemberCall(
  node: CallExpressionNode,
  memberName: string,
): boolean {
  const callee = getMemberExpressionFromCall(node);
  if (!callee || callee.computed) {
    return false;
  }

  return (
    isIdentifier(callee.object, "Date") &&
    isIdentifier(callee.property, memberName)
  );
}
