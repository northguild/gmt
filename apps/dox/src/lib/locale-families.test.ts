/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { gmtStats } from "../data/gmt-stats";
import {
  familyCounts,
  formatFamilyCounts,
  LOCALE_FAMILIES,
  localeMatrixRows,
} from "./locale-families";

describe("locale-families", () => {
  it("has a family entry for every published locale", () => {
    for (const locale of gmtStats.localeList) {
      expect(
        LOCALE_FAMILIES[locale],
        `missing family for ${locale}`,
      ).toBeDefined();
    }
  });

  it("lists no locale that isn't published", () => {
    const published = new Set(gmtStats.localeList);
    for (const locale of Object.keys(LOCALE_FAMILIES)) {
      expect(
        published.has(locale),
        `${locale} is not in gmtStats.localeList`,
      ).toBe(true);
    }
  });

  it("builds one matrix row per published locale, indexed within its family", () => {
    const rows = localeMatrixRows(gmtStats.localeList);
    expect(rows).toHaveLength(gmtStats.localeList.length);

    const seen = new Map<string, number>();
    for (const row of rows) {
      const expectedRow = seen.get(row.family) ?? 0;
      expect(row.row).toBe(expectedRow);
      seen.set(row.family, expectedRow + 1);
    }
  });

  it("totals family counts to the published locale count", () => {
    const counts = familyCounts(gmtStats.localeList);
    const total = counts.reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(gmtStats.locales);
  });

  it("formats family counts as natural English", () => {
    const counts = [
      { family: "Latin", count: 9 },
      { family: "CJK", count: 4 },
    ];
    expect(formatFamilyCounts(counts)).toBe("Latin (9), CJK (4)");
  });
});
