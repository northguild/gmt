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
    // Each message names the package and links the guide that maps its calls.
    it.each([
      {
        specifier: "moment",
        message:
          "Avoid moment: it wraps native Date. Use @northguild/gmt instead; https://northguild.dev/gmt/migrate/moment/ maps Moment.js calls to their gmt replacements.",
      },
      {
        specifier: "moment-timezone",
        message:
          "Avoid moment-timezone: it wraps native Date. Use @northguild/gmt instead; https://northguild.dev/gmt/migrate/moment/ maps Moment.js calls to their gmt replacements.",
      },
      {
        specifier: "dayjs",
        message:
          "Avoid dayjs: it wraps native Date. Use @northguild/gmt instead; https://northguild.dev/gmt/migrate/dayjs/ maps Day.js calls to their gmt replacements.",
      },
      {
        specifier: "luxon",
        message:
          "Avoid luxon: it wraps native Date. Use @northguild/gmt instead; https://northguild.dev/gmt/migrate/luxon/ maps Luxon calls to their gmt replacements.",
      },
      {
        specifier: "date-fns",
        message:
          "Avoid date-fns: it wraps native Date. Use @northguild/gmt instead; https://northguild.dev/gmt/migrate/date-fns/ maps date-fns calls to their gmt replacements.",
      },
      {
        specifier: "date-fns-tz",
        message:
          "Avoid date-fns-tz: it wraps native Date. Use @northguild/gmt instead; https://northguild.dev/gmt/migrate/date-fns/ maps date-fns calls to their gmt replacements.",
      },
      {
        specifier: "@date-fns/tz",
        message:
          "Avoid @date-fns/tz: it wraps native Date. Use @northguild/gmt instead; https://northguild.dev/gmt/migrate/date-fns/ maps date-fns calls to their gmt replacements.",
      },
      {
        specifier: "spacetime",
        message:
          "Avoid spacetime: it wraps native Date. Use @northguild/gmt instead; https://northguild.dev/gmt/migrate/ lists the migration guides.",
      },
      {
        specifier: "date-fns/format",
        message:
          "Avoid date-fns: it wraps native Date. Use @northguild/gmt instead; https://northguild.dev/gmt/migrate/date-fns/ maps date-fns calls to their gmt replacements.",
      },
    ])("reports import from $specifier", ({ specifier, message }) => {
      const { report, ctx } = makeContext();
      const source = literal(specifier);
      noDateLibraryImportsRule
        .create(ctx)
        .ImportDeclaration?.({ type: "ImportDeclaration", source });
      expect(report).toHaveBeenCalledOnce();
      expect(report).toHaveBeenCalledWith({ node: source, message });
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
