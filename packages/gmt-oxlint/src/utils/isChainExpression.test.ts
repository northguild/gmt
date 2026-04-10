import type { Node } from "../types";
import { isChainExpression } from "./isChainExpression";

describe("isChainExpression", () => {
  it("returns true for ChainExpression node", () => {
    const node: Node = {
      type: "ChainExpression",
      expression: { type: "Identifier", name: "x" },
    };

    expect(isChainExpression(node)).toBe(true);
  });

  it("returns false for non-ChainExpression node", () => {
    const node: Node = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "fn" },
    };

    expect(isChainExpression(node)).toBe(false);
  });

  it("returns false for undefined node", () => {
    expect(isChainExpression(undefined)).toBe(false);
  });
});
