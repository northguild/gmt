import type { CallExpressionNode, MemberExpressionNode } from "../types";
import { getMemberExpressionFromCall } from "./getMemberExpressionFromCall";

const memberCallee: MemberExpressionNode = {
  type: "MemberExpression",
  object: { type: "Identifier", name: "Date" },
  property: { type: "Identifier", name: "now" },
  computed: false,
};

describe("getMemberExpressionFromCall", () => {
  it("returns member callee for direct call expression", () => {
    const callNode: CallExpressionNode = {
      type: "CallExpression",
      callee: memberCallee,
    };

    expect(getMemberExpressionFromCall(callNode)).toBe(memberCallee);
  });

  it("returns inner member expression for chain expression callee", () => {
    const callNode: CallExpressionNode = {
      type: "CallExpression",
      callee: {
        type: "ChainExpression",
        expression: memberCallee,
      },
    };

    expect(getMemberExpressionFromCall(callNode)).toBe(memberCallee);
  });

  it("returns null when callee is not member-based", () => {
    const callNode: CallExpressionNode = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "fn" },
    };

    expect(getMemberExpressionFromCall(callNode)).toBeNull();
  });
});
