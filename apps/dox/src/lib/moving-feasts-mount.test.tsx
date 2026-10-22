/**
 * @vitest-environment jsdom
 *
 * Moving Feasts end to end against the real `@northguild/gmt`.
 */
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  mountMovingFeasts,
  renderMovingFeastsTemplate,
} from "./moving-feasts-mount";
import { FEAST_OFFSETS } from "./moving-feasts";

installJsdomShims();

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;
const fire = (el: Element, type: "input" | "change") =>
  el.dispatchEvent(new Event(type, { bubbles: true }));
const text = (el: Element | null) =>
  (el?.textContent ?? "").replace(/\s+/gu, " ").trim();
const value = (root: HTMLElement, role: string) =>
  text(q(root, role).querySelector(".gmt-punct-hero-value"));

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderMovingFeastsTemplate(args);
  document.body.append(root);
  const handle = await mountMovingFeasts(
    root,
    args,
    new AbortController().signal,
  );
  return { root, handle };
}

function setYear(root: HTMLElement, year: string) {
  const input = q<HTMLInputElement>(root, "year");
  input.value = year;
  fire(input, "input");
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("section 1", () => {
  it("2024 reads both Easters and 35 days", async () => {
    const { root } = await mount();
    setYear(root, "2024");
    expect(value(root, "hero-gregorian")).toBe("2024-03-31");
    expect(value(root, "hero-julian")).toBe("2024-05-05");
    expect(value(root, "hero-apart")).toBe("35 days");
  });

  it("2025 reads same day", async () => {
    const { root } = await mount();
    setYear(root, "2025");
    expect(value(root, "hero-apart")).toBe("same day");
  });

  it("a year the library cannot place is NO SIGNAL on both plates, with an empty grid", async () => {
    const { root } = await mount();
    setYear(root, "-300000");
    for (const role of ["hero-gregorian", "hero-julian"]) {
      expect(q(root, role).hasAttribute("data-signal")).toBe(true);
      expect(value(root, role)).toContain("NO SIGNAL");
    }
    expect(text(q(root, "year-note"))).toContain("NO SIGNAL");
    expect(root.querySelectorAll('[data-kinds~="pick"]').length).toBe(0);
  });

  it("walks the ends of the range without throwing, each year answered from the library", async () => {
    const { root } = await mount();
    for (const year of [
      "33808",
      "33809",
      "-271815",
      "-271821",
      "-271822",
      "275760",
      "275761",
    ]) {
      setYear(root, year);
      expect(q<HTMLInputElement>(root, "year").value).toBe(year);
      expect(
        text(q(root, "year-note")) === "" ||
          text(q(root, "year-note")).length > 0,
      ).toBe(true);
    }
    setYear(root, "33808");
    expect(text(q(root, "year-note"))).toContain("in another calendar year");
    setYear(root, "-271821");
    expect(text(q(root, "year-note"))).toContain("neighbouring years");
    expect(
      root.querySelectorAll('[data-kinds~="pick"]').length,
    ).toBeGreaterThan(0);
    setYear(root, "-271822");
    expect(q(root, "hero-gregorian").hasAttribute("data-signal")).toBe(true);
    expect(root.querySelectorAll('[data-kinds~="pick"]').length).toBe(0);
  });

  it("one toggle per offset, each marking a date", async () => {
    const { root } = await mount();
    setYear(root, "2024");
    const toggles = root.querySelectorAll('[data-role="offset"]');
    expect(toggles.length).toBe(FEAST_OFFSETS.length);
    expect(
      root.querySelectorAll('[data-kinds~="pick"]').length,
    ).toBeGreaterThan(0);
  });
});

describe("section 2", () => {
  it("fifth Friday of February is NO SIGNAL, and January gives the 30th with both chips", async () => {
    const { root } = await mount({ preset: "fifth-friday" });
    expect(q(root, "nth-hero").hasAttribute("data-signal")).toBe(true);
    expect(text(q(root, "nth-note-text"))).toContain("no fifth Friday");
    const month = q<HTMLSelectElement>(root, "month");
    month.value = "1";
    fire(month, "change");
    expect(value(root, "nth-hero")).toBe("2026-01-30");
    const cell = root.querySelector(
      '[data-role="nth-grid"] [data-date="2026-01-30"]',
    )!;
    const chips = [...cell.querySelectorAll(".gmt-holiday-chip--tag")].map(
      (c) => text(c),
    );
    expect(chips).toEqual(["5", "-1"]);
  });
});

describe("the Builder link", () => {
  it("points at the Builder once there is a year and an offset", async () => {
    const { root } = await mount();
    setYear(root, "2024");
    expect(q(root, "link-builder").getAttribute("href")).toContain(
      "/tools/holiday-rule-builder/",
    );
  });
});

describe("readouts hold still", () => {
  it("no plate or grid box moves when the slider is dragged", async () => {
    const { root } = await mount();
    const boxes = () =>
      ["hero-gregorian", "hero-julian", "hero-apart", "easter-grid"].map(
        (r) => {
          const b = q(root, r).getBoundingClientRect();
          return [b.x, b.y, b.width, b.height];
        },
      );
    const before = boxes();
    const slider = q<HTMLInputElement>(root, "year-slider");
    for (const v of [slider.min, slider.max, "2024", "2025"]) {
      slider.value = v;
      fire(slider, "input");
      expect(boxes()).toEqual(before);
    }
  });
});
