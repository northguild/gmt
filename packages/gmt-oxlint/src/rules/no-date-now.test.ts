import { MSG_DATE_NOW } from "../messages";
import type {
  CallExpressionNode,
  MemberExpressionNode,
  RuleContext,
} from "../types";
import { noDateNowRule } from "./no-date-now";

function makeContext(): { report: ReturnType<typeof vi.fn>; ctx: RuleContext } {
  const report = vi.fn();
  const ctx: RuleContext = {
    report,
    sourceCode: { getScope: () => ({ through: [] }) },
  };
  return { report, ctx };
}

function makeDateStaticCall(
  member: string,
  computed = false,
): CallExpressionNode {
  const callee: MemberExpressionNode = {
    type: "MemberExpression",
    object: { type: "Identifier", name: "Date" },
    property: { type: "Identifier", name: member },
    computed,
  };
  return { type: "CallExpression", callee };
}

describe("noDateNowRule", () => {
  describe("reports", () => {
    it("reports Date.now()", () => {
      const { report, ctx } = makeContext();
      const listener = noDateNowRule.create(ctx);
      listener.CallExpression?.(makeDateStaticCall("now"));
      expect(report).toHaveBeenCalledOnce();
      expect(report).toHaveBeenCalledWith({
        node: expect.objectContaining({ type: "CallExpression" }),
        message: MSG_DATE_NOW,
      });
    });
  });

  describe("does not report", () => {
    it.each`
      description       | member
      ${"Date.UTC()"}   | ${"UTC"}
      ${"Date.parse()"} | ${"parse"}
      ${"other.now()"}  | ${"now"}
    `("ignores $description", ({ member, description: _ }) => {
      const { report, ctx } = makeContext();
      const listener = noDateNowRule.create(ctx);
      if (member === "now" && _ === "other.now()") {
        const node: CallExpressionNode = {
          type: "CallExpression",
          callee: {
            type: "MemberExpression",
            object: { type: "Identifier", name: "performance" },
            property: { type: "Identifier", name: "now" },
            computed: false,
          },
        };
        listener.CallExpression?.(node);
      } else {
        listener.CallExpression?.(makeDateStaticCall(member));
      }
      expect(report).not.toHaveBeenCalled();
    });

    it("ignores Date['now']()", () => {
      const { report, ctx } = makeContext();
      const listener = noDateNowRule.create(ctx);
      listener.CallExpression?.(makeDateStaticCall("now", true));
      expect(report).not.toHaveBeenCalled();
    });

    it("ignores a plain function call", () => {
      const { report, ctx } = makeContext();
      const listener = noDateNowRule.create(ctx);
      listener.CallExpression?.({
        type: "CallExpression",
        callee: { type: "Identifier", name: "now" },
      });
      expect(report).not.toHaveBeenCalled();
    });
  });

  it("has correct rule meta", () => {
    expect(noDateNowRule.meta.type).toBe("problem");
    expect(noDateNowRule.meta.docs.description).toBeTruthy();
  });
});
