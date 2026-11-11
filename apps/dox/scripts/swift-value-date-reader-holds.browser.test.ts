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
 * The SWIFT Value Date Reader keeps its boxes still. The tool has typed input and no drag handle:
 * `readout-still` types values into it, and this reads the built page in a browser. At 300 px and
 * at desktop width it steps every read preset, every write preset and every value `readout-still`
 * types, then empties both boxes. Each hold, the plates strips, the band table and the call frames
 * keep their width and height to within 0.5 px of the first state, the two plates in each
 * strip keep their left and right edges, and every paragraph keeps its height (a note that wraps
 * to a second line only for some values pulls everything below it up). 1440 px is where the two
 * plates sit side by side and a width set by content shows; 390 px is where a paragraph wraps.
 * Firefox is left to CI.
 */

const dist = distDirOrSkip();
const EPSILON = 0.5;
const WIDTHS = [300, 390, 1280, 1440];
const ENGINES: [string, BrowserType][] = [
  ["chromium", chromium],
  ["webkit", webkit],
];
/** The boxes the reader must never see change: holds (call frames sit in them), strips, the band table. */
const GATES = ["hold", "plates", "write-plates", "grid", "chip"];

/** The values `readout-still` types into each box. */
const READ_VALUES = [
  "990615",
  "240615",
  "750101",
  "850229",
  "000229",
  "2406",
  "240615EUR1000,00",
  "２４０６１５",
  "9".repeat(16),
];
const WRITE_VALUES = [
  "2024-06-15",
  "1979-12-31",
  "2061-01-01",
  "2024-06-15T10:00:00",
  "x".repeat(32),
];

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

interface Box {
  key: string;
  width: number;
  height: number;
}
interface Snapshot {
  boxes: Box[];
  /** Per plates strip, each plate's left and right edge. */
  edges: string[];
  /** Per paragraph in the widget, its height. */
  paragraphs: number[];
}

/** Every gated box in the widget, by its position among the gated boxes, and each plate's edges. */
const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate((names) => {
    const root = document.querySelector(
      "[data-widget='swift-value-date-reader']",
    );
    if (root === null) throw new Error("the widget is not on the page");
    const boxes: Box[] = [];
    let i = 0;
    for (const el of root.querySelectorAll<HTMLElement>("[data-gate]")) {
      const own = (el.getAttribute("data-gate") ?? "").split(/\s+/);
      const hit = own.filter((g) => names.includes(g));
      if (hit.length === 0) continue;
      const r = el.getBoundingClientRect();
      boxes.push({
        key: `${i++}:${hit.join("+")}`,
        width: r.width,
        height: r.height,
      });
    }
    const edges: string[] = [];
    root.querySelectorAll<HTMLElement>("dl").forEach((strip, s) => {
      Array.from(strip.children).forEach((plate, p) => {
        const r = plate.getBoundingClientRect();
        edges.push(`strip ${s} plate ${p}: ${r.left}..${r.right}`);
      });
    });
    // Paragraphs outside a hold: a hold's own size is already measured above and its ghosts
    // are paragraphs of their own. The figure's empty message is a paragraph only while the
    // figure is empty, so it is no fixed paragraph to compare.
    const paragraphs = Array.from(
      root.querySelectorAll<HTMLElement>("p:not([data-state='empty'])"),
    )
      .filter((p) => p.closest("[data-gate~='hold']") === null)
      .map((p) => p.getBoundingClientRect().height);
    return { boxes, edges, paragraphs };
  }, GATES);

describe.each(ENGINES)("SWIFT Value Date Reader holds in %s", (_name, type) => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (dist !== null) browser = await type.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it.each(WIDTHS)(
    "keeps every box through every preset and typed value at %i px",
    async (width) => {
      if (browser === undefined || server === undefined) return;
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(`${base}/tools/swift-value-date-reader/`);
        const readPreset = page.getByRole("combobox", {
          name: "Preset",
          exact: true,
        });
        const writePreset = page.getByRole("combobox", {
          name: "Date preset",
          exact: true,
        });
        const valueBox = page.getByRole("textbox", {
          name: "Value date (YYMMDD)",
        });
        const dateBox = page.getByRole("textbox", { name: "ISO date" });
        await readPreset.waitFor({ state: "visible" });
        await settle(page);

        const optionsOf = (select: typeof readPreset) =>
          select
            .locator("option")
            .evaluateAll((os) =>
              os
                .map((o) => (o as HTMLOptionElement).value)
                .filter((v) => v !== "custom"),
            );
        const readIds = await optionsOf(readPreset);
        const writeIds = await optionsOf(writePreset);

        const steps: [string, () => Promise<void>][] = [
          ...readIds.map((id): [string, () => Promise<void>] => [
            `read preset ${id}`,
            async () => {
              await readPreset.selectOption(id);
            },
          ]),
          ...writeIds.map((id): [string, () => Promise<void>] => [
            `write preset ${id}`,
            async () => {
              await writePreset.selectOption(id);
            },
          ]),
          ...READ_VALUES.map((v): [string, () => Promise<void>] => [
            `value ${v}`,
            () => valueBox.fill(v),
          ]),
          ...WRITE_VALUES.map((v): [string, () => Promise<void>] => [
            `date ${v}`,
            () => dateBox.fill(v),
          ]),
          [
            "both boxes emptied",
            async () => {
              await valueBox.fill("");
              await dateBox.fill("");
            },
          ],
        ];

        let first: Snapshot | null = null;
        const moved: string[] = [];
        for (const [label, act] of steps) {
          await act();
          await settle(page);
          const now = await snapshot(page);
          if (first === null) {
            first = now;
            expect(now.boxes.length).toBeGreaterThan(8);
            continue;
          }
          expect(
            now.boxes.map((b) => b.key),
            `boxes on ${label}`,
          ).toEqual(first.boxes.map((b) => b.key));
          now.boxes.forEach((b, i) => {
            const was = first!.boxes[i]!;
            if (
              Math.abs(b.width - was.width) > EPSILON ||
              Math.abs(b.height - was.height) > EPSILON
            ) {
              moved.push(
                `${label} ${b.key}: ${was.width}x${was.height} -> ${b.width}x${b.height}`,
              );
            }
          });
          now.edges.forEach((edge, i) => {
            const was = first!.edges[i];
            const [, a] = (was ?? "").split(": ");
            const [, b] = edge.split(": ");
            const [al, ar] = (a ?? "").split("..").map(Number);
            const [bl, br] = (b ?? "").split("..").map(Number);
            if (
              Math.abs((bl ?? 0) - (al ?? 0)) > EPSILON ||
              Math.abs((br ?? 0) - (ar ?? 0)) > EPSILON
            ) {
              moved.push(`${label} ${edge} (was ${a})`);
            }
          });
          expect(now.paragraphs.length, `paragraphs on ${label}`).toBe(
            first.paragraphs.length,
          );
          now.paragraphs.forEach((h, i) => {
            const was = first!.paragraphs[i]!;
            if (Math.abs(h - was) > EPSILON) {
              moved.push(`${label} paragraph ${i}: ${was} -> ${h}`);
            }
          });
        }
        expect(moved).toEqual([]);
      } finally {
        await page.close();
      }
    },
    180_000,
  );
});
