import { MSG_DATE_LIBRARY_IMPORT } from "../messages";
import type { LiteralNode, Node, RuleContext } from "../types";
import { noDateLibraryImportsRule } from "./no-date-library-imports";

function makeContext(): { report: ReturnType<typeof vi.fn>; ctx: RuleContext } {
  const report = vi.fn();
  const ctx: RuleContext = {
    report,
    sourceCode: { getScope: () => ({ through: [] }) },
  };
  return { report, ctx };
}

function literal(value: string): LiteralNode {
  return { type: "Literal", value };
}

describe("noDateLibraryImportsRule", () => {
  describe("reports", () => {
    it.each`
      specifier
      ${"moment"}
      ${"moment-timezone"}
      ${"dayjs"}
      ${"luxon"}
      ${"date-fns"}
      ${"date-fns-tz"}
      ${"spacetime"}
      ${"date-fns/format"}
    `("reports import from $specifier", ({ specifier }) => {
      const { report, ctx } = makeContext();
      const source = literal(specifier);
      noDateLibraryImportsRule
        .create(ctx)
        .ImportDeclaration?.({ type: "ImportDeclaration", source });
      expect(report).toHaveBeenCalledOnce();
      expect(report).toHaveBeenCalledWith({
        node: source,
        message: MSG_DATE_LIBRARY_IMPORT,
      });
    });

    it.each`
      form                   | visit
      ${"export { x } from"} | ${"ExportNamedDeclaration"}
      ${"export * from"}     | ${"ExportAllDeclaration"}
    `("reports a re-export via $form luxon", ({ visit }) => {
      const { report, ctx } = makeContext();
      const listener = noDateLibraryImportsRule.create(ctx);
      listener[visit as "ExportNamedDeclaration" | "ExportAllDeclaration"]?.({
        type: visit,
        source: literal("luxon"),
      });
      expect(report).toHaveBeenCalledOnce();
    });

    it('reports dynamic import("dayjs")', () => {
      const { report, ctx } = makeContext();
      noDateLibraryImportsRule.create(ctx).ImportExpression?.({
        type: "ImportExpression",
        source: literal("dayjs"),
      });
      expect(report).toHaveBeenCalledOnce();
    });

    it('reports require("moment")', () => {
      const { report, ctx } = makeContext();
      noDateLibraryImportsRule.create(ctx).CallExpression?.({
        type: "CallExpression",
        callee: { type: "Identifier", name: "require" },
        arguments: [literal("moment")],
      });
      expect(report).toHaveBeenCalledOnce();
    });
  });

  describe("does not report", () => {
    it.each`
      specifier               | description
      ${"@js-joda/core"}      | ${"js-joda is deliberately allowed"}
      ${"@northguild/gmt"}    | ${"gmt itself"}
      ${"./my-moment-helper"} | ${"a relative path containing a banned name"}
      ${"momentjs"}           | ${"a different package that only shares a prefix"}
    `(
      "does not report import from $specifier ($description)",
      ({ specifier }) => {
        const { report, ctx } = makeContext();
        noDateLibraryImportsRule.create(ctx).ImportDeclaration?.({
          type: "ImportDeclaration",
          source: literal(specifier),
        });
        expect(report).not.toHaveBeenCalled();
      },
    );

    it("does not report a local re-export with no source", () => {
      const { report, ctx } = makeContext();
      noDateLibraryImportsRule.create(ctx).ExportNamedDeclaration?.({
        type: "ExportNamedDeclaration",
        source: null,
      });
      expect(report).not.toHaveBeenCalled();
    });

    it("does not report a call to a function other than require", () => {
      const { report, ctx } = makeContext();
      const callee: Node = { type: "Identifier", name: "load" };
      noDateLibraryImportsRule.create(ctx).CallExpression?.({
        type: "CallExpression",
        callee,
        arguments: [literal("moment")],
      });
      expect(report).not.toHaveBeenCalled();
    });

    it("does not report require() with no arguments", () => {
      const { report, ctx } = makeContext();
      noDateLibraryImportsRule.create(ctx).CallExpression?.({
        type: "CallExpression",
        callee: { type: "Identifier", name: "require" },
      });
      expect(report).not.toHaveBeenCalled();
    });
  });
});
