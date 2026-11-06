import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import {
  chromium,
  webkit,
  type Browser,
  type BrowserType,
  type Page,
} from "@playwright/test";
import { distDirOrSkip } from "./dist-dir";
import { serveStatic } from "./lib/static-server.mjs";

/**
 * The industry tag definitions. jsdom has no layout, so this reads the built site in a browser:
 * whichever tag opens its definition, the box stays 16 px inside both viewport edges and the page
 * does not scroll sideways, and on a wide screen it sits under its own tag.
 */

const dist = distDirOrSkip();
const GUTTER = 16;
const NARROW = 375;
const WIDE = [1280, 1440, 1910];
const ENGINES: [string, BrowserType][] = [
  ["chromium", chromium],
  ["webkit", webkit],
];

let server: Server | undefined;

beforeAll(async () => {
  if (dist === null) return;
  // Dox is served under /gmt: the pages sit in dist/gmt.
  server = (await serveStatic(resolve(dist), 0)) as Server;
});

afterAll(async () => {
  await new Promise<void>((done) =>
    server ? server.close(() => done()) : done(),
  );
});

/** Two animation frames, so a layout the last change caused has settled. */
const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );

/** Opens one tag's definition from the keyboard and measures it, then closes it with Escape. */
async function open(page: Page, index: number) {
  const tag = page.locator(".gmt-industry-tag").nth(index);
  await tag.focus();
  await page.keyboard.press("Enter");
  const definition = page
    .locator(".gmt-industry-tag-item")
    .nth(index)
    .locator(".gmt-industry-tag-def");
  await definition.waitFor({ state: "visible" });
  await settle(page);
  const box = await definition.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right };
  });
  const tagBox = await tag.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right };
  });
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  await page.keyboard.press("Escape");
  await settle(page);
  const refocused = await page.evaluate(
    () => document.activeElement?.closest(".gmt-industry-tag") !== null,
  );
  return { ...box, tag: tagBox, scrollWidth, refocused };
}

describe.each(ENGINES)("industry tag definitions in %s", (_name, type) => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (dist !== null) browser = await type.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  async function onGuides(
    width: number,
    run: (page: Page, count: number) => Promise<void>,
  ) {
    if (browser === undefined || server === undefined) return;
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
    const page = await browser.newPage({ viewport: { width, height: 812 } });
    try {
      await page.goto(`${base}/guides/`);
      const count = await page.locator(".gmt-industry-tag").count();
      expect(count).toBeGreaterThan(4);
      await run(page, count);
    } finally {
      await page.close();
    }
  }

  it("keep every definition 16 px inside a 375 px viewport, with no sideways scroll", async () => {
    await onGuides(NARROW, async (page, count) => {
      const rects = [];
      for (let i = 0; i < count; i++) {
        const r = await open(page, i);
        rects.push({ i, left: r.left, right: r.right });
        expect(r.left, `tag ${i} left`).toBeGreaterThanOrEqual(GUTTER);
        expect(r.right, `tag ${i} right`).toBeLessThanOrEqual(NARROW - GUTTER);
        expect(r.scrollWidth, `tag ${i} scrollWidth`).toBeLessThanOrEqual(
          NARROW,
        );
        expect(r.refocused, `tag ${i} focus returns`).toBe(true);
      }
      console.info(`rects at ${NARROW}:`, JSON.stringify(rects));
    });
  }, 60_000);

  it.each(WIDE)(
    "sit under their own tag at %i wide, inside the viewport",
    async (width) => {
      await onGuides(width, async (page, count) => {
        for (const index of [0, count - 1]) {
          const r = await open(page, index);
          // Starting at the tag's start edge, or flipped to end at its end edge.
          const underOwn =
            (r.left >= r.tag.left - 1 && r.left <= r.tag.right) ||
            (r.right >= r.tag.left && r.right <= r.tag.right + 1);
          expect(
            underOwn,
            `tag ${index}: definition ${r.left}..${r.right} against tag ${r.tag.left}..${r.tag.right}`,
          ).toBe(true);
          expect(r.left).toBeGreaterThanOrEqual(GUTTER);
          expect(r.right).toBeLessThanOrEqual(width - GUTTER);
          expect(r.scrollWidth).toBeLessThanOrEqual(width);
          console.info(`rects at ${width}, tag ${index}:`, JSON.stringify(r));
        }
      });
    },
    60_000,
  );
});
