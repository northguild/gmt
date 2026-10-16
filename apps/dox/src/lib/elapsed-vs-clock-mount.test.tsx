/**
 * @vitest-environment jsdom
 *
 * The Elapsed vs. Clock Difference tool end to end: template → mount → interact
 * → assert, against the real `@northguild/gmt`. Every preset's printed calls,
 * results, plates, rulers and list are checked against literal strings read
 * from a run of the built library, so a drift in the library or the widget
 * fails here.
 */
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  BEFORE_1972_TEXT,
  CLOCK_REFUSES_TEXT,
  ELAPSED_PRESETS,
  NOT_INSERTED_TEXT,
} from "./elapsed-vs-clock";
import {
  mountElapsedVsClock,
  renderElapsedVsClockTemplate,
} from "./elapsed-vs-clock-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "start",
  "end",
  "end-slider",
  "end-value",
  "frame",
  "heroes",
  "hero-clock",
  "hero-elapsed",
  "hero-count",
  "rulers",
  "track-clock",
  "span-clock",
  "marks-clock",
  "chips-clock",
  "track-elapsed",
  "span-elapsed",
  "marks-elapsed",
  "chips-elapsed",
  "ends-low",
  "ends-high",
  "summary",
  "insertions-list",
  ...["clock", "elapsed", "count"].flatMap((g) => [
    `call-${g}`,
    `copy-${g}`,
    `${g}-output`,
    `${g}-aside`,
  ]),
];

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderElapsedVsClockTemplate(args);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountElapsedVsClock(root, args, controller.signal);
  return { root, handle, controller };
}

function choose(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLSelectElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function type(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLInputElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function slide(root: HTMLElement, position: number) {
  const el = q<HTMLInputElement>(root, "end-slider");
  el.value = String(position);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const text = (root: HTMLElement, role: string) =>
  q(root, role).textContent ?? "";
const copy = (root: HTMLElement, group: string) =>
  q(root, `copy-${group}`).dataset["copyText"] ?? "";
const isSentinel = (root: HTMLElement, role: string) =>
  q(root, role).classList.contains("gmt-playground-sentinel");

/** A plate's value and its two sub lines. */
const plate = (root: HTMLElement, role: string): [string, string, string] => {
  const el = q(root, role);
  const lines = [...el.querySelectorAll(".gmt-punct-hero-line")].map(
    (l) => l.textContent ?? "",
  );
  return [
    el.querySelector(".gmt-punct-hero-value")!.textContent!,
    lines[0] ?? "",
    lines[1] ?? "",
  ];
};

const BLANK = "Not read: the field is blank.";
const NO_SIGNAL = "NO SIGNAL";
const CLOCK_LINES = ["read as UTC", "counts no inserted second"] as const;
const ELAPSED_LINES = ["read through TAI", "counts every second"] as const;

interface Expected {
  copy: { clock: string; elapsed: string; count: string };
  output: { clock: string; elapsed: string; count: string };
  plates: { clock: string; elapsed: string; count: string };
  countLines: [string, string];
  marks: number;
  list: string[];
  asides: [string, string, string];
}

const NONE_COUNTED = "No second was inserted between these two.";

/** What each preset prints, from a run against `packages/gmt/dist`. */
const EXPECTED: Record<string, Expected> = {
  "across-2016": {
    copy: {
      clock: 'spanNs("2016-12-31T23:59:59Z", "2017-01-01T00:00:01Z")',
      elapsed:
        'toTAI("2016-12-31T23:59:59Z")\ntoTAI("2017-01-01T00:00:01Z")\nspanNs("2017-01-01T00:00:35Z", "2017-01-01T00:00:38Z")',
      count:
        'leapSecondsBetween("2016-12-31T23:59:59Z", "2017-01-01T00:00:01Z")',
    },
    output: {
      clock: "2000000000n",
      elapsed:
        '"2017-01-01T00:00:35 TAI"\n"2017-01-01T00:00:38 TAI"\n3000000000n',
      count: "1",
    },
    plates: { clock: "2 s", elapsed: "3 s", count: "1" },
    countLines: ["from 2016-12-31", "to 2017-01-01"],
    marks: 1,
    list: ["2016-12-31T23:59:60Z"],
    asides: ["", "", ""],
  },
  "start-is-the-leap-second": {
    copy: {
      clock: 'spanNs("2016-12-31T23:59:60Z", "2017-01-01T00:00:00Z")',
      elapsed:
        'toTAI("2016-12-31T23:59:60Z")\ntoTAI("2017-01-01T00:00:00Z")\nspanNs("2017-01-01T00:00:36Z", "2017-01-01T00:00:37Z")',
      count:
        'leapSecondsBetween("2016-12-31T23:59:60Z", "2017-01-01T00:00:00Z")',
    },
    output: {
      clock: NO_SIGNAL,
      elapsed:
        '"2017-01-01T00:00:36 TAI"\n"2017-01-01T00:00:37 TAI"\n1000000000n',
      count: "1",
    },
    plates: { clock: "no result", elapsed: "1 s", count: "1" },
    countLines: ["from 2016-12-31", "to 2017-01-01"],
    marks: 1,
    list: ["2016-12-31T23:59:60Z"],
    asides: [CLOCK_REFUSES_TEXT, "", ""],
  },
  "twenty-four-years": {
    copy: {
      clock: 'spanNs("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
      elapsed:
        'toTAI("2000-01-01T00:00:00Z")\ntoTAI("2024-01-01T00:00:00Z")\nspanNs("2000-01-01T00:00:32Z", "2024-01-01T00:00:37Z")',
      count:
        'leapSecondsBetween("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
    },
    output: {
      clock: "757382400000000000n",
      elapsed:
        '"2000-01-01T00:00:32 TAI"\n"2024-01-01T00:00:37 TAI"\n757382405000000000n',
      count: "5",
    },
    plates: {
      clock: "757382400 s",
      elapsed: "757382405 s",
      count: "5",
    },
    countLines: ["from 2000-01-01", "to 2024-01-01"],
    marks: 5,
    list: [
      "2005-12-31T23:59:60Z",
      "2008-12-31T23:59:60Z",
      "2012-06-30T23:59:60Z",
      "2015-06-30T23:59:60Z",
      "2016-12-31T23:59:60Z",
    ],
    asides: ["", "", ""],
  },
  "no-insertions": {
    copy: {
      clock: 'spanNs("2020-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
      elapsed:
        'toTAI("2020-01-01T00:00:00Z")\ntoTAI("2024-01-01T00:00:00Z")\nspanNs("2020-01-01T00:00:37Z", "2024-01-01T00:00:37Z")',
      count:
        'leapSecondsBetween("2020-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
    },
    output: {
      clock: "126230400000000000n",
      elapsed:
        '"2020-01-01T00:00:37 TAI"\n"2024-01-01T00:00:37 TAI"\n126230400000000000n',
      count: "0",
    },
    plates: { clock: "126230400 s", elapsed: "126230400 s", count: "0" },
    countLines: ["from 2020-01-01", "to 2024-01-01"],
    marks: 0,
    list: [NONE_COUNTED],
    asides: ["", "", ""],
  },
  backwards: {
    copy: {
      clock: 'spanNs("2024-01-01T00:00:00Z", "2000-01-01T00:00:00Z")',
      elapsed:
        'toTAI("2024-01-01T00:00:00Z")\ntoTAI("2000-01-01T00:00:00Z")\nspanNs("2024-01-01T00:00:37Z", "2000-01-01T00:00:32Z")',
      count:
        'leapSecondsBetween("2024-01-01T00:00:00Z", "2000-01-01T00:00:00Z")',
    },
    output: {
      clock: "-757382400000000000n",
      elapsed:
        '"2024-01-01T00:00:37 TAI"\n"2000-01-01T00:00:32 TAI"\n-757382405000000000n',
      count: "-5",
    },
    plates: {
      clock: "-757382400 s",
      elapsed: "-757382405 s",
      count: "-5",
    },
    countLines: ["from 2024-01-01", "to 2000-01-01"],
    marks: 5,
    list: [
      "2005-12-31T23:59:60Z",
      "2008-12-31T23:59:60Z",
      "2012-06-30T23:59:60Z",
      "2015-06-30T23:59:60Z",
      "2016-12-31T23:59:60Z",
    ],
    asides: ["", "", ""],
  },
  "not-inserted": {
    copy: {
      clock: 'spanNs("2017-12-31T23:59:60Z", "2018-01-01T00:00:00Z")',
      elapsed: 'toTAI("2017-12-31T23:59:60Z")\ntoTAI("2018-01-01T00:00:00Z")',
      count:
        'leapSecondsBetween("2017-12-31T23:59:60Z", "2018-01-01T00:00:00Z")',
    },
    output: { clock: NO_SIGNAL, elapsed: NO_SIGNAL, count: NO_SIGNAL },
    plates: { clock: "no result", elapsed: "no result", count: "no result" },
    countLines: ["", ""],
    marks: 0,
    list: ["Not read: there is no count."],
    asides: [NOT_INSERTED_TEXT, NOT_INSERTED_TEXT, NOT_INSERTED_TEXT],
  },
  "before-1972": {
    copy: {
      clock: 'spanNs("1971-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
      elapsed: 'toTAI("1971-01-01T00:00:00Z")\ntoTAI("2024-01-01T00:00:00Z")',
      count:
        'leapSecondsBetween("1971-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
    },
    output: {
      clock: "1672531200000000000n",
      elapsed: NO_SIGNAL,
      count: NO_SIGNAL,
    },
    plates: { clock: "1672531200 s", elapsed: "no result", count: "no result" },
    countLines: ["", ""],
    marks: 0,
    list: ["Not read: there is no count."],
    asides: ["", BEFORE_1972_TEXT, BEFORE_1972_TEXT],
  },
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("renderElapsedVsClockTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderElapsedVsClockTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is a widget root with the standard wrapper, and no class containing card but the wrapper", () => {
    const root = document.createElement("div");
    root.innerHTML = renderElapsedVsClockTemplate();
    const widget = root.firstElementChild as HTMLElement;
    expect(widget.getAttribute("class")).toBe(
      "gmt-elapsed-vs-clock gmt-widget not-content",
    );
    expect(widget.attributes).toHaveLength(1);
    const classes = [...root.querySelectorAll("[class]")].flatMap((e) =>
      e.getAttribute("class")!.split(/\s+/),
    );
    expect(
      classes.filter((c) => c.includes("card") && c !== "gmt-widget-card"),
    ).toEqual([]);
  });

  it("renders three numbered sections and three empty plates before the library answers", () => {
    const root = document.createElement("div");
    root.innerHTML = renderElapsedVsClockTemplate();
    expect(
      [...root.querySelectorAll(".gmt-widget-section h4")].map(
        (h) => h.textContent,
      ),
    ).toEqual([
      "1. Set a start and an end",
      "2. The same span, counted two ways",
      "3. What the library returns",
    ]);
    for (const role of ["hero-clock", "hero-elapsed", "hero-count"]) {
      expect(plate(root, role)[0]).toBe("no result");
    }
    expect(q(root, "rulers").getAttribute("role")).toBe("img");
  });

  it("opens on the first preset, with a native range and text inputs", () => {
    const root = document.createElement("div");
    root.innerHTML = renderElapsedVsClockTemplate();
    expect(q<HTMLInputElement>(root, "start").value).toBe(
      "2016-12-31T23:59:59Z",
    );
    expect(q<HTMLInputElement>(root, "end").value).toBe("2017-01-01T00:00:01Z");
    expect(q<HTMLInputElement>(root, "end-slider").type).toBe("range");
    for (const role of ["start", "end"]) {
      expect(q<HTMLInputElement>(root, role).type).toBe("text");
    }
  });

  it("escapes a hostile seed", () => {
    const hostile = '"><img src=x onerror=alert(1)>';
    const root = document.createElement("div");
    root.innerHTML = renderElapsedVsClockTemplate({
      start: hostile,
      end: hostile,
    });
    expect(root.querySelector("img")).toBeNull();
    expect(q<HTMLInputElement>(root, "start").value).toBe(hostile);
  });
});

describe("every preset", () => {
  it("covers every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      ELAPSED_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(Object.entries(EXPECTED))("%s", async (id, want) => {
    const { root } = await mount();
    choose(root, "preset", id);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(id);
    for (const g of ["clock", "elapsed", "count"] as const) {
      expect(copy(root, g), g).toBe(want.copy[g]);
      expect(text(root, `${g}-output`), g).toBe(want.output[g]);
      expect(isSentinel(root, `${g}-output`), g).toBe(
        want.output[g] === NO_SIGNAL,
      );
    }
    ["clock", "elapsed", "count"].forEach((g, i) => {
      expect(text(root, `${g}-aside`), g).toContain(want.asides[i]!);
      expect(text(root, `${g}-aside`) === "", g).toBe(want.asides[i] === "");
    });
    expect(plate(root, "hero-clock")).toEqual([
      want.plates.clock,
      ...(want.plates.clock === "no result" ? ["", ""] : CLOCK_LINES),
    ]);
    expect(plate(root, "hero-elapsed")).toEqual([
      want.plates.elapsed,
      ...(want.plates.elapsed === "no result" ? ["", ""] : ELAPSED_LINES),
    ]);
    expect(plate(root, "hero-count")).toEqual([
      want.plates.count,
      ...want.countLines,
    ]);
    // Each counted second is a mark on the clock and a sliver on the elapsed ruler.
    expect(
      q(root, "marks-clock").querySelectorAll(".gmt-cutoff-mark"),
    ).toHaveLength(want.marks);
    expect(
      q(root, "marks-elapsed").querySelectorAll(".gmt-gnss-sliver"),
    ).toHaveLength(want.marks);
    expect(
      [...q(root, "chips-elapsed").querySelectorAll(".gmt-cutoff-chip")].map(
        (c) => c.textContent,
      ),
    ).toEqual(Array(want.marks).fill("+1 s"));
    expect(
      [...q(root, "insertions-list").children].map((li) => li.textContent),
    ).toEqual(want.list);
    expect(q(root, "span-clock").hidden).toBe(
      want.plates.clock === "no result",
    );
    expect(q(root, "span-elapsed").hidden).toBe(
      want.plates.elapsed === "no result",
    );
    expect(q(root, "rulers").getAttribute("aria-label")).toBe(
      text(root, "summary"),
    );
  });

  it("the rulers' ends read earlier first, whichever way the span runs", async () => {
    const { root } = await mount();
    choose(root, "preset", "backwards");
    expect([text(root, "ends-low"), text(root, "ends-high")]).toEqual([
      "2000-01-01",
      "2024-01-01",
    ]);
  });

  it("an empty list is a live answer and not a no signal", async () => {
    const { root } = await mount();
    choose(root, "preset", "no-insertions");
    expect(isSentinel(root, "count-output")).toBe(false);
    expect(text(root, "count-aside")).toBe("");
  });

  it("a blank field leaves every call out and every output empty", async () => {
    const { root } = await mount();
    type(root, "end", "");
    for (const g of ["clock", "elapsed", "count"]) {
      expect(copy(root, g)).toBe("");
      expect(text(root, `${g}-output`)).toBe(BLANK);
      expect(isSentinel(root, `${g}-output`)).toBe(false);
    }
    expect(text(root, "summary")).toBe("Give a start and an end to compare.");
  });

  it("text that is not an instant is no signal with the reason", async () => {
    const { root } = await mount();
    type(root, "start", "soon");
    for (const g of ["clock", "elapsed", "count"]) {
      expect(isSentinel(root, `${g}-output`), g).toBe(true);
      expect(text(root, `${g}-aside`), g).toContain(
        "This is not an ISO 8601 instant.",
      );
    }
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(q<HTMLInputElement>(root, "end-slider").disabled).toBe(false);
  });
});

describe("the end slider", () => {
  const at = async (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(convertUtcToUnix(iso) ?? 0);
    return mount();
  };

  it("runs from 1972-01-01 to continuous UTC while today is earlier", async () => {
    const { root } = await at("2026-10-16T09:00:00Z");
    const slider = q<HTMLInputElement>(root, "end-slider");
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("20228");
    expect(root.querySelector(".gmt-range-ends")!.textContent).toBe(
      "1972-01-012027-05-20",
    );
  });

  it("runs to the reader's today once it is later", async () => {
    const { root } = await at("2030-03-10T09:00:00Z");
    const slider = q<HTMLInputElement>(root, "end-slider");
    expect(slider.max).toBe("21253");
    expect(root.querySelector(".gmt-range-ends")!.textContent).toBe(
      "1972-01-012030-03-10",
    );
  });

  it("writes a midnight into the end and reads the new span", async () => {
    const { root } = await at("2026-10-16T09:00:00Z");
    choose(root, "preset", "twenty-four-years");
    slide(root, 20228);
    expect(q<HTMLInputElement>(root, "end").value).toBe("2027-05-20T00:00:00Z");
    expect(q<HTMLInputElement>(root, "start").value).toBe(
      "2000-01-01T00:00:00Z",
    );
    expect(plate(root, "hero-count")[0]).toBe("5");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    slide(root, 10);
    expect(q<HTMLInputElement>(root, "end").value).toBe("1972-01-11T00:00:00Z");
    // The span now runs backwards from 2000, over every second inserted since 1972.
    expect(plate(root, "hero-count")[0]).toBe("-22");
  });

  it("is disabled while the end cannot be placed, and a typed end moves it", async () => {
    const { root } = await at("2026-10-16T09:00:00Z");
    type(root, "end", "soon");
    expect(q<HTMLInputElement>(root, "end-slider").disabled).toBe(true);
    type(root, "end", "1972-01-11T12:00:00Z");
    expect(q<HTMLInputElement>(root, "end-slider").disabled).toBe(false);
    expect(q<HTMLInputElement>(root, "end-slider").value).toBe("10");
  });

  it("moving it does not resize the plates, the rulers or the list", async () => {
    const { root } = await at("2026-10-16T09:00:00Z");
    const shape = () =>
      `${q(root, "heroes").children.length}/${q(root, "rulers").children.length}/${q(root, "insertions-list").tagName}`;
    const before = shape();
    for (const day of [0, 5000, 10000, 20228]) {
      slide(root, day);
      expect(shape()).toBe(before);
    }
  });
});

describe("offset-spelled input", () => {
  it("draws the same marks as the Z spelling and prints the library's answers", async () => {
    const { root } = await mount();
    type(root, "start", "2016-12-31T23:59:59Z");
    type(root, "end", "2017-01-01T00:00:01Z");
    const z = q(root, "marks-clock").innerHTML;
    type(root, "start", "2017-01-01T08:59:59+09:00");
    type(root, "end", "2017-01-01T09:00:01+09:00");
    expect(q(root, "marks-clock").innerHTML).toBe(z);
    expect(
      q(root, "marks-clock").querySelectorAll(".gmt-cutoff-mark"),
    ).toHaveLength(1);
    expect(text(root, "clock-output")).toBe("2000000000n");
    expect(text(root, "count-output")).toBe("1");
    expect(q<HTMLInputElement>(root, "end-slider").disabled).toBe(false);
  });
});

describe("permalinks", () => {
  it.each(ELAPSED_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await mount();
      choose(first.root, "preset", id!);
      const state = first.handle.getPermalinkState?.() as Record<
        string,
        unknown
      >;
      expect(Object.keys(state).sort()).toEqual(["end", "start"]);
      expect(
        Object.values(state).every(
          (v) => typeof v === "string" && v.length >= 10 && v.length <= 64,
        ),
      ).toBe(true);
      const url = encodeWidgetPermalink("elapsed", state);
      expect(url).toMatch(
        /^\/tools\/elapsed-vs-clock-difference\/\?w=elapsed&wa=/,
      );
      const seeded = seedFromLocation("elapsed", url.slice(url.indexOf("?")));
      expect(seeded).toEqual(state);
      const outputs = ["clock", "elapsed", "count"].map((g) =>
        text(first.root, `${g}-output`),
      );
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(
        ["clock", "elapsed", "count"].map((g) =>
          text(second.root, `${g}-output`),
        ),
      ).toEqual(outputs);
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );
});

describe("on-screen words", () => {
  function screenText(root: HTMLElement): string {
    const clone = root.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll('.gmt-codeframe, output[data-role$="output"]')
      .forEach((e) => e.remove());
    const labels = [...clone.querySelectorAll("[aria-label]")].map((e) =>
      e.getAttribute("aria-label"),
    );
    return `${clone.textContent}\n${labels.join("\n")}`;
  }

  it.each(ELAPSED_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null or undefined outside the printed output",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      expect(screenText(root)).not.toMatch(/\b(null|undefined)\b/);
    },
  );

  it("names no law, regulator or national lead", async () => {
    const forbidden =
      /\b(CFR|statut|regulat|docket|agency|court|America\/|en-US|NIST|USNO)\w*/i;
    const { root } = await mount();
    const seen: string[] = [renderElapsedVsClockTemplate()];
    for (const p of ELAPSED_PRESETS) {
      choose(root, "preset", p.id);
      seen.push(root.textContent ?? "");
    }
    for (const s of seen) expect(s).not.toMatch(forbidden);
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderElapsedVsClockTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountElapsedVsClock(root, {}, controller.signal);
    expect(plate(root, "hero-clock")[0]).toBe("no result");
    expect(handle.getPermalinkState?.()).toBeNull();
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });

  it("releases its width observer on destroy, and destroying twice is safe", async () => {
    const spy = spyOnResizeObservers();
    const { handle } = await mount();
    expect(spy.live.size).toBe(1);
    handle.destroy();
    handle.destroy();
    expect(spy.live.size).toBe(0);
    spy.restore();
  });

  it("fits its chip rows again when the width changes, and keeps the drawing", async () => {
    const spy = spyOnResizeObservers();
    const { root } = await mount();
    choose(root, "preset", "twenty-four-years");
    const marks = q(root, "marks-clock").innerHTML;
    Object.defineProperty(q(root, "frame"), "clientWidth", {
      configurable: true,
      value: 480,
    });
    spy.fire();
    expect(q(root, "marks-clock").innerHTML).toBe(marks);
    spy.restore();
  });
});
