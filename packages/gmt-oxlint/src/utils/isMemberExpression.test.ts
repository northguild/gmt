import type { Node } from "../types";
import { isMemberExpression } from "./isMemberExpression";

describe("isMemberExpression", () => {
  it("returns true for MemberExpression node", () => {
    const node: Node = {
      type: "MemberExpression",
      object: { type: "Identifier", name: "Date" },
      property: { type: "Identifier", name: "now" },
      computed: false,
    };

    expect(isMemberExpression(node)).toBe(true);
  });

  it("returns false for non-MemberExpression node", () => {
    const node: Node = { type: "Identifier", name: "Date" };

    expect(isMemberExpression(node)).toBe(false);
  });

  it("returns false for undefined node", () => {
    expect(isMemberExpression(undefined)).toBe(false);
  });
});
