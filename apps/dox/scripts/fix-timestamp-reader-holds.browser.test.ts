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
 * The FIX Timestamp Reader keeps its boxes still. The tool has typed input and no drag handle:
 * `readout-still` types values into it, and this reads the built page in a browser. For every
 * preset of each section, at 300 px and at desktop width, each hold and plate row keeps its width
 * and height to within 0.5 px of what it was on the first preset. A second case reads the first
 * load: every hold the server draws keeps its size when the mount fills it. Firefox is left to CI.
 */

const dist = distDirOrSkip();
const EPSILON = 0.5;
const WIDTHS = [300, 1280];
/** The widths `grow-measure` loads the page at. */
const LOAD_WIDTHS = [390, 1440];
const ENGINES: [string, BrowserType][] = [
  ["chromium", chromium],
  ["webkit", webkit],
];
/**
 * The boxes whose size the reader must never see change. A hold's live content (the code frame
 * inside the calls hold) may be shorter than the hold, so only the hold itself is measured.
 */
const GATES = ["hold", "hero", "plates", "frame"];

let server: Server | undefined;

beforeAll(async () => {
  if (dist === null) return;
  server = (await serveStatic(resolve(dist), 0)) as Server;
});

afterAll(async () => {
  await new Promise<void>((done) =>
    server ? server.close(() => done()) : done(),
  );
});

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );

type Box = { key: string; width: number; height: number };

/** Every gated box in the widget, by its position among the gated boxes. */
const boxes = (page: Page, gates: string[]): Promise<Box[]> =>
  page.evaluate((names) => {
    const root = document.querySelector("[data-widget='fix-timestamp-reader']");
    if (root === null) throw new Error("the widget is not on the page");
    const out: Box[] = [];
    let i = 0;
    for (const el of root.querySelectorAll<HTMLElement>("[data-gate]")) {
      const own = (el.getAttribute("data-gate") ?? "").split(/\s+/);
      const hit = own.filter((g) => names.includes(g));
      if (hit.length === 0) continue;
      const r = el.getBoundingClientRect();
      out.push({
        key: `${i++}:${hit.join("+")}`,
        width: r.width,
        height: r.height,
      });
    }
    return out;
  }, gates);

describe.each(ENGINES)("FIX Timestamp Reader holds in %s", (_name, type) => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (dist !== null) browser = await type.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  async function sweep(
    width: number,
    presetName: string,
    other: { name: string; value: string },
  ) {
    if (browser === undefined || server === undefined) return;
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(`${base}/tools/fix-timestamp-reader/`);
      const select = page.getByRole("combobox", {
        name: presetName,
        exact: true,
      });
      await select.waitFor({ state: "visible" });
      await page
        .getByRole("combobox", { name: other.name, exact: true })
        .selectOption(other.value);
      const values = await select
        .locator("option")
        .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
      let first: Box[] | null = null;
      const moved: string[] = [];
      // Each preset, then both boxes emptied: nothing to read is a state too.
      const states = [...values, "(empty)"];
      for (const value of states) {
        if (value === "(empty)") {
          await page.getByRole("textbox", { name: "UTCTimestamp" }).fill("");
          await page
            .getByRole("textbox", { name: "Instant", exact: true })
            .fill("");
        } else await select.selectOption(value);
        await settle(page);
        const now = await boxes(page, GATES);
        if (first === null) {
          first = now;
          expect(now.length).toBeGreaterThan(8);
          continue;
        }
        expect(
          now.map((b) => b.key),
          `boxes on ${value}`,
        ).toEqual(first.map((b) => b.key));
        now.forEach((b, i) => {
          const was = first![i]!;
          if (
            Math.abs(b.width - was.width) > EPSILON ||
            Math.abs(b.height - was.height) > EPSILON
          ) {
            moved.push(
              `${value} ${b.key}: ${was.width}x${was.height} -> ${b.width}x${b.height}`,
            );
          }
        });
      }
      expect(moved).toEqual([]);
    } finally {
      await page.close();
    }
  }

  /** Each hold's size by its live element's id, with scripts on or off. */
  async function holdsAtLoad(width: number, scripts: boolean) {
    const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}/gmt`;
    const context = await browser!.newContext({
      viewport: { width, height: 900 },
      javaScriptEnabled: scripts,
    });
    try {
      const page = await context.newPage();
      await page.goto(`${base}/tools/fix-timestamp-reader/`);
      if (scripts) {
        await page
          .getByRole("combobox", { name: "Preset", exact: true })
          .waitFor({ state: "visible" });
        // The first reading is drawn once the library has loaded.
        await page
          .getByRole("img", { name: /^FIX timestamp/ })
          .waitFor({ state: "visible" });
        await settle(page);
      }
      return await page.evaluate(() => {
        const out: Record<string, [number, number]> = {};
        for (const el of document.querySelectorAll<HTMLElement>(
          "[data-widget='fix-timestamp-reader'] [data-gate~='hold']",
        )) {
          const r = el.getBoundingClientRect();
          out[el.firstElementChild?.id ?? "?"] = [r.width, r.height];
        }
        return out;
      });
    } finally {
      await context.close();
    }
  }

  it.each(LOAD_WIDTHS)(
    "keeps every hold the server drew when the first reading arrives at %i px",
    async (width) => {
      if (browser === undefined || server === undefined) return;
      const drawn = await holdsAtLoad(width, false);
      const filled = await holdsAtLoad(width, true);
      expect(Object.keys(drawn).length).toBeGreaterThan(5);
      expect(Object.keys(filled)).toEqual(Object.keys(drawn));
      const moved = Object.keys(drawn).flatMap((id) => {
        const [w0, h0] = drawn[id]!;
        const [w1, h1] = filled[id]!;
        return Math.abs(w1 - w0) > EPSILON || Math.abs(h1 - h0) > EPSILON
          ? [`${id}: ${w0}x${h0} -> ${w1}x${h1}`]
          : [];
      });
      expect(moved).toEqual([]);
    },
    120_000,
  );

  it.each(WIDTHS)(
    "keeps every box through every stamp preset at %i px",
    (width) =>
      sweep(width, "Preset", {
        name: "Instant preset",
        value: "near-midnight",
      }),
    120_000,
  );

  it.each(WIDTHS)(
    "keeps every box through every writer preset at %i px",
    (width) =>
      sweep(width, "Instant preset", { name: "Preset", value: "milliseconds" }),
    120_000,
  );
});
