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
 * The PTP Clock Converter keeps its boxes still. The tool has typed input and no drag handle:
 * `readout-still` types values into it, and this reads the built page in a browser. At 300 px and
 * at desktop width it steps every read preset, every write preset and every value `readout-still`
 * types, then empties both boxes. Each hold, the plates strips and the call frames
 * keep their width and height to within 0.5 px of the first state, the two plates in each
 * strip keep their left and right edges, and every paragraph keeps its height (a note that wraps
 * to a second line only for some values pulls everything below it up). 1440 px is where the two
 * plates sit side by side and a width set by content shows; 390 px is where a paragraph wraps.
 * Firefox is left to CI.
 *
 * The ruler is read at the same widths: every label it shows stays inside its axis, the first
 * starts at the axis start, the last ends at the axis end, every other label is centred on its
 * value, and the lane's label is one line (PR #532 review: the 40 ran past the axis and was
 * clipped, and the long lane label wrapped to four lines at 1280 px).
 */

const dist = distDirOrSkip();
const EPSILON = 0.5;
const WIDTHS = [300, 390, 1280, 1440];
const ENGINES: [string, BrowserType][] = [
  ["chromium", chromium],
  ["webkit", webkit],
];
/** The boxes the reader must never see change: holds (call frames sit in them), strips. */
const GATES = [
  "hold",
  "hero",
  "check-plates",
  "write-plates",
  "frame",
  "codeframe",
];

/** The values `readout-still` types into each box. */
const SECONDS_VALUES = [
  "1704067237",
  "0",
  "-1",
  "1.5",
  "x",
  "281474976710656",
  "9".repeat(20),
  "-" + "9".repeat(20),
];
const NANOS_VALUES = [
  "0",
  "500000000",
  "-1",
  "1.5",
  "x",
  "9".repeat(11) + ".123456789",
];
const OFFSET_VALUES = [
  "37",
  "36",
  "0",
  "-1",
  "37.5",
  "x",
  "90",
  "-" + "9".repeat(11) + ".123456789",
];
const INSTANT_VALUES = [
  "2024-01-01T02:00:00+02:00",
  "2016-12-31T23:59:60Z",
  "1969-12-31T23:59:59Z",
  "+275760-09-12T23:59:59.999999999Z",
  "x",
  "9".repeat(64),
];
/** The widest values, typed one character at a time. */
const TYPED_SECONDS = "-" + "9".repeat(20);
const TYPED_INSTANT = "+275760-09-12T23:59:59.999999999Z";

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
    const root = document.querySelector("[data-widget='ptp-clock-converter']");
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

describe.each(ENGINES)("PTP Clock Converter holds in %s", (_name, type) => {
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
        await page.goto(`${base}/tools/ptp-clock-converter/`);
        const readPreset = page.getByRole("combobox", {
          name: "Preset",
          exact: true,
        });
        const writePreset = page.getByRole("combobox", {
          name: "Write preset",
          exact: true,
        });
        const secondsBox = page.getByRole("textbox", {
          name: "Seconds",
          exact: true,
        });
        const nanosBox = page.getByRole("textbox", { name: "Nanoseconds" });
        const offsetBox = page.getByRole("textbox", {
          name: "currentUtcOffset (s)",
        });
        const instantBox = page.getByRole("textbox", { name: "UTC instant" });
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
          ...SECONDS_VALUES.map((v): [string, () => Promise<void>] => [
            `seconds ${v}`,
            () => secondsBox.fill(v),
          ]),
          ...NANOS_VALUES.map((v): [string, () => Promise<void>] => [
            `nanoseconds ${v}`,
            () => nanosBox.fill(v),
          ]),
          ...OFFSET_VALUES.map((v): [string, () => Promise<void>] => [
            `offset ${v}`,
            () => offsetBox.fill(v),
          ]),
          ...INSTANT_VALUES.map((v): [string, () => Promise<void>] => [
            `instant ${v}`,
            () => instantBox.fill(v),
          ]),
          // The widest values, one character at a time.
          ...[...TYPED_SECONDS].map((_, i): [string, () => Promise<void>] => [
            `typing seconds, ${i + 1} characters`,
            () => secondsBox.fill(TYPED_SECONDS.slice(0, i + 1)),
          ]),
          ...[...TYPED_INSTANT].map((_, i): [string, () => Promise<void>] => [
            `typing instant, ${i + 1} characters`,
            () => instantBox.fill(TYPED_INSTANT.slice(0, i + 1)),
          ]),
          [
            "all boxes emptied",
            async () => {
              await secondsBox.fill("");
              await nanosBox.fill("");
              await offsetBox.fill("");
              await instantBox.fill("");
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

  it.each(WIDTHS)(
    "keeps every ruler label inside the axis and centred on its value at %i px",
    async (width) => {
      if (browser === undefined || server === undefined) return;
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(`${base}/tools/ptp-clock-converter/`);
        await page
          .getByRole("combobox", { name: "Preset", exact: true })
          .waitFor({ state: "visible" });
        await settle(page);

        const ruler = await page.evaluate(() => {
          const root = document.querySelector(
            "[data-widget='ptp-clock-converter']",
          );
          const axis = root?.querySelector(
            "[data-gate='moving']",
          )?.nextElementSibling;
          const laneLabel = root?.querySelector<HTMLElement>(
            "[data-gate~='drawn'] > span[aria-hidden='true']",
          );
          if (!(axis instanceof HTMLElement) || !laneLabel) {
            throw new Error("the ruler is not on the page");
          }
          const a = axis.getBoundingClientRect();
          const labels = Array.from(
            axis.querySelectorAll<HTMLElement>("[style*='--gmt-at']"),
          )
            .filter((t) => t.getClientRects().length > 0)
            .map((t) => {
              // The text's own box: the label's box has no width.
              const range = document.createRange();
              range.selectNodeContents(t);
              const r = range.getBoundingClientRect();
              return {
                text: t.textContent ?? "",
                at: Number(t.style.getPropertyValue("--gmt-at")),
                left: r.left,
                right: r.right,
              };
            });
          return {
            left: a.left,
            right: a.right,
            width: a.width,
            labels,
            laneHeight: laneLabel.getBoundingClientRect().height,
            laneLine: parseFloat(getComputedStyle(laneLabel).lineHeight),
          };
        });

        expect(ruler.labels.length).toBeGreaterThanOrEqual(3);
        const off: string[] = [];
        for (const l of ruler.labels) {
          if (
            l.left < ruler.left - EPSILON ||
            l.right > ruler.right + EPSILON
          ) {
            off.push(
              `${l.text} at ${l.left}..${l.right}, outside ${ruler.left}..${ruler.right}`,
            );
          }
          const value = ruler.left + l.at * ruler.width;
          const placed =
            l.at === 0 ? l.left : l.at === 1 ? l.right : (l.left + l.right) / 2;
          if (Math.abs(placed - value) > EPSILON) {
            off.push(`${l.text} placed at ${placed}, its value is at ${value}`);
          }
        }
        expect(off).toEqual([]);
        expect(ruler.laneHeight).toBeLessThan(ruler.laneLine * 1.5);
      } finally {
        await page.close();
      }
    },
    60_000,
  );
});
