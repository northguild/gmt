import { MSG_DATE_PARSE } from "../messages";
import type {
  CallExpressionNode,
  MemberExpressionNode,
  RuleContext,
} from "../types";
import { noDateParseRule } from "./no-date-parse";

function makeContext(): { report: ReturnType<typeof vi.fn>; ctx: RuleContext } {
  const report = vi.fn();
  const ctx: RuleContext = {
    report,
    sourceCode: { getScope: () => ({ through: [] }) },
  };
  return { report, ctx };
}

function makeDateStaticCall(
  object: string,
  member: string,
  computed = false,
): CallExpressionNode {
  const callee: MemberExpressionNode = {
    type: "MemberExpression",
    object: { type: "Identifier", name: object },
    property: { type: "Identifier", name: member },
    computed,
  };
  return { type: "CallExpression", callee };
}

describe("noDateParseRule", () => {
  describe("reports", () => {
    it("reports Date.parse()", () => {
      const { report, ctx } = makeContext();
      const listener = noDateParseRule.create(ctx);
      listener.CallExpression?.(makeDateStaticCall("Date", "parse"));
      expect(report).toHaveBeenCalledOnce();
      expect(report).toHaveBeenCalledWith({
        node: expect.objectContaining({ type: "CallExpression" }),
        message: MSG_DATE_PARSE,
      });
    });
  });

  describe("does not report", () => {
    it.each`
      description        | object     | member
      ${"Date.now()"}    | ${"Date"}  | ${"now"}
      ${"Date.UTC()"}    | ${"Date"}  | ${"UTC"}
      ${"JSON.parse()"}  | ${"JSON"}  | ${"parse"}
      ${"other.parse()"} | ${"other"} | ${"parse"}
    `("ignores $description", ({ object, member }) => {
      const { report, ctx } = makeContext();
      const listener = noDateParseRule.create(ctx);
      listener.CallExpression?.(makeDateStaticCall(object, member));
      expect(report).not.toHaveBeenCalled();
    });

    it("ignores Date['parse']()", () => {
      const { report, ctx } = makeContext();
      const listener = noDateParseRule.create(ctx);
      listener.CallExpression?.(makeDateStaticCall("Date", "parse", true));
      expect(report).not.toHaveBeenCalled();
    });

    it("ignores a plain function call", () => {
      const { report, ctx } = makeContext();
      const listener = noDateParseRule.create(ctx);
      listener.CallExpression?.({
        type: "CallExpression",
        callee: { type: "Identifier", name: "parse" },
      });
      expect(report).not.toHaveBeenCalled();
    });
  });

  it("has correct rule meta", () => {
    expect(noDateParseRule.meta.type).toBe("problem");
    expect(noDateParseRule.meta.docs.description).toBeTruthy();
  });
});
