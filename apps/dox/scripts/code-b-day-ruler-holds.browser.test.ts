import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import {
  chromium,
  webkit,
  type Browser,
  type ElementHandle,
  type BrowserType,
  type Page,
} from "@playwright/test";
import type { ExpectStatic } from "vitest";
import { distDirOrSkip } from "./dist-dir";
import { serveStatic } from "./lib/static-server.mjs";

/**
 * The Code B Day Ruler keeps its boxes still while the day moves. For every preset, a sweep over
 * days 1 to 366 and a pointer drag there and back, at 300, 390, 1280 and 1440 px and in both
 * themes, each readout card, hold, the comparison line and both lanes keep their width and height
 * to within 0.5 px of what they were at the start. At 1280 px the two cards' outer edges are the
 * row's edges. Firefox is left to CI.
 *
 * The days are stepped from inside the page: one `evaluate` per preset sets the slider's value,
 * sends its bubbling `input` event (what a key on a native range sends, and what the mount
 * listens to), waits one frame and measures. The real keys then run `Home`, `ArrowRight` and
 * `End`, so the keyboard still drives the same handler. The tests run concurrently, each on its
 * own page.
 */

const dist = distDirOrSkip();
const EPSILON = 0.5;
const WIDTHS = [300, 390, 1280, 1440];
const THEMES = ["light", "dark"] as const;
const ENGINES: [string, BrowserType][] = [
  ["chromium", chromium],
  ["webkit", webkit],
];
const GATES = ["hold", "hero", "drawn"];
const PRESETS = ["after-leap-day", "day-366", "century"];

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

/** Waits for every running animation, such as the widget's entrance, to finish. */
const entered = (page: Page) =>
  page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => undefined)),
    );
  });

type Box = { key: string; width: number; height: number };

/**
 * The one measuring function. It is source text, not a function, so Playwright and the in-page
 * sweep run exactly the same code: `installMeasure` puts it on the page, and `boxes` and the
 * sweep both call it there.
 */
const MEASURE = `(names) => {
  const root = document.querySelector("[data-widget='code-b-day-ruler']");
  if (root === null) throw new Error("the widget is not on the page");
  const out = [];
  let i = 0;
  for (const el of root.querySelectorAll("[data-gate]")) {
    const own = (el.getAttribute("data-gate") ?? "").split(/\\s+/);
    const hit = own.filter((g) => names.includes(g));
    if (hit.length === 0) continue;
    const r = el.getBoundingClientRect();
    out.push({ key: (i++) + ":" + hit.join("+"), width: r.width, height: r.height });
  }
  // The comparison line is a status region with no gate of its own.
  const line = root.querySelector("[role='status']");
  if (line !== null) {
    const r = line.getBoundingClientRect();
    out.push({ key: "line", width: r.width, height: r.height });
  }
  return out;
}`;

type PageWithMeasure = Window & {
  __measure: (names: string[]) => Box[];
};

const installMeasure = (page: Page) =>
  page.evaluate(`window.__measure = ${MEASURE}; undefined`);

const boxes = (page: Page): Promise<Box[]> =>
  page.evaluate(
    (names) => (window as unknown as PageWithMeasure).__measure(names),
    GATES,
  );

interface SweepResult {
  moved: string[];
  /** The last day's keys; the days whose keys differed from the first are in `badKeys`. */
  keys: string[];
  badKeys: string[];
  lastValue: string;
}

/**
 * Steps every day of one preset inside the page: set the value, send `input`, wait one frame
 * (a rAF callback posts to a MessageChannel, so ResizeObserver callbacks, which run after the
 * frame's rAF callbacks, have run before the next task measures), then measure and compare.
 */
const daySweep = (
  page: Page,
  slider: ElementHandle<HTMLInputElement>,
  id: string,
  first: Box[],
): Promise<SweepResult> =>
  page.evaluate(
    async ({ input, id, first, epsilon, names }) => {
      const measure = (window as unknown as PageWithMeasure).__measure;
      const frame = () =>
        new Promise<void>((done) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => {
            channel.port1.close();
            done();
          };
          requestAnimationFrame(() => channel.port2.postMessage(0));
        });
      const moved: string[] = [];
      const badKeys: string[] = [];
      const firstKeys = first.map((b) => b.key).join("|");
      let keys: string[] = [];
      for (let day = 1; day <= 366; day += 1) {
        input.value = String(day);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await frame();
        const now = measure(names);
        const label = `${id} day ${day}`;
        keys = now.map((b) => b.key);
        if (keys.join("|") !== firstKeys) {
          badKeys.push(label);
          continue;
        }
        now.forEach((b, i) => {
          const was = first[i]!;
          if (
            Math.abs(b.width - was.width) > epsilon ||
            Math.abs(b.height - was.height) > epsilon
          ) {
            moved.push(
              `${label} ${b.key}: ${was.width}x${was.height} -> ${b.width}x${b.height}`,
            );
          }
        });
      }
      return { moved, keys, badKeys, lastValue: input.value };
    },
    { input: slider, id, first, epsilon: EPSILON, names: GATES },
  );

describe.concurrent.each(ENGINES)(
  "Code B Day Ruler holds in %s",
  (_name, type) => {
    let browser: Browser | undefined;

    beforeAll(async () => {
      if (dist !== null) browser = await type.launch();
    });
    afterAll(async () => {
      await browser?.close();
    });

    const url = () =>
      `http://127.0.0.1:${(server!.address() as AddressInfo).port}/gmt/tools/code-b-day-ruler/`;

    function compare(
      expect: ExpectStatic,
      first: Box[],
      now: Box[],
      label: string,
      moved: string[],
    ): void {
      expect(
        now.map((b) => b.key),
        `boxes at ${label}`,
      ).toEqual(first.map((b) => b.key));
      now.forEach((b, i) => {
        const was = first[i]!;
        if (
          Math.abs(b.width - was.width) > EPSILON ||
          Math.abs(b.height - was.height) > EPSILON
        ) {
          moved.push(
            `${label} ${b.key}: ${was.width}x${was.height} -> ${b.width}x${b.height}`,
          );
        }
      });
    }

    async function sweep(
      expect: ExpectStatic,
      width: number,
      theme: (typeof THEMES)[number],
    ) {
      if (browser === undefined || server === undefined) return;
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        colorScheme: theme,
      });
      try {
        await page.goto(url());
        const select = page.getByRole("combobox", {
          name: "Preset",
          exact: true,
        });
        await select.waitFor({ state: "visible" });
        await entered(page);
        await installMeasure(page);
        const slider = page.getByRole("slider", { name: "Day of year" });
        const sliderHandle =
          (await slider.elementHandle()) as ElementHandle<HTMLInputElement>;
        const moved: string[] = [];

        for (const id of PRESETS) {
          await select.selectOption(id);
          await entered(page);
          await settle(page);
          const first = await boxes(page);
          expect(first.length).toBeGreaterThan(6);

          // Every day from 1 to 366, stepped by the slider's `input` event in the page.
          const swept = await daySweep(page, sliderHandle, id, first);
          expect(swept.badKeys, `${id}: days whose boxes differ`).toEqual([]);
          expect(swept.keys).toEqual(first.map((b) => b.key));
          const min = Number(await slider.getAttribute("min"));
          const max = Number(await slider.getAttribute("max"));
          expect(swept.lastValue).toBe(String(max));
          moved.push(...swept.moved);

          // The real keys still drive the same handler.
          const pressed = async (key: string, value: number) => {
            await page.keyboard.press(key);
            await settle(page);
            expect(
              Number(await slider.inputValue()),
              `${id} after ${key}`,
            ).toBe(value);
            compare(
              expect,
              first,
              await boxes(page),
              `${id} key ${key}`,
              moved,
            );
          };
          await slider.focus();
          await pressed("Home", min);
          await pressed("ArrowRight", min + 1);
          await pressed("ArrowRight", min + 2);
          await pressed("End", max);

          // Pointer: drag to both ends and back to the middle.
          const track = await slider.boundingBox();
          if (track !== null) {
            const y = track.y + track.height / 2;
            await page.mouse.move(track.x + 2, y);
            await page.mouse.down();
            for (const t of [0.25, 0.5, 0.75, 0.98, 0.5, 0.02]) {
              await page.mouse.move(track.x + track.width * t, y);
              await settle(page);
              compare(
                expect,
                first,
                await boxes(page),
                `${id} drag ${t}`,
                moved,
              );
            }
            await page.mouse.up();
          }
        }
        expect(moved).toEqual([]);

        if (width >= 1280) {
          const edges = await page.evaluate(() => {
            const heroes = [
              ...document.querySelectorAll<HTMLElement>(
                "[data-widget='code-b-day-ruler'] [data-gate~='hero']",
              ),
            ].map((e) => e.getBoundingClientRect());
            const row = document
              .querySelector(
                "[data-widget='code-b-day-ruler'] [data-gate~='hero']",
              )
              ?.parentElement?.getBoundingClientRect();
            return { heroes, row };
          });
          expect(edges.heroes).toHaveLength(2);
          expect(
            Math.abs(edges.heroes[0]!.left - edges.row!.left),
          ).toBeLessThanOrEqual(EPSILON);
          expect(
            Math.abs(edges.heroes[1]!.right - edges.row!.right),
          ).toBeLessThanOrEqual(EPSILON);
        }
      } finally {
        await page.close();
      }
    }

    for (const theme of THEMES) {
      it.for(WIDTHS)(
        `keeps every box through the day at %i px in ${theme}`,
        { timeout: 300_000 },
        (width, { expect }) => sweep(expect, width, theme),
      );
    }
  },
);
