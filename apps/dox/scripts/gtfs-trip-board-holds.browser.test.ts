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
 * The GTFS Trip Board keeps its plates still. The tool has typed input and no drag handle, so this
 * steps every preset and the typed edits the readout-still gate makes, and compares each state with
 * the first. Both plates keep their x, width and height, and so does the value inside them (a
 * plate's value is a hold with ghosts). The table and the calls grow with the trip by design, so
 * the table is only held when an edit keeps the row count. At 1280 and 1440 px the left plate meets
 * the row's left edge and the right plate its right edge; every plate has a border on all four
 * sides; neither the page nor any table cell scrolls sideways. Firefox is left to CI.
 */

const dist = distDirOrSkip();
const EPSILON = 0.5;
const WIDTHS = [300, 390, 1280, 1440];
const ENGINES: [string, BrowserType][] = [
  ["chromium", chromium],
  ["webkit", webkit],
];

/** The widest zone name the IANA database holds: its readings are the widest a box ever shows. */
const WIDEST_ZONE = "America/Argentina/Buenos_Aires";

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

/** A baseline taken while a transition still runs is a false baseline. */
const quiet = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    ),
  );
  await settle(page);
};

interface Rect {
  x: number;
  width: number;
  height: number;
}
interface Snapshot {
  plates: Rect[];
  /** The value box inside each plate. */
  values: Rect[];
  table: Rect | null;
  rows: number;
  row: { left: number; right: number };
  scrollWidth: number;
  clientWidth: number;
  borders: number[][];
  /** Cells whose content is wider than the cell. */
  wideCells: string[];
}

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const root = document.querySelector("[data-widget='gtfs-trip-board']");
    if (root === null) throw new Error("the widget is not on the page");
    const rect = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return { x: r.x, width: r.width, height: r.height };
    };
    const plateEls = Array.from(
      root.querySelectorAll<HTMLElement>("[data-gate='hero']"),
    );
    const rowEl = plateEls[0]?.parentElement?.getBoundingClientRect();
    const table = root.querySelector("table");
    return {
      plates: plateEls.map(rect),
      values: plateEls.flatMap((p) =>
        Array.from(p.querySelectorAll("dd")).map(rect),
      ),
      table: table === null ? null : rect(table),
      rows: table === null ? 0 : table.querySelectorAll("tbody tr").length,
      row: { left: rowEl?.left ?? 0, right: rowEl?.right ?? 0 },
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      borders: plateEls.map((p) => {
        const s = getComputedStyle(p);
        return [
          parseFloat(s.borderTopWidth),
          parseFloat(s.borderRightWidth),
          parseFloat(s.borderBottomWidth),
          parseFloat(s.borderLeftWidth),
        ];
      }),
      wideCells: Array.from(root.querySelectorAll<HTMLElement>("td, th"))
        .filter((c) => {
          const r = c.getBoundingClientRect();
          return (
            r.width > 1 && r.height > 1 && c.scrollWidth > c.clientWidth + 1
          );
        })
        .map(
          (c) =>
            `${(c.textContent ?? "").trim().slice(0, 40)} ${c.scrollWidth}>${c.clientWidth}`,
        ),
    };
  });

const differs = (a: Rect, b: Rect): boolean =>
  Math.abs(a.x - b.x) > EPSILON ||
  Math.abs(a.width - b.width) > EPSILON ||
  Math.abs(a.height - b.height) > EPSILON;

describe.each(ENGINES)("GTFS Trip Board holds in %s", (_name, type) => {
  let browser: Browser | undefined;
  beforeAll(async () => {
    if (dist !== null) browser = await type.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it.each(WIDTHS)(
    "keeps every plate and value through every preset and edit at %i px",
    async (width) => {
      if (browser === undefined || server === undefined) return;
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(`${base}/tools/gtfs-trip-board/`);
        const presetBox = page.getByRole("combobox", {
          name: "Preset",
          exact: true,
        });
        const rowsBox = page.getByRole("textbox", {
          name: "Trip rows (stop_times.txt, with stop_timezone from stops.txt)",
        });
        const dateBox = page.getByRole("textbox", {
          name: "Service date (calendar.txt)",
        });
        const zoneBox = page.getByRole("textbox", {
          name: "Zone (agency.txt, agency_timezone)",
        });
        await presetBox.waitFor({ state: "visible" });
        await quiet(page);

        const ids = await presetBox
          .locator("option")
          .evaluateAll((os) =>
            os
              .map((o) => (o as HTMLOptionElement).value)
              .filter((v) => v !== "custom"),
          );
        expect(ids.length).toBe(5);

        const steps: [string, boolean, () => Promise<void>][] = [
          ...ids.map((id): [string, boolean, () => Promise<void>] => [
            `preset ${id}`,
            false,
            async () => {
              await presetBox.selectOption(id);
            },
          ]),
          [
            "border preset again",
            false,
            async () => {
              await presetBox.selectOption("border");
            },
          ],
          [
            `widest zone ${WIDEST_ZONE}`,
            true,
            async () => {
              await zoneBox.fill(WIDEST_ZONE);
            },
          ],
          [
            "refused date",
            true,
            async () => {
              await dateBox.fill("20260230");
            },
          ],
          [
            "refused zone",
            true,
            async () => {
              await zoneBox.fill("Not/AZone");
            },
          ],
          [
            "cleared date",
            true,
            async () => {
              await dateBox.fill("");
            },
          ],
          [
            "refused time",
            true,
            async () => {
              await presetBox.selectOption("border");
              const text = await rowsBox.inputValue();
              await rowsBox.fill(text.replace(/\d\d:\d\d:\d\d/, "10:99:00"));
            },
          ],
        ];

        let first: Snapshot | null = null;
        let prev: Snapshot | null = null;
        const moved: string[] = [];
        for (const [label, keepsRows, act] of steps) {
          await act();
          await quiet(page);
          const now = await snapshot(page);

          expect(now.plates, `plates on ${label}`).toHaveLength(2);
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
          if (width <= 300) {
            expect(
              now.wideCells,
              `cells wider than themselves on ${label}`,
            ).toEqual([]);
          }
          if (width >= 1280) {
            const [left, right] = now.plates as [Rect, Rect];
            if (Math.abs(left.x - right.x) > 1) {
              expect(Math.abs(left.x - now.row.left)).toBeLessThanOrEqual(1);
              expect(
                Math.abs(right.x + right.width - now.row.right),
              ).toBeLessThanOrEqual(1);
            }
          }
          if (first === null) {
            first = now;
            expect(now.values.length).toBe(2);
          } else {
            now.plates.forEach((p, i) => {
              if (differs(p, first!.plates[i]!)) {
                moved.push(`${label} plate ${i}`);
              }
            });
            now.values.forEach((v, i) => {
              if (differs(v, first!.values[i]!)) {
                moved.push(`${label} value ${i}`);
              }
            });
          }
          if (
            keepsRows &&
            prev !== null &&
            prev.rows === now.rows &&
            prev.table !== null &&
            now.table !== null &&
            differs(prev.table, now.table)
          ) {
            moved.push(`${label} table`);
          }
          prev = now;
        }
        expect(moved).toEqual([]);
      } finally {
        await page.close();
      }
    },
    240_000,
  );
});
