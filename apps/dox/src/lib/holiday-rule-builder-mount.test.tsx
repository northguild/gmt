/**
 * @vitest-environment jsdom
 *
 * The Holiday Rule Builder end to end: template, mount, interact, assert,
 * against the real `@northguild/gmt`. Dates are the library spec's; counts
 * are derived from the modules.
 */
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { installJsdomShims } from "~/test/jsdom-shims";
import { readArgs as readLedgerArgs } from "./free-time-ledger";
import { MAX_RULES } from "./holiday-codec";
import {
  FOLD_WIDTH,
  mountHolidayRuleBuilder,
  renderHolidayRuleBuilderTemplate,
} from "./holiday-rule-builder-mount";
import { BUILDER_PRESETS, NO_SIGNAL_TEXT } from "./holiday-rule-builder";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;
const rows = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>("[data-row]"),
];

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderHolidayRuleBuilderTemplate(args);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountHolidayRuleBuilder(root, args, controller.signal);
  return { root, handle, controller };
}

const fire = (el: Element, type: "input" | "change") =>
  el.dispatchEvent(new Event(type, { bubbles: true }));
const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

function setField(row: HTMLElement, field: string, value: string) {
  const el = row.querySelector<HTMLInputElement>(`[data-field="${field}"]`)!;
  el.value = value;
  fire(el, el.tagName === "SELECT" ? "change" : "input");
}

const closed = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('[data-date][data-kinds~="closed"]')]
    .map((c) => c.dataset["date"]!)
    .sort();
const ghosts = (root: HTMLElement) =>
  [
    ...root.querySelectorAll<HTMLElement>(
      '[data-date][data-kinds~="moved-from"]',
    ),
  ]
    .map((c) => c.dataset["date"]!)
    .sort();
const buttonOf = (row: HTMLElement, action: string) =>
  row.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the chain preset", () => {
  it("draws ghosts on 25 and 26 Dec and closed cells on 27 and 28", async () => {
    const { root } = await mount();
    expect(ghosts(root)).toEqual(["2021-12-25", "2021-12-26"]);
    const days = closed(root).filter(
      (d) => d >= "2021-12-20" && d <= "2021-12-31",
    );
    expect(days).toContain("2021-12-27");
    expect(days).toContain("2021-12-28");
    expect(q(root, "calendar-output").textContent).toContain(
      '["2021-12-27", "2021-12-28"]',
    );
  });

  it("starts with the rows' own number chips and no policy on a new row", async () => {
    const { root } = await mount();
    expect(
      root.querySelectorAll(".gmt-holiday-chip--rule").length,
    ).toBeGreaterThan(0);
    click(q(root, "rules").ownerDocument.querySelector('[data-action="add"]')!);
    const last = rows(root).at(-1)!;
    expect(
      last.querySelectorAll("select[data-weekday]").length,
    ).toBeGreaterThan(0);
    for (const s of last.querySelectorAll<HTMLSelectElement>(
      "select[data-weekday]",
    )) {
      expect(s.value).toBe("");
    }
  });
});

describe("every preset", () => {
  it("builds a calendar", async () => {
    for (const p of BUILDER_PRESETS) {
      const { root } = await mount({ preset: p.id });
      expect(q(root, "calendar-output").textContent, p.id).not.toContain(
        "null",
      );
      expect(rows(root).length, p.id).toBe(p.rules.length);
      expect(q<HTMLSelectElement>(root, "preset").value).toBe(p.id);
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

  it("changes the result when a row moves up", async () => {
    const { root } = await mount(seed);
    const christmas = () =>
      closed(root).filter((d) => d >= "2021-12-20" && d <= "2021-12-31");
    expect(christmas()).toEqual(["2021-12-27", "2021-12-28"]);
    click(buttonOf(rows(root)[1]!, "up"));
    expect(christmas()).toEqual(["2021-12-27"]);
    expect(q(root, "calendar-output").textContent).toContain('["2021-12-27"]');
  });

  it("keeps focus on the button of the row that moved", async () => {
    const { root } = await mount(seed);
    click(buttonOf(rows(root)[1]!, "up"));
    // At the top "up" is disabled, so focus falls to the row's "down".
    expect(buttonOf(rows(root)[0]!, "up").disabled).toBe(true);
    expect(document.activeElement).toBe(buttonOf(rows(root)[0]!, "down"));
  });
});

describe("the midweek preset", () => {
  it("shows 17 Jun closed with no ghost, and a ghost once row 1 goes", async () => {
    const { root } = await mount({ preset: "midweek" });
    const cell = () =>
      root.querySelector<HTMLElement>('[data-date="2026-06-17"]')!;
    expect(cell().dataset["kinds"]).toContain("closed");
    expect(ghosts(root)).not.toContain("2026-06-17");
    click(buttonOf(rows(root)[0]!, "remove"));
    expect(ghosts(root)).toContain("2026-06-17");
    expect(rows(root).length).toBe(
      BUILDER_PRESETS.find((p) => p.id === "midweek")!.rules.length - 1,
    );
  });
});

describe("no result", () => {
  it("shows NO SIGNAL for month 13 and prints the null result", async () => {
    const { root } = await mount();
    setField(rows(root)[0]!, "month", "13");
    const result = rows(root)[0]!.querySelector<HTMLElement>(
      '[data-role="row-result"]',
    )!;
    expect(result.textContent).toContain(NO_SIGNAL_TEXT);
    expect(result.className).toContain("gmt-playground-sentinel");
    const out = q(root, "calendar-output");
    expect(out.textContent).toContain("null");
    expect(out.className).toContain("gmt-playground-sentinel");
    expect(
      root.querySelector('[data-role="link-ledger"]')!.hasAttribute("href"),
    ).toBe(false);
    expect(
      root
        .querySelector('[data-role="link-ledger"]')!
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(q(root, "handoff-hint").textContent).not.toBe("");
  });

  it("keeps focus in the field while it is typed in", async () => {
    const { root } = await mount();
    const input = rows(root)[0]!.querySelector<HTMLInputElement>(
      '[data-field="month"]',
    );
    const before =
      input ??
      rows(root)[0]!.querySelector<HTMLInputElement>('[data-field="name"]')!;
    before.focus();
    before.value = before.value + "";
    fire(before, "input");
    expect(rows(root)[0]!.contains(before)).toBe(true);
  });

  it("treats a valid rule with no date as an empty answer, not NO SIGNAL", async () => {
    const { root } = await mount({
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
    const result = rows(root)[0]!.querySelector<HTMLElement>(
      '[data-role="row-result"]',
    )!;
    expect(result.textContent).not.toContain("NO SIGNAL");
    expect(result.className).not.toContain("gmt-playground-sentinel");
    expect(q(root, "calendar-output").textContent).not.toContain("null");
  });
});

describe("the rule cap", () => {
  it("cannot add a 13th rule", async () => {
    const { root } = await mount();
    const add = root.querySelector<HTMLButtonElement>('[data-action="add"]')!;
    while (rows(root).length < MAX_RULES) click(add);
    expect(rows(root).length).toBe(MAX_RULES);
    expect(add.disabled).toBe(true);
    click(add);
    expect(rows(root).length).toBe(MAX_RULES);
  });
});

describe("the Ledger hand-off", () => {
  it("round-trips the weekend, holidays, zone and basis", async () => {
    const { root } = await mount({ preset: "closing" });
    const link = root.querySelector<HTMLAnchorElement>(
      '[data-role="link-ledger"]',
    )!;
    const href = link.getAttribute("href")!;
    expect(href).toBeTruthy();
    const search = new URL(href, "https://example.test").search;
    const seeded = seedFromLocation("freetime", search);
    const state = readLedgerArgs(seeded as never);
    const calendar = BUILDER_PRESETS.find((p) => p.id === "closing")!;
    expect(state.weekend).toEqual([...calendar.weekend]);
    expect(state.zone).toBe(calendar.zone);
    expect(state.basis).toBe("working");
    const printed = q(root, "calendar-output").textContent!;
    for (const date of state.holidays.split("\n")) {
      expect(printed).toContain(date);
    }
    expect(state.holidays.split("\n").length).toBeGreaterThan(0);
  });
});

describe("the policy editor folds with the container", () => {
  const stubWidth = (root: HTMLElement, width: number) =>
    Object.defineProperty(q(root, "rules"), "clientWidth", {
      configurable: true,
      get: () => width,
    });
  const opens = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLDetailsElement>(".gmt-holiday-policy")].map(
      (d) => d.open,
    );
  let spy: ReturnType<typeof spyOnResizeObservers>;
  beforeEach(() => {
    spy = spyOnResizeObservers();
  });
  afterEach(() => spy.restore());

  async function mountAt(width: number) {
    const root = document.createElement("div");
    root.innerHTML = renderHolidayRuleBuilderTemplate({});
    document.body.append(root);
    stubWidth(root, width);
    const controller = new AbortController();
    await mountHolidayRuleBuilder(root, {}, controller.signal);
    // The mount drew the rows before the stub could matter only if it read the
    // width late; re-pick a preset so rows are drawn with the width in place.
    const preset = q<HTMLSelectElement>(root, "preset");
    preset.value = "friday-monday";
    fire(preset, "change");
    return root;
  }

  it("draws the editors closed when narrow", async () => {
    const root = await mountAt(FOLD_WIDTH - 90);
    expect(opens(root).length).toBeGreaterThan(0);
    expect(opens(root).every((o) => !o)).toBe(true);
  });

  it("draws the editors open when wide", async () => {
    const root = await mountAt(FOLD_WIDTH + 200);
    expect(opens(root).every((o) => o)).toBe(true);
  });

  it("keeps in step on resize, both ways", async () => {
    const root = await mountAt(FOLD_WIDTH + 200);
    stubWidth(root, FOLD_WIDTH - 90);
    spy.fire();
    expect(opens(root).every((o) => !o)).toBe(true);
    stubWidth(root, FOLD_WIDTH + 200);
    spy.fire();
    expect(opens(root).every((o) => o)).toBe(true);
  });

  it("releases its observer on destroy", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderHolidayRuleBuilderTemplate({});
    document.body.append(root);
    const handle = await mountHolidayRuleBuilder(
      root,
      {},
      new AbortController().signal,
    );
    expect(spy.live.size).toBeGreaterThan(0);
    handle.destroy();
    expect(spy.live.size).toBe(0);
  });
});

describe("the permalink", () => {
  it("carries the edited rules back out", async () => {
    const { root, handle } = await mount({ preset: "closing" });
    click(buttonOf(rows(root)[0]!, "remove"));
    const state = handle.getPermalinkState!() as Record<string, string>;
    expect(state["preset"]).toBeUndefined();
    expect(state["rules"].split("\n").length).toBe(
      BUILDER_PRESETS.find((p) => p.id === "closing")!.rules.length - 1,
    );
    expect(state["year"]).toBe("2026");
  });
});

describe("the year", () => {
  it("steps by one and keeps the grid at twelve months", async () => {
    const { root } = await mount();
    const months = () =>
      root.querySelectorAll(
        "[data-role='grid'] [data-month], [data-role='grid'] table",
      ).length;
    const before = months();
    click(root.querySelector('[data-action="year-up"]')!);
    expect(q<HTMLInputElement>(root, "year").value).toBe("2022");
    expect(months()).toBe(before);
  });
});
