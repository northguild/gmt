/**
 * @vitest-environment jsdom
 *
 * The Holiday Rule Builder end to end against the real `@northguild/gmt`, through roles and
 * accessible names the way a reader meets the page. Dates are the library spec's; counts
 * are derived from the modules.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { readArgs as readLedgerArgs } from "./free-time-ledger";
import { MAX_RULES } from "./holiday-codec";
import { BUILDER_PRESETS, NO_SIGNAL_TEXT } from "./holiday-rule-builder";
import { FOLD_WIDTH } from "./holiday-rule-builder-mount";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showHolidayRuleBuilder"] as AnyWidgetEntry;

async function mount(args: unknown = {}): Promise<RenderedWidget> {
  return renderWidget(entry, { args });
}

const ruleNames = () =>
  screen.queryAllByRole("textbox", { name: /^Rule \d+ name$/ });
const result = (n: number) =>
  screen.getByRole("note", { name: `Rule ${n} result` });
const output = () => screen.getByRole("status", { name: "Calendar returned" });
const ledgerGroup = () =>
  screen.getByRole("group", { name: "Open this result in another tool" });
const ledgerLink = () =>
  within(ledgerGroup()).getByText("Count free time on this calendar");
const yearField = () => screen.getByRole("spinbutton", { name: "Year" });
const presetBox = () => screen.getByRole("combobox", { name: "Preset" });

/** Every marked date's sentence, in grid order. */
const marked = (): string[] =>
  screen
    .queryAllByRole("list", { name: "Marked dates" })
    .flatMap((list) => within(list).queryAllByRole("listitem"))
    .map((item) => item.textContent ?? "");
const closedIn = (monthYear: string) =>
  marked().filter(
    (s) => s.includes(` ${monthYear}:`) && /: (closed|.*; closed)/.test(s),
  );
const ghosts = () =>
  marked().filter((s) => s.includes("a holiday moved from here"));

async function setText(
  rendered: RenderedWidget,
  field: HTMLElement,
  value: string,
): Promise<void> {
  await rendered.user.clear(field);
  if (value !== "") await rendered.user.paste(value);
}

describe("the chain preset", () => {
  it("marks ghosts on 25 and 26 Dec and closed days on 27 and 28", async () => {
    const rendered = await mount();
    expect(ghosts().map((s) => s.split(":")[0])).toEqual([
      "Saturday 25 December 2021",
      "Sunday 26 December 2021",
    ]);
    expect(closedIn("December 2021").map((s) => s.split(":")[0])).toEqual([
      "Monday 27 December 2021",
      "Tuesday 28 December 2021",
    ]);
    expect(output()).toHaveTextContent('["2021-12-27", "2021-12-28"]');
    expect(screen.getByRole("group", { name: "Weekend" })).toBeInTheDocument();
    await expectNoAxeViolations(rendered.root);
  });

  it("a new rule starts with no observance chosen", async () => {
    const rendered = await mount();
    const before = ruleNames().length;
    await rendered.user.click(screen.getByRole("button", { name: "Add rule" }));
    expect(ruleNames()).toHaveLength(before + 1);
    const groups = screen.getAllByRole("group", { name: /observance/i });
    const selects = within(groups.at(-1)!).getAllByRole("combobox");
    expect(selects.length).toBeGreaterThan(0);
    for (const s of selects) expect(s).toHaveValue("");
    await expectNoAxeViolations(rendered.root);
  });
});

describe("every preset", () => {
  it("builds a calendar", async () => {
    for (const p of BUILDER_PRESETS) {
      const rendered = await mount({ preset: p.id });
      expect(output(), p.id).not.toHaveTextContent("null");
      expect(ruleNames(), p.id).toHaveLength(p.rules.length);
      expect(presetBox(), p.id).toHaveValue(p.id);
      rendered.destroy();
    }
  });
});

describe("order", () => {
  const A = {
    name: "A",
    kind: "fixed",
    month: 12,
    day: 26,
    observed: { 7: "nextWorkingDay" },
  };
  const B = { name: "B", kind: "dates", dates: ["2021-12-27"] };
  const seed = { rules: [B, A], year: 2021, timeZone: "Europe/London" };
  const christmas = () => closedIn("December 2021").map((s) => s.split(":")[0]);

  it("keeps the closed days when a row moves up", async () => {
    const rendered = await mount(seed);
    expect(christmas()).toEqual([
      "Monday 27 December 2021",
      "Tuesday 28 December 2021",
    ]);
    await rendered.user.click(
      screen.getByRole("button", { name: "Move rule 2 up" }),
    );
    expect(christmas()).toEqual([
      "Monday 27 December 2021",
      "Tuesday 28 December 2021",
    ]);
    expect(output()).toHaveTextContent('["2021-12-27", "2021-12-28"]');
    await expectNoAxeViolations(rendered.root);
  });

  it("swaps which holiday walks to which day when a row moves up", async () => {
    const rendered = await mount({ preset: "chain" });
    const from = (day: string) => marked().find((s) => s.startsWith(day)) ?? "";
    expect(from("Monday 27 December 2021")).toContain(
      "moved here from Saturday",
    );
    expect(from("Tuesday 28 December 2021")).toContain(
      "moved here from Sunday",
    );
    await rendered.user.click(
      screen.getByRole("button", { name: "Move rule 2 up" }),
    );
    expect(from("Monday 27 December 2021")).toContain("moved here from Sunday");
    expect(from("Tuesday 28 December 2021")).toContain(
      "moved here from Saturday",
    );
  });

  it("keeps focus with the row that moved", async () => {
    const rendered = await mount(seed);
    await rendered.user.click(
      screen.getByRole("button", { name: "Move rule 2 up" }),
    );
    // At the top "up" is disabled, so focus falls to the row's "down".
    expect(
      screen.getByRole("button", { name: "Move rule 1 up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move rule 1 down" }),
    ).toHaveFocus();
  });
});

describe("the midweek preset", () => {
  it("closes 17 Jun with no ghost, and shows a ghost once rule 1 goes", async () => {
    const rendered = await mount({ preset: "midweek" });
    const on = (list: string[]) =>
      list.filter((s) => s.startsWith("Wednesday 17 June 2026"));
    expect(on(closedIn("June 2026"))).toHaveLength(1);
    expect(on(ghosts())).toHaveLength(0);
    await rendered.user.click(
      screen.getByRole("button", { name: "Remove rule 1" }),
    );
    expect(on(ghosts())).toHaveLength(1);
    expect(ruleNames()).toHaveLength(
      BUILDER_PRESETS.find((p) => p.id === "midweek")!.rules.length - 1,
    );
    await expectNoAxeViolations(rendered.root);
  });
});

describe("no result", () => {
  it("shows NO SIGNAL for month 13 and prints the null result", async () => {
    const rendered = await mount();
    const first = screen.getAllByRole("textbox", { name: "Month" })[0]!;
    await setText(rendered, first, "13");
    expect(result(1)).toHaveTextContent(NO_SIGNAL_TEXT);
    expect(output()).toHaveTextContent("null");
    expect(within(ledgerGroup()).queryByRole("link")).not.toBeInTheDocument();
    expect(ledgerLink()).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("note", { name: "Hand-off hint" }),
    ).not.toBeEmptyDOMElement();
    await expectNoAxeViolations(rendered.root);
  });

  it("keeps focus in the field while it is typed in", async () => {
    const rendered = await mount();
    const first = screen.getAllByRole("textbox", { name: "Month" })[0]!;
    await setText(rendered, first, "13");
    expect(screen.getAllByRole("textbox", { name: "Month" })[0]).toHaveFocus();
  });

  it("treats a valid rule with no date as an empty answer, not NO SIGNAL", async () => {
    const rendered = await mount({
      rules: [
        {
          name: "Fifth Friday",
          kind: "nthWeekday",
          month: 2,
          weekday: 5,
          n: 5,
        },
      ],
      year: 2026,
      timeZone: "UTC",
    });
    expect(result(1)).not.toHaveTextContent("NO SIGNAL");
    expect(output()).not.toHaveTextContent("null");
    await expectNoAxeViolations(rendered.root);
  });
});

describe("the rule cap", () => {
  it("cannot add a 13th rule", async () => {
    const rendered = await mount();
    const add = screen.getByRole("button", { name: "Add rule" });
    while (ruleNames().length < MAX_RULES) await rendered.user.click(add);
    expect(ruleNames()).toHaveLength(MAX_RULES);
    expect(add).toBeDisabled();
    await rendered.user.click(add);
    expect(ruleNames()).toHaveLength(MAX_RULES);
    await expectNoAxeViolations(rendered.root);
  });
});

describe("the Ledger hand-off", () => {
  it("round-trips the weekend, holidays, zone and basis", async () => {
    await mount({ preset: "closing" });
    const href = within(ledgerGroup())
      .getByRole("link", { name: "Count free time on this calendar" })
      .getAttribute("href")!;
    expect(href).toBeTruthy();
    const search = new URL(href, "https://example.test").search;
    const state = readLedgerArgs(seedFromLocation("freetime", search) as never);
    const calendar = BUILDER_PRESETS.find((p) => p.id === "closing")!;
    expect(state.weekend).toEqual([...calendar.weekend]);
    expect(state.zone).toBe(calendar.zone);
    expect(state.basis).toBe("working");
    expect(state.holidays.split("\n").length).toBeGreaterThan(0);
    for (const date of state.holidays.split("\n")) {
      expect(output()).toHaveTextContent(date);
    }
  });
});

describe("the policy editor folds with the container", () => {
  let spy: ReturnType<typeof spyOnResizeObservers>;
  let width = 0;
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth",
  );
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
    if (original) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", original);
    }
  });

  const policies = () => screen.getAllByRole("group", { name: /observance/i });
  const allOpen = (open: boolean) =>
    policies().every((d) =>
      open ? d.hasAttribute("open") : !d.hasAttribute("open"),
    );

  async function mountAt(w: number) {
    width = w;
    return mount({ preset: "friday-monday" });
  }

  it("draws the editors closed when narrow", async () => {
    await mountAt(FOLD_WIDTH - 90);
    expect(policies().length).toBeGreaterThan(0);
    expect(allOpen(false)).toBe(true);
  });

  it("draws the editors open when wide", async () => {
    await mountAt(FOLD_WIDTH + 200);
    expect(allOpen(true)).toBe(true);
  });

  it("keeps in step on resize, both ways", async () => {
    await mountAt(FOLD_WIDTH + 200);
    width = FOLD_WIDTH - 90;
    spy.fire();
    expect(allOpen(false)).toBe(true);
    width = FOLD_WIDTH + 200;
    spy.fire();
    expect(allOpen(true)).toBe(true);
  });

  it("releases its observer on destroy", async () => {
    const rendered = await mountAt(FOLD_WIDTH + 200);
    expect(spy.live.size).toBeGreaterThan(0);
    rendered.destroy();
    expect(spy.live.size).toBe(0);
  });
});

describe("the permalink", () => {
  it("carries the edited rules back out", async () => {
    const rendered = await mount({ preset: "closing" });
    await rendered.user.click(
      screen.getByRole("button", { name: "Remove rule 1" }),
    );
    const url = new URL(rendered.permalink(), "https://example.test");
    const state = JSON.parse(url.searchParams.get("wa")!) as Record<
      string,
      string
    >;
    expect(state["preset"]).toBeUndefined();
    expect(state["rules"]!.split("\n").length).toBe(
      BUILDER_PRESETS.find((p) => p.id === "closing")!.rules.length - 1,
    );
    expect(state["year"]).toBe("2026");
  });
});

describe("the year", () => {
  it("steps by one and keeps the grid at twelve months", async () => {
    const rendered = await mount();
    await rendered.user.click(
      screen.getByRole("button", { name: "Next year" }),
    );
    expect(yearField()).toHaveValue(2022);
    expect(screen.getByRole("img", { name: /2022/ })).toBeInTheDocument();
    await expectNoAxeViolations(rendered.root);
  });

  it("an invalid year leaves nothing of the last one on screen", async () => {
    const rendered = await mount();
    expect(ghosts()).not.toEqual([]);
    for (const typed of ["", "1899", "2101", "2021.5"]) {
      await setText(rendered, yearField(), typed);
      expect(yearField()).toBeInvalid();
      for (const [i] of ruleNames().entries()) {
        expect(result(i + 1)).toHaveTextContent(NO_SIGNAL_TEXT);
      }
      // The Comparator needs no year: the link stays, without one.
      const compare = within(
        screen.getByRole("group", { name: "Rule 1 comparison" }),
      ).getByRole("link", { name: "Compare policies for this date" });
      const seeded = seedFromLocation(
        "observance",
        new URL(compare.getAttribute("href")!, "https://example.test").search,
      );
      expect(seeded).not.toHaveProperty("year");
      expect(marked()).toEqual([]);
      expect(screen.getByRole("note", { name: "Year note" })).toHaveTextContent(
        NO_SIGNAL_TEXT,
      );
      expect(screen.getByRole("note", { name: "Year note" })).toHaveTextContent(
        "1900 to 2100",
      );
      expect(
        screen.getByRole("status", { name: "Year summary" }),
      ).toHaveTextContent(
        "No calendar: the year is not a whole number from 1900 to 2100.",
      );
      expect(output()).toHaveTextContent("NO SIGNAL");
      expect(within(ledgerGroup()).queryByRole("link")).not.toBeInTheDocument();
      expect(
        screen.getByRole("note", { name: "Hand-off hint" }),
      ).toHaveTextContent(
        "There is no calendar to send: the year is not valid.",
      );
    }
    await expectNoAxeViolations(rendered.root);
    await setText(rendered, yearField(), "2021");
    expect(yearField()).toBeValid();
    expect(ghosts()).toHaveLength(2);
    expect(output()).toHaveTextContent("2021-12-27");
    expect(
      within(ledgerGroup()).getByRole("link", {
        name: "Count free time on this calendar",
      }),
    ).toHaveAttribute("href");
  });
});
