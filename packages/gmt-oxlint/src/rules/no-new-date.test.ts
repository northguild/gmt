import { MSG_NEW_DATE } from "../messages";
import type { NewExpressionNode, RuleContext } from "../types";
import { noNewDateRule } from "./no-new-date";

function makeContext(): { report: ReturnType<typeof vi.fn>; ctx: RuleContext } {
  const report = vi.fn();
  const ctx: RuleContext = {
    report,
    sourceCode: { getScope: () => ({ through: [] }) },
  };
  return { report, ctx };
}

function makeNewExpression(calleeName: string): NewExpressionNode {
  return {
    type: "NewExpression",
    callee: { type: "Identifier", name: calleeName },
  };
}

describe("noNewDateRule", () => {
  describe("reports", () => {
    it("reports new Date()", () => {
      const { report, ctx } = makeContext();
      const listener = noNewDateRule.create(ctx);
      listener.NewExpression?.(makeNewExpression("Date"));
      expect(report).toHaveBeenCalledOnce();
      expect(report).toHaveBeenCalledWith({
        node: expect.objectContaining({ type: "NewExpression" }),
        message: MSG_NEW_DATE,
      });
    });
  });

  describe("does not report", () => {
    it.each`
      callee
      ${"Temporal"}
      ${"Map"}
      ${"Set"}
      ${"Error"}
    `("ignores new $callee()", ({ callee }) => {
      const { report, ctx } = makeContext();
      const listener = noNewDateRule.create(ctx);
      listener.NewExpression?.(makeNewExpression(callee));
      expect(report).not.toHaveBeenCalled();
    });
  });

  it("has correct rule meta", () => {
    expect(noNewDateRule.meta.type).toBe("problem");
    expect(noNewDateRule.meta.docs.description).toBeTruthy();
  });
});
