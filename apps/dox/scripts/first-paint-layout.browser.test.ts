import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import {
  chromium,
  webkit,
  type Browser,
  type BrowserType,
} from "@playwright/test";
import { distDirOrSkip } from "./dist-dir";
import { serveStatic } from "./lib/static-server.mjs";

/**
 * Two layouts a reader sees before the scripts have run, read in a browser because jsdom has no
 * layout.
 *
 * The landing without its carousel: no JavaScript, or a carousel that never ran. Every page then
 * reads in order down the hero's copy column. A section page is an inline-size container, whose
 * content counts as no width, so a page left to size itself shrank to nothing and set its text one
 * letter a line.
 *
 * The `/dox` strip: the reader's clock and the Worker badge are known only after hydration. The
 * server render holds their places, so the strip is as tall before hydration as after, and the chat
 * under it does not move.
 */

const dist = distDirOrSkip();
const ENGINES: [string, BrowserType][] = [
  ["chromium", chromium],
  ["webkit", webkit],
];

/** The issue's window, a laptop, and a phone held upright. */
const VIEWPORTS = [
  { width: 1917, height: 1012 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
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

/** The served site's root. Called only once `server` is up. */
function base(): string {
  if (server === undefined) throw new Error("no server");
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
}

describe.each(ENGINES)("first-paint layout in %s", (_name, type) => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (dist !== null) browser = await type.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it.each(VIEWPORTS)(
    "the landing without its carousel fills the copy column at $width×$height",
    async (viewport) => {
      if (browser === undefined || server === undefined) return;
      const context = await browser.newContext({
        viewport,
        javaScriptEnabled: false,
      });
      try {
        const page = await context.newPage();
        await page.goto(`${base()}/`);
        const sizes = await page.evaluate(() => {
          const column = document.querySelector<HTMLElement>(
            ".gmt-herostage-copy",
          );
          if (!column) throw new Error("no hero copy column");
          const style = getComputedStyle(column);
          const inner =
            column.clientWidth -
            parseFloat(style.paddingInlineStart) -
            parseFloat(style.paddingInlineEnd);
          return {
            mark: document.documentElement.dataset["homeCarousel"] ?? null,
            inner,
            pages: Array.from(
              column.querySelectorAll<HTMLElement>(":scope > [data-page]"),
              (el) => ({
                name: el.dataset["page"] ?? "",
                width: el.getBoundingClientRect().width,
              }),
            ),
            titles: Array.from(
              column.querySelectorAll<HTMLElement>("li[data-tone] p"),
              (el) => el.getBoundingClientRect().width,
            ),
          };
        });
        expect(sizes.mark).toBeNull();
        expect(sizes.inner).toBeGreaterThan(300);
        expect(sizes.pages.length).toBeGreaterThan(2);
        for (const { name, width } of sizes.pages)
          expect([name, Math.round(width)]).toEqual([
            name,
            Math.round(sizes.inner),
          ]);
        expect(sizes.titles.length).toBeGreaterThan(0);
        // A tile is half the column on a wide screen; its title has room for words.
        for (const width of sizes.titles) expect(width).toBeGreaterThan(100);
      } finally {
        await context.close();
      }
    },
    60_000,
  );

  it.each(VIEWPORTS)(
    "the /dox strip is as tall before hydration as after at $width×$height",
    async (viewport) => {
      if (browser === undefined || server === undefined) return;
      const measure = async (javaScriptEnabled: boolean) => {
        const context = await browser!.newContext({
          viewport,
          javaScriptEnabled,
        });
        try {
          const page = await context.newPage();
          await page.goto(`${base()}/dox/`);
          // After: both the clock and the badge show their values.
          if (javaScriptEnabled)
            await page.waitForFunction(
              () =>
                document.querySelectorAll(".gmt-hive-strip [data-pending]")
                  .length === 0,
              null,
              { timeout: 30_000 },
            );
          return await page.evaluate(() => {
            const strip = document.querySelector(".gmt-hive-strip");
            const body = document.querySelector(".gmt-hive-body");
            if (!strip || !body) throw new Error("no /dox strip");
            return {
              strip: strip.getBoundingClientRect().height,
              body: body.getBoundingClientRect().top,
            };
          });
        } finally {
          await context.close();
        }
      };
      const before = await measure(false);
      const after = await measure(true);
      expect(before.strip).toBeGreaterThan(30);
      expect(after).toEqual(before);
    },
    90_000,
  );
});
