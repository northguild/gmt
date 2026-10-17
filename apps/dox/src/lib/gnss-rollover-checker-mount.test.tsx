/**
 * @vitest-environment jsdom
 *
 * The GNSS Rollover Checker end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`. Values are from a run of the
 * built library, so a drift in the library or the widget fails here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installJsdomShims } from "~/test/jsdom-shims";
import { lib } from "~/test/gnss-lib";
import {
  EMPTY_TEXTS,
  ROLLOVER_PRESETS,
  ROLLOVER_SENTENCES,
  ROLLING_DATE_TEXT,
  readRollover,
  windowDays,
} from "./gnss-rollover-checker";
import {
  mountGnssRolloverChecker,
  renderGnssRolloverCheckerTemplate,
} from "./gnss-rollover-checker-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const NOW = "2026-10-15T00:00:00Z";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "counter",
  "model-pivot",
  "model-era",
  "pivot",
  "era",
  "now-today",
  "now-date",
  "date",
  "date-slider",
  "date-value",
  "frame",
  "heroes",
  "hero-reports",
  "hero-wrong-from",
  "hero-left",
  "strip",
  "strip-track",
  "strip-list",
  "strip-rows",
  "verdict",
  "verdict-text",
  "summary",
  "reason-aside",
  "counters-table",
  "counters-body",
  "era-zero-hint",
  "rolling-row",
  "call-rollover",
  "copy-rollover",
  "rollover-output",
];

const COUNTERS = [
  "GPS-LNAV",
  "GPS-CNAV",
  "GAL",
  "BDT",
  "QZS-LNAV",
  "QZS-CNAV",
  "IRN-LNAV",
  "IRN-L1NV",
];

/** What each preset shows, from a run of the built library. */
const EXPECTED: Record<
  string,
  { reported: string; verdict: string; wrongFrom: string; left: string }
> = {
  "navic-built-2020": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2039-08-17T00:00:00Z",
    left: "4689 days",
  },
  "navic-built-2020-after-wrap": {
    reported: "2020-05-17T00:00:00Z",
    verdict: "a date 7168 days early",
    wrongFrom: "2039-08-17T00:00:00Z",
    left: "past by 137 days",
  },
  "qzss-built-2005": {
    reported: "2007-03-01T00:00:04Z",
    verdict: "a date 7167 days 23 h 59 min 56 s early",
    wrongFrom: "2025-01-14T23:59:55Z",
    left: "past by 638 days 5 s",
  },
  "galileo-built-2024": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2102-07-03T00:00:00Z",
    left: "27654 days",
  },
  "beidou-built-2024": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2181-01-01T00:00:00Z",
    left: "56326 days",
  },
  "navic-fixed-era": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2038-11-20T23:59:42Z",
    left: "4419 days 23 h 59 min 42 s",
  },
  "navic-fixed-era-after-2038": {
    reported: "2019-05-18T00:00:00Z",
    verdict: "a date 7168 days early",
    wrongFrom: "2038-11-20T23:59:42Z",
    left: "past by 41 days 18 s",
  },
  "galileo-fixed-first-wrap": {
    reported: "1999-08-31T00:00:05Z",
    verdict: "a date 28671 days 23 h 59 min 55 s early",
    wrongFrom: "2078-02-19T23:59:42Z",
    left: "past by 9 days 18 s",
  },
  "gps-lnav-fixed-era": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2038-11-20T23:59:42Z",
    left: "4419 days 23 h 59 min 42 s",
  },
  "firmware-ahead": {
    reported: "2046-05-31T00:00:00Z",
    verdict: "a date 7168 days late",
    wrongFrom: "2058-07-06T23:59:42Z",
    left: "11587 days 23 h 59 min 42 s",
  },
  today: {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2102-07-03T00:00:00Z",
    left: "27654 days",
  },
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderGnssRolloverCheckerTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountGnssRolloverChecker(root, args, controller.signal);
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

function pick(root: HTMLElement, role: string) {
  const el = q<HTMLInputElement>(root, role);
  el.checked = true;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function slide(root: HTMLElement, day: number) {
  const el = q<HTMLInputElement>(root, "date-slider");
  el.value = String(day);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const text = (root: HTMLElement, role: string) =>
  q(root, role).textContent ?? "";
const isSentinel = (root: HTMLElement) =>
  q(root, "rollover-output").classList.contains("gmt-playground-sentinel");
const plateValue = (root: HTMLElement, role: string) =>
  q(root, role).querySelector(".gmt-punct-hero-value")!.textContent!;
const rows = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>('[data-role="counters-body"] tr'),
];
const cells = (row: HTMLElement) =>
  [...row.children].map((c) => {
    const lines = [...c.querySelectorAll(".gmt-clock-line")];
    const parts = lines.length > 0 ? lines : [c];
    return parts
      .map((l) => l.textContent!.replace(/\s+/g, " ").trim())
      .filter((t) => t !== "")
      .join(" ");
  });
const chips = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>('[data-role="strip-chip"]'),
];

describe("renderGnssRolloverCheckerTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssRolloverCheckerTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is a widget root with the standard wrapper, and no class containing card but the wrapper", () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssRolloverCheckerTemplate();
    const widget = root.firstElementChild as HTMLElement;
    expect(widget.className).toBe(
      "gmt-gnss-rollover-checker gmt-widget not-content",
    );
    const cardClasses = [...root.querySelectorAll("[class]")]
      .flatMap((el) => [...el.classList])
      .filter((c) => c.includes("card"));
    expect(new Set(cardClasses)).toEqual(new Set(["gmt-widget-card"]));
  });

  it("renders four numbered sections, 2 and 3 wide, with three plates, five chip slots and eight rows", () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssRolloverCheckerTemplate();
    const sections = [...root.querySelectorAll(".gmt-widget-section")];
    expect(sections.map((s) => s.querySelector("h4")!.textContent)).toEqual([
      "1. Describe the receiver",
      "2. Where the firmware goes wrong",
      "3. When each counter next wraps",
      "4. What the library returns",
    ]);
    expect(
      sections.map((s) => s.classList.contains("gmt-widget-section--wide")),
    ).toEqual([false, true, true, false]);
    expect(root.querySelectorAll(".gmt-punct-hero")).toHaveLength(3);
    expect(chips(root)).toHaveLength(5);
    expect(rows(root).map((r) => r.dataset["row"])).toEqual(COUNTERS);
  });

  it("limits every typed field to 64 characters", () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssRolloverCheckerTemplate();
    for (const role of ["pivot", "era", "date"]) {
      expect(q<HTMLInputElement>(root, role).maxLength, role).toBe(64);
    }
  });

  it("escapes a hostile seed", () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssRolloverCheckerTemplate({
      firmwareNotBefore: '"><img src=x onerror=alert(1)><script>x</script>',
    });
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      ROLLOVER_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(ROLLOVER_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    const want = EXPECTED[id!]!;
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(id);
    expect(isSentinel(root)).toBe(false);
    expect(plateValue(root, "hero-reports")).toBe(want.reported);
    expect(text(root, "hero-reports")).toContain(want.verdict);
    expect(plateValue(root, "hero-wrong-from")).toBe(want.wrongFrom);
    expect(plateValue(root, "hero-left")).toBe(want.left);
    expect(rows(root)).toHaveLength(8);
    expect(text(root, "reason-aside")).toBe("");
    expect(text(root, "call-rollover")).toContain("utcToGnssWeek");
    // One result line for each call line.
    expect(text(root, "rollover-output").split("\n")).toHaveLength(
      text(root, "call-rollover").split("\n").length,
    );
  });
});

describe("the table", () => {
  it("lists all eight counters, lights the receiver's own and tags the next to wrap", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    expect(rows(root).map((r) => r.dataset["row"])).toEqual(COUNTERS);
    const lit = rows(root).filter((r) => r.hasAttribute("data-reading"));
    expect(lit.map((r) => r.dataset["row"])).toEqual(["IRN-LNAV"]);
    expect(lit[0]!.getAttribute("data-series")).toBe("1");
    const byName = (n: string) =>
      cells(rows(root).find((r) => r.dataset["row"] === n)!);
    expect(byName("IRN-LNAV")).toEqual([
      "IRN-LNAV your receiver · next to wrap",
      "weeks below 1024",
      "2038-11-20T23:59:42Z",
      "4419 days",
    ]);
    expect(byName("GPS-LNAV")[0]).toBe("GPS-LNAV next to wrap");
    expect(byName("GAL")).toEqual([
      "GAL",
      "weeks below 4096",
      "2078-02-19T23:59:42Z",
      expect.stringMatching(/^\d+ days$/),
    ]);
    expect(byName("BDT")[2]).toBe("2163-01-01T23:59:56Z");
    expect(byName("GPS-CNAV")[1]).toBe("weeks below 8192");
  });

  it("keeps all eight rows when the reading goes to NO SIGNAL", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    type(root, "date", "garbage");
    expect(rows(root).map((r) => r.dataset["row"])).toEqual(COUNTERS);
  });

  it("says the rolling receiver can only be pinned by a live clock", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    expect(text(root, "rolling-row")).toBe(ROLLING_DATE_TEXT);
    pick(root, "now-today");
    expect(text(root, "rolling-row")).toContain("rolling reads");
  });
});

describe("the strip", () => {
  it("is a labelled image with a hidden list of its marks, and nothing inside takes focus", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    const drawing = q(root, "strip");
    expect(drawing.getAttribute("role")).toBe("img");
    const label = drawing.getAttribute("aria-label")!;
    expect(label).toContain("Fuse timeline of the IRN-LNAV counter");
    expect(label).toContain(
      "The firmware reads right from 2020-01-01T00:00:00Z to 2039-08-17T00:00:00Z, then reports one counter period early to 2059-04-02T00:00:00Z.",
    );
    expect(label).toContain("This counter next wraps at 2038-11-20T23:59:42Z.");
    const items = [...q(root, "strip-list").querySelectorAll("li")].map(
      (li) => li.textContent,
    );
    expect(items).toContain("build date: 2020-01-01T00:00:00Z");
    expect(items).toContain("wrong from: 2039-08-17T00:00:00Z");
    expect(items).toContain("check date: 2026-10-15T00:00:00Z");
    expect(
      drawing.querySelectorAll("a, button, input, select, [tabindex]"),
    ).toHaveLength(0);
  });

  it("lights the window to the wrong date, hatches the rest, and pins the check date", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    const lit = q<HTMLElement>(root, "strip-lit");
    const hatch = q<HTMLElement>(root, "strip-hatch");
    expect(lit.hidden).toBe(false);
    expect(hatch.hidden).toBe(false);
    expect(hatch.classList.contains("gmt-gnss-hatch")).toBe(true);
    expect(hatch.style.getPropertyValue("--from")).toBe(
      lit.style.getPropertyValue("--to"),
    );
    expect(q<HTMLElement>(root, "strip-pin").hidden).toBe(false);
    // In a date mode the reader's clock is still marked, so the window can be
    // read against now; the clock is pinned to the same day as the check here.
    expect(q<HTMLElement>(root, "strip-today").hidden).toBe(false);
    expect(text(root, "strip-key-hatch")).toBe(
      "reports one counter period early",
    );
  });

  it("draws a today mark, not a pin, when checking today", async () => {
    const { root } = await mount({ preset: "today" });
    expect(q<HTMLElement>(root, "strip-today").hidden).toBe(false);
    expect(q<HTMLElement>(root, "strip-pin").hidden).toBe(true);
  });

  it("always has five chip slots, and fills only the marks it has", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    expect(chips(root)).toHaveLength(5);
    const filled = chips(root).filter((c) => !c.hasAttribute("data-blank"));
    expect(filled.length).toBeGreaterThanOrEqual(3);
    expect(filled[0]!.textContent).toBe("build date 2020-01-01T00:00:00Z");
    type(root, "pivot", "garbage");
    expect(chips(root)).toHaveLength(5);
    expect(chips(root).every((c) => c.hasAttribute("data-blank"))).toBe(true);
  });

  it("says a mark outside the window is outside", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    type(root, "date", "2200-01-01T00:00:00Z");
    expect(text(root, "strip-list")).toContain("(outside the timeline drawn)");
    expect(q<HTMLElement>(root, "strip-pin").hidden).toBe(true);
  });
});

describe("the fuse timeline", () => {
  const rowsOf = (root: HTMLElement) => [
    ...root.querySelectorAll<HTMLElement>(".gmt-fuse-row"),
  ];

  it("draws a skeleton of eight rows and three width headings before the library loads", () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssRolloverCheckerTemplate();
    expect(rowsOf(root)).toHaveLength(8);
    expect(root.querySelectorAll(".gmt-fuse-head")).toHaveLength(3);
    expect(root.querySelectorAll(".gmt-fuse-year").length).toBeGreaterThan(5);
  });

  it("draws one track per counter, grouped by width, with the receiver's own marked", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    expect(rowsOf(root).map((r) => r.dataset["counter"])).toEqual([
      "GPS-LNAV",
      "QZS-LNAV",
      "IRN-LNAV",
      "GAL",
      "GPS-CNAV",
      "BDT",
      "QZS-CNAV",
      "IRN-L1NV",
    ]);
    expect(
      [...root.querySelectorAll(".gmt-fuse-head")].map((h) => h.textContent),
    ).toEqual([
      "10-bit counters, weeks below 1024",
      "12-bit counters, weeks below 4096",
      "13-bit counters, weeks below 8192",
    ]);
    expect(
      rowsOf(root)
        .filter((r) => r.hasAttribute("data-yours"))
        .map((r) => r.dataset["counter"]),
    ).toEqual(["IRN-LNAV"]);
  });

  it("emphasises every counter's next wrap and puts the window on the receiver's track", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    const next = root.querySelectorAll('.gmt-fuse-tick[data-state="next"]');
    expect(next).toHaveLength(8);
    const own = rowsOf(root).find((r) => r.dataset["counter"] === "IRN-LNAV")!;
    for (const role of [
      "strip-lit",
      "strip-hatch",
      "strip-spark",
      "strip-fuse",
    ]) {
      expect(own.contains(q(root, role)), role).toBe(true);
    }
    type(root, "date", "2030-01-01T00:00:00Z");
    expect(
      root.querySelectorAll('.gmt-fuse-tick[data-state="past"]').length,
    ).toBeGreaterThan(0);
    expect(q<HTMLElement>(root, "strip-fuse").hidden).toBe(false);
  });

  it("keeps the window on the track of a newly chosen counter", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    choose(root, "counter", "GAL");
    const own = rowsOf(root).find((r) => r.dataset["counter"] === "GAL")!;
    expect(own.contains(q(root, "strip-lit"))).toBe(true);
    expect(own.hasAttribute("data-yours")).toBe(true);
    expect(
      rowsOf(root).filter((r) => r.hasAttribute("data-yours")),
    ).toHaveLength(1);
  });

  it("burns out the fuse once the check date is past the wrong-from date", async () => {
    const { root } = await mount({ preset: "navic-built-2020-after-wrap" });
    expect(q<HTMLElement>(root, "strip-fuse").hidden).toBe(true);
  });
});

describe("the countdown and the badge", () => {
  it("shows days, hours, minutes and seconds in fixed cells, and the words as text", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    const cells = [...q(root, "hero-left").querySelectorAll(".gmt-fuse-cell")];
    expect(cells.map((c) => c.getAttribute("data-unit"))).toEqual([
      "days",
      "h",
      "min",
      "s",
    ]);
    expect(cells[0]!.querySelector("b")!.textContent).toBe("4689");
    expect(plateValue(root, "hero-left")).toBe("4689 days");
  });

  it("counts past the date with a Past by caption", async () => {
    const { root } = await mount({ preset: "navic-built-2020-after-wrap" });
    const hero = q(root, "hero-left");
    expect(hero.hasAttribute("data-past")).toBe(true);
    expect(hero.querySelector(".gmt-punct-hero-cap")!.textContent).toBe(
      "Past by",
    );
  });

  it("says the verdict in a badge", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    expect(q(root, "verdict").getAttribute("data-verdict")).toBe("right");
    expect(text(root, "verdict-text")).toBe("Reports the right date");
    choose(root, "preset", "navic-built-2020-after-wrap");
    expect(q(root, "verdict").getAttribute("data-verdict")).toBe("early");
    expect(text(root, "verdict-text")).toBe("Reports a date 7168 days early");
    choose(root, "preset", "firmware-ahead");
    expect(q(root, "verdict").getAttribute("data-verdict")).toBe("late");
  });

  it("shows no result in the badge and an empty countdown under a sentinel", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    type(root, "pivot", "garbage");
    expect(q(root, "verdict").getAttribute("data-verdict")).toBe("none");
    expect(text(root, "verdict-text")).toBe("no result");
    expect(q(root, "hero-left").hasAttribute("data-empty")).toBe(true);
    expect(q(root, "hero-left").querySelector(".gmt-fuse-digits")).toBeNull();
  });
});

describe("the plates", () => {
  it("say what a correct and a failed receiver report", async () => {
    const { root } = await mount({ preset: "navic-built-2020-after-wrap" });
    expect(text(root, "hero-reports")).toContain("a date 7168 days early");
    expect(text(root, "hero-left")).toContain(
      "since it began reporting an early date",
    );
  });

  it("read no result under a sentinel", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    type(root, "pivot", "garbage");
    expect(
      [...root.querySelectorAll(".gmt-punct-hero")].every((p) =>
        p.hasAttribute("data-empty"),
      ),
    ).toBe(true);
  });
});

describe("the era 0 hint", () => {
  it("says a build date before the first week is read as era 0, in a held line", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    const hint = q(root, "era-zero-hint");
    expect((hint.textContent ?? "").trim()).toBe("");
    type(root, "pivot", "1970-01-01T00:00:00Z");
    expect(isSentinel(root)).toBe(false);
    expect(hint.textContent).toMatch(
      /^Build date before .+'s first week \(.+\): read as era 0\.$/,
    );
    type(root, "pivot", "2020-01-01T00:00:00Z");
    expect((hint.textContent ?? "").trim()).toBe("");
    // The line sits in a hold sized by the longest hint it can show.
    expect(hint.closest(".gmt-ledger-hold")).not.toBeNull();
  });
});

describe("the sentinel sentences", () => {
  it("are different sentences for different faults, each a NO SIGNAL", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    const sentences = new Set<string>();
    type(root, "pivot", "garbage");
    expect(isSentinel(root)).toBe(true);
    expect(text(root, "rollover-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain(ROLLOVER_SENTENCES.pivot);
    sentences.add(text(root, "reason-aside"));
    type(root, "pivot", "2020-01-01T00:00:00Z");

    type(root, "date", "garbage");
    expect(isSentinel(root)).toBe(true);
    expect(text(root, "reason-aside")).toContain(ROLLOVER_SENTENCES.date);
    sentences.add(text(root, "reason-aside"));

    type(root, "date", "2016-12-31T23:59:60Z");
    expect(isSentinel(root)).toBe(true);
    expect(text(root, "reason-aside")).toContain(
      ROLLOVER_SENTENCES.secondSixty,
    );
    sentences.add(text(root, "reason-aside"));

    type(root, "date", NOW);
    pick(root, "model-era");
    type(root, "era", "abc");
    expect(isSentinel(root)).toBe(true);
    expect(text(root, "reason-aside")).toContain(ROLLOVER_SENTENCES.era);
    sentences.add(text(root, "reason-aside"));
    expect(sentences.size).toBe(4);
  });

  it("a blank field is an empty state, never amber", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    type(root, "pivot", "");
    expect(isSentinel(root)).toBe(false);
    expect(text(root, "rollover-output").trim()).toBe("");
    expect(text(root, "reason-aside")).toContain(EMPTY_TEXTS.pivot);
    expect(root.querySelector(".gmt-playground-sentinel")).toBeNull();
    type(root, "pivot", "2020-01-01T00:00:00Z");
    type(root, "date", "");
    expect(isSentinel(root)).toBe(false);
    expect(text(root, "reason-aside")).toContain(EMPTY_TEXTS.date);
    expect(rows(root)).toHaveLength(8);
  });

  it("names a date past the year 9999, not a date before the first week", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    pick(root, "now-date");
    type(root, "date", "9999-12-31T23:00:00-05:00");
    expect(isSentinel(root)).toBe(true);
    expect(text(root, "reason-aside")).toContain(
      ROLLOVER_SENTENCES.dateAfter9999,
    );
  });

  it("a correct wrong-date answer is a result, not a NO SIGNAL", async () => {
    const { root } = await mount({ preset: "navic-built-2020-after-wrap" });
    expect(isSentinel(root)).toBe(false);
    expect(text(root, "reason-aside")).toBe("");
  });
});

describe("the form", () => {
  it("opens on the first preset", async () => {
    const { root } = await mount();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("navic-built-2020");
    expect(q<HTMLSelectElement>(root, "counter").value).toBe("IRN-LNAV");
    expect(q<HTMLInputElement>(root, "pivot").value).toBe(
      "2020-01-01T00:00:00Z",
    );
  });

  it("makes the preset custom when a field changes, and back when it matches", async () => {
    const { root } = await mount();
    type(root, "pivot", "2021-01-01T00:00:00Z");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    type(root, "pivot", "2020-01-01T00:00:00Z");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("navic-built-2020");
    choose(root, "counter", "GAL");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("shows the build date or the era by how the firmware counts", async () => {
    const { root } = await mount();
    const field = (n: string) =>
      root.querySelector<HTMLElement>(`[data-field="${n}"]`)!;
    expect(field("pivot").hidden).toBe(false);
    expect(field("era").hidden).toBe(true);
    pick(root, "model-era");
    expect(field("pivot").hidden).toBe(true);
    expect(field("era").hidden).toBe(false);
  });

  it("shows the date and the slider only when checking a date", async () => {
    const { root } = await mount();
    const field = (n: string) =>
      root.querySelector<HTMLElement>(`[data-field="${n}"]`)!;
    expect(field("date").hidden).toBe(false);
    expect(field("date-slider").hidden).toBe(false);
    pick(root, "now-today");
    expect(field("date").hidden).toBe(true);
    expect(field("date-slider").hidden).toBe(true);
    expect(q<HTMLInputElement>(root, "date-slider").disabled).toBe(true);
  });

  it("carries the moment being watched into the date when switching to a date", async () => {
    vi.setSystemTime("2026-11-02T03:04:05Z");
    const { root } = await mount({ preset: "today" });
    pick(root, "now-date");
    expect(q<HTMLInputElement>(root, "date").value).toBe(
      "2026-11-02T03:04:05Z",
    );
    expect(plateValue(root, "hero-reports")).toBe("2026-11-02T03:04:05Z");
  });

  it("checks an era the firmware fixes", async () => {
    const { root } = await mount({ preset: "navic-fixed-era" });
    expect(q<HTMLInputElement>(root, "model-era").checked).toBe(true);
    type(root, "era", "2");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(isSentinel(root)).toBe(false);
    expect(plateValue(root, "hero-wrong-from")).not.toBe(
      EXPECTED["navic-fixed-era"]!.wrongFrom,
    );
  });
});

describe("the slider", () => {
  it("spans the firmware's window by day and follows a whole-day date", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    const slider = q<HTMLInputElement>(root, "date-slider");
    const read = readRollover(
      lib,
      ROLLOVER_PRESETS.find((p) => p.id === "navic-built-2020")!.state,
      NOW,
    );
    const days = windowDays(lib, read)!;
    expect(slider.disabled).toBe(false);
    expect(Number(slider.min)).toBe(0);
    expect(Number(slider.max)).toBe(days);
    const toToday = lib.diffUtcAsDuration("2020-01-01T00:00:00Z", NOW, "days");
    expect(toToday).toBe(`P${slider.value}D`);
    expect(text(root, "date-value")).toBe(NOW);
  });

  it("writes the day's date into the field and reads it", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    slide(root, 0);
    expect(q<HTMLInputElement>(root, "date").value).toBe(
      "2020-01-01T00:00:00Z",
    );
    expect(plateValue(root, "hero-reports")).toBe("2020-01-01T00:00:00Z");
    expect(text(root, "date-value")).toBe("2020-01-01T00:00:00Z");
    const max = Number(q<HTMLInputElement>(root, "date-slider").max);
    slide(root, max);
    const date = q<HTMLInputElement>(root, "date").value;
    expect(lib.diffUtcAsDuration("2020-01-01T00:00:00Z", date, "days")).toBe(
      `P${max}D`,
    );
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("has a typed equivalent and leaves the slider for a date that is not a whole day", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    slide(root, 5);
    type(root, "date", "2030-05-05T05:05:05Z");
    expect(q<HTMLInputElement>(root, "date-slider").value).toBe("5");
    type(root, "date", "2020-01-11T00:00:00Z");
    expect(q<HTMLInputElement>(root, "date-slider").value).toBe("10");
  });

  it("is a native range, labelled, and is off when there is no window", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    const slider = q<HTMLInputElement>(root, "date-slider");
    expect(slider.type).toBe("range");
    expect(slider.closest("label")!.textContent).toContain(
      "Slide the date through the firmware's window",
    );
    type(root, "pivot", "garbage");
    expect(slider.disabled).toBe(true);
  });
});

describe("the live clock", () => {
  it("counts down once a second in Today mode and stops when a date is chosen", async () => {
    const { root, handle } = await mount({ preset: "today" });
    expect(plateValue(root, "hero-left")).toBe("27654 days");
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(plateValue(root, "hero-left")).toBe("27653 days 23 h 59 min 59 s");
    pick(root, "now-date");
    expect(vi.getTimerCount()).toBe(0);
    const frozen = plateValue(root, "hero-left");
    vi.advanceTimersByTime(5000);
    expect(plateValue(root, "hero-left")).toBe(frozen);
    pick(root, "now-today");
    expect(vi.getTimerCount()).toBe(1);
    handle.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the ticking instant out of the live sentence", async () => {
    const { root } = await mount({ preset: "today" });
    const summary = q(root, "summary");
    const before = summary.textContent ?? "";
    expect(before).not.toBe("");
    expect(before).not.toContain("2026-10-15T00:00:00Z");
    const watch = new MutationObserver(() => {});
    watch.observe(summary, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    vi.advanceTimersByTime(3000);
    expect(summary.textContent).toBe(before);
    expect(watch.takeRecords()).toHaveLength(0);
    watch.disconnect();
  });

  it("speaks again in Today mode when the verdict changes", async () => {
    const { root } = await mount({ preset: "today" });
    const summary = q(root, "summary");
    const before = summary.textContent;
    choose(root, "counter", "GPS-LNAV");
    expect(summary.textContent).not.toBe(before);
  });

  it("still states the date in a pinned-date reading", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    expect(q(root, "summary").textContent).toContain("2039-08-17T00:00:00Z");
  });

  it("never starts a clock for a pinned date", async () => {
    await mount({ preset: "navic-built-2020" });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("seeding and permalinks", () => {
  it("seeds a chat call's values and paints them on the first frame", async () => {
    const seed = {
      counter: "GAL",
      firmwareNotBefore: "2024-01-01T00:00:00Z",
      date: NOW,
    };
    const template = renderGnssRolloverCheckerTemplate(seed);
    expect(template).toContain('value="2024-01-01T00:00:00Z"');
    const { root } = await mount(seed);
    expect(q<HTMLSelectElement>(root, "counter").value).toBe("GAL");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(
      "galileo-built-2024",
    );
    expect(plateValue(root, "hero-wrong-from")).toBe(
      EXPECTED["galileo-built-2024"]!.wrongFrom,
    );
  });

  it("seeds an era", async () => {
    const { root } = await mount({
      counter: "GPS-LNAV",
      firmwareEra: "2",
      date: NOW,
    });
    expect(q<HTMLInputElement>(root, "model-era").checked).toBe(true);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(
      "gps-lnav-fixed-era",
    );
  });

  it.each(ROLLOVER_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of one string",
    async (id) => {
      const first = await mount();
      choose(first.root, "preset", id!);
      const state = first.handle.getPermalinkState?.() as Record<
        string,
        unknown
      >;
      expect(state).toEqual({ preset: id });
      const url = encodeWidgetPermalink("rollover", state);
      expect(url).toMatch(/^\/tools\/gnss-rollover-checker\/\?w=rollover&wa=/);
      const seeded = seedFromLocation("rollover", url.slice(url.indexOf("?")));
      expect(seeded).toEqual(state);
      const output = text(first.root, "rollover-output");
      const reason = text(first.root, "reason-aside");
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(text(second.root, "rollover-output")).toBe(output);
      expect(text(second.root, "reason-aside")).toBe(reason);
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );

  it("writes a custom check as the counter, the firmware key and the date, all strings of at most 64", async () => {
    const { root, handle } = await mount();
    type(root, "pivot", "2021-01-01T00:00:00Z");
    const state = handle.getPermalinkState?.() as Record<string, string>;
    expect(state).toEqual({
      counter: "IRN-LNAV",
      firmwareNotBefore: "2021-01-01T00:00:00Z",
      date: NOW,
    });
    for (const v of Object.values(state)) {
      expect(typeof v).toBe("string");
      expect(v.length).toBeLessThanOrEqual(64);
    }
    const url = encodeWidgetPermalink("rollover", state);
    expect(seedFromLocation("rollover", url.slice(url.indexOf("?")))).toEqual(
      state,
    );
  });

  it("writes no date for a check of today, and an era in place of a build date", async () => {
    const { root, handle } = await mount({ preset: "today" });
    pick(root, "model-era");
    type(root, "era", "1");
    expect(handle.getPermalinkState?.()).toEqual({
      counter: "GAL",
      firmwareEra: "1",
    });
  });
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

  it.each(ROLLOVER_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null, no GPS-only wording, and names no body, zone or country",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      const shown = screenText(root);
      expect(shown).not.toMatch(/\bnull\b|undefined|NaN/);
      expect(shown).not.toMatch(/GPS rollover|GPS week rollover/i);
      expect(shown).not.toMatch(/UTC\+3|Moscow|MSK|New_York|en-US|\bGMT\b/);
      expect(shown).not.toMatch(/GLONASS/);
    },
  );

  it("states the reading in one hidden live sentence", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    const summary = q(root, "summary");
    expect(summary.getAttribute("aria-live")).toBe("polite");
    expect(summary.textContent).toContain("IRN-LNAV receiver reports");
    expect(summary.textContent).toContain("2039-08-17T00:00:00Z");
  });

  it("uses real controls", async () => {
    const { root } = await mount();
    expect(root.querySelectorAll("select")).toHaveLength(2);
    expect(root.querySelectorAll('input[type="text"]')).toHaveLength(3);
    expect(root.querySelectorAll('input[type="range"]')).toHaveLength(1);
    expect(root.querySelectorAll('input[type="radio"]')).toHaveLength(4);
  });

  it("prints the calls it made", async () => {
    const { root } = await mount({ preset: "today" });
    const calls = text(root, "call-rollover");
    expect(calls).toContain("utcToGnssWeek");
    expect(calls).toContain("gnssWeekToUtc");
    expect(calls).toContain("diffUtcAsDuration");
    expect(calls).toContain("areUtcEqual");
    expect(calls).toContain('"rolling"');
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssRolloverCheckerTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountGnssRolloverChecker(root, {}, controller.signal);
    expect(text(root, "rollover-output")).toBe("\u00a0");
    expect(vi.getTimerCount()).toBe(0);
    handle.destroy();
    handle.destroy();
  });
});

describe("the links row (D13)", () => {
  const ERAS = "See every era of this reading";
  const link = (root: HTMLElement) => q<HTMLAnchorElement>(root, "link-eras");
  const state = (root: HTMLElement) => ({
    text: link(root).textContent,
    href: link(root).getAttribute("href"),
    disabled: link(root).getAttribute("aria-disabled"),
  });
  const disabled = { text: ERAS, href: null, disabled: "true" };

  /** The week and time of week the counter broadcasts at `utc`, from the library. */
  function broadcast(counter: string, utc: string) {
    const w = lib.utcToGnssWeek(counter as never, utc)!;
    return {
      week: String(w.week),
      timeOfWeekSeconds: String(w.timeOfWeekSeconds),
    };
  }

  it("has the one link in the links row", async () => {
    const { root } = await mount();
    const row = q(root, "tool-links");
    expect(row.classList.contains("gmt-widget-controls")).toBe(true);
    expect(
      [...row.querySelectorAll("a")].map((a) => a.dataset["role"]),
    ).toEqual(["link-eras"]);
  });

  it("sends the broadcast week and time of week and the build date to the Week Decoder", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    expect(state(root)).toEqual({
      text: ERAS,
      href: encodeWidgetPermalink("gnssweek", {
        mode: "broadcast",
        counter: "IRN-LNAV",
        ...broadcast("IRN-LNAV", NOW),
        rolloverNotBefore: "2020-01-01T00:00:00Z",
      }),
      disabled: null,
    });
  });

  it("sends a fixed era as rolloverEra", async () => {
    const { root } = await mount({ preset: "gps-lnav-fixed-era" });
    expect(link(root).getAttribute("href")).toBe(
      encodeWidgetPermalink("gnssweek", {
        mode: "broadcast",
        counter: "GPS-LNAV",
        ...broadcast("GPS-LNAV", NOW),
        rolloverEra: "2",
      }),
    );
  });

  it("sends the week the receiver broadcasts, which is the true week after the window ends", async () => {
    const { root } = await mount({ preset: "navic-built-2020-after-wrap" });
    expect(link(root).getAttribute("href")).toBe(
      encodeWidgetPermalink("gnssweek", {
        mode: "broadcast",
        counter: "IRN-LNAV",
        ...broadcast("IRN-LNAV", "2040-01-01T00:00:00Z"),
        rolloverNotBefore: "2020-01-01T00:00:00Z",
      }),
    );
  });

  it("follows the slider's date", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    slide(root, 0);
    expect(link(root).getAttribute("href")).toBe(
      encodeWidgetPermalink("gnssweek", {
        mode: "broadcast",
        counter: "IRN-LNAV",
        ...broadcast("IRN-LNAV", "2020-01-01T00:00:00Z"),
        rolloverNotBefore: "2020-01-01T00:00:00Z",
      }),
    );
  });

  it("is disabled, with no href, on NO SIGNAL and lit again by a good reading", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    expect(link(root).hasAttribute("href")).toBe(true);
    type(root, "pivot", "garbage");
    expect(state(root)).toEqual(disabled);
    type(root, "pivot", "2020-01-01T00:00:00Z");
    type(root, "date", "2016-12-31T23:59:60Z");
    expect(state(root)).toEqual(disabled);
    type(root, "date", NOW);
    expect(link(root).hasAttribute("href")).toBe(true);
    expect(link(root).hasAttribute("aria-disabled")).toBe(false);
    pick(root, "model-era");
    type(root, "era", "abc");
    expect(state(root)).toEqual(disabled);
  });

  it("is disabled for a blank field", async () => {
    const { root } = await mount({ preset: "navic-built-2020" });
    type(root, "date", "");
    expect(state(root)).toEqual(disabled);
  });

  it("lands on a seed the Week Decoder reads back as the reading's own", async () => {
    const { root } = await mount({ preset: "galileo-built-2024" });
    const href = link(root).getAttribute("href")!;
    const seed = seedFromLocation("gnssweek", href.slice(href.indexOf("?")));
    expect(seed).toEqual({
      mode: "broadcast",
      counter: "GAL",
      ...broadcast("GAL", NOW),
      rolloverNotBefore: "2024-01-01T00:00:00Z",
    });
  });
});
