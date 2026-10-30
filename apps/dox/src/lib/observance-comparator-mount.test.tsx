/**
 * @vitest-environment jsdom
 *
 * The Observance Comparator end to end against the real `@northguild/gmt`, through roles and
 * accessible names the way a reader meets the page. Dates are the library spec's; counts
 * are derived from the modules.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { textLines, unexpectedCapitalised } from "~/test/no-proper-names";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { readArgs as readBuilderArgs } from "./holiday-rule-builder";
import {
  COMPARATOR_PRESETS,
  FOLD_WIDTH,
  MAX_COLUMNS,
  MAX_HOLIDAYS,
  MAX_YEARS,
  MIN_COLUMNS,
  readArgs,
} from "./observance-comparator";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showObservanceComparator"] as AnyWidgetEntry;
const builderEntry = WIDGET_REGISTRY[
  "showHolidayRuleBuilder"
] as AnyWidgetEntry;

async function mount(args: unknown = {}): Promise<RenderedWidget> {
  return renderWidget(entry, { args });
}

const table = () => screen.getByRole("table");
/** One row header per drawn year; the padding rows are hidden and inert. */
const yearRows = () => within(table()).queryAllByRole("rowheader");
/** A year's cell buttons, one per column, in column order. */
const cellsOf = (year: number) =>
  within(table()).queryAllByRole("button", { name: new RegExp(`^${year}, `) });
const cell = (year: number, column: number) => cellsOf(year)[column]!;
const yearButton = (year: number) =>
  within(table()).getByRole("button", { name: String(year) });
const selectedCells = () =>
  within(table()).queryAllByRole("button", {
    pressed: true,
    name: /^\d{4}, /,
  });
const note = (name: string) => screen.getByRole("note", { name });
const summary = () => screen.getByRole("status", { name: "Year summary" });
const lastYear = () => screen.getByRole("spinbutton", { name: "Last year" });
const addHoliday = () => screen.getByRole("button", { name: "Add holiday" });
const addColumn = () => screen.getByRole("button", { name: "Add column" });
const removeHolidays = () =>
  screen.queryAllByRole("button", { name: /^Remove holiday \d+$/ });
const removeColumns = () =>
  screen.queryAllByRole("button", { name: /^Remove column \d+$/ });
const handoff = () =>
  within(
    screen.getByRole("group", { name: "Open this column in another tool" }),
  ).getByText("Build this column's calendar");
const calls = () =>
  screen.getByRole("group", { name: "observedDate calls", hidden: true });

describe("the opening preset", () => {
  it("draws a row per year, and always the same number of body rows", async () => {
    const { root } = await mount();
    const p = COMPARATOR_PRESETS[0]!;
    expect(yearRows()).toHaveLength(Number(p.to) - Number(p.from) + 1);
    // Header row plus MAX_YEARS body rows, the padding ones hidden.
    expect(within(table()).getAllByRole("row", { hidden: true })).toHaveLength(
      MAX_YEARS + 1,
    );
    await expectNoAxeViolations(root);
  });

  it("reads 'policies disagree' on the 2021 row, with 27 and 28 Dec under next working day", async () => {
    await mount();
    expect(
      within(table()).getByRole("rowheader", {
        name: /2021.*policies disagree/u,
      }),
    ).toBeInTheDocument();
    expect(cell(2021, 3)).toHaveAccessibleName(/Mon 27 Dec/u);
    expect(cell(2021, 3)).toHaveAccessibleName(/Tue 28 Dec/u);
    expect(cell(2021, 1)).toHaveAccessibleName(/Fri 24 Dec/u);
  });

  it("marks an agreeing row in words too", async () => {
    await mount();
    const agree = yearRows().find((h) =>
      /policies agree/u.test(h.textContent ?? ""),
    );
    const nothing = yearRows().find((h) =>
      /nothing to compare/u.test(h.textContent ?? ""),
    );
    const disagree = yearRows().filter((h) =>
      /policies disagree/u.test(h.textContent ?? ""),
    );
    expect(agree ?? nothing ?? disagree[0]).toBeDefined();
  });

  it("selects the first disagreeing year and draws the plates and a call", async () => {
    await mount();
    expect(selectedCells()).toHaveLength(1);
    expect(screen.getByText("Columns that disagree")).toBeInTheDocument();
    expect(calls()).toHaveTextContent("observedDate(");
    expect(summary()).toHaveTextContent("policies disagree");
  });
});

describe("a cell that crosses a year", () => {
  it("new-year 2028, Friday-Monday, reads Fri 31 Dec 2027", async () => {
    await mount({ preset: "new-year" });
    const heads = within(table()).getAllByRole("columnheader");
    const column = heads
      .slice(1)
      .findIndex((h) => (h.textContent ?? "").startsWith("Saturday to Friday"));
    expect(column).toBeGreaterThanOrEqual(0);
    expect(cell(2028, column)).toHaveAccessibleName(/Fri 31 Dec 2027/u);
    expect(cell(2028, column)).toHaveAccessibleName(/before/u);
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
    for (let y = Number(p.from); y < Number(p.from) + years; y++) {
      expect(cell(y, 1)).toHaveAccessibleName(/no signal, invalid input/u);
    }
    const heads = within(table()).getAllByRole("columnheader");
    expect(heads[2]).toHaveTextContent("NO SIGNAL");
    await expectNoAxeViolations(root);
  });
});

describe("the controls", () => {
  it("cannot go past the holiday or column caps, nor below the minimum", async () => {
    const { user, root } = await mount();
    for (let i = 0; i < MAX_HOLIDAYS + 2; i++) {
      if (!addHoliday().hasAttribute("disabled"))
        await user.click(addHoliday());
    }
    expect(removeHolidays()).toHaveLength(MAX_HOLIDAYS);
    expect(addHoliday()).toBeDisabled();
    await expectNoAxeViolations(root);

    for (let i = 0; i < MAX_COLUMNS + 2; i++) {
      if (!addColumn().hasAttribute("disabled")) await user.click(addColumn());
    }
    expect(removeColumns()).toHaveLength(MAX_COLUMNS);
    expect(addColumn()).toBeDisabled();

    for (let i = 0; i < MAX_COLUMNS + 2; i++) {
      const first = removeColumns()[0]!;
      if (!first.hasAttribute("disabled")) await user.click(first);
    }
    expect(removeColumns()).toHaveLength(MIN_COLUMNS);
    for (const b of removeColumns()) expect(b).toBeDisabled();
    await expectNoAxeViolations(root);
  });

  it("keeps focus on a remove button after a holiday is removed", async () => {
    const { user, root } = await mount();
    await user.click(addHoliday());
    expect(removeHolidays().length).toBeGreaterThanOrEqual(3);
    // The first row: focus goes to the row that took its place.
    await user.click(removeHolidays()[0]!);
    expect(removeHolidays()[0]).toHaveFocus();
    // The last row: focus goes to the previous row's remove button.
    await user.click(addHoliday());
    const last = removeHolidays().length - 1;
    await user.click(removeHolidays()[last]!);
    expect(removeHolidays()[last - 1]).toHaveFocus();
    // Down to one row, the remove buttons are off: focus goes to add.
    while (removeHolidays().length > 1) {
      await user.click(removeHolidays()[0]!);
    }
    expect(addHoliday()).toHaveFocus();
    await expectNoAxeViolations(root);
  });

  it("keeps focus in the field while a year is typed", async () => {
    const { user, root } = await mount();
    await user.clear(lastYear());
    await user.type(lastYear(), "2025");
    expect(lastYear()).toHaveFocus();
    expect(lastYear()).toHaveValue(2025);
    await expectNoAxeViolations(root);
  });

  it("a span longer than the cap is cut with a note", async () => {
    const { user, root } = await mount();
    await user.clear(lastYear());
    await user.type(lastYear(), "2060");
    expect(yearRows()).toHaveLength(MAX_YEARS);
    expect(note("Span note")).toHaveTextContent(String(MAX_YEARS));
    await expectNoAxeViolations(root);
  });

  it("an empty year span is NO SIGNAL, not a blank", async () => {
    const { user, root } = await mount();
    await user.clear(lastYear());
    expect(note("Span note")).toHaveTextContent("NO SIGNAL");
    expect(yearRows()).toHaveLength(0);
    await expectNoAxeViolations(root);
  });

  it("names a column added from the preset until the reader changes it", async () => {
    const { user, root } = await mount({ column1: "mon-mon" });
    expect(note("Column note")).toHaveTextContent(
      "Column 2 was added from the preset: a comparison needs at least 2 policies.",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Column 2 policy" }),
      "fri-mon",
    );
    expect(note("Column note")).toBeEmptyDOMElement();
    await expectNoAxeViolations(root);
  });

  it("drops the note with the column it names", async () => {
    const { user, root } = await mount({ column1: "mon-mon" });
    await user.click(addColumn());
    await user.click(addColumn());
    expect(note("Column note")).toHaveTextContent(
      "Column 2 was added from the preset: a comparison needs at least 2 policies.",
    );
    // The reader's own column goes, so the preset's moves up to column 1.
    await user.click(removeColumns()[0]!);
    expect(note("Column note")).toHaveTextContent(
      "Column 1 was added from the preset: a comparison needs at least 2 policies.",
    );
    await user.click(removeColumns()[0]!);
    expect(note("Column note")).toBeEmptyDOMElement();
    await expectNoAxeViolations(root);
  });

  it.each([{}, { column1: "mon-mon", column2: "none" }])(
    "has no note when the reader gave every column (%j)",
    async (args) => {
      await mount(args);
      expect(note("Column note")).toBeEmptyDOMElement();
    },
  );

  it("picking a cell moves the selection and the plates follow", async () => {
    const { user, root } = await mount();
    await user.click(cell(2026, 2));
    expect(cell(2026, 2)).toBePressed();
    expect(selectedCells()).toHaveLength(1);
    expect(summary()).toHaveTextContent("2026");
    expect(cell(2026, 2)).toHaveFocus();
    await expectNoAxeViolations(root);
  });

  it("picking a year header selects that year", async () => {
    const { user, root } = await mount();
    await user.click(yearButton(2022));
    expect(yearButton(2022)).toBePressed();
    expect(summary()).toHaveTextContent("2022");
    await expectNoAxeViolations(root);
  });
});

describe("readouts hold still", () => {
  it("stepping the last year keeps the table at the same number of body rows", async () => {
    const { user, root } = await mount();
    const rows = () =>
      within(table()).getAllByRole("row", { hidden: true }).length;
    const before = rows();
    for (let i = 0; i < 6; i++) {
      await user.click(
        screen.getByRole("button", {
          name: i % 2 === 0 ? "Earlier last year" : "Later last year",
        }),
      );
      expect(rows()).toBe(before);
    }
    await expectNoAxeViolations(root);
  });
});

describe("the Builder hand-off", () => {
  it("round-trips the rules and the policy text into the Builder's readArgs", async () => {
    const { user } = await mount();
    await user.click(cell(2021, 3));
    const href = handoff().getAttribute("href")!;
    expect(href).toBeTruthy();
    const seeded = seedFromLocation(
      "holidays",
      new URL(href, "https://example.test").search,
    );
    const builder = readBuilderArgs(seeded as never);
    expect(builder.rows.length).toBe(removeHolidays().length);
    expect(builder.rows.every((r) => r.policy === "6w 7w")).toBe(true);
    expect(String(builder.year)).toBe("2021");
  });

  it("is off, with a hint, when the selected column is NO SIGNAL", async () => {
    const { user, root } = await mount({
      column1: "custom:6>6",
      column2: "none",
    });
    await user.click(cell(2021, 0));
    expect(handoff()).toHaveAttribute("aria-disabled", "true");
    expect(note("Hand-off hint")).not.toBeEmptyDOMElement();
    await expectNoAxeViolations(root);
  });
});

describe("a hand-written date that is not on the calendar", () => {
  it.each(["02-31", "13-01"])(
    "%s shows NO SIGNAL with a reason, and draws no date",
    async (date) => {
      const { root } = await mount({ holiday1: date });
      const cells = within(table()).getAllByRole("button", {
        name: /^\d{4}, /,
      });
      expect(cells.length).toBeGreaterThan(0);
      for (const c of cells) {
        expect(c).toHaveAccessibleName(/no signal, invalid input/u);
      }
      expect(root).not.toHaveTextContent(/undefined|NaN|Invalid/u);
      expect(note("Holiday note")).toHaveTextContent("holiday 1");
      await expectNoAxeViolations(root);
    },
  );
});

describe("the Builder's compare link", () => {
  it("seeds the Comparator with the row's date and policy", async () => {
    await renderWidget(builderEntry, { args: {} });
    const group = screen.getByRole("group", { name: "Rule 1 comparison" });
    const link = within(group).getByRole("link", {
      name: "Compare policies for this date",
    });
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
    await renderWidget(builderEntry, { args: {} });
    const names = screen
      .getAllByRole("textbox", { name: /^Rule \d+ name$/ })
      .map((_, i) => `Rule ${i + 1} comparison`);
    const present = names.filter(
      (name) => screen.queryAllByRole("group", { name }).length > 0,
    );
    expect(present.length).toBeGreaterThan(0);
    expect(present.length).toBeLessThanOrEqual(names.length);
  });
});

describe("narrow layout structure", () => {
  it("the table is named and every cell names its year and column", async () => {
    await mount();
    expect(table()).toHaveAccessibleName(
      /Observed dates of .*one row per year/u,
    );
    for (const b of within(table()).getAllByRole("button", {
      name: /^\d{4}, /,
    })) {
      expect(b).toHaveAccessibleName(/^\d{4}, .+: /u);
    }
  });
});

describe("the policy editor folds with the container", () => {
  let spy: ReturnType<typeof spyOnResizeObservers>;
  let width = 0;
  beforeEach(() => {
    spy = spyOnResizeObservers();
    Object.defineProperty(HTMLOListElement.prototype, "clientWidth", {
      configurable: true,
      get: () => width,
    });
  });
  afterEach(() => {
    spy.restore();
    Reflect.deleteProperty(HTMLOListElement.prototype, "clientWidth");
  });

  const policies = () => screen.getAllByRole("group", { name: /observance/i });
  const allOpen = (open: boolean) =>
    policies().every((d) =>
      open ? d.hasAttribute("open") : !d.hasAttribute("open"),
    );
  async function mountAt(w: number) {
    width = w;
    return mount({ column1: "custom:6>1", column2: "none" });
  }

  it("is closed when narrow and open when wide, and follows a resize", async () => {
    await mountAt(FOLD_WIDTH - 90);
    expect(policies().length).toBeGreaterThan(0);
    expect(allOpen(false)).toBe(true);
    width = FOLD_WIDTH + 200;
    spy.fire();
    expect(allOpen(true)).toBe(true);
    width = FOLD_WIDTH - 90;
    spy.fire();
    expect(allOpen(false)).toBe(true);
  });

  it("releases its observer on destroy", async () => {
    const rendered = await mountAt(FOLD_WIDTH + 200);
    expect(spy.live.size).toBeGreaterThan(0);
    rendered.destroy();
    expect(spy.live.size).toBe(0);
  });
});

describe("the permalink and the words", () => {
  it("carries the edited state out", async () => {
    const rendered = await mount();
    await rendered.user.clear(lastYear());
    await rendered.user.type(lastYear(), "2024");
    const link = decodeURIComponent(rendered.permalink());
    expect(link).toContain('"to":"2024"');
    expect(link).not.toContain('"preset"');
  });

  it("names no place", async () => {
    const { root } = await mount();
    expect(unexpectedCapitalised(textLines(root))).toEqual([]);
  });
});
