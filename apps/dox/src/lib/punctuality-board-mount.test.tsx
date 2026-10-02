/**
 * @vitest-environment jsdom
 *
 * The Punctuality Board end to end: template -> mount -> interact -> assert,
 * against the real `@northguild/gmt`. Every printed deviation, class and rate
 * is an appendix Z row (PB1 to PB4, PBP, PBR1).
 */
/// <reference types="vitest/globals" />
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { PUNCTUALITY_PRESETS } from "./punctuality-board";
import {
  mountPunctualityBoard,
  renderPunctualityBoardTemplate,
} from "./punctuality-board-mount";
import { minutesToIso } from "./punctuality-widgets";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "late",
  "early",
  "compare-late",
  "early-on",
  "compare-on",
  "rate",
  "board",
  "tolerance-track",
  "handle-late",
  "handle-early",
  "handle-compare",
  "rows",
  "axis-ticks",
  "board-summary",
  "reason-aside",
  "call-rate-a",
  "rate-output-a",
  "call-rate-b",
  "rate-output-b",
  "calls-table",
];

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderPunctualityBoardTemplate(args);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountPunctualityBoard(root, args, controller.signal);
  return { root, handle, controller };
}

async function mountPreset(id: string, extra = {}) {
  return mount({ preset: id, ...extra });
}

function key(root: HTMLElement, role: string, k: string, shift = false) {
  q(root, role).dispatchEvent(
    new KeyboardEvent("keydown", { key: k, shiftKey: shift, bubbles: true }),
  );
}

function keyup(root: HTMLElement, role: string, k: string) {
  q(root, role).dispatchEvent(
    new KeyboardEvent("keyup", { key: k, bubbles: true }),
  );
}

function stubTrack(root: HTMLElement) {
  q(root, "tolerance-track").getBoundingClientRect = () =>
    ({
      left: 0,
      right: 600,
      width: 600,
      top: 0,
      bottom: 20,
      height: 20,
    }) as DOMRect;
}

function setText(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLInputElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function commit(root: HTMLElement, role: string) {
  q(root, role).dispatchEvent(new Event("change", { bubbles: true }));
}

function flip(root: HTMLElement, role: string, on: boolean) {
  const el = q<HTMLInputElement>(root, role);
  el.checked = on;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const text = (root: HTMLElement, role: string) =>
  q(root, role).textContent ?? "";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderPunctualityBoardTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderPunctualityBoardTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is exactly one widget root, first in the template", () => {
    const html = renderPunctualityBoardTemplate();
    expect(
      html.startsWith(
        '<div class="gmt-punctuality-board gmt-widget not-content">',
      ),
    ).toBe(true);
  });

  it("makes every handle a real slider with an accessible name", () => {
    const root = document.createElement("div");
    root.innerHTML = renderPunctualityBoardTemplate();
    for (const [role, label] of [
      ["handle-late", "Late tolerance"],
      ["handle-early", "Early tolerance"],
      ["handle-compare", "Second late tolerance"],
    ]) {
      const h = q(root, role!);
      expect(h.getAttribute("role")).toBe("slider");
      expect(h.getAttribute("aria-label")).toBe(label);
      expect(h.getAttribute("tabindex")).toBe("0");
      expect(h.classList.contains("gmt-handle")).toBe(true);
    }
  });

  it("is seeded from a preset id", () => {
    const root = document.createElement("div");
    root.innerHTML = renderPunctualityBoardTemplate({ preset: "day-based" });
    expect(q<HTMLInputElement>(root, "late").value).toBe("P1D");
    expect(q<HTMLInputElement>(root, "early-on").checked).toBe(true);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("day-based");
  });

  it("escapes a seeded value", () => {
    const root = document.createElement("div");
    root.innerHTML = renderPunctualityBoardTemplate({
      pairs: [{ planned: "a", actual: "b" }],
      late: '"><script>x</script>',
    });
    expect(root.querySelector("script")).toBeNull();
  });
});

describe("mountPunctualityBoard: every preset", () => {
  const EXPECTED: Record<
    string,
    {
      header: string[];
      deltas: string[];
      classes: string[];
      output: string;
    }
  > = {
    "fifteen-minute": {
      header: ["4 of 6 on time, late tolerance 15 min (PT15M)"],
      deltas: [
        "+5 min",
        "+14 min 59 s",
        "+15 min",
        "+17 min",
        "−3 min",
        "−12 min",
      ],
      classes: ["on time", "on time", "late", "late", "on time", "on time"],
      output: "{ onTime: 4, total: 6, rate: 0.6666666666666666 }",
    },
    "sixty-and-120": {
      header: [
        "2 of 6 on time, late tolerance 1 h (PT60M)",
        "4 of 6 on time, late tolerance 2 h (PT120M)",
      ],
      deltas: [
        "+30 min",
        "+59 min",
        "+1 h",
        "+1 h 35 min",
        "+2 h",
        "+2 h 30 min",
      ],
      classes: [
        "on time · on time under 2 h",
        "on time · on time under 2 h",
        "late · on time under 2 h",
        "late · on time under 2 h",
        "late · late under 2 h",
        "late · late under 2 h",
      ],
      output: "{ onTime: 2, total: 6, rate: 0.3333333333333333 }",
    },
    "day-based": {
      header: [
        "2 of 6 on time, late tolerance 24 h (P1D), early tolerance 24 h (P1D)",
      ],
      deltas: ["−36 h", "−24 h", "−6 h", "+20 h", "+24 h", "+72 h"],
      classes: ["early", "early", "on time", "on time", "late", "late"],
      output: "{ onTime: 2, total: 6, rate: 0.3333333333333333 }",
    },
    "fall-back": {
      header: ["1 of 4 on time, late tolerance 15 min (PT15M)"],
      deltas: ["+1 h", "+15 min", "+25 min", "+10 min"],
      classes: ["late", "late", "late", "on time"],
      output: "{ onTime: 1, total: 4, rate: 0.25 }",
    },
  };

  it.each(PUNCTUALITY_PRESETS.map((p) => [p.id]))("prints %s", async (id) => {
    const { root } = await mountPreset(id!);
    const want = EXPECTED[id!]!;
    const header = [...q(root, "rate").querySelectorAll("p")]
      .map((p) => p.textContent ?? "")
      .filter((t) => !t.startsWith("Read off"));
    expect(header).toEqual(want.header);
    want.deltas.forEach((d, i) => {
      expect(text(root, `row-delta-${i + 1}`)).toBe(d);
      expect(text(root, `row-class-${i + 1}`)).toBe(want.classes[i]);
    });
    expect(text(root, "rate-output-a")).toBe(want.output);
  });

  it("PB2b prints the second rate", async () => {
    const { root } = await mountPreset("sixty-and-120");
    expect(text(root, "rate-output-b")).toBe(
      "{ onTime: 4, total: 6, rate: 0.6666666666666666 }",
    );
    expect(q(root, "rate-b-block").hidden).toBe(false);
    expect(q(root, "lane-b").hidden).toBe(false);
  });

  it("PB4n shows the naive wall-clock reading on the fall-back preset", async () => {
    const { root } = await mountPreset("fall-back");
    expect(text(root, "rate-naive")).toBe(
      "Read off the wall clocks (naive): 3 of 4 on time",
    );
    expect(text(root, "row-naive-1")).toBe(
      "wall clock: 0 min, on time (naive)",
    );
    expect(text(root, "row-naive-2")).toBe(
      "wall clock: −45 min, on time (naive)",
    );
    expect(text(root, "row-naive-3")).toBe("wall clock: +25 min, late (naive)");
    expect(text(root, "row-naive-4")).toBe(
      "wall clock: +10 min, on time (naive)",
    );
  });

  it("shows no naive line on a preset whose clocks agree", async () => {
    const { root } = await mountPreset("fifteen-minute");
    expect(
      q(root, "rate").querySelector('[data-role="rate-naive"]'),
    ).toBeNull();
    expect(q(root, "row-naive-1")).toBeNull();
  });

  it("prints the calls table's literal outputs", async () => {
    const { root } = await mountPreset("fifteen-minute");
    const cells = [...q(root, "call-row-3").querySelectorAll("td")].map(
      (c) => c.textContent,
    );
    expect(cells).toEqual(['"PT15M"', '"late"']);
  });

  it("prints the real call, with the pairs and the tolerance", async () => {
    const { root } = await mountPreset("fifteen-minute");
    const call = text(root, "call-rate-a");
    expect(call.startsWith("punctualityRate([{ planned: ")).toBe(true);
    expect(call.endsWith('}], { late: "PT15M" })')).toBe(true);
  });
});

describe("mountPunctualityBoard: the boundary", () => {
  it("PB1d: ArrowRight on the late handle writes PT16M, row 3 reads on time, 5 of 6", async () => {
    const { root } = await mountPreset("fifteen-minute");
    expect(text(root, "row-class-3")).toBe("late");
    key(root, "handle-late", "ArrowRight");
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT16M");
    expect(text(root, "row-class-3")).toBe("on time");
    expect(text(root, "rate-a")).toContain("5 of 6 on time");
    expect(text(root, "rate-output-a")).toBe(
      "{ onTime: 5, total: 6, rate: 0.8333333333333334 }",
    );
  });

  it("ArrowLeft moves back, and the preset select goes to Custom", async () => {
    const { root } = await mountPreset("fifteen-minute");
    key(root, "handle-late", "ArrowRight");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    key(root, "handle-late", "ArrowLeft");
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT15M");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("fifteen-minute");
  });

  it("PB1z: Home on the late handle writes PT0S and the header reads 2 of 6", async () => {
    const { root } = await mountPreset("fifteen-minute");
    key(root, "handle-late", "Home");
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT0S");
    expect(text(root, "rate-a")).toContain("2 of 6 on time");
  });

  it("End writes the axis end", async () => {
    const { root } = await mountPreset("fifteen-minute");
    // R is 30 for this preset (axisMinutes).
    key(root, "handle-late", "End");
    expect(q<HTMLInputElement>(root, "late").value).toBe(minutesToIso(30));
    expect(q(root, "handle-late").getAttribute("aria-valuemax")).toBe("30");
  });

  it("Shift+Arrow and PageUp or PageDown move ten steps", async () => {
    const { root } = await mountPreset("fifteen-minute");
    key(root, "handle-late", "ArrowRight", true);
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT25M");
    key(root, "handle-late", "PageDown");
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT15M");
    key(root, "handle-late", "PageUp");
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT25M");
  });

  it("a late handle never goes below zero", async () => {
    const { root } = await mountPreset("fifteen-minute");
    key(root, "handle-late", "ArrowLeft", true);
    key(root, "handle-late", "ArrowLeft", true);
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT0S");
  });

  it("does not rescale the axis while keys move a handle", async () => {
    const { root } = await mountPreset("fifteen-minute");
    const before = text(root, "axis-ticks");
    key(root, "handle-late", "End");
    expect(text(root, "axis-ticks")).toBe(before);
  });

  it("refits the axis when a typed value is committed", async () => {
    const { root } = await mountPreset("fifteen-minute");
    const before = text(root, "axis-ticks");
    setText(root, "late", "PT3H");
    expect(text(root, "axis-ticks")).toBe(before);
    commit(root, "late");
    expect(text(root, "axis-ticks")).not.toBe(before);
  });

  it("keeps aria on the handle in step with the field", async () => {
    const { root } = await mountPreset("fifteen-minute");
    const h = q(root, "handle-late");
    expect(h.getAttribute("aria-valuenow")).toBe("15");
    expect(h.getAttribute("aria-valuetext")).toBe(
      "Late tolerance 15 minutes, PT15M",
    );
    expect(h.getAttribute("aria-valuemin")).toBe("0");
  });

  it("moves the handle when a typed value is readable and leaves it when it is not", async () => {
    const { root } = await mountPreset("fifteen-minute");
    setText(root, "late", "PT20M");
    const moved = q(root, "handle-late").style.left;
    setText(root, "late", "P1W");
    expect(q(root, "handle-late").style.left).toBe(moved);
  });
});

describe("mountPunctualityBoard: the early tolerance", () => {
  it("PB1e: switching early on with PT10M gives row 6 early and 3 of 6", async () => {
    const { root } = await mountPreset("fifteen-minute");
    expect(q<HTMLInputElement>(root, "early").disabled).toBe(true);
    expect(q(root, "handle-early").hidden).toBe(true);
    setText(root, "early", "PT10M");
    flip(root, "early-on", true);
    expect(q<HTMLInputElement>(root, "early").disabled).toBe(false);
    expect(q(root, "handle-early").hidden).toBe(false);
    expect(text(root, "row-class-6")).toBe("early");
    expect(text(root, "rate-a")).toContain("3 of 6 on time");
    expect(text(root, "rate-output-a")).toBe(
      "{ onTime: 3, total: 6, rate: 0.5 }",
    );
  });

  it("Shift+ArrowLeft on the early handle moves it ten steps", async () => {
    const { root } = await mountPreset("fifteen-minute");
    setText(root, "early", "PT10M");
    flip(root, "early-on", true);
    key(root, "handle-early", "ArrowLeft", true);
    expect(q<HTMLInputElement>(root, "early").value).toBe("PT20M");
    key(root, "handle-early", "ArrowRight");
    expect(q<HTMLInputElement>(root, "early").value).toBe("PT19M");
  });

  it("Home and End on the early handle go to the axis ends", async () => {
    const { root } = await mountPreset("fifteen-minute");
    flip(root, "early-on", true);
    key(root, "handle-early", "End");
    expect(q<HTMLInputElement>(root, "early").value).toBe("PT0S");
    key(root, "handle-early", "Home");
    // The axis is not read back from the DOM: the preset's largest deviation is
    // 17 minutes (09:30 due, 09:47 in), 1.2 x 17 = 20.4 rounds up to a 30-minute
    // half-axis, so Home is 30 minutes early.
    expect(q<HTMLInputElement>(root, "early").value).toBe("PT30M");
    expect(q(root, "handle-early").getAttribute("aria-valuemin")).toBe("-30");
  });

  it("turning the day-based early tolerance off leaves the late edge", async () => {
    const { root } = await mountPreset("day-based");
    flip(root, "early-on", false);
    expect(text(root, "row-class-1")).toBe("on time");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });
});

describe("mountPunctualityBoard: the second tolerance", () => {
  it("shows its lane, handle and result when switched on", async () => {
    const { root } = await mountPreset("fifteen-minute");
    expect(q(root, "lane-b").hidden).toBe(true);
    flip(root, "compare-on", true);
    expect(q(root, "lane-b").hidden).toBe(false);
    expect(q(root, "rate-b-block").hidden).toBe(false);
    expect(text(root, "rate-output-b")).toContain("onTime");
  });

  it("moves with its own handle", async () => {
    const { root } = await mountPreset("sixty-and-120");
    // R is 180, so a step is one minute and Shift moves ten.
    key(root, "handle-compare", "ArrowLeft", true);
    expect(q<HTMLInputElement>(root, "compare-late").value).toBe(
      minutesToIso(110),
    );
  });
});

describe("mountPunctualityBoard: NO SIGNAL", () => {
  it("PBR1: a weeks tolerance shows NO SIGNAL and the invalid-late reason", async () => {
    const { root } = await mountPreset("fifteen-minute");
    setText(root, "late", "P1W");
    expect(text(root, "rate-output-a")).toBe("NO SIGNAL");
    expect(
      q(root, "rate-output-a").classList.contains("gmt-playground-sentinel"),
    ).toBe(true);
    expect(text(root, "reason-aside")).toContain(
      "The late tolerance is not an exact duration",
    );
    expect(text(root, "row-class-1")).toBe("NO SIGNAL");
    expect(text(root, "rate-a")).toContain("NO SIGNAL");
  });

  it("clears the reason once the tolerance is valid again", async () => {
    const { root } = await mountPreset("fifteen-minute");
    setText(root, "late", "P1W");
    setText(root, "late", "PT15M");
    expect(text(root, "reason-aside")).toBe("");
    expect(text(root, "rate-output-a")).toContain("onTime: 4");
  });

  it("a zoneless arrival shows NO SIGNAL for the rate and names its row", async () => {
    const { root } = await mount({
      pairs: [
        {
          planned: "2024-06-14T09:00:00+01:00[Europe/London]",
          actual: "2024-06-14T09:05:00+01:00[Europe/London]",
        },
        {
          planned: "2024-06-14T09:00:00+01:00[Europe/London]",
          actual: "2024-06-14T09:15:00",
        },
      ],
      late: "PT15M",
    });
    expect(text(root, "rate-output-a")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain(
      "Arrival 2's planned or actual",
    );
    expect(text(root, "row-delta-2")).toBe("NO SIGNAL");
    expect(text(root, "row-delta-1")).toBe("+5 min");
  });
});

describe("mountPunctualityBoard: a chat seed", () => {
  it("PBP: one row, +15 min, late, 0 of 1", async () => {
    const { root } = await mount({
      pairs: [
        {
          planned: "2024-06-14T09:00:00+01:00[Europe/London]",
          actual: "2024-06-14T09:15:00+01:00[Europe/London]",
        },
      ],
      late: "PT15M",
    });
    expect(text(root, "row-delta-1")).toBe("+15 min");
    expect(text(root, "row-class-1")).toBe("late");
    expect(text(root, "rate-output-a")).toBe(
      "{ onTime: 0, total: 1, rate: 0 }",
    );
    expect(text(root, "rate-a")).toContain("0 of 1 on time");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("PB1e permalink: the preset with a 10-minute early tolerance", async () => {
    const { root } = await mount({ preset: "fifteen-minute", early: "PT10M" });
    expect(text(root, "row-class-6")).toBe("early");
    expect(text(root, "rate-a")).toContain("3 of 6 on time");
  });
});

describe("mountPunctualityBoard: a page seed", () => {
  it("writes a permalink seed onto a template rendered without it", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderPunctualityBoardTemplate();
    document.body.append(root);
    await mountPunctualityBoard(
      root,
      { preset: "sixty-and-120" },
      new AbortController().signal,
    );
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT60M");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("sixty-and-120");
    expect(text(root, "rate-output-b")).toContain("onTime: 4");
  });
});

describe("mountPunctualityBoard: a pointer drag", () => {
  it("writes a snapped late tolerance and re-renders the rows", async () => {
    const { root } = await mountPreset("fifteen-minute");
    const track = q(root, "tolerance-track");
    track.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 600,
        width: 600,
        top: 0,
        bottom: 20,
        height: 20,
      }) as DOMRect;
    const handle = q(root, "handle-late");
    handle.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
    // R = 30: x = 460 of 600 is -30 + 0.7667 x 60 = 16.
    handle.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: 460,
      }),
    );
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT16M");
    expect(text(root, "row-class-3")).toBe("on time");
    handle.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
    );
    // A move after the release does nothing.
    handle.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: 100,
      }),
    );
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT16M");
  });

  it("keeps the axis still during the drag and refits on release", async () => {
    const { root } = await mountPreset("fifteen-minute");
    const track = q(root, "tolerance-track");
    track.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 600,
        width: 600,
        top: 0,
        bottom: 20,
        height: 20,
      }) as DOMRect;
    const handle = q(root, "handle-late");
    const before = text(root, "axis-ticks");
    handle.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
    handle.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: 600,
      }),
    );
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT30M");
    expect(text(root, "axis-ticks")).toBe(before);
    handle.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
    );
    expect(text(root, "axis-ticks")).not.toBe(before);
  });

  it("ignores a pointermove no handle started", async () => {
    const { root } = await mountPreset("fifteen-minute");
    q(root, "tolerance-track").dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX: 500 }),
    );
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT15M");
  });
});

describe("mountPunctualityBoard: keyboard past the axis", () => {
  it("refits the axis when the key comes up, so the handle can move on past the old edge", async () => {
    // Bug: only a pointer coming up refit the axis, so the keyboard could not
    // take a handle past the edge a pointer could.
    const { root } = await mountPreset("fifteen-minute");
    const handle = q(root, "handle-late");
    key(root, "handle-late", "End");
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT30M");
    expect(handle.getAttribute("aria-valuemax")).toBe("30");
    // Held: the axis does not move, and more presses go nowhere.
    const held = text(root, "axis-ticks");
    key(root, "handle-late", "ArrowRight");
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT30M");
    expect(text(root, "axis-ticks")).toBe(held);
    keyup(root, "handle-late", "End");
    expect(text(root, "axis-ticks")).not.toBe(held);
    expect(Number(handle.getAttribute("aria-valuemax"))).toBeGreaterThan(30);
    key(root, "handle-late", "ArrowRight");
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT31M");
  });

  it("does not refit for a key that moved nothing, or one that is not a handle key", async () => {
    const { root } = await mountPreset("fifteen-minute");
    const ticks = text(root, "axis-ticks");
    keyup(root, "handle-late", "ArrowLeft");
    keyup(root, "handle-late", "Shift");
    expect(text(root, "axis-ticks")).toBe(ticks);
  });

  it("refits when the handle loses focus with a moved key still down", async () => {
    const { root } = await mountPreset("fifteen-minute");
    key(root, "handle-late", "End");
    const ticks = text(root, "axis-ticks");
    q(root, "handle-late").dispatchEvent(
      new FocusEvent("focusout", { bubbles: true }),
    );
    expect(text(root, "axis-ticks")).not.toBe(ticks);
  });
});

describe("mountPunctualityBoard: a drag that loses its pointer", () => {
  const down = (root: HTMLElement) =>
    q(root, "handle-late").dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
  const move = (root: HTMLElement, x: number) =>
    q(root, "handle-late").dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: x,
      }),
    );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ends when the capture is lost", async () => {
    const { root } = await mountPreset("fifteen-minute");
    stubTrack(root);
    down(root);
    move(root, 460);
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT16M");
    q(root, "handle-late").dispatchEvent(
      new Event("lostpointercapture", { bubbles: true }),
    );
    move(root, 100);
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT16M");
  });

  it("ends when capture never took and the pointer is released outside the widget", async () => {
    vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {
      throw new Error("no such pointer");
    });
    const { root } = await mountPreset("fifteen-minute");
    stubTrack(root);
    down(root);
    move(root, 460);
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT16M");
    document.body.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
    );
    move(root, 100);
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT16M");
  });

  it("stops listening on the page once destroyed", async () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { handle } = await mountPreset("fifteen-minute");
    handle.destroy();
    const names = remove.mock.calls.map((c) => c[0]);
    expect(names).toContain("pointerup");
    expect(names).toContain("pointercancel");
  });
});

describe("mountPunctualityBoard: the live region", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is not the readout: a status line beside it speaks once, after the change settles", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { root } = await mountPreset("fifteen-minute");
    const rate = q(root, "rate");
    const live = q(root, "rate-live");
    expect(rate.hasAttribute("aria-live")).toBe(false);
    expect(live.getAttribute("role")).toBe("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("");
    const changes: string[] = [];
    new MutationObserver(() => changes.push(live.textContent ?? "")).observe(
      live,
      { childList: true, characterData: true, subtree: true },
    );
    for (let i = 0; i < 5; i++) {
      key(root, "handle-late", "ArrowRight");
      vi.advanceTimersByTime(100);
    }
    expect(live.textContent).toBe("");
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(live.textContent).toContain("of 6 on time");
    expect(live.textContent).toContain("PT20M");
    expect(changes).toHaveLength(1);
  });

  it("drops a pending reading when destroyed", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { root, handle } = await mountPreset("fifteen-minute");
    key(root, "handle-late", "ArrowRight");
    handle.destroy();
    vi.advanceTimersByTime(2000);
    expect(q(root, "rate-live").textContent).toBe("");
  });
});

describe("mountPunctualityBoard: text that is not a date", () => {
  it.each([
    ["2024-02-30T08:00:00+00:00[Europe/London]", "08:00"],
    ["2024-06-31T10:05:00+03:00[Europe/Helsinki]", "10:05"],
  ])(
    "an impossible zoned planned time (%s) is a NO SIGNAL row, and the mount does not reject",
    async (planned, clock) => {
      // Bug: the weekday label threw out of the mount.
      const { root } = await mount({
        pairs: [
          { planned, actual: "2024-06-14T09:05:00+01:00[Europe/London]" },
          {
            planned: "2024-06-14T09:00:00+01:00[Europe/London]",
            actual: "2024-06-14T09:05:00+01:00[Europe/London]",
          },
        ],
        late: "PT15M",
      });
      expect(text(root, "row-delta-1")).toBe("NO SIGNAL");
      expect(text(root, "row-delta-2")).toBe("+5 min");
      expect(text(root, "rate-output-a")).toBe("NO SIGNAL");
      expect(text(root, "reason-aside")).toContain(
        "Arrival 1's planned or actual",
      );
      // The row prints the clock as typed; it has no date to compare.
      expect(text(root, "row-label-1")).toBe(`${clock} \u2192 09:05`);
    },
  );

  it("an impossible zoned actual time typed into a seed does not throw either", async () => {
    const { root } = await mount({
      pairs: [
        {
          planned: "2024-06-14T09:00:00+01:00[Europe/London]",
          actual: "2024-02-30T08:00:00+00:00[Europe/London]",
        },
      ],
      late: "PT15M",
    });
    expect(text(root, "row-delta-1")).toBe("NO SIGNAL");
    expect(text(root, "board-summary")).toContain("NO SIGNAL");
  });
});

describe("mountPunctualityBoard: the picture agrees with the library", () => {
  it("draws a hatched cap for a zero deviation the library calls early (early tolerance PT0S)", async () => {
    const at = "2024-06-14T09:00:00+01:00[Europe/London]";
    const { root } = await mount({
      pairs: [{ planned: at, actual: at }],
      late: "PT15M",
      early: "PT0S",
    });
    expect(text(root, "row-class-1")).toBe("early");
    expect(
      q(root, "row-1").querySelector(".gmt-punct-bar-out.gmt-punct-hatch"),
    ).not.toBeNull();
  });
});

describe("mountPunctualityBoard: fonts, tables and growth", () => {
  it("releases its font listener when destroyed", async () => {
    const add = vi.fn();
    const remove = vi.fn();
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        addEventListener: add,
        removeEventListener: remove,
      },
    });
    try {
      const { handle } = await mountPreset("fifteen-minute");
      expect(add).toHaveBeenCalledWith("loadingdone", expect.any(Function));
      handle.destroy();
      handle.destroy();
      expect(remove).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalledWith("loadingdone", add.mock.calls[0]![1]);
    } finally {
      Reflect.deleteProperty(document, "fonts");
    }
  });

  it("gives the calls table table roles and a labelled, focusable scroll box", async () => {
    const { root } = await mountPreset("sixty-and-120");
    const table = q(root, "calls-table");
    expect(table.getAttribute("role")).toBe("table");
    expect(table.getAttribute("tabindex")).toBe("0");
    expect(table.getAttribute("aria-label")).toBeTruthy();
    expect(table.querySelector("thead")!.getAttribute("role")).toBe("rowgroup");
    expect(table.querySelector("tbody")!.getAttribute("role")).toBe("rowgroup");
    expect(
      [...table.querySelectorAll("thead th")].map((th) =>
        th.getAttribute("role"),
      ),
    ).toEqual(Array(4).fill("columnheader"));
    const rows = [...table.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row.getAttribute("role")).toBe("row");
      expect(row.querySelector("th")!.getAttribute("role")).toBe("rowheader");
      expect(
        [...row.querySelectorAll("td")].map((td) => td.getAttribute("role")),
      ).toEqual(Array(3).fill("cell"));
    }
  });

  it("puts the result plates in a growing slot", () => {
    const root = document.createElement("div");
    root.innerHTML = renderPunctualityBoardTemplate();
    expect(q(root, "rate-heroes").getAttribute("data-grow")).toBe("slot");
  });
});

describe("mountPunctualityBoard: presets, permalinks and teardown", () => {
  it("a cleared late tolerance survives the permalink instead of restoring the preset's", async () => {
    // Bug: a blank late was left out of a preset permalink, so a reload
    // brought the preset's own tolerance back.
    const { root, handle } = await mountPreset("fifteen-minute");
    setText(root, "late", "");
    const state = handle.getPermalinkState!();
    expect(state).toEqual({ preset: "fifteen-minute", late: "none" });
    const again = await mount(state ?? {});
    expect(q<HTMLInputElement>(again.root, "late").value).toBe("");
    expect(text(again.root, "rate-output-a")).toBe("NO SIGNAL");
  });

  it("choosing a preset replaces the rows and the tolerance", async () => {
    const { root } = await mountPreset("fifteen-minute");
    const select = q<HTMLSelectElement>(root, "preset");
    select.value = "day-based";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q<HTMLInputElement>(root, "late").value).toBe("P1D");
    expect(q<HTMLInputElement>(root, "early-on").checked).toBe(true);
    expect(text(root, "row-class-1")).toBe("early");
    expect(text(root, "preset-description")).toContain("Singapore");
  });

  it("round-trips the preset form through the permalink", async () => {
    const { root, handle } = await mountPreset("fifteen-minute");
    setText(root, "early", "PT10M");
    flip(root, "early-on", true);
    const state = handle.getPermalinkState!();
    expect(state).toEqual({ preset: "fifteen-minute", early: "PT10M" });
    const href = encodeWidgetPermalink("punctuality", state!);
    const seed = seedFromLocation("punctuality", href.slice(href.indexOf("?")));
    expect(seed).toEqual(state);
    const again = await mount(seed);
    expect(text(again.root, "row-class-6")).toBe("early");
  });

  it("round-trips the custom form through the permalink", async () => {
    const { root, handle } = await mount({
      pairs: [
        {
          planned: "2024-06-14T09:00:00+01:00[Europe/London]",
          actual: "2024-06-14T09:15:00+01:00[Europe/London]",
        },
      ],
      late: "PT15M",
    });
    key(root, "handle-late", "ArrowRight");
    const state = handle.getPermalinkState!();
    expect(state).toMatchObject({ pairCount: "1", late: "PT16M" });
    const seed = seedFromLocation(
      "punctuality",
      `?w=punctuality&wa=${encodeURIComponent(JSON.stringify(state))}`,
    );
    const again = await mount(seed);
    expect(text(again.root, "row-class-1")).toBe("on time");
    expect(q<HTMLInputElement>(again.root, "late").value).toBe("PT16M");
  });

  it("stops responding once the signal aborts", async () => {
    const { root, controller } = await mountPreset("fifteen-minute");
    controller.abort();
    key(root, "handle-late", "ArrowRight");
    expect(q<HTMLInputElement>(root, "late").value).toBe("PT15M");
  });

  it("returns an inert handle when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderPunctualityBoardTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountPunctualityBoard(root, {}, controller.signal);
    expect(handle.getPermalinkState!()).toBeNull();
    expect(q(root, "rows").children).toHaveLength(0);
  });

  it("destroys twice without throwing", async () => {
    const { handle } = await mountPreset("fifteen-minute");
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});

describe("the restyled board: result plates, bars and focus", () => {
  const FOCUSABLE = "[tabindex], a, button, input, select, textarea";
  const value = (root: HTMLElement, role: string) =>
    q(root, role).querySelector(".gmt-punct-hero-value")!.textContent;

  it.each([
    ["fifteen-minute", "4 of 6"],
    ["sixty-and-120", "2 of 6"],
    ["day-based", "2 of 6"],
    ["fall-back", "1 of 4"],
  ])("reads the on-time count on %s as %s", async (id, want) => {
    const { root } = await mountPreset(id!);
    expect(value(root, "rate-hero-a")).toBe(want);
    expect(q(root, "rate-hero-a").getAttribute("data-series")).toBe("1");
    expect(
      q(root, "rate-hero-a").querySelector(".gmt-punct-hero-cap")!.textContent,
    ).toBe("on time");
  });

  it("words the tolerance under the count, early included when it is on", async () => {
    const quarter = await mountPreset("fifteen-minute");
    expect(
      q(quarter.root, "rate-hero-a").querySelector(".gmt-punct-hero-sub")!
        .textContent,
    ).toBe("late tolerance 15 min");
    const days = await mountPreset("day-based");
    expect(
      q(days.root, "rate-hero-a").querySelector(".gmt-punct-hero-sub")!
        .textContent,
    ).toBe("late tolerance 24 h, early 24 h");
  });

  it("draws the second plate, in series 3, only while the comparison is on", async () => {
    const off = await mountPreset("fifteen-minute");
    expect(off.root.querySelector('[data-role="rate-hero-b"]')).toBeNull();
    const { root } = await mountPreset("sixty-and-120");
    expect(value(root, "rate-hero-b")).toBe("4 of 6");
    expect(q(root, "rate-hero-b").getAttribute("data-series")).toBe("3");
    expect(
      q(root, "rate-hero-b").querySelector(".gmt-punct-hero-sub")!.textContent,
    ).toBe("second late tolerance 2 h");
    flip(root, "compare-on", false);
    expect(root.querySelector('[data-role="rate-hero-b"]')).toBeNull();
  });

  it("marks the two lanes with their series and gives lane B its own chip", async () => {
    const { root } = await mountPreset("sixty-and-120");
    expect(q(root, "lane-a").getAttribute("data-series")).toBe("1");
    expect(q(root, "lane-b").getAttribute("data-series")).toBe("3");
    expect(text(root, "band-a-text")).toBe("← early is on time");
    expect(text(root, "band-b-text")).toBe("2 h late");
    expect(q(root, "band-a-text").classList.contains("gmt-cutoff-chip")).toBe(
      true,
    );
  });

  it("runs the band down every row, in percent, on the board", async () => {
    const { root } = await mountPreset("sixty-and-120");
    const board = q(root, "board");
    expect(board.style.getPropertyValue("--band-l")).toBe("0%");
    expect(board.style.getPropertyValue("--band-r")).not.toBe("");
    expect(board.style.getPropertyValue("--band-b")).not.toBe("");
    expect(board.classList.contains("gmt-punct-grid--compare")).toBe(true);
    flip(root, "compare-on", false);
    expect(board.classList.contains("gmt-punct-grid--compare")).toBe(false);
    expect(board.style.getPropertyValue("--band-b")).toBe("");
  });

  it.each(PUNCTUALITY_PRESETS.map((p) => [p.id]))(
    "draws exactly one end cap per row on %s",
    async (id) => {
      const { root } = await mountPreset(id!);
      const rows = [...q(root, "rows").children];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.querySelectorAll(".gmt-punct-bar--end")).toHaveLength(1);
      }
    },
  );

  it("flips the stems of a negative deviation and caps a late bar outside the band", async () => {
    const { root } = await mountPreset("fifteen-minute");
    // Row 5 is -3 min: one stem, inside the band, flipped.
    const early = q(root, "row-5");
    expect(early.querySelector(".gmt-punct-bar-in")!.className).toContain(
      "gmt-punct-bar--neg",
    );
    expect(early.querySelector(".gmt-punct-bar-in")!.className).toContain(
      "gmt-punct-bar--end",
    );
    // Row 4 is +17 min: a solid stem, then the hatched one carries the cap.
    const late = q(root, "row-4");
    expect(late.querySelector(".gmt-punct-bar-in")!.className).not.toContain(
      "gmt-punct-bar--end",
    );
    expect(late.querySelector(".gmt-punct-bar-out")!.className).toContain(
      "gmt-punct-bar--end",
    );
    expect(late.querySelector(".gmt-punct-bar-out")!.className).not.toContain(
      "gmt-punct-bar--neg",
    );
  });

  it("keeps the plates out of the accessibility tree", async () => {
    const { root } = await mountPreset("sixty-and-120");
    const heroes = root.querySelectorAll(".gmt-punct-heroes");
    expect(heroes).toHaveLength(1);
    for (const h of heroes) expect(h.getAttribute("aria-hidden")).toBe("true");
  });

  it("has no focusable element in the board but the named handles", async () => {
    const { root } = await mountPreset("sixty-and-120");
    const roles = [...q(root, "board").querySelectorAll(FOCUSABLE)].map(
      (e) => (e as HTMLElement).dataset.role,
    );
    expect(roles.sort()).toEqual([
      "handle-compare",
      "handle-early",
      "handle-late",
    ]);
  });
});

describe("readouts that hold still", () => {
  it("gives each row a fixed set of lines: delta, word, and the second word on its own line", async () => {
    const { root } = await mountPreset("sixty-and-120");
    const row = q(root, "row-3");
    expect(row.querySelectorAll(".gmt-punct-row-b")).toHaveLength(1);
    expect(q(root, "row-class-3").textContent).toBe("late · on time under 2 h");
    const plain = await mountPreset("fifteen-minute");
    expect(plain.root.querySelectorAll(".gmt-punct-row-b")).toHaveLength(0);
  });

  it("draws each plate's sub line as fixed lines", async () => {
    const { root } = await mountPreset("sixty-and-120");
    expect(
      q(root, "rate-hero-a").querySelectorAll(".gmt-punct-hero-line"),
    ).toHaveLength(2);
    expect(
      q(root, "rate-hero-b").querySelectorAll(".gmt-punct-hero-line"),
    ).toHaveLength(3);
  });
});

describe("releasing observers", () => {
  it("destroy disconnects every ResizeObserver the mount created", async () => {
    const spy = spyOnResizeObservers();
    try {
      const { handle } = await mount();
      expect(spy.live.size).toBeGreaterThan(0);
      handle.destroy();
      expect(spy.live.size).toBe(0);
    } finally {
      spy.restore();
    }
  });
});
