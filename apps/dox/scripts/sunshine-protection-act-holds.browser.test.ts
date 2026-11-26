import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { type Browser, type Page } from "@playwright/test";
import { STATES as STATES_DATA } from "../src/data/sunshine-protection-act-proposals";
import stateNames from "../src/lib/us-state-names.json";
import { computeSunshineActZones } from "../worker/sunshine-protection-act";
import { launchBrowser } from "./lib/browser-launch.mjs";
import { distDirOrSkip } from "./dist-dir";
import { serveStatic } from "./lib/static-server.mjs";

/**
 * The Sunshine Protection Act page holds still. Pinning a zone or a state, switching between Today
 * and Proposals and the Worker's answer arriving must not move the pin panel, the legend, the list
 * card or the map's frame by more than 0.5 px, in either view, at 375 px, 1024 px (the cards
 * stacked) and 1440 px (the map, the list and the clocks in one row). It also reads the layout the
 * owner asked for, as the Canada and Morocco checkers have it: the map is drawn at every width, its
 * frame wider than it is tall; from 62rem of checker the map card, the list and Today's live clocks
 * share one row of one height, with the pin panel across the full width under them; the view
 * switch sits in the map card's heading; each clock's time and offset share a line; and no two
 * shown map labels meet.
 */

const dist = distDirOrSkip();
const EPSILON = 0.5;
const WIDTHS = [375, 1024, 1440];
/** The engines the CI browser job installs; Firefox runs in the weekly sweep, not here. */
const ENGINES: ["chromium" | "webkit"][] = [["chromium"], ["webkit"]];
/** What must hold: the section, the map's frame, the list card, the pin panel and its cells, the legend. */
const HELD =
  "[data-gate~='us-section'], [data-gate~='map-frame'], [data-gate~='pickcard'], [data-gate~='us-pin'], [data-gate~='us-pin-cell'], ul[aria-label='Map classes']";

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

/**
 * The places pinned in the view that is showing, by their accessible names: a shape and its marker
 * are one place.
 */
const pinnedNames = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const root = document.querySelector(
      "[data-widget='sunshine-protection-act']",
    )!;
    const byId = new Map<string, string>();
    for (const el of root.querySelectorAll<HTMLElement | SVGElement>(
      "[aria-pressed='true'][data-feature-id]",
    )) {
      if (el.closest("[hidden]") !== null || el.getClientRects().length === 0)
        continue;
      const id = el.dataset["featureId"] ?? "";
      if (!byId.has(id))
        byId.set(
          id,
          el.getAttribute("aria-label") ?? (el as HTMLElement).innerText,
        );
    }
    return [...byId.values()];
  });

/** Waits for the view that is showing to have drawn its frames, so its boundary file has arrived. */
const drawn = (page: Page) =>
  page.waitForFunction(
    () =>
      [...document.querySelectorAll("path[data-frame-ids]")].filter(
        (el) => el.closest("[hidden]") === null,
      ).length === 5,
  );

interface Box {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Every held box of the view that is showing, by its position among them. */
const snapshot = (page: Page): Promise<Box[]> =>
  page.evaluate((selector) => {
    const root = document.querySelector(
      "[data-widget='sunshine-protection-act']",
    );
    if (root === null) throw new Error("the widget is not on the page");
    const boxes: Box[] = [];
    let i = 0;
    // Positions are the box's offset from the view's own section, so a page scroll (a press scrolls
    // its button into view) is not a move.
    let origin: DOMRect | null = null;
    for (const el of root.querySelectorAll<HTMLElement>(selector)) {
      if (el.closest("[hidden]") !== null) continue;
      const r = el.getBoundingClientRect();
      // A box that is not drawn holds nothing.
      if (r.width === 0 && r.height === 0) continue;
      origin ??= r;
      boxes.push({
        key: `${i++}`,
        left: r.left - origin.left,
        top: r.top - origin.top,
        width: r.width,
        height: r.height,
      });
    }
    return boxes;
  }, HELD);

function expectHeld(first: Box[], later: Box[], label: string) {
  expect(later.length, label).toBe(first.length);
  first.forEach((box, i) => {
    const now = later[i]!;
    for (const side of ["left", "top", "width", "height"] as const)
      expect(
        Math.abs(now[side] - box[side]),
        `${label}: box ${i} ${side}`,
      ).toBeLessThanOrEqual(EPSILON);
  });
}

describe.each(ENGINES)("Sunshine Protection Act holds in %s", (name) => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (dist !== null) browser = (await launchBrowser(name)) as Browser;
  });
  afterAll(async () => {
    await browser?.close();
  });

  it.each([900, 800])(
    "spans the full width of the section at 1440 x %i",
    async (height) => {
      if (browser === undefined || server === undefined) return;
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
      const page = await browser.newPage({ viewport: { width: 1440, height } });
      try {
        await page.goto(`${base}/check/us-sunshine-protection-act/`);
        await settle(page);
        const widths = await page.evaluate(() => {
          const width = (selector: string) =>
            document
              .querySelector<HTMLElement>(
                `[data-widget='sunshine-protection-act'] ${selector}`,
              )!
              .getBoundingClientRect().width;
          return {
            frame: width("[data-gate~='map-frame']"),
            stage: width("[data-gate~='map-block']"),
          };
        });
        // The frame fills its block, less the block's own padding and border.
        expect(widths.frame).toBeGreaterThan(widths.stage - 48);
      } finally {
        await page.close();
      }
    },
    60_000,
  );

  it.each([900, 800])(
    "lays the map, the list and the clocks in one row over a full-width pin panel, the switch in the map card, and pins from the keyboard on the map in both views at 1440 x %i",
    async (height) => {
      if (browser === undefined || server === undefined) return;
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
      const page = await browser.newPage({ viewport: { width: 1440, height } });
      try {
        await page.goto(`${base}/check/us-sunshine-protection-act/`);
        await settle(page);
        for (const [index, view] of ["Today", "Proposals"].entries()) {
          const radio = page.getByRole("radio", { name: view });
          if (index === 1) {
            await radio.click();
            await settle(page);
          }
          await drawn(page);
          const layout = await page.evaluate(() => {
            const root = document.querySelector(
              "[data-widget='sunshine-protection-act']",
            )!;
            const shown = (selector: string) =>
              [...root.querySelectorAll<HTMLElement>(selector)].find(
                (el) => el.closest("[hidden]") === null,
              )!;
            const map = shown("[data-gate~='map-frame']");
            const block = map.closest<HTMLElement>("[data-gate~='map-block']")!;
            const drawing = map.getBoundingClientRect();
            const section = shown(
              "[data-gate~='us-section']",
            ).getBoundingClientRect();
            const pin = shown("[data-gate~='us-pin']").getBoundingClientRect();
            const stage = shown(
              "[data-gate~='map-stage']",
            ).getBoundingClientRect();
            const list = shown(
              "[data-gate~='pickcard']",
            ).getBoundingClientRect();
            // Today's third column: the live clocks' card, the section's child that holds them.
            const clocks = shown("[data-gate~='clock']")
              ?.closest("[data-gate~='us-section'] > *")
              ?.getBoundingClientRect();
            const sameRow = (r: DOMRect) =>
              Math.abs(r.top - stage.top) <= 1 &&
              Math.abs(r.height - stage.height) <= 1;
            return {
              row:
                sameRow(list) &&
                list.left >= stage.right &&
                (clocks === undefined ||
                  (sameRow(clocks) && clocks.left >= list.right)),
              hasClocks: clocks !== undefined,
              under: pin.top >= stage.bottom,
              fullWidth: Math.abs(pin.width - section.width) <= 1,
              switchInCard:
                shown("[data-role='view-switch']")?.closest(
                  "[data-gate~='map-block']",
                ) !== null,
              map: drawing.width,
              block: block.getBoundingClientRect().width,
            };
          });
          expect(layout.row, `${view}: map, list and clocks share a row`).toBe(
            true,
          );
          expect(layout.hasClocks, `${view}: the live clocks`).toBe(
            view === "Today",
          );
          expect(layout.under, `${view}: the panel is under the row`).toBe(
            true,
          );
          expect(layout.fullWidth, `${view}: the panel spans the row`).toBe(
            true,
          );
          expect(
            layout.switchInCard,
            `${view}: the switch is in the map card`,
          ).toBe(true);
          expect(
            Math.abs(layout.map - layout.block),
            `${view} drawing width`,
          ).toBeLessThanOrEqual(2);
          // Keyboard only: Tab from the view switch reaches the map once, an arrow moves, Enter pins.
          await radio.focus();
          let onShape = false;
          for (let i = 0; i < 6 && !onShape; i++) {
            await page.keyboard.press("Tab");
            onShape = await page.evaluate(
              () =>
                document.activeElement?.closest("[data-gate~='map-frame']") !==
                  null &&
                document.activeElement?.hasAttribute("data-feature-id") ===
                  true,
            );
          }
          expect(onShape, `${view}: Tab reaches the map`).toBe(true);
          await page.keyboard.press("ArrowRight");
          const target = await page.evaluate(
            () => document.activeElement?.getAttribute("aria-label") ?? "",
          );
          await page.keyboard.press("Enter");
          await settle(page);
          expect(await pinnedNames(page), `${view}: Enter pins`).toEqual([
            target,
          ]);
          // The next Tab leaves the map: its shapes are one stop, not dozens.
          await page.keyboard.press("Tab");
          expect(
            await page.evaluate(
              () =>
                document.activeElement?.hasAttribute("data-feature-id") ??
                false,
            ),
            `${view}: one Tab leaves the map`,
          ).toBe(false);
        }
      } finally {
        await page.close();
      }
    },
    60_000,
  );

  it("shows the list as the path when the boundary file fails at 1440", async () => {
    if (browser === undefined || server === undefined) return;
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    try {
      await page.route("**/*-boundaries-us.json", (route) =>
        route.fulfill({ status: 404, body: "" }),
      );
      await page.goto(`${base}/check/us-sunshine-protection-act/`);
      const list = page.getByRole("region", {
        name: "US time zones, scrollable list",
      });
      await list.waitFor({ state: "visible" });
      const row = list.getByRole("button", { name: /Phoenix/ });
      await row.click({ timeout: 5000 });
      await settle(page);
      expect(await row.getAttribute("aria-pressed")).toBe("true");
    } finally {
      await page.close();
    }
  }, 60_000);

  it("keeps the list as a path at 1440 while the boundary file loads, and for Midway and Wake once it is drawn", async () => {
    if (browser === undefined || server === undefined) return;
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    try {
      // Hold the boundary file back, as a stalled fetch would, until the list has been used.
      let release = () => {};
      const held = new Promise<void>((done) => (release = done));
      await page.route("**/*-boundaries-us.json", async (route) => {
        await held;
        await route.continue();
      });
      await page.goto(`${base}/check/us-sunshine-protection-act/`);
      const list = page.getByRole("region", {
        name: "US time zones, scrollable list",
      });
      await list.waitFor({ state: "visible" });
      const phoenix = list.getByRole("button", { name: /Phoenix/ });
      await phoenix.click({ timeout: 5000 });
      await settle(page);
      expect(await phoenix.getAttribute("aria-pressed")).toBe("true");
      // Midway and Wake have no shape in the boundary file: the list is their only path.
      release();
      await drawn(page);
      for (const place of [/Midway/, /Wake/]) {
        const row = list.getByRole("button", { name: place });
        await row.click({ timeout: 5000 });
        await settle(page);
        expect(await row.getAttribute("aria-pressed")).toBe("true");
      }
    } finally {
      await page.close();
    }
  }, 60_000);

  /** The mean colour of a 9 x 9 square at a point of the page, read from a screenshot. */
  const colourAt = async (
    page: Page,
    x: number,
    y: number,
  ): Promise<[number, number, number]> => {
    // The drawing fades in on arrival and on a view change: read it at rest.
    await page.waitForFunction(() => document.getAnimations().length === 0);
    const png = await page.screenshot({
      clip: { x: x - 4, y: y - 4, width: 9, height: 9 },
    });
    return page.evaluate(async (b64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${b64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const sum = [0, 0, 0];
      for (let i = 0; i < data.length; i += 4)
        for (const c of [0, 1, 2]) sum[c]! += data[i + c]!;
      const n = data.length / 4;
      return sum.map((v) => v / n) as [number, number, number];
    }, png.toString("base64"));
  };

  /** A point inside a shape of the view that is showing, scrolled into view. */
  const centreOf = (page: Page, id: string) =>
    page.evaluate((featureId) => {
      const shape = [
        ...document.querySelectorAll<SVGGraphicsElement>(
          "[data-widget='sunshine-protection-act'] path[data-feature-id]",
        ),
      ].find(
        (el) =>
          el.dataset["featureId"] === featureId &&
          el.closest("[hidden]") === null,
      )!;
      shape.scrollIntoView({ block: "center" });
      const r = shape.getBoundingClientRect();
      // The middle of the box can be sea (islands) or under the place's label, so take the point
      // of the land nearest the middle whose 9 x 9 square around it is all this shape's fill and
      // clear of every label.
      const labels = [
        ...document.querySelectorAll<HTMLElement>(
          "[data-widget='sunshine-protection-act'] [data-label-for]",
        ),
      ]
        .filter((l) => l.closest("[hidden]") === null)
        .map((l) => l.getBoundingClientRect());
      const toShape = shape.getScreenCTM()!.inverse();
      const geometry = shape as unknown as SVGGeometryElement;
      const land = (x: number, y: number) =>
        geometry.isPointInFill(new DOMPoint(x, y).matrixTransform(toShape));
      const clear = (x: number, y: number, m: number) =>
        [
          [0, 0],
          [-m, -m],
          [m, -m],
          [-m, m],
          [m, m],
        ].every(([dx, dy]) => land(x + dx!, y + dy!)) &&
        labels.every(
          (l) =>
            x + m < l.left ||
            x - m > l.right ||
            y + m < l.top ||
            y - m > l.bottom,
        );
      const mid = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      for (const margin of [6, 2]) {
        const points: { x: number; y: number }[] = [];
        for (let y = r.top; y <= r.bottom; y += 2)
          for (let x = r.left; x <= r.right; x += 2)
            if (clear(x, y, margin)) points.push({ x, y });
        const d = (p: { x: number; y: number }) =>
          (p.x - mid.x) ** 2 + (p.y - mid.y) ** 2;
        const best = points.sort((a, b) => d(a) - d(b))[0];
        if (best !== undefined) return best;
      }
      return mid;
    }, id);

  it("paints the classes as flat fills in Canada's colours, never black and never a pattern, in both views", async () => {
    if (browser === undefined || server === undefined) return;
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
    });
    try {
      await page.route("**/api/sunshine-protection-act", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "cache-control": "no-store" },
          body: JSON.stringify(computeSunshineActZones("2026-11-13T12:00:00Z")),
        }),
      );
      await page.goto(`${base}/check/us-sunshine-protection-act/`);
      await page.getByText("Checking\u2026").waitFor({ state: "hidden" });
      await settle(page);
      await drawn(page);
      // Flat fills only: no shape is painted with a pattern. The svg carries the forced-colours
      // marks, which only a forced palette puts on a shape.
      expect(
        await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              "[data-widget='sunshine-protection-act'] path[data-feature-id]",
            ),
          ]
            .map((el) => getComputedStyle(el).fill)
            .filter((fill) => fill.startsWith("url(")),
        ),
      ).toEqual([]);
      // Gold is warm (red and green over blue), cyan is Canada's teal: blue and green over red,
      // in either order. Purple is blue and red over green. The fills are translucent over the
      // dark sea, so the margins are small.
      const gold = ([r, g, b]: number[]) => g! > b! + 8 && r! > b! + 3;
      const cyan = ([r, g, b]: number[]) => b! > r! + 20 && g! > r! + 20;
      const purple = ([r, g, b]: number[]) => b! > g! + 15 && r! > g!;
      const notBlack = ([r, g, b]: number[]) => Math.max(r!, g!, b!) > 30;
      const sum = (c: number[]) => c[0]! + c[1]! + c[2]!;
      const read = async (id: string) => {
        const at = await centreOf(page, id);
        return colourAt(page, at.x, at.y);
      };
      // Today: a zone that changes is gold; Arizona's zone, which never changes, is cyan.
      const chicago = await read("America/Chicago");
      expect(gold(chicago), `chicago ${JSON.stringify(chicago)}`).toBe(true);
      const phoenix = await read("America/Phoenix");
      expect(cyan(phoenix), `phoenix ${JSON.stringify(phoenix)}`).toBe(true);
      expect(notBlack(phoenix)).toBe(true);
      // Proposals, by the colours of the legend's swatches: a state of each class, away from the
      // scattered islands whose box middle lies in the sea.
      await page.getByRole("radio", { name: "Proposals" }).click();
      await settle(page);
      await drawn(page);
      const largest = (kind: string) =>
        page.evaluate((wanted) => {
          const shapes = [
            ...document.querySelectorAll<SVGGraphicsElement>(
              "[data-widget='sunshine-protection-act'] path[data-feature-id]",
            ),
          ].filter(
            (el) =>
              el.closest("[hidden]") === null &&
              el.dataset["kind"] === wanted &&
              !["AK", "HI", "PR", "VI", "GU", "MP", "AS"].includes(
                el.dataset["featureId"]!,
              ),
          );
          const area = (el: Element) => {
            const r = el.getBoundingClientRect();
            return r.width * r.height;
          };
          const best = shapes.sort((a, b) => area(b) - area(a))[0]!;
          best.scrollIntoView({ block: "center" });
          const r = best.getBoundingClientRect();
          return {
            id: best.dataset["featureId"],
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
          };
        }, kind);
      const sample = async (kind: string) => {
        const at = await largest(kind);
        return { id: at.id, colour: await colourAt(page, at.x, at.y) };
      };
      const solidPurple = await sample("daylight-if-allowed");
      const softPurple = await sample("daylight-conditional");
      const solidCyan = await sample("standard-all-year");
      const softCyan = await sample("standard-proposed");
      const noPosition = await sample("no-position");
      expect(purple(solidPurple.colour), solidPurple.id).toBe(true);
      expect(purple(softPurple.colour), softPurple.id).toBe(true);
      expect(cyan(solidCyan.colour), solidCyan.id).toBe(true);
      expect(cyan(softCyan.colour), softCyan.id).toBe(true);
      expect(gold(noPosition.colour), noPosition.id).toBe(true);
      // A conditional or merely proposed position is the lighter step, so it is dimmer than its
      // firm one, and neither is black.
      expect(sum(softPurple.colour)).toBeLessThan(sum(solidPurple.colour) - 20);
      expect(sum(softCyan.colour)).toBeLessThan(sum(solidCyan.colour) - 4);
      for (const c of [
        solidPurple,
        softPurple,
        solidCyan,
        softCyan,
        noPosition,
      ])
        expect(notBlack(c.colour), `${c.id} is not black`).toBe(true);
    } finally {
      await page.close();
    }
  }, 60_000);

  it("draws no box round a shape after a real click", async () => {
    if (browser === undefined || server === undefined) return;
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    try {
      await page.goto(`${base}/check/us-sunshine-protection-act/`);
      await settle(page);
      for (const [view, id] of [
        ["Today", "America/Phoenix"],
        ["Proposals", "AZ"],
      ] as const) {
        if (view === "Proposals") {
          await page.getByRole("radio", { name: "Proposals" }).click();
          await settle(page);
        }
        await drawn(page);
        const at = await centreOf(page, id);
        await page.mouse.click(at.x, at.y);
        await settle(page);
        // The browser's focus ring on the clicked shape is the dark rectangle round its box.
        const outline = await page.evaluate(() => {
          const style = getComputedStyle(document.activeElement!);
          return style.outlineWidth;
        });
        expect(outline, `${view}: the clicked shape has no outline`).toBe(
          "0px",
        );
      }
    } finally {
      await page.close();
    }
  }, 60_000);

  it("leaves nothing of the hidden view on screen or under the pointer", async () => {
    if (browser === undefined || server === undefined) return;
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    try {
      await page.route("**/api/sunshine-protection-act", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "cache-control": "no-store" },
          body: JSON.stringify(computeSunshineActZones("2026-11-13T12:00:00Z")),
        }),
      );
      await page.goto(`${base}/check/us-sunshine-protection-act/`);
      await page.getByText("Checking…").waitFor({ state: "hidden" });
      await settle(page);
      // A pin in Proposals (its ring and its inset frame are what showed through), then Today.
      await page.getByRole("radio", { name: "Proposals" }).click();
      await settle(page);
      await drawn(page);
      for (const id of ["TX", "HI"]) {
        const at = await centreOf(page, id);
        await page.mouse.click(at.x, at.y);
        await settle(page);
      }
      await page.getByRole("radio", { name: "Today" }).click();
      await settle(page);
      await drawn(page);
      const leaks = await page.evaluate(() => {
        const root = document.querySelector(
          "[data-widget='sunshine-protection-act']",
        )!;
        // Laid out (a `display: none` legend row has no box) and not hidden.
        const shown = [...root.querySelectorAll("[hidden] *")]
          .filter(
            (el) =>
              el.getClientRects().length > 0 &&
              getComputedStyle(el).visibility !== "hidden",
          )
          .map((el) => el.outerHTML.slice(0, 80));
        // Every inset frame of Today, pressed at its centre and at a corner, is Today's to answer.
        const caught: string[] = [];
        for (const frame of root.querySelectorAll<SVGPathElement>(
          "path[data-frame-ids]",
        )) {
          if (frame.closest("[hidden]") !== null) continue;
          frame.scrollIntoView({ block: "center" });
          const r = frame.getBoundingClientRect();
          for (const [x, y] of [
            [r.left + r.width / 2, r.top + r.height / 2],
            [r.right - 9, r.bottom - 9],
          ] as const) {
            const hit = document.elementFromPoint(x, y);
            if (hit?.closest("[hidden]"))
              caught.push(hit.outerHTML.slice(0, 80));
          }
        }
        return { shown, caught };
      });
      expect(leaks.shown, "drawn from the hidden view").toEqual([]);
      expect(leaks.caught, "presses the hidden view catches").toEqual([]);
      // And a press on Honolulu pins Honolulu.
      const at = await centreOf(page, "Pacific/Honolulu");
      await page.mouse.click(at.x, at.y);
      await settle(page);
      expect(await pinnedNames(page)).toEqual([
        expect.stringMatching(/Honolulu/),
      ]);
    } finally {
      await page.close();
    }
  }, 60_000);

  const INSETS = [
    {
      name: "Alaska",
      today: /Anchorage|Juneau|Sitka|Metlakatla|Yakutat|Nome|Adak/,
      proposals: /Alaska/,
    },
    { name: "Hawaii", today: /Honolulu/, proposals: /Hawaii/ },
    {
      name: "Puerto Rico",
      today: /Puerto|Thomas/,
      proposals: /Puerto Rico|Virgin/,
    },
    { name: "Guam", today: /Guam|Saipan/, proposals: /Guam|Northern Mariana/ },
    { name: "American Samoa", today: /Pago/, proposals: /Samoa/ },
  ];

  it("pins an inset's region from a press anywhere in its frame, in both views", async () => {
    if (browser === undefined || server === undefined) return;
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    try {
      await page.goto(`${base}/check/us-sunshine-protection-act/`);
      await settle(page);
      const views = [{ key: "today" as const }, { key: "proposals" as const }];
      for (const [index, view] of views.entries()) {
        if (index === 1) {
          await page.getByRole("radio", { name: "Proposals" }).click();
          await settle(page);
        }
        await drawn(page);
        const frames = await page.evaluate(() => {
          const root = document.querySelector(
            "[data-widget='sunshine-protection-act']",
          )!;
          return [
            ...root.querySelectorAll<SVGPathElement>("path[data-frame-ids]"),
          ]
            .filter((el) => el.closest("[hidden]") === null)
            .map((el) => {
              el.scrollIntoView({ block: "center" });
              const r = el.getBoundingClientRect();
              return {
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height,
                tabindex: el.getAttribute("tabindex"),
                hidden: el.getAttribute("aria-hidden"),
              };
            });
        });
        expect(frames.length, `${view.key} insets`).toBe(INSETS.length);
        // Reading order of the insets is the projection's: match each frame by its pinned row.
        const seen = new Set<string>();
        for (const frame of frames) {
          // No tab stop and nothing for a screen reader: a pointer convenience only.
          expect(frame.tabindex).toBeNull();
          expect(frame.hidden).toBe("true");
          await page.evaluate(() => window.scrollTo(0, 0));
          const box = await page.evaluate(
            ([i]) => {
              const root = document.querySelector(
                "[data-widget='sunshine-protection-act']",
              )!;
              const el = [
                ...root.querySelectorAll<SVGPathElement>(
                  "path[data-frame-ids]",
                ),
              ].filter((e) => e.closest("[hidden]") === null)[i as number]!;
              el.scrollIntoView({ block: "center" });
              const r = el.getBoundingClientRect();
              return { x: r.right - 9, y: r.bottom - 9 };
            },
            [frames.indexOf(frame)],
          );
          await page.mouse.click(box.x, box.y);
          await settle(page);
          const pressed = await pinnedNames(page);
          expect(
            pressed.length,
            `${view.key} frame ${frames.indexOf(frame)} pins`,
          ).toBe(1);
          const which = INSETS.find((inset) =>
            inset[view.key].test(pressed[0]!),
          );
          expect(
            which,
            `${view.key}: ${pressed[0]} is an inset's place`,
          ).toBeDefined();
          seen.add(which!.name);
          // The frame lights up in the pin's green.
          const lit = await page.evaluate(() => {
            const root = document.querySelector(
              "[data-widget='sunshine-protection-act']",
            )!;
            const visible = (el: Element) => el.closest("[hidden]") === null;
            const frame = [
              ...root.querySelectorAll<SVGPathElement>(
                "path[data-frame-ids][data-pinned='true']",
              ),
            ].filter(visible);
            const inks = [
              ...root.querySelectorAll<SVGPathElement>(
                "[data-ring='pin'] path:last-child",
              ),
            ].filter(visible);
            return {
              count: frame.length,
              stroke: frame[0] ? getComputedStyle(frame[0]).stroke : "",
              ink: inks[0] ? getComputedStyle(inks[0]).stroke : "none",
            };
          });
          expect(lit.count, "one frame lit").toBe(1);
          expect(lit.stroke).toBe(lit.ink);
        }
        expect([...seen].sort(), `${view.key} insets reached`).toEqual(
          INSETS.map((inset) => inset.name).sort(),
        );
      }
    } finally {
      await page.close();
    }
  }, 90_000);

  it("makes the insets big: their land fills their cards, and the cards span the map", async () => {
    if (browser === undefined || server === undefined) return;
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    try {
      await page.goto(`${base}/check/us-sunshine-protection-act/`);
      await settle(page);
      for (const view of ["Today", "Proposals"]) {
        if (view === "Proposals") {
          await page.getByRole("radio", { name: "Proposals" }).click();
          await settle(page);
        }
        await drawn(page);
        // The drawing fades in on arrival: measure it at rest.
        await page.waitForFunction(() => document.getAnimations().length === 0);
        const measured = await page.evaluate(() => {
          const root = document.querySelector(
            "[data-widget='sunshine-protection-act']",
          )!;
          const visible = (el: Element) => el.closest("[hidden]") === null;
          const frames = [
            ...root.querySelectorAll<SVGPathElement>("path[data-frame-ids]"),
          ].filter(visible);
          const map = [
            ...root.querySelectorAll<HTMLElement>("[data-gate~='map-frame']"),
          ].find(visible)!;
          const credits = map.querySelector<HTMLElement>(
            "button[popovertarget]",
          )!;
          const boxes = frames.map((el) => {
            const r = el.getBoundingClientRect();
            const ids = el.getAttribute("data-frame-ids")!.split(" ");
            // The land: the shapes of this card's places, cut to the card.
            const shapes = [
              ...root.querySelectorAll<SVGGraphicsElement>(
                "path[data-feature-id]",
              ),
            ]
              .filter(
                (s) =>
                  visible(s) &&
                  ids.includes(s.getAttribute("data-feature-id")!),
              )
              .map((s) => s.getBoundingClientRect());
            // Each shown label of this card's places sits inside the card, whole: its text, not
            // the room the label reserves for its longest offset.
            const labels = [
              ...root.querySelectorAll<HTMLElement>("[data-label-for]"),
            ]
              .filter(
                (l) =>
                  visible(l) &&
                  getComputedStyle(l).visibility === "visible" &&
                  ids.includes(l.getAttribute("data-label-for")!),
              )
              .map((l) => {
                const parts = [...l.children].map((c) =>
                  c.getBoundingClientRect(),
                );
                return {
                  left: Math.min(...parts.map((r) => r.left)),
                  right: Math.max(...parts.map((r) => r.right)),
                  text: l.textContent!.trim(),
                };
              });
            const left = Math.min(...shapes.map((s) => s.left));
            const right = Math.max(...shapes.map((s) => s.right));
            const top = Math.min(...shapes.map((s) => s.top));
            const bottom = Math.max(...shapes.map((s) => s.bottom));
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              landW: Math.min(right, r.right) - Math.max(left, r.left),
              landH: Math.min(bottom, r.bottom) - Math.max(top, r.top),
              shapes: shapes.length,
              labels,
            };
          });
          const m = map
            .querySelector("svg[role='group']")!
            .getBoundingClientRect();
          const c = credits.getBoundingClientRect();
          const size = (el: Element | null | undefined) =>
            el ? Number.parseFloat(getComputedStyle(el).fontSize) : 0;
          const note = [...root.querySelectorAll("p")].find(
            (p) =>
              visible(p) &&
              p.textContent!.startsWith("Insets are not to scale"),
          );
          const legend = [
            ...root.querySelectorAll("ul[aria-label='Map classes']"),
          ].find(visible);
          return {
            boxes,
            noteSize: size(note),
            legendSize: size(legend?.querySelector("li")),
            map: { left: m.left, right: m.right, height: m.height },
            credits: {
              left: c.left,
              top: c.top,
              right: c.right,
              bottom: c.bottom,
            },
          };
        });
        expect(measured.boxes.length, `${view} cards`).toBe(5);
        expect(measured.noteSize, `${view} note is drawn`).toBeGreaterThan(0);
        expect(
          measured.noteSize,
          `${view} note is no larger than the legend`,
        ).toBeLessThanOrEqual(measured.legendSize);
        for (const [i, box] of measured.boxes.entries())
          for (const label of box.labels)
            expect(
              label.left >= box.left - 0.5 && label.right <= box.right + 0.5,
              `${view} card ${i} label "${label.text}" ${label.left}-${label.right} fits ${box.left}-${box.right}`,
            ).toBe(true);
        for (const [i, box] of measured.boxes.entries()) {
          expect(box.shapes, `${view} card ${i} has land`).toBeGreaterThan(0);
          // The land fills at least 40% of the card's width or height.
          expect(
            Math.max(
              box.landW / (box.right - box.left),
              box.landH / (box.bottom - box.top),
            ),
            `${view} card ${i} land share`,
          ).toBeGreaterThanOrEqual(0.4);
          const c = measured.credits;
          const overlaps =
            c.left < box.right &&
            c.right > box.left &&
            c.top < box.bottom &&
            c.bottom > box.top;
          expect(
            overlaps,
            `${view} card ${i} is clear of the credits button`,
          ).toBe(false);
        }
        // The strip spans the map, within its padding, with even gaps.
        const first = measured.boxes[0]!;
        const last = measured.boxes.at(-1)!;
        expect(first.left - measured.map.left, `${view} left`).toBeLessThan(24);
        expect(measured.map.right - last.right, `${view} right`).toBeLessThan(
          24,
        );
        const gaps = measured.boxes
          .slice(1)
          .map((b, i) => b.left - measured.boxes[i]!.right);
        for (const gap of gaps)
          expect(Math.abs(gap - gaps[0]!), `${view} gaps`).toBeLessThanOrEqual(
            1,
          );
        // Each card is a quarter of the drawing's height, at any width of the map.
        for (const b of measured.boxes)
          expect(
            (b.bottom - b.top) / measured.map.height,
            `${view} card height`,
          ).toBeGreaterThanOrEqual(0.25);
      }
    } finally {
      await page.close();
    }
  }, 60_000);

  it.each(WIDTHS)(
    "keeps its panels through pins, views and the answer at %i px",
    async (width) => {
      if (browser === undefined || server === undefined) return;
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      try {
        let release: () => void = () => {};
        const answer = new Promise<void>((done) => (release = done));
        await page.route("**/api/sunshine-protection-act", async (route) => {
          await answer;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "cache-control": "no-store" },
            body: JSON.stringify(
              computeSunshineActZones("2026-11-13T12:00:00Z"),
            ),
          });
        });
        await page.goto(`${base}/check/us-sunshine-protection-act/`);
        await settle(page);
        const first = await snapshot(page);

        // The answer arrives: nothing moves, and the status line had its room.
        release();
        await page.getByText("Checking…").waitFor({ state: "hidden" });
        await settle(page);
        expectHeld(first, await snapshot(page), "after the answer");

        // The panel holds its room from the first paint at every width. Narrow, the list under the
        // map is the easy tap path; wider, the map is, by its own keyboard path.
        const narrow = width < 520;
        const pinFrom = async (list: string, name: RegExp) => {
          if (narrow) {
            await page
              .getByRole("region", { name: list })
              .getByRole("button", { name })
              .click();
          } else {
            const shape = page
              .locator("[data-gate~='map-frame']")
              .getByRole("button", { name })
              .first();
            await shape.focus();
            await page.keyboard.press("Enter");
          }
          await settle(page);
        };
        const ZONES = "US time zones, scrollable list";
        const today = first;
        for (const name of [
          /Phoenix/,
          /New_York|New York/,
          /Honolulu/,
          /Anchorage/,
        ]) {
          await pinFrom(ZONES, name);
          expectHeld(today, await snapshot(page), `pin ${name}`);
        }

        // Every shown label's text keeps clear of every other's: a crowded one is hidden.
        const meet = await page.evaluate(() => {
          const boxes = [
            ...document.querySelectorAll<HTMLElement>("[data-label-for]"),
          ]
            .filter(
              (el) =>
                el.closest("[hidden]") === null &&
                getComputedStyle(el).visibility === "visible",
            )
            .map((el) => ({
              id: el.dataset["labelFor"],
              parts: [...el.children].map((c) => c.getBoundingClientRect()),
            }));
          const hit = (a: DOMRect, b: DOMRect) =>
            a.left < b.right &&
            b.left < a.right &&
            a.top < b.bottom &&
            b.top < a.bottom;
          const pairs: string[] = [];
          boxes.forEach((a, i) =>
            boxes.slice(i + 1).forEach((b) => {
              if (a.parts.some((p) => b.parts.some((q) => hit(p, q))))
                pairs.push(`${a.id} / ${b.id}`);
            }),
          );
          return pairs;
        });
        expect(meet, "labels that meet").toEqual([]);

        // Each live clock's time and offset share one line.
        const wrapped = await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              "[data-gate='clock-time']",
            ),
          ]
            .filter((el) => el.children.length === 2)
            .filter((el) => {
              const [hm, off] = [...el.children].map((c) =>
                c.getBoundingClientRect(),
              );
              return off!.top >= hm!.bottom - 1;
            })
            .map((el) => el.id),
        );
        expect(wrapped, "clocks whose offset wraps").toEqual([]);

        {
          // The owner's layout: a landscape frame at every width, the pin panel below it.
          const layout = await page.evaluate(() => {
            const rect = (selector: string) =>
              document
                .querySelector<HTMLElement>(
                  `[data-widget='sunshine-protection-act'] ${selector}`,
                )!
                .getBoundingClientRect();
            const frame = rect("[data-gate~='map-frame']");
            const pin = rect("[data-gate~='us-pin']");
            return {
              frameWide: frame.width > frame.height,
              ratio: frame.width / frame.height,
              pinBelow: pin.top >= frame.bottom - 1,
            };
          });
          expect(layout.frameWide).toBe(true);
          expect(layout.ratio).toBeGreaterThan(1.1);
          expect(layout.ratio).toBeLessThan(1.6);
          expect(layout.pinBelow).toBe(true);
        }

        // Switch to Proposals and pin states there: its own boxes hold across its own pins.
        await page.getByRole("radio", { name: "Proposals" }).click();
        await settle(page);
        const STATES = "US states and territories, scrollable list";
        // The state with the longest note too: its readout must fit the room the panel holds.
        const longest = STATES_DATA.reduce<{ postal: string; length: number }>(
          (best, row) =>
            "note" in row && row.note !== null && row.note.length > best.length
              ? { postal: row.postal, length: row.note.length }
              : best,
          { postal: "", length: 0 },
        );
        const longName = (stateNames as Record<string, string>)[
          longest.postal
        ]!;
        const states = [
          /Delaware/,
          /Idaho/,
          /Florida/,
          /Arizona/,
          new RegExp(longName),
        ];
        const proposals = await snapshot(page);
        for (const name of states) {
          await pinFrom(STATES, name);
          expectHeld(proposals, await snapshot(page), `pin ${name}`);
        }

        // Back to Today: the first view's boxes are where they were.
        await page.getByRole("radio", { name: "Today" }).click();
        await settle(page);
        expectHeld(today, await snapshot(page), "back on Today");
      } finally {
        await page.close();
      }
    },
    60_000,
  );

  // The age words grow with the date: "today", "1 day ago", and from the session's end a second
  // sentence. Each dated line holds room for its widest text from the first paint, so neither the
  // pin's "As of" nor the national card's "Last checked on" grows on any day.
  const DATES = [
    "2026-11-13T12:00:00Z",
    "2026-11-14T12:00:00Z",
    "2027-01-02T12:00:00Z",
    "2027-02-01T12:00:00Z",
    "2100-01-01T12:00:00Z",
  ];
  it.each(WIDTHS)(
    "holds its dated lines on any day at %i px",
    async (width) => {
      if (browser === undefined || server === undefined) return;
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
      const url = `${base}/check/us-sunshine-protection-act/`;
      const lineHeight = (page: Page) =>
        page.evaluate(
          () =>
            document
              .querySelector<HTMLElement>("[id$='national-age']")!
              .getBoundingClientRect().height,
        );
      // The server's markup, before any date is read.
      const still = await browser.newContext({
        viewport: { width, height: 1000 },
        javaScriptEnabled: false,
      });
      let markup: number;
      try {
        const page = await still.newPage();
        await page.goto(url);
        markup = await lineHeight(page);
      } finally {
        await still.close();
      }
      for (const date of DATES) {
        const page = await browser.newPage({
          viewport: { width, height: 1000 },
        });
        try {
          await page.clock.setFixedTime(date);
          await page.goto(url);
          await page
            .getByRole("radio", { name: "Proposals" })
            .click({ timeout: 10_000 });
          await settle(page);
          // The date has been read once the national card's line carries the age.
          await page.waitForFunction(() =>
            /,/.test(
              document.querySelector<HTMLElement>("[id$='national-age']")!
                .textContent ?? "",
            ),
          );
          expect(
            await lineHeight(page),
            `${date}: national card's line`,
          ).toBeCloseTo(markup, 0);
          const before = await snapshot(page);
          if (width < 520) {
            await page
              .getByRole("region", {
                name: "US states and territories, scrollable list",
              })
              .getByRole("button", { name: /Delaware/ })
              .click();
          } else {
            await drawn(page);
            const shape = page
              .locator("[data-gate~='map-frame']")
              .getByRole("button", { name: /Delaware/ })
              .first();
            await shape.focus();
            await page.keyboard.press("Enter");
          }
          await settle(page);
          expect(
            await page.locator("[id$='proposals-pin-asof']").textContent(),
          ).toMatch(/^13 November 2026, /);
          expectHeld(before, await snapshot(page), `${date}: pin Delaware`);
        } finally {
          await page.close();
        }
      }
    },
    120_000,
  );
});
