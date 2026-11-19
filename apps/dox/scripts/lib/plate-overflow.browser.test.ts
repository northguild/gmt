import { chromium, type Browser, type Page } from "@playwright/test";
import { measurePlates } from "./plate-overflow.mjs";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 600, height: 600 } });
});
afterAll(async () => {
  await browser.close();
});

const SR_ONLY =
  "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";

const platesOf = async (inner: string, width = 200) => {
  await page.setContent(
    `<main><dl><div class="gmt-plates__plate" style="box-sizing:border-box;width:${width}px;padding:0 10px;border:1px solid">${inner}</div></dl></main>`,
  );
  return page.evaluate(measurePlates);
};

describe("measurePlates", () => {
  it("counts the plates it measured and passes text that fits", async () => {
    const r = await platesOf(`<dd>2026-01-01</dd>`);
    expect(r.plates).toBe(1);
    expect(r.found).toEqual([]);
  });

  it("reports visible text that runs past the plate's right edge", async () => {
    const r = await platesOf(
      `<dd style="white-space:nowrap">2026-02-28T00:00:00.123456789Z</dd>`,
    );
    expect(r.found).toHaveLength(1);
    expect(r.found[0]!.sample).toBe(false);
    expect(r.found[0]!.past).toBeGreaterThan(1.5);
  });

  it("passes text that wraps inside the plate", async () => {
    const r = await platesOf(
      `<dd style="overflow-wrap:anywhere">2026-02-28T00:00:00.123456789Z</dd>`,
    );
    expect(r.found).toEqual([]);
  });

  it("allows 1.5 px past the padding edge and no more", async () => {
    // A 200 px plate with 1 px borders: the padding edge is at 199 px. Fourteen monospace
    // characters of 12 px are 168 px wide and start at 11 px plus the offset.
    const text = (offset: number) =>
      `<dd style="margin:0 0 0 ${offset}px;font:20px monospace;white-space:nowrap">mmmmmmmmmmmmmm</dd>`;
    expect((await platesOf(text(21))).found).toEqual([]);
    expect((await platesOf(text(23))).found).toHaveLength(1);
  });

  it("skips screen-reader-only, aria-hidden and visibility-hidden text", async () => {
    const r = await platesOf(
      `<dd><span style="${SR_ONLY}">a long screen-reader only label</span><span aria-hidden="true" style="display:block;white-space:nowrap">aria hidden text that is long</span><span style="display:block;visibility:hidden;white-space:nowrap">hidden text that is long enough</span><span style="display:block">ok</span></dd>`,
    );
    expect(r.found).toEqual([]);
  });

  it("reports a reserved sample that runs past the edge under its own rule", async () => {
    const r = await platesOf(
      `<dd><span>ok</span><span class="ghost" aria-hidden="true" style="visibility:hidden;white-space:nowrap">+275760-09-12T23:59:59.999999999Z</span></dd>`,
    );
    expect(r.found).toHaveLength(1);
    expect(r.found[0]!.sample).toBe(true);
  });

  it("measures nothing when the page has no plate", async () => {
    await page.setContent(`<main><p>no plate</p></main>`);
    expect((await page.evaluate(measurePlates)).plates).toBe(0);
  });
});
