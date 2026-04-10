import { MSG_DATE_UTC } from "../messages";
import type {
  CallExpressionNode,
  MemberExpressionNode,
  RuleContext,
} from "../types";
import { noDateUtcRule } from "./no-date-utc";

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

describe("noDateUtcRule", () => {
  describe("reports", () => {
    it("reports Date.UTC()", () => {
      const { report, ctx } = makeContext();
      const listener = noDateUtcRule.create(ctx);
      listener.CallExpression?.(makeDateStaticCall("Date", "UTC"));
      expect(report).toHaveBeenCalledOnce();
      expect(report).toHaveBeenCalledWith({
        node: expect.objectContaining({ type: "CallExpression" }),
        message: MSG_DATE_UTC,
      });
    });
  });

  describe("does not report", () => {
    it.each`
      description       | object     | member
      ${"Date.now()"}   | ${"Date"}  | ${"now"}
      ${"Date.parse()"} | ${"Date"}  | ${"parse"}
      ${"other.UTC()"}  | ${"other"} | ${"UTC"}
    `("ignores $description", ({ object, member }) => {
      const { report, ctx } = makeContext();
      const listener = noDateUtcRule.create(ctx);
      listener.CallExpression?.(makeDateStaticCall(object, member));
      expect(report).not.toHaveBeenCalled();
    });

    it("ignores Date['UTC']()", () => {
      const { report, ctx } = makeContext();
      const listener = noDateUtcRule.create(ctx);
      listener.CallExpression?.(makeDateStaticCall("Date", "UTC", true));
      expect(report).not.toHaveBeenCalled();
    });

    it("ignores a plain function call", () => {
      const { report, ctx } = makeContext();
      const listener = noDateUtcRule.create(ctx);
      listener.CallExpression?.({
        type: "CallExpression",
        callee: { type: "Identifier", name: "UTC" },
      });
      expect(report).not.toHaveBeenCalled();
    });
  });

  it("has correct rule meta", () => {
    expect(noDateUtcRule.meta.type).toBe("problem");
    expect(noDateUtcRule.meta.docs.description).toBeTruthy();
  });
});
