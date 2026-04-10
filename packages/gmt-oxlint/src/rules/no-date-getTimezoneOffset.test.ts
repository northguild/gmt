import { MSG_GET_TIMEZONE_OFFSET } from "../messages";
import type {
  CallExpressionNode,
  MemberExpressionNode,
  RuleContext,
} from "../types";
import { noDateGetTimezoneOffsetRule } from "./no-date-getTimezoneOffset";

function makeContext(): { report: ReturnType<typeof vi.fn>; ctx: RuleContext } {
  const report = vi.fn();
  const ctx: RuleContext = {
    report,
    sourceCode: { getScope: () => ({ through: [] }) },
  };
  return { report, ctx };
}

function makeGetTimezoneOffsetCall(computed = false): CallExpressionNode {
  const callee: MemberExpressionNode = {
    type: "MemberExpression",
    object: { type: "Identifier", name: "date" },
    property: { type: "Identifier", name: "getTimezoneOffset" },
    computed,
  };
  return { type: "CallExpression", callee };
}

describe("noDateGetTimezoneOffsetRule", () => {
  describe("reports", () => {
    it("reports date.getTimezoneOffset()", () => {
      const { report, ctx } = makeContext();
      const listener = noDateGetTimezoneOffsetRule.create(ctx);
      listener.CallExpression?.(makeGetTimezoneOffsetCall());
      expect(report).toHaveBeenCalledOnce();
      expect(report).toHaveBeenCalledWith({
        node: expect.objectContaining({ type: "CallExpression" }),
        message: MSG_GET_TIMEZONE_OFFSET,
      });
    });
  });

  describe("does not report", () => {
    it("ignores computed property call (date['getTimezoneOffset']())", () => {
      const { report, ctx } = makeContext();
      const listener = noDateGetTimezoneOffsetRule.create(ctx);
      listener.CallExpression?.(makeGetTimezoneOffsetCall(true));
      expect(report).not.toHaveBeenCalled();
    });

    it("ignores a call with a different method name", () => {
      const { report, ctx } = makeContext();
      const listener = noDateGetTimezoneOffsetRule.create(ctx);
      const node: CallExpressionNode = {
        type: "CallExpression",
        callee: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "date" },
          property: { type: "Identifier", name: "getTime" },
          computed: false,
        },
      };
      listener.CallExpression?.(node);
      expect(report).not.toHaveBeenCalled();
    });

    it("ignores a plain function call (no member expression)", () => {
      const { report, ctx } = makeContext();
      const listener = noDateGetTimezoneOffsetRule.create(ctx);
      const node: CallExpressionNode = {
        type: "CallExpression",
        callee: { type: "Identifier", name: "getTimezoneOffset" },
      };
      listener.CallExpression?.(node);
      expect(report).not.toHaveBeenCalled();
    });
  });

  it("has correct rule meta", () => {
    expect(noDateGetTimezoneOffsetRule.meta.type).toBe("problem");
    expect(noDateGetTimezoneOffsetRule.meta.docs.description).toBeTruthy();
  });
});
