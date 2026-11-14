import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { type Browser, type Page } from "@playwright/test";
import { handleCanadaClockChange } from "../worker/canada-clock-change";
import { handleMoroccoClockChange } from "../worker/morocco-clock-change";
import { handleSunshineProtectionAct } from "../worker/sunshine-protection-act";
import { launchBrowser } from "./lib/browser-launch.mjs";
import { distDirOrSkip } from "./dist-dir";
import { serveStatic } from "./lib/static-server.mjs";

/**
 * Under forced colours the three clock-change maps still tell their classes apart. Each shape wears
 * its legend swatch's mark (solid, hatch or dots, or a sparser hatch or dots for the lighter steps)
 * in the system pair, and nothing in the map is painted outside the system colours: Chromium leaves
 * an svg fill or stroke as authored, so a shape kept its own colour and the land kept the dark
 * island's sea. Chromium alone emulates forced colours, so this runs there, in both system themes.
 */

const dist = distDirOrSkip();

type Mark =
  | "solid"
  | "hatch"
  | "hatch-sparse"
  | "dots"
  | "dots-sparse"
  | "canvas";

/** The mark each class wears, on the map and in its swatch. */
const MARK: Record<string, Mark> = {
  "changes-after": "solid",
  changes: "solid",
  "no-position": "solid",
  stopped: "hatch",
  "daylight-if-allowed": "hatch",
  "daylight-conditional": "hatch-sparse",
  none: "dots",
  "standard-all-year": "dots",
  "standard-proposed": "dots-sparse",
  "no-data": "canvas",
};

const PAGES: [string, string, string | null][] = [
  ["Canada", "/check/canada-2026-clock-change/", null],
  ["Morocco", "/check/morocco-2026-clock-change/", null],
  ["US Today", "/check/us-sunshine-protection-act/", null],
  ["US Proposals", "/check/us-sunshine-protection-act/", "Proposals"],
];

const SCHEMES: ["light" | "dark"][] = [["light"], ["dark"]];

let server: Server | undefined;
let browser: Browser | undefined;

beforeAll(async () => {
  if (dist === null) return;
  server = (await serveStatic(resolve(dist), 0)) as Server;
  browser = (await launchBrowser("chromium")) as Browser;
});

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((done) =>
    server ? server.close(() => done()) : done(),
  );
});

const SHAPE = "[class*='zone-map__shape'][data-kind]";
const NOW = () => "2026-11-13T12:00:00Z";

/** The checkers' Worker endpoints, answered by their own handlers: the static server has no Worker. */
const ENDPOINTS = {
  "canada-clock-change": handleCanadaClockChange,
  "morocco-clock-change": handleMoroccoClockChange,
  "sunshine-protection-act": handleSunshineProtectionAct,
};

async function answerChecks(page: Page) {
  for (const [name, handle] of Object.entries(ENDPOINTS))
    await page.route(`**/api/${name}`, async (route) => {
      const answer = await handle(
        new Request(route.request().url(), {
          headers: { "cf-connecting-ip": "127.0.0.1" },
        }),
        {},
        NOW,
      );
      await route.fulfill({
        status: answer.status,
        headers: Object.fromEntries(answer.headers),
        body: await answer.text(),
      });
    });
}

/** Scrolls until the map module has drawn its shapes: it draws when the map comes near the view. */
async function drawn(page: Page) {
  for (let i = 0; i < 40; i++) {
    if ((await page.locator(SHAPE).count()) > 0) return;
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(150);
  }
  await page.locator(SHAPE).first().waitFor({ state: "attached" });
}

/** The system colours where an element is drawn, by name. */
type System = Record<
  "Canvas" | "CanvasText" | "GrayText" | "Highlight",
  string
>;

interface Paint {
  kind: string;
  fill: string;
  stroke: string;
  pattern: boolean;
  system: System;
}

interface Other {
  name: string;
  fill: string;
  stroke: string;
  system: System;
}

interface Swatch {
  kind: string;
  color: string;
  image: string;
  system: System;
}

interface Read {
  shapes: Paint[];
  others: Other[];
  swatches: Swatch[];
}

/**
 * Reads every shown shape, swatch and other map mark of the view that is showing, each with the
 * system colours where it is drawn: the map and the swatches are dark-theme islands, and Chromium
 * resolves a system colour by the colour scheme of the element, so the page's own differ.
 */
const read = (page: Page): Promise<Read> =>
  page.evaluate((shapeSelector) => {
    const shown = (el: Element) =>
      el.closest("[hidden]") === null && el.getClientRects().length > 0;
    const cache = new Map<Element, System>();
    // A probe beside the element, opted out of the repaint, reads each colour as it is there.
    const systemAt = (el: Element): System => {
      const host = (el instanceof SVGElement ? el.ownerSVGElement : el)
        ?.parentElement as HTMLElement;
      const known = cache.get(host);
      if (known !== undefined) return known;
      const probe = document.createElement("span");
      probe.style.forcedColorAdjust = "none";
      host.append(probe);
      const system = {} as System;
      for (const name of [
        "Canvas",
        "CanvasText",
        "GrayText",
        "Highlight",
      ] as const) {
        probe.style.color = name;
        system[name] = getComputedStyle(probe).color;
      }
      probe.remove();
      cache.set(host, system);
      return system;
    };

    const shapes = [...document.querySelectorAll<SVGElement>(shapeSelector)]
      .filter(shown)
      .map((el) => {
        const cs = getComputedStyle(el);
        const id = /url\("#([^"]+)"\)/.exec(cs.fill)?.[1];
        return {
          kind: el.dataset["kind"] ?? "",
          fill: cs.fill,
          stroke: cs.stroke,
          pattern:
            id !== undefined &&
            el.ownerSVGElement?.querySelector(`pattern[id="${id}"]`) !== null,
          system: systemAt(el),
        };
      });
    const others = [
      ...document.querySelectorAll<SVGElement>(
        "[class*='zone-map__land'], [class*='zone-map__marker'], [class*='zone-map__ring'] path, [class*='zone-map__mark']",
      ),
    ]
      .filter(shown)
      .map((el) => {
        const cs = getComputedStyle(el);
        return {
          name: el.getAttribute("class") ?? "",
          fill: cs.fill,
          stroke: cs.stroke,
          system: systemAt(el),
        };
      });
    const swatches = [
      ...document.querySelectorAll<HTMLElement>(
        "[class*='zone-map__swatch'][data-kind]",
      ),
    ]
      .filter(shown)
      .map((el) => {
        const cs = getComputedStyle(el);
        return {
          kind: el.dataset["kind"] ?? "",
          color: cs.backgroundColor,
          image: cs.backgroundImage,
          system: systemAt(el),
        };
      });
    return { shapes, others, swatches };
  }, SHAPE);

/**
 * Whether a paint is a system colour where it is drawn, the svg's own pattern, or nothing. A
 * system colour drawn at an opacity keeps its channels.
 */
function isSystem(value: string, system: System): boolean {
  if (value === "none" || value === "rgba(0, 0, 0, 0)") return true;
  if (value.startsWith('url("#')) return true;
  const channels = (colour: string) =>
    /^rgba?\((\d+), (\d+), (\d+)/.exec(colour)?.slice(1, 4).join(",");
  return Object.values(system).some(
    (colour) => channels(colour) === channels(value),
  );
}

/** What a shape's fill must be for its mark: the system colour, or the svg's own pattern. */
function expectShape(shape: Paint) {
  const mark = MARK[shape.kind];
  expect(mark, `a mark for ${shape.kind}`).toBeDefined();
  if (mark === "solid")
    expect(shape.fill, shape.kind).toBe(shape.system.CanvasText);
  else if (mark === "canvas")
    expect(shape.fill, shape.kind).toBe(shape.system.Canvas);
  else {
    expect(shape.fill, shape.kind).toMatch(new RegExp(`-fc-${mark}"\\)$`));
    expect(shape.pattern, `${shape.kind}'s pattern is in its svg`).toBe(true);
  }
  expect(
    isSystem(shape.stroke, shape.system),
    `${shape.kind} stroke ${shape.stroke}`,
  ).toBe(true);
}

/** What a swatch must show for its mark, so the legend and the map agree. */
function expectSwatch(swatch: Swatch) {
  const { system } = swatch;
  const mark = MARK[swatch.kind];
  // The Navajo Nation's swatch belongs to the overlay, not to a class; it is solid.
  if (mark === undefined) {
    expect(swatch.color, swatch.kind).toBe(system.CanvasText);
    return;
  }
  if (mark === "solid") {
    expect(swatch.color, swatch.kind).toBe(system.CanvasText);
    expect(swatch.image, swatch.kind).toBe("none");
  } else if (mark === "canvas") {
    expect(swatch.color, swatch.kind).toBe(system.Canvas);
    expect(swatch.image, swatch.kind).toBe("none");
  } else {
    expect(swatch.color, swatch.kind).toBe(system.Canvas);
    expect(swatch.image, swatch.kind).toMatch(
      mark.startsWith("hatch")
        ? /^repeating-linear-gradient/
        : /^radial-gradient/,
    );
  }
}

describe.each(SCHEMES)("Clock-change maps in forced colours, %s", (scheme) => {
  it.each(PAGES)(
    "%s: each shape wears its swatch's mark, in system colours only",
    async (_name, path, view) => {
      if (browser === undefined || server === undefined) return;
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        forcedColors: "active",
        colorScheme: scheme,
      });
      try {
        await answerChecks(page);
        await page.goto(`${base}${path}`);
        await drawn(page);
        if (view !== null) {
          await page.getByRole("radio", { name: view }).check();
          await drawn(page);
          await page.waitForFunction(
            (selector) =>
              [...document.querySelectorAll(selector)].some(
                (el) =>
                  el.closest("[hidden]") === null &&
                  (el as SVGElement).dataset["kind"] === "daylight-if-allowed",
              ),
            SHAPE,
          );
        }
        const { shapes, others, swatches } = await read(page);
        expect(shapes.length).toBeGreaterThan(0);
        expect(swatches.length).toBeGreaterThan(0);
        for (const shape of shapes) expectShape(shape);
        for (const mark of others) {
          expect(
            isSystem(mark.fill, mark.system),
            `${mark.name} fill ${mark.fill}`,
          ).toBe(true);
          expect(
            isSystem(mark.stroke, mark.system),
            `${mark.name} stroke ${mark.stroke}`,
          ).toBe(true);
        }
        // Every class drawn on the map has a swatch, and each swatch matches its class.
        const kinds = new Set(shapes.map((shape) => shape.kind));
        for (const swatch of swatches) {
          kinds.delete(swatch.kind);
          expectSwatch(swatch);
        }
        expect([...kinds], "classes on the map with no swatch").toEqual([]);
      } finally {
        await page.close();
      }
    },
    60_000,
  );
});
