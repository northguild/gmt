#!/usr/bin/env tsx
/**
 * Captures the six landing pages that hang in the deck's ice wall (slice 2b of DOX-G12).
 *
 * Run it from `apps/dox`:  `pnpm exec tsx scripts/capture-wall.ts`
 * Re-run with `--placeholder` to write labelled stand-in panes (no network), which is what ships
 * when a site is unreachable: a stand-in says so on its face and in `wall.json`, and never
 * passes for a capture.
 *
 * For each page it opens a 1280 x 800 window at a device pixel ratio of 1, waits for the page to
 * settle, and writes a 1024 x 640 WebP (quality 80, held under 90 kB) to
 * `public/slides/give-me-temporal/wall/<id>.webp`. The page's address, the capture's date and
 * whether the page shows a live clock are written to `src/slides/give-me-temporal/wall.json`,
 * which the deck's figures and captions read. The date comes from gmt (`getUtcNow`).
 *
 * `title` is the page's own `<title>`, read from the page; a stand-in, or a page with an empty
 * `<title>`, carries the label in `PAGES`.
 * `clip` is optional and the owner's: a rectangle of the window to keep, set once the capture has
 * been looked at, so a site's clock emblem sits inside the frame.
 *
 * `clock` is an input, not something measured: it is true in `PAGES` for a page whose capture
 * shows a clock in its mark (Moment.js's clock face, Luxon's dial), and the deck's caption says so.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { getUtcNow } from "@northguild/gmt/utc/get";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const imageDir = resolve(root, "public/slides/give-me-temporal/wall");
const dataFile = resolve(root, "src/slides/give-me-temporal/wall.json");

const MAX_BYTES = 90 * 1024;

interface Page {
  id: string;
  /**
   * The library's name: the pane's caption, and a stand-in's label. A captured page's `title` is
   * read from its `<title>` and stays for screen readers.
   */
  label: string;
  url: string;
  clock: boolean;
  /**
   * A rectangle of the 1280 x 800 window to keep, so a site's clock emblem sits inside the frame.
   * The owner sets it after looking at the capture; without one the top of the page is kept.
   */
  clip?: { x: number; y: number; width: number; height: number };
}

interface Rendered {
  png: Buffer;
  /** The page's `<title>`; `null` for a stand-in. */
  title: string | null;
}

const PAGES: readonly Page[] = [
  {
    id: "moment",
    label: "Moment.js",
    url: "https://momentjs.com/",
    clock: true,
  },
  {
    id: "luxon",
    label: "Luxon",
    url: "https://moment.github.io/luxon/",
    clock: true,
  },
  {
    id: "date-fns",
    label: "date-fns",
    url: "https://date-fns.org/",
    clock: true,
  },
  { id: "dayjs", label: "Day.js", url: "https://day.js.org/", clock: true },
  {
    id: "spacetime",
    label: "Spacetime",
    url: "https://spacetime.how/",
    clock: false,
  },
  {
    id: "internationalized-date",
    label: "@internationalized/date",
    url: "https://react-aria.adobe.com/internationalized/date/",
    clock: false,
  },
];

const placeholderMode = process.argv.includes("--placeholder");

async function render(
  page: Page,
  browser: Awaited<ReturnType<typeof chromium.launch>> | null,
): Promise<Rendered> {
  if (browser) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      locale: "en-US",
    });
    try {
      const tab = await context.newPage();
      await tab.goto(page.url, { waitUntil: "networkidle", timeout: 45000 });
      await tab.waitForTimeout(1500);
      /* A page can ship an empty `<title>` (spacetime.how does); its label names it instead. */
      const title = (await tab.title()).trim() || page.label;
      const png = await tab.screenshot({
        type: "png",
        ...(page.clip ? { clip: page.clip } : {}),
      });
      return { png, title };
    } finally {
      await context.close();
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
    <rect width="1280" height="800" fill="#101820"/>
    <rect x="24" y="24" width="1232" height="752" fill="none" stroke="#6b7c8c" stroke-width="4" stroke-dasharray="24 16"/>
    <text x="640" y="360" text-anchor="middle" font-family="sans-serif" font-size="64" fill="#c9d6e2">PLACEHOLDER</text>
    <text x="640" y="440" text-anchor="middle" font-family="sans-serif" font-size="40" fill="#8fa3b5">capture pending: ${page.label}</text>
  </svg>`;
  return { png: await sharp(Buffer.from(svg)).png().toBuffer(), title: null };
}

async function main(): Promise<void> {
  const capturedAt = getUtcNow();
  if (!capturedAt)
    throw new Error("gmt returned no instant for the capture date");
  mkdirSync(imageDir, { recursive: true });
  mkdirSync(dirname(dataFile), { recursive: true });
  const browser = placeholderMode ? null : await chromium.launch();
  const entries: unknown[] = [];
  const failed: string[] = [];
  try {
    for (const page of PAGES) {
      let rendered: Rendered | null = null;
      let placeholder = placeholderMode;
      if (browser) {
        try {
          rendered = await render(page, browser);
        } catch (error) {
          failed.push(`${page.id}: ${(error as Error).message}`);
        }
      }
      if (!rendered) {
        placeholder = true;
        rendered = await render(page, null);
      }
      const { png } = rendered;
      let quality = 80;
      let out = await sharp(png)
        .resize(1024, 640, { fit: "cover", position: "top" })
        .webp({ quality })
        .toBuffer();
      while (out.length > MAX_BYTES && quality > 30) {
        quality -= 10;
        out = await sharp(png)
          .resize(1024, 640, { fit: "cover", position: "top" })
          .webp({ quality })
          .toBuffer();
      }
      writeFileSync(resolve(imageDir, `${page.id}.webp`), out);
      entries.push({
        id: page.id,
        name: page.label,
        title: rendered.title ?? page.label,
        url: page.url,
        capturedAt,
        image: `slides/give-me-temporal/wall/${page.id}.webp`,
        clock: page.clock,
        ...(placeholder ? { placeholder: true } : {}),
      });
      console.log(
        `${placeholder ? "placeholder" : "captured"} ${page.id} ${out.length} bytes`,
      );
    }
  } finally {
    await browser?.close();
  }
  writeFileSync(dataFile, `${JSON.stringify(entries, null, 2)}\n`);
  if (failed.length > 0) console.error(`not captured:\n${failed.join("\n")}`);
}

await main();
