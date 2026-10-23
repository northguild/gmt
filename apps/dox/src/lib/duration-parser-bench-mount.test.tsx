/**
 * @vitest-environment jsdom
 *
 * The Duration Parser Bench end to end: template, mount, interact, assert,
 * against the real `@northguild/gmt`.
 */
import { installJsdomShims } from "~/test/jsdom-shims";
import { GMT_MODULES } from "./gmt-modules";
import { showUnavailable } from "./widget-mount";
import {
  CELL_NO_SIGNAL,
  RESULT_NO_SIGNAL,
  SAME_DURATION_TEXT,
  mountDurationParserBench,
  renderDurationParserBenchTemplate,
} from "./duration-parser-bench-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderDurationParserBenchTemplate(args);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountDurationParserBench(root, args, controller.signal);
  return { root, handle, controller };
}

function type(root: HTMLElement, value: string) {
  const el = q<HTMLInputElement>(root, "text");
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function pick(root: HTMLElement, locale: string) {
  const el = q<HTMLSelectElement>(root, "locale");
  el.value = locale;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const roles = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-role]")].map(
    (e) => (e as HTMLElement).dataset["role"],
  );

const words = (root: HTMLElement) =>
  [...root.querySelectorAll('[data-role="words-cell"]')].map(
    (c) => c.textContent,
  );

describe("the template", () => {
  it("holds three sections, a real text input with maxlength 64 and the Try buttons", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDurationParserBenchTemplate();
    expect(root.querySelectorAll(".gmt-widget-section")).toHaveLength(3);
    const input = q<HTMLInputElement>(root, "text");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("maxlength")).toBe("64");
    expect(input.value).toBe("2h 30m");
    expect(q(root, "locale").tagName).toBe("SELECT");
    expect(root.querySelectorAll('button[data-role="try"]')).toHaveLength(8);
    expect(root.querySelectorAll(".gmt-dbench-cell")).toHaveLength(10);
  });

  it("is seeded: the text and a locale outside the list", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDurationParserBenchTemplate({
      text: "1m",
      locale: "xx-YY",
    });
    expect(q<HTMLInputElement>(root, "text").value).toBe("1m");
    expect(q<HTMLSelectElement>(root, "locale").value).toBe("xx-YY");
  });

  it("has the same elements before and after mount", async () => {
    const before = document.createElement("div");
    before.innerHTML = renderDurationParserBenchTemplate();
    const { root } = await mount();
    const names = new Set(roles(root));
    for (const r of roles(before)) expect(names.has(r)).toBe(true);
  });
});

describe("mount", () => {
  it("reads the default string and fills both tables", async () => {
    const { root } = await mount();
    expect(q(root, "parser").dataset["parser"]).toBe("human");
    expect(q(root, "result").textContent).toBe("PT2H30M");
    expect(q(root, "compact").textContent).toBe("2h 30m");
    expect(q(root, "roundtrip").textContent).toBe(SAME_DURATION_TEXT);
    expect(root.querySelectorAll('[data-role="rows-minute"] tr')).toHaveLength(
      7,
    );
    expect(
      [...root.querySelectorAll('[data-role="hours-cell"]')].map(
        (c) => c.textContent,
      ),
    ).toEqual(["71", "73", "72", "72"]);
    expect(
      root.querySelector(".gmt-dbench-laytime-note a")?.getAttribute("href"),
    ).toMatch(/bimco\.org/);
  });

  it("shows P1M's human cell as a sentinel and its ISO cell as P1M", async () => {
    const { root } = await mount();
    const last = root.querySelectorAll('[data-role="rows-minute"] tr')[6]!;
    const cells = last.querySelectorAll("td");
    expect(cells[1]!.textContent).toBe(CELL_NO_SIGNAL);
    expect(cells[2]!.textContent).toBe("P1M");
    expect(cells[3]!.textContent).toBe("month");
  });

  it("re-draws section 2 when the reader types, and lights the fields", async () => {
    const { root } = await mount();
    type(root, "1.5h");
    expect(q(root, "result").textContent).toBe("PT1H30M");
    const lit = [...root.querySelectorAll(".gmt-dbench-cell[data-lit]")].map(
      (c) => (c as HTMLElement).dataset["field"],
    );
    expect(lit).toEqual(["hours", "minutes"]);
    expect(q(root, "call-bench").textContent).toContain(
      'parseHumanDuration("1.5h")',
    );
  });

  it("keeps a leading space and shows a sentinel, not a blank", async () => {
    const { root } = await mount();
    type(root, " 2h");
    expect(q<HTMLInputElement>(root, "text").value).toBe(" 2h");
    expect(q(root, "parser").dataset["parser"]).toBe("none");
    expect(q(root, "result").textContent).toBe(RESULT_NO_SIGNAL);
    expect(
      q(root, "result").classList.contains("gmt-playground-sentinel"),
    ).toBe(true);
    expect(q(root, "refusal").textContent).toMatch(/Neither parser reads it/);
    expect(q(root, "compact").textContent).toBe("not called");
    expect(q(root, "bench-output").textContent).toBe("NO SIGNAL\nNO SIGNAL");
  });

  it("does not call a valid human string a failure for the ISO parser", async () => {
    const { root } = await mount();
    expect(q(root, "bench-output").textContent).not.toContain("NO SIGNAL");
  });

  it("fills the field from a Try button and runs the call", async () => {
    const { root } = await mount();
    root.querySelector<HTMLButtonElement>('button[data-try="PT90M"]')!.click();
    expect(q<HTMLInputElement>(root, "text").value).toBe("PT90M");
    expect(q(root, "parser").dataset["parser"]).toBe("iso");
    expect(q(root, "compact").textContent).toBe("90m");
  });

  it("re-draws only the formatDuration cells on a locale change", async () => {
    const { root } = await mount();
    const humanCells = [
      ...root.querySelectorAll('[data-role="rows-minute"] td:nth-child(2)'),
    ];
    const before = words(root);
    const readout = q(root, "result").textContent;
    pick(root, "de-DE");
    expect(words(root)).not.toEqual(before);
    expect(q(root, "result").textContent).toBe(readout);
    // The other cells are the same nodes: they were not re-drawn.
    expect([
      ...root.querySelectorAll('[data-role="rows-minute"] td:nth-child(2)'),
    ]).toEqual(humanCells);
  });

  it("round-trips the text, with spaces and commas, through a permalink", async () => {
    const { handle, root } = await mount();
    type(root, "2h, and 30m");
    pick(root, "de-DE");
    const state = handle.getPermalinkState?.() ?? {};
    expect(state).toEqual({ text: "2h, and 30m", locale: "de-DE" });
    const url = encodeWidgetPermalink("durationbench", state);
    window.history.pushState({}, "", url);
    const seed = seedFromLocation("durationbench");
    expect(seed).toEqual(state);
    const again = await mount(seed);
    expect(q<HTMLInputElement>(again.root, "text").value).toBe("2h, and 30m");
    expect(q<HTMLSelectElement>(again.root, "locale").value).toBe("de-DE");
    expect(q(again.root, "result").textContent).toBe("PT2H30M");
  });
});

describe("when the library does not load", () => {
  it("rejects with a load error the host turns into the unavailable notice", async () => {
    const originals = { ...GMT_MODULES };
    for (const key of Object.keys(GMT_MODULES)) {
      GMT_MODULES[key] = () => Promise.reject(new Error("offline"));
    }
    try {
      const root = document.createElement("div");
      root.innerHTML = renderDurationParserBenchTemplate();
      document.body.append(root);
      let failure: unknown;
      await mountDurationParserBench(
        root,
        {},
        new AbortController().signal,
      ).catch((e) => {
        failure = e;
        showUnavailable(root, e);
      });
      expect(failure).toBeInstanceOf(Error);
      expect(root.textContent).toMatch(/./);
    } finally {
      Object.assign(GMT_MODULES, originals);
    }
  });
});
