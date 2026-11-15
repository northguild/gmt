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
 * The GTFS Service Day Clock keeps its boxes still. The tool has typed input and no drag handle,
 * so this steps every preset and two typed refusals in a browser and compares each state with the
 * first. Both anchor cards keep their x, width and height, and so does every value box inside
 * them (a plate's value is a hold with ghosts). At 1280 and 1440 px the left card's left edge
 * meets the row's left and the right card's right edge meets the row's right; every card has a
 * border on all four sides; the page never scrolls sideways. A typed expanded year
 * (`99991231` / `999:59:59` / `UTC`) is checked separately: it may make a card taller, but not
 * wider, and the rail's "Not drawn" line shows if a helper refused it. Firefox is left to CI.
 */

const dist = distDirOrSkip();
const EPSILON = 0.5;
const WIDTHS = [300, 390, 1280, 1440];
const ENGINES: [string, BrowserType][] = [
  ["chromium", chromium],
  ["webkit", webkit],
];

/** Two typed refusals, run after every preset. */
const REFUSALS: [string, string, string][] = [
  ["20240230", "08:00:00", "Europe/Berlin"],
  ["20260329", "25:60:00", "Not/AZone"],
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

interface Rect {
  x: number;
  width: number;
  height: number;
}
interface Snapshot {
  cards: Rect[];
  /** Every value box inside a card, in document order. */
  values: Rect[];
  row: { left: number; right: number };
  scrollWidth: number;
  clientWidth: number;
  borders: number[][];
  notDrawn: boolean;
}

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const root = document.querySelector(
      "[data-widget='gtfs-service-day-clock']",
    );
    if (root === null) throw new Error("the widget is not on the page");
    const rect = (
      el: Element,
    ): { x: number; width: number; height: number } => {
      const r = el.getBoundingClientRect();
      return { x: r.x, width: r.width, height: r.height };
    };
    const cardEls = Array.from(
      root.querySelectorAll<HTMLElement>("[role='group'][aria-labelledby]"),
    );
    const values = cardEls.flatMap((c) =>
      Array.from(c.querySelectorAll("dd")).map(rect),
    );
    const rowEl = cardEls[0]?.parentElement;
    const row = rowEl?.getBoundingClientRect();
    return {
      cards: cardEls.map(rect),
      values,
      row: { left: row?.left ?? 0, right: row?.right ?? 0 },
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      borders: cardEls.map((c) => {
        const s = getComputedStyle(c);
        return [
          parseFloat(s.borderTopWidth),
          parseFloat(s.borderRightWidth),
          parseFloat(s.borderBottomWidth),
          parseFloat(s.borderLeftWidth),
        ];
      }),
      notDrawn: (root as HTMLElement).innerText.includes("Not drawn:"),
    };
  });

describe.each(ENGINES)("GTFS Service Day Clock holds in %s", (_name, type) => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (dist !== null) browser = await type.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it.each(WIDTHS)(
    "keeps every card and value through every preset and refusal at %i px",
    async (width) => {
      if (browser === undefined || server === undefined) return;
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(`${base}/tools/gtfs-service-day-clock/`);
        const presetBox = page.getByRole("combobox", {
          name: "Preset",
          exact: true,
        });
        const dateBox = page.getByRole("textbox", {
          name: "Service date (calendar.txt)",
        });
        const timeBox = page.getByRole("textbox", {
          name: "Stop time (stop_times.txt)",
        });
        const zoneBox = page.getByRole("textbox", {
          name: "Zone (agency.txt, agency_timezone)",
        });
        await presetBox.waitFor({ state: "visible" });
        await settle(page);

        const ids = await presetBox
          .locator("option")
          .evaluateAll((os) =>
            os
              .map((o) => (o as HTMLOptionElement).value)
              .filter((v) => v !== "custom"),
          );
        expect(ids.length).toBe(8);

        const steps: [string, () => Promise<void>][] = [
          ...ids.map((id): [string, () => Promise<void>] => [
            `preset ${id}`,
            async () => {
              await presetBox.selectOption(id);
            },
          ]),
          ...REFUSALS.map(([d, t, z]): [string, () => Promise<void>] => [
            `refusal ${d} ${t} ${z}`,
            async () => {
              await dateBox.fill(d);
              await timeBox.fill(t);
              await zoneBox.fill(z);
            },
          ]),
        ];

        let first: Snapshot | null = null;
        const moved: string[] = [];
        for (const [label, act] of steps) {
          await act();
          await settle(page);
          const now = await snapshot(page);

          expect(now.cards, `cards on ${label}`).toHaveLength(2);
          expect(
            now.scrollWidth,
            `horizontal scroll on ${label}`,
          ).toBeLessThanOrEqual(now.clientWidth);
          for (const b of now.borders) {
            expect(
              b.every((w) => w > 0),
              `all four borders on ${label}`,
            ).toBe(true);
          }
          if (width >= 1280) {
            const [left, right] = now.cards as [Rect, Rect];
            if (Math.abs(left.x - right.x) > 1) {
              // Two columns.
              expect(Math.abs(left.x - now.row.left)).toBeLessThanOrEqual(1);
              expect(
                Math.abs(right.x + right.width - now.row.right),
              ).toBeLessThanOrEqual(1);
            }
          }
          if (first === null) {
            first = now;
            expect(now.values.length).toBe(6);
            continue;
          }
          now.cards.forEach((c, i) => {
            const was = first!.cards[i]!;
            if (
              Math.abs(c.x - was.x) > EPSILON ||
              Math.abs(c.width - was.width) > EPSILON ||
              Math.abs(c.height - was.height) > EPSILON
            ) {
              moved.push(
                `${label} card ${i}: ${was.x},${was.width}x${was.height} -> ${c.x},${c.width}x${c.height}`,
              );
            }
          });
          now.values.forEach((v, i) => {
            const was = first!.values[i]!;
            if (
              Math.abs(v.x - was.x) > EPSILON ||
              Math.abs(v.width - was.width) > EPSILON ||
              Math.abs(v.height - was.height) > EPSILON
            ) {
              moved.push(
                `${label} value ${i}: ${was.x},${was.width}x${was.height} -> ${v.x},${v.width}x${v.height}`,
              );
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
    "a typed expanded year grows a card in height only at %i px",
    async (width) => {
      if (browser === undefined || server === undefined) return;
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(`${base}/tools/gtfs-service-day-clock/`);
        const dateBox = page.getByRole("textbox", {
          name: "Service date (calendar.txt)",
        });
        await dateBox.waitFor({ state: "visible" });
        await settle(page);
        const before = await snapshot(page);

        await dateBox.fill("99991231");
        await page
          .getByRole("textbox", { name: "Stop time (stop_times.txt)" })
          .fill("999:59:59");
        await page
          .getByRole("textbox", {
            name: "Zone (agency.txt, agency_timezone)",
          })
          .fill("UTC");
        await settle(page);
        const after = await snapshot(page);

        after.cards.forEach((c, i) => {
          expect(
            Math.abs(c.width - before.cards[i]!.width),
            `card ${i} width`,
          ).toBeLessThanOrEqual(EPSILON);
          expect(
            Math.abs(c.x - before.cards[i]!.x),
            `card ${i} x`,
          ).toBeLessThanOrEqual(EPSILON);
        });
        expect(after.scrollWidth).toBeLessThanOrEqual(after.clientWidth);
        // When a rail helper refuses the far instant, the rail says so in one line.
        const bodyText = await page
          .locator("[data-widget='gtfs-service-day-clock']")
          .innerText();
        if (after.notDrawn) {
          expect(bodyText).toContain(
            "Not drawn: the library gave no position for this instant.",
          );
        }
      } finally {
        await page.close();
      }
    },
    120_000,
  );
});
