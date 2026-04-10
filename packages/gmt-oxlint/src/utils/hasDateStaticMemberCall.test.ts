import type { CallExpressionNode } from "../types";
import { hasDateStaticMemberCall } from "./hasDateStaticMemberCall";

describe("hasDateStaticMemberCall", () => {
  it("returns true for Date.now()", () => {
    const node: CallExpressionNode = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "Date" },
        property: { type: "Identifier", name: "now" },
        computed: false,
      },
    };

    expect(hasDateStaticMemberCall(node, "now")).toBe(true);
  });

  it("returns true for optional chaining Date.parse?.() shape", () => {
    const node: CallExpressionNode = {
      type: "CallExpression",
      callee: {
        type: "ChainExpression",
        expression: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "Date" },
          property: { type: "Identifier", name: "parse" },
          computed: false,
        },
      },
    };

    expect(hasDateStaticMemberCall(node, "parse")).toBe(true);
  });

  it("returns false when object is not Date", () => {
    const node: CallExpressionNode = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "Temporal" },
        property: { type: "Identifier", name: "now" },
        computed: false,
      },
    };

    expect(hasDateStaticMemberCall(node, "now")).toBe(false);
  });

  it("returns false when property name does not match", () => {
    const node: CallExpressionNode = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "Date" },
        property: { type: "Identifier", name: "UTC" },
        computed: false,
      },
    };

    expect(hasDateStaticMemberCall(node, "now")).toBe(false);
  });

  it("returns false for computed member expression", () => {
    const node: CallExpressionNode = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "Date" },
        property: { type: "Identifier", name: "now" },
        computed: true,
      },
    };

    expect(hasDateStaticMemberCall(node, "now")).toBe(false);
  });
});
