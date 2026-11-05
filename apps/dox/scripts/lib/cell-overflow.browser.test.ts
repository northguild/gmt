import { chromium, type Browser, type Page } from "@playwright/test";
import { measureCells } from "./cell-overflow.mjs";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 400, height: 600 } });
});
afterAll(async () => {
  await browser.close();
});

const cellsOf = async (table: string) => {
  await page.setContent(`<main>${table}</main>`);
  return page.evaluate(measureCells);
};

describe("measureCells", () => {
  it("passes a table whose cells hold their content", async () => {
    expect(
      await cellsOf(
        `<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>one</td><td>two</td></tr></tbody></table>`,
      ),
    ).toEqual([]);
  });

  it("reports text that spills into the next cell of a fixed table", async () => {
    const found = await cellsOf(
      `<table style="table-layout:fixed;width:200px"><colgroup><col width="30"><col></colgroup><tbody><tr><td style="white-space:nowrap">2026-02-28T00:00:00Z</td><td>next</td></tr></tbody></table>`,
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.cell).toBe("2026-02-28T00:00:00Z");
    expect(found[0]!.reasons.join(" ")).toContain("wide in a");
  });

  it("reports text a cell clips", async () => {
    const found = await cellsOf(
      `<table style="table-layout:fixed;width:100px"><tbody><tr><td style="overflow:hidden;white-space:nowrap">a very long unbroken label</td></tr></tbody></table>`,
    );
    expect(found).toHaveLength(1);
  });

  it("skips the cells of a visually hidden header", async () => {
    expect(
      await cellsOf(
        `<table><thead style="position:absolute;width:1px;height:1px;overflow:hidden"><tr><th>Start</th></tr></thead><tbody><tr><td>x</td></tr></tbody></table>`,
      ),
    ).toEqual([]);
  });

  it("skips a header cell hidden on its own, as a stacked table keeps it", async () => {
    expect(
      await cellsOf(
        `<table style="display:block"><thead style="display:block"><tr style="display:block"><th style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap">Place</th></tr></thead><tbody><tr><td>x</td></tr></tbody></table>`,
      ),
    ).toEqual([]);
  });
});
