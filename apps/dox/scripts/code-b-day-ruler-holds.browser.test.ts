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
 * The Code B Day Ruler keeps its boxes still while the day moves. For every preset, a keyboard
 * sweep over days 1 to 366 and a pointer drag there and back, at 300, 390, 1280 and 1440 px and
 * in both themes, each readout card, hold, the comparison line and both lanes keep their width and
 * height to within 0.5 px of what they were at the start. At 1280 px the two cards' outer edges
 * are the row's edges. Firefox is left to CI.
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

const boxes = (page: Page): Promise<Box[]> =>
  page.evaluate((names) => {
    const root = document.querySelector("[data-widget='code-b-day-ruler']");
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
    // The comparison line is a status region with no gate of its own.
    const line = root.querySelector<HTMLElement>("[role='status']");
    if (line !== null) {
      const r = line.getBoundingClientRect();
      out.push({ key: "line", width: r.width, height: r.height });
    }
    return out;
  }, GATES);

describe.each(ENGINES)("Code B Day Ruler holds in %s", (_name, type) => {
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

  async function sweep(width: number, theme: (typeof THEMES)[number]) {
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
      const slider = page.getByRole("slider", { name: "Day of year" });
      const moved: string[] = [];

      for (const id of PRESETS) {
        await select.selectOption(id);
        await entered(page);
        await settle(page);
        const first = await boxes(page);
        expect(first.length).toBeGreaterThan(6);

        // Keyboard: every day from 1 to 366.
        await slider.focus();
        await page.keyboard.press("Home");
        for (let day = 1; day <= 366; day += 1) {
          await settle(page);
          compare(first, await boxes(page), `${id} key day ${day}`, moved);
          if (day < 366) await page.keyboard.press("ArrowRight");
        }

        // Pointer: drag to both ends and back to the middle.
        const track = await slider.boundingBox();
        if (track !== null) {
          const y = track.y + track.height / 2;
          await page.mouse.move(track.x + 2, y);
          await page.mouse.down();
          for (const t of [0.25, 0.5, 0.75, 0.98, 0.5, 0.02]) {
            await page.mouse.move(track.x + track.width * t, y);
            await settle(page);
            compare(first, await boxes(page), `${id} drag ${t}`, moved);
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
    it.each(WIDTHS)(
      `keeps every box through the day at %i px in ${theme}`,
      (width) => sweep(width, theme),
      300_000,
    );
  }
});
