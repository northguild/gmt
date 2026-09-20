import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { pageExpressionValues } from "./page-expression-values";
import { stripMdx } from "./page-markdown";

/**
 * The values table and the pages it serves, kept from drifting apart.
 *
 * `index.mdx` and `why-gmt.mdx` write their figures as expressions, and the text surfaces need
 * those expressions evaluated. If a page grows an expression the table doesn't know, the figure
 * would ship as source text again — silently, since the page's own HTML would still be right.
 * This test reads the pages and fails on any expression that `stripMdx` cannot resolve.
 */

const PAGES = ["index.mdx", "why-gmt.mdx"] as const;

const sourceOf = (page: string): string =>
  readFileSync(
    resolve(import.meta.dirname, "..", "content", "docs", page),
    "utf8",
  );

describe("page expression values", () => {
  for (const page of PAGES) {
    it(`resolves every expression ${page} interpolates`, () => {
      const stripped = stripMdx(sourceOf(page), {
        gmtVersion: "1.0.0",
        values: pageExpressionValues(),
      });

      // Anything left is either prose in braces or an expression nobody evaluated.
      const left = (stripped.match(/\{[A-Za-z_][^}\n]{0,80}\}/g) ?? []).filter(
        (found) =>
          !/^\{(yyyy|MM|dd|HH|mm|ss|[A-Z][A-Za-z]*Unit)\}$/.test(found),
      );

      expect({ page, left }).toEqual({ page, left: [] });
    });
  }

  it("states no figure of its own: every value comes from the data modules", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "page-expression-values.ts"),
      "utf8",
    );
    const body = source.slice(source.indexOf("export function"));

    // A bare number in the table would be a hand-typed figure, which `pnpm stats:sync` could
    // never keep true. Array indices and the `/ 60` that turns offset minutes into hours are
    // arithmetic on values that do come from the modules.
    const literals = (
      body.match(/:\s*"(?![^"]*\$\{)[^"]*\d[^"]*"/g) ?? []
    ).filter((found) => !found.includes("u-ca"));

    expect(literals).toEqual([]);
  });
});
