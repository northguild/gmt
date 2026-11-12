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
 * The globe's clock rows are one height, whatever their fields hold. The list builds a row with
 * its fields empty, measures it, and writes the reading a slice later; the virtualizer caches that
 * first measure. A row that grows when its reading lands moves every row below it. jsdom has no
 * layout, so this reads the built landing page in a browser.
 */

const dist = distDirOrSkip();
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

describe.each(ENGINES)("globe clock rows in %s", (_name, type) => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (dist !== null) browser = await type.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it("are as tall empty, as they are built, as with every field filled", async () => {
    if (browser === undefined || server === undefined) return;
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    try {
      await page.goto(`${base}/`);
      await page.waitForFunction(
        () =>
          (document.querySelector("[data-clock-sizer] [data-field='time']")
            ?.textContent ?? "") !== "",
        null,
        { timeout: 30_000 },
      );
      /* Copies of a real row, so they take the row's own styles, laid out beside it. The height
         is the computed one: the list moves rows by transform, which a bounding box would count. */
      const heights = await page.evaluate(() => {
        const row = document.querySelector<HTMLElement>(
          "[data-clock-sizer] [role='option']",
        );
        if (!row?.parentElement) throw new Error("no clock row");
        const measure = (fill: Record<string, string>): number => {
          const copy = row.cloneNode(true) as HTMLElement;
          copy.removeAttribute("id");
          for (const field of copy.querySelectorAll<HTMLElement>(
            "[data-field]",
          ))
            field.textContent = fill[field.dataset.field ?? ""] ?? "";
          row.parentElement?.appendChild(copy);
          const height = parseFloat(getComputedStyle(copy).height);
          copy.remove();
          return height;
        };
        return {
          empty: measure({}),
          plain: measure({
            offset: "UTC+00:00",
            date: "2026-11-12",
            time: "12:00:00",
          }),
          full: measure({
            dst: "DST",
            offset: "UTC+13:45",
            shift: "+2d",
            date: "2026-11-12",
            time: "12:00:00",
          }),
          noSignal: measure({ offset: "no signal", time: "— — —" }),
        };
      });
      expect(heights.empty).toBeGreaterThan(0);
      expect(heights, JSON.stringify(heights)).toEqual({
        empty: heights.empty,
        plain: heights.empty,
        full: heights.empty,
        noSignal: heights.empty,
      });
    } finally {
      await page.close();
    }
  }, 60_000);
});
