import type { IdentifierNode, Node } from "../types";

/**
 * Type guard to check if a node is an Identifier with a specific name.
 * @param node The node to check.
 * @param name The name to match.
 * @returns True if the node is an Identifier with the specified name, otherwise false.
 */
export function isIdentifier(
  node: Node | undefined,
  name: string,
): node is IdentifierNode {
  return Boolean(
    node &&
      node.type === "Identifier" &&
      (node as IdentifierNode).name === name,
  );
}
