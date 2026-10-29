/**
 * @vitest-environment jsdom
 *
 * The Observance Comparator end to end against the real `@northguild/gmt`.
 * Dates are the library spec's; counts are derived from the modules.
 */
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { installJsdomShims } from "~/test/jsdom-shims";
import { textLines, unexpectedCapitalised } from "~/test/no-proper-names";
import { readArgs as readBuilderArgs } from "./holiday-rule-builder";
import {
  mountHolidayRuleBuilder,
  renderHolidayRuleBuilderTemplate,
} from "./holiday-rule-builder-mount";
import {
  COMPARATOR_PRESETS,
  FOLD_WIDTH,
  MAX_COLUMNS,
  MAX_HOLIDAYS,
  MAX_YEARS,
  MIN_COLUMNS,
  readArgs,
} from "./observance-comparator";
import {
  mountObservanceComparator,
  renderObservanceComparatorTemplate,
} from "./observance-comparator-mount";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const SENTINEL = "⟨ NO SIGNAL — invalid input ⟩";
const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;
const fire = (el: Element, type: "input" | "change") =>
  el.dispatchEvent(new Event(type, { bubbles: true }));
const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const text = (el: Element | null) =>
  (el?.textContent ?? "").replace(/\s+/gu, " ").trim();
const realRows = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>("tbody tr[data-year]"),
];
const cell = (root: HTMLElement, year: number, col: number) =>
  root.querySelector<HTMLElement>(
    `[data-action="pick-cell"][data-year="${year}"][data-col="${col}"]`,
  )!;

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderObservanceComparatorTemplate(args);
  document.body.append(root);
  const handle = await mountObservanceComparator(
    root,
    args,
    new AbortController().signal,
  );
  return { root, handle };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the opening preset", () => {
  it("draws a row per year, and always the same number of body rows", async () => {
    const { root } = await mount();
    const p = COMPARATOR_PRESETS[0]!;
    expect(realRows(root).length).toBe(Number(p.to) - Number(p.from) + 1);
    expect(root.querySelectorAll("tbody tr").length).toBe(MAX_YEARS);
  });

  it("reads 'policies disagree' on the 2021 row, with 27 and 28 Dec under next working day", async () => {
    const { root } = await mount();
    const row = root.querySelector<HTMLElement>('tr[data-year="2021"]')!;
    expect(text(row)).toContain("policies disagree");
    expect(row.hasAttribute("data-disagree")).toBe(true);
    const last = cell(root, 2021, 3);
    expect(text(last)).toContain("Mon 27 Dec");
    expect(text(last)).toContain("Tue 28 Dec");
    expect(text(cell(root, 2021, 1))).toContain("Fri 24 Dec");
  });

  it("marks an agreeing row in words too", async () => {
    const { root } = await mount();
    const agree = realRows(root).find((r) => !r.hasAttribute("data-disagree"));
    if (agree)
      expect(text(agree)).toMatch(/policies agree|nothing to compare/u);
  });

  it("selects the first disagreeing year and draws the plates and a call", async () => {
    const { root } = await mount();
    expect(root.querySelectorAll("[data-selected]").length).toBe(1);
    expect(text(q(root, "heroes"))).toContain("Columns that disagree");
    expect(text(q(root, "call-observed"))).toContain("observedDate(");
  });
});

describe("a cell that crosses a year", () => {
  it("new-year 2028, Friday-Monday, reads Fri 31 Dec 2027", async () => {
    const { root } = await mount({ preset: "new-year" });
    const heads = [...root.querySelectorAll("thead [data-action='pick-col']")];
    const col = heads.findIndex((h) =>
      text(h).startsWith("Saturday to Friday"),
    );
    const c = cell(root, 2028, col);
    expect(text(c)).toContain("Fri 31 Dec 2027");
    expect(c.querySelector("[title]")?.getAttribute("title")).toContain(
      "before",
    );
  });
});

describe("a rejected policy", () => {
  it("shows the sentinel text in every cell of its column, and the reason in the header", async () => {
    // The editor offers no Saturday-to-Saturday choice, so a link supplies it.
    const { root } = await mount({
      preset: "adjacent",
      column1: "none",
      column2: "custom:6>6",
      column3: "mon-mon",
      column4: "next-working",
    });
    const p = COMPARATOR_PRESETS[0]!;
    const years = Number(p.to) - Number(p.from) + 1;
    const cells = [
      ...root.querySelectorAll<HTMLElement>(
        '[data-action="pick-cell"][data-col="1"]',
      ),
    ];
    expect(cells.length).toBe(years);
    for (const c of cells) {
      const holidays = [...c.querySelectorAll(".gmt-obs-nosignal")];
      expect(holidays.length).toBeGreaterThan(0);
      for (const h of holidays) expect(text(h)).toContain(SENTINEL);
    }
    expect(text(root.querySelector("thead th[data-col='1']"))).toContain(
      "NO SIGNAL",
    );
  });
});

describe("the controls", () => {
  it("cannot go past the holiday or column caps, nor below the minimum", async () => {
    const { root } = await mount();
    const addH = root.querySelector<HTMLButtonElement>(
      '[data-action="add-holiday"]',
    )!;
    for (let i = 0; i < MAX_HOLIDAYS + 2; i++) click(addH);
    expect(root.querySelectorAll("li[data-holiday]").length).toBe(MAX_HOLIDAYS);
    expect(addH.disabled).toBe(true);
    const addC = root.querySelector<HTMLButtonElement>(
      '[data-action="add-column"]',
    )!;
    for (let i = 0; i < MAX_COLUMNS + 2; i++) click(addC);
    expect(root.querySelectorAll("li[data-column]").length).toBe(MAX_COLUMNS);
    for (let i = 0; i < MAX_COLUMNS + 2; i++) {
      const rm = root.querySelector<HTMLButtonElement>(
        '[data-action="remove-column"]',
      )!;
      click(rm);
    }
    expect(root.querySelectorAll("li[data-column]").length).toBe(MIN_COLUMNS);
  });

  it("keeps focus on a remove button after a holiday is removed", async () => {
    const { root } = await mount();
    const addH = root.querySelector<HTMLButtonElement>(
      '[data-action="add-holiday"]',
    )!;
    click(addH);
    const removeAt = (i: number) =>
      root.querySelector<HTMLButtonElement>(
        `[data-holiday="${i}"] [data-action="remove-holiday"]`,
      )!;
    const count = () => root.querySelectorAll("li[data-holiday]").length;
    expect(count()).toBeGreaterThanOrEqual(3);
    // The first row: focus goes to the row that took its place.
    removeAt(0).focus();
    click(removeAt(0));
    expect(document.activeElement).toBe(removeAt(0));
    // The last row: focus goes to the previous row's remove button.
    click(addH);
    const last = count() - 1;
    removeAt(last).focus();
    click(removeAt(last));
    expect(document.activeElement).toBe(removeAt(last - 1));
    // Down to one row, the remove buttons are off: focus goes to add.
    while (count() > 1) {
      removeAt(0).focus();
      click(removeAt(0));
    }
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(addH);
  });

  it("keeps focus in the field while a year is typed", async () => {
    const { root } = await mount();
    const to = q<HTMLInputElement>(root, "to");
    to.focus();
    to.value = "2025";
    fire(to, "input");
    expect(document.activeElement).toBe(to);
  });

  it("a span longer than the cap is cut with a note", async () => {
    const { root } = await mount();
    const to = q<HTMLInputElement>(root, "to");
    to.value = "2060";
    fire(to, "input");
    expect(realRows(root).length).toBe(MAX_YEARS);
    expect(text(q(root, "span-note"))).toContain(String(MAX_YEARS));
  });

  it("an empty year span is NO SIGNAL, not a blank", async () => {
    const { root } = await mount();
    const to = q<HTMLInputElement>(root, "to");
    to.value = "";
    fire(to, "input");
    expect(text(q(root, "span-note"))).toContain("NO SIGNAL");
    expect(realRows(root).length).toBe(0);
  });

  it("names a column added from the preset until the reader changes it", async () => {
    const { root } = await mount({ column1: "mon-mon" });
    const note = q(root, "column-note");
    expect(note.hidden).toBe(false);
    expect(text(note)).toBe(
      "Column 2 was added from the preset: a comparison needs at least 2 policies.",
    );
    const second = root.querySelector<HTMLSelectElement>(
      '[data-column="1"] [data-field="col-preset"]',
    )!;
    second.value = "fri-mon";
    fire(second, "change");
    expect(q(root, "column-note").hidden).toBe(true);
    expect(text(q(root, "column-note"))).toBe("");
  });

  it("drops the note with the column it names", async () => {
    const { root } = await mount({ column1: "mon-mon" });
    const add = root.querySelector<HTMLButtonElement>(
      '[data-action="add-column"]',
    )!;
    const removeFirst = () =>
      click(
        root.querySelector<HTMLButtonElement>(
          '[data-column="0"] [data-action="remove-column"]',
        )!,
      );
    click(add);
    click(add);
    expect(text(q(root, "column-note"))).toBe(
      "Column 2 was added from the preset: a comparison needs at least 2 policies.",
    );
    // The reader's own column goes, so the preset's moves up to column 1.
    removeFirst();
    expect(text(q(root, "column-note"))).toBe(
      "Column 1 was added from the preset: a comparison needs at least 2 policies.",
    );
    removeFirst();
    expect(q(root, "column-note").hidden).toBe(true);
  });

  it("has no note when the reader gave every column", async () => {
    for (const args of [{}, { column1: "mon-mon", column2: "none" }]) {
      const { root } = await mount(args);
      expect(q(root, "column-note").hidden).toBe(true);
      document.body.innerHTML = "";
    }
  });

  it("picking a cell moves the selection and the plates follow", async () => {
    const { root } = await mount();
    click(cell(root, 2026, 2));
    expect(cell(root, 2026, 2).getAttribute("aria-pressed")).toBe("true");
    expect(
      root.querySelectorAll('[aria-pressed="true"][data-action="pick-cell"]')
        .length,
    ).toBe(1);
    expect(text(q(root, "year-sentence"))).toContain("2026");
  });
});

describe("readouts hold still", () => {
  it("stepping the last year keeps the plates and the header unchanged in shape", async () => {
    const { root } = await mount();
    const to = q<HTMLInputElement>(root, "to");
    const shape = () => ({
      plates: [...q(root, "heroes").children].map(
        (p) => p.tagName + p.className,
      ),
      head: text(root.querySelector("thead")),
      body: root.querySelectorAll("tbody tr").length,
    });
    const before = shape();
    for (let i = 0; i < 10; i++) {
      to.value = String(Number(to.value) + (i % 2 === 0 ? -1 : 1));
      fire(to, "input");
      expect(shape()).toEqual(before);
    }
  });
});

describe("the Builder hand-off", () => {
  it("round-trips the rules and the policy text into the Builder's readArgs", async () => {
    const { root } = await mount();
    click(cell(root, 2021, 3));
    const link = q<HTMLAnchorElement>(root, "link-builder");
    const href = link.getAttribute("href")!;
    expect(href).toBeTruthy();
    const seeded = seedFromLocation(
      "holidays",
      new URL(href, "https://example.test").search,
    );
    const builder = readBuilderArgs(seeded as never);
    expect(builder.rows.length).toBe(
      root.querySelectorAll("li[data-holiday]").length,
    );
    expect(builder.rows.every((r) => r.policy === "6w 7w")).toBe(true);
    expect(String(builder.year)).toBe("2021");
  });

  it("is off, with a hint, when the selected column is NO SIGNAL", async () => {
    const { root } = await mount({ column1: "custom:6>6", column2: "none" });
    click(cell(root, 2021, 0));
    const link = q(root, "link-builder");
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(text(q(root, "handoff-hint"))).not.toBe("");
  });
});

describe("a hand-written date that is not on the calendar", () => {
  it.each(["02-31", "13-01"])(
    "%s shows NO SIGNAL with a reason, and draws no date",
    async (date) => {
      const { root } = await mount({ holiday1: date });
      const cells = [
        ...root.querySelectorAll<HTMLElement>('[data-action="pick-cell"]'),
      ];
      expect(cells.length).toBeGreaterThan(0);
      for (const c of cells) {
        expect(c.querySelector(".gmt-obs-nosignal")).not.toBeNull();
        expect(c.querySelector('[data-state="date"]')).toBeNull();
      }
      expect(root.innerHTML).not.toMatch(/undefined|NaN|Invalid/u);
      const note = q(root, "holiday-note");
      expect(note.hidden).toBe(false);
      expect(text(note)).toContain("holiday 1");
    },
  );
});

describe("the Builder's compare link", () => {
  it("seeds the Comparator with the row's date and policy", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderHolidayRuleBuilderTemplate("test", {});
    document.body.append(root);
    await mountHolidayRuleBuilder(root, {}, new AbortController().signal);
    const link = root.querySelector<HTMLAnchorElement>(
      '[data-role="link-compare"]',
    )!;
    expect(link).toBeTruthy();
    const href = link.getAttribute("href")!;
    expect(href).toBeTruthy();
    const seeded = seedFromLocation(
      "observance",
      new URL(href, "https://example.test").search,
    );
    const state = readArgs(seeded as never);
    expect(state.holidays.length).toBe(1);
    expect(state.year).not.toBe("");
    expect(state.columns[0]).toBe("none");
  });

  it("is only on fixed rows", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderHolidayRuleBuilderTemplate("test", {});
    document.body.append(root);
    await mountHolidayRuleBuilder(root, {}, new AbortController().signal);
    for (const li of root.querySelectorAll<HTMLElement>("[data-row]")) {
      const has = li.querySelector('[data-role="link-compare"]') !== null;
      expect(has).toBe(li.dataset["kind"] === "fixed");
    }
  });
});

describe("narrow layout structure", () => {
  it("the table box is a named container and every cell carries its column label", async () => {
    const { root } = await mount();
    expect(q(root, "matrix-box")).toBeTruthy();
    for (const td of root.querySelectorAll("tbody tr[data-year] td")) {
      expect(td.getAttribute("data-label")).toBeTruthy();
    }
  });
});

describe("the policy editor folds with the container", () => {
  let spy: ReturnType<typeof spyOnResizeObservers>;
  beforeEach(() => {
    spy = spyOnResizeObservers();
  });
  afterEach(() => spy.restore());
  const stub = (root: HTMLElement, width: number) =>
    Object.defineProperty(q(root, "columns"), "clientWidth", {
      configurable: true,
      get: () => width,
    });
  const opens = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLDetailsElement>(".gmt-holiday-policy")].map(
      (d) => d.open,
    );

  async function mountCustom(width: number) {
    const args = { column1: "custom:6>1", column2: "none" };
    const root = document.createElement("div");
    root.innerHTML = renderObservanceComparatorTemplate(args);
    document.body.append(root);
    stub(root, width);
    const handle = await mountObservanceComparator(
      root,
      args,
      new AbortController().signal,
    );
    return { root, handle };
  }

  it("is closed when narrow and open when wide, and follows a resize", async () => {
    const { root } = await mountCustom(FOLD_WIDTH - 90);
    expect(opens(root).length).toBeGreaterThan(0);
    expect(opens(root).every((o) => !o)).toBe(true);
    stub(root, FOLD_WIDTH + 200);
    spy.fire();
    expect(opens(root).every((o) => o)).toBe(true);
    stub(root, FOLD_WIDTH - 90);
    spy.fire();
    expect(opens(root).every((o) => !o)).toBe(true);
  });

  it("releases its observer on destroy", async () => {
    const { handle } = await mountCustom(FOLD_WIDTH + 200);
    expect(spy.live.size).toBeGreaterThan(0);
    handle.destroy();
    expect(spy.live.size).toBe(0);
  });
});

describe("the permalink and the words", () => {
  it("carries the edited state out", async () => {
    const { root, handle } = await mount();
    const to = q<HTMLInputElement>(root, "to");
    to.value = "2024";
    fire(to, "input");
    const state = handle.getPermalinkState!() as Record<string, string>;
    expect(state["to"]).toBe("2024");
    expect(state["preset"]).toBeUndefined();
  });

  it("names no place", async () => {
    const { root } = await mount();
    expect(unexpectedCapitalised(textLines(root))).toEqual([]);
  });
});
