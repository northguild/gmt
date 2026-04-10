import { MSG_DATE_GLOBAL } from "../messages";
import type { IdentifierNode, ProgramNode, RuleContext } from "../types";
import { noDateGlobalRule } from "./no-date-global";

function makeContext(): { report: ReturnType<typeof vi.fn>; ctx: RuleContext } {
  const report = vi.fn();
  const ctx: RuleContext = {
    report,
    sourceCode: { getScope: () => ({ through: [] }) },
  };
  return { report, ctx };
}

function makeProgram(): ProgramNode {
  return { type: "Program" };
}

function makeContextWithThrough(
  refs: Array<{ name: string; range?: [number, number] }>,
): { report: ReturnType<typeof vi.fn>; ctx: RuleContext } {
  const report = vi.fn();
  const ctx: RuleContext = {
    report,
    sourceCode: {
      getScope: () => ({
        through: refs.map(({ name, range }) => ({
          identifier: { type: "Identifier", name, range } as IdentifierNode,
        })),
      }),
    },
  };
  return { report, ctx };
}

describe("noDateGlobalRule", () => {
  describe("reports", () => {
    it("reports a single unresolved Date reference", () => {
      const { report, ctx } = makeContextWithThrough([
        { name: "Date", range: [0, 4] },
      ]);
      const listener = noDateGlobalRule.create(ctx);
      listener.Program?.(makeProgram());
      expect(report).toHaveBeenCalledOnce();
      expect(report).toHaveBeenCalledWith({
        node: expect.objectContaining({ type: "Identifier", name: "Date" }),
        message: MSG_DATE_GLOBAL,
      });
    });

    it("reports multiple distinct Date references", () => {
      const { report, ctx } = makeContextWithThrough([
        { name: "Date", range: [0, 4] },
        { name: "Date", range: [10, 14] },
      ]);
      const listener = noDateGlobalRule.create(ctx);
      listener.Program?.(makeProgram());
      expect(report).toHaveBeenCalledTimes(2);
    });

    it("deduplicates Date references with the same range", () => {
      const { report, ctx } = makeContextWithThrough([
        { name: "Date", range: [0, 4] },
        { name: "Date", range: [0, 4] },
      ]);
      const listener = noDateGlobalRule.create(ctx);
      listener.Program?.(makeProgram());
      expect(report).toHaveBeenCalledOnce();
    });
  });

  describe("does not report", () => {
    it("ignores when through is empty", () => {
      const { report, ctx } = makeContext();
      const listener = noDateGlobalRule.create(ctx);
      listener.Program?.(makeProgram());
      expect(report).not.toHaveBeenCalled();
    });

    it("ignores non-Date unresolved references", () => {
      const { report, ctx } = makeContextWithThrough([
        { name: "Temporal", range: [0, 8] },
        { name: "console", range: [10, 17] },
      ]);
      const listener = noDateGlobalRule.create(ctx);
      listener.Program?.(makeProgram());
      expect(report).not.toHaveBeenCalled();
    });
  });

  it("has correct rule meta", () => {
    expect(noDateGlobalRule.meta.type).toBe("problem");
    expect(noDateGlobalRule.meta.docs.description).toBeTruthy();
  });
});
