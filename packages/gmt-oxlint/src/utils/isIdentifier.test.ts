import type { Node } from "../types";
import { isIdentifier } from "./isIdentifier";

describe("isIdentifier", () => {
  it("returns true for matching identifier name", () => {
    const node: Node = { type: "Identifier", name: "Date" };

    expect(isIdentifier(node, "Date")).toBe(true);
  });

  it("returns false for non-matching identifier name", () => {
    const node: Node = { type: "Identifier", name: "Temporal" };

    expect(isIdentifier(node, "Date")).toBe(false);
  });

  it("returns false for non-Identifier node", () => {
    const node: Node = { type: "Literal", value: "Date" };

    expect(isIdentifier(node, "Date")).toBe(false);
  });

  it("returns false for undefined node", () => {
    expect(isIdentifier(undefined, "Date")).toBe(false);
  });
});
