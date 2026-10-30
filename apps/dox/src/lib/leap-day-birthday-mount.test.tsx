/**
 * @vitest-environment jsdom
 *
 * Leap-Day Birthday end to end, through roles and accessible names the way a reader meets
 * the page. The loader hands the widget the real library wrapped in a recorder, so the
 * printed calls can be checked against the calls that ran.
 */
import { vi } from "vitest";
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import { NO_SIGNAL_SHORT } from "./leap-day-birthday-mount";
import type { MonthDayLib } from "./month-day-lib";
import { monthDayLib } from "~/test/month-day-lib";

const recorded: { name: string; args: unknown[] }[] = [];

vi.mock("./month-day-lib", () => ({
  loadMonthDayLib: async () => {
    const wrapped = {} as Record<string, unknown>;
    for (const [name, fn] of Object.entries(monthDayLib)) {
      wrapped[name] = (...args: unknown[]) => {
        recorded.push({ name, args });
        return (fn as (...a: unknown[]) => unknown)(...args);
      };
    }
    return wrapped as unknown as MonthDayLib;
  },
}));

const { LEAP_PRESETS, ROW_COUNT } = await import("./leap-day-birthday");

installJsdomShims();

const entry = WIDGET_REGISTRY["showLeapDayBirthday"] as AnyWidgetEntry;

async function mount(args: unknown = {}): Promise<RenderedWidget> {
  return renderWidget(entry, { args });
}

// The year is a number field the reader steps with the arrow keys: a spin button.
const field = (name: string) =>
  screen.getByRole(name === "Year" ? "spinbutton" : "textbox", { name });
const preset = () => screen.getByRole("combobox", { name: "Preset" });
const table = () =>
  screen.getByRole("table", { name: "The date in eight consecutive years" });
const bodyRows = () => within(table()).getAllByRole("row").slice(1);
const cellsOf = (row: HTMLElement) => within(row).getAllByRole("cell");
const summary = () => screen.getByRole("status", { name: "Summary" });
const reason = () => screen.getByRole("note", { name: "Reason" });
const calls = () =>
  screen.getByRole("group", { name: "Calls made", hidden: true });

/**
 * A cell holds the live text and, hidden from a reader, a ghost of each text it may show so
 * the column keeps its width. A cell that reads NO SIGNAL therefore matches the text twice.
 */
const isSignal = (cell: HTMLElement) =>
  within(cell).queryAllByText(NO_SIGNAL_SHORT).length > 1;

async function type(
  rendered: RenderedWidget,
  name: string,
  value: string,
): Promise<void> {
  const el = field(name);
  await rendered.user.clear(el);
  await rendered.user.paste(value);
}

describe("the plates and the rows", () => {
  it("29 February in 2023 reads 28 February, moved earlier, with the naive column refused", async () => {
    const rendered = await mount({ value: "--02-29", year: 2023 });
    expect(summary()).toHaveTextContent("Stored as --02-29");
    expect(summary()).toHaveTextContent("2023: 2023-02-28, moved earlier");
    const first = bodyRows()[0]!;
    const cells = within(first).getAllByRole("cell");
    expect(within(first).getByRole("rowheader")).toHaveTextContent("2023");
    expect(cells[0]).toHaveTextContent("2023-02-28");
    expect(isSignal(cells[0]!)).toBe(false);
    expect(isSignal(cells[2]!)).toBe(true);
    expect(cells[3]).toHaveTextContent("2023-03-01");
    expect(summary()).toHaveTextContent("2024: 2024-02-29, kept");
    await expectNoAxeViolations(rendered.root);
  });

  it("always draws eight rows with the same cells, in every state", async () => {
    const rendered = await mount();
    for (const p of LEAP_PRESETS) {
      await rendered.user.selectOptions(preset(), p.id);
      expect(bodyRows()).toHaveLength(ROW_COUNT);
      for (const row of bodyRows()) expect(cellsOf(row)).toHaveLength(4);
      await expectNoAxeViolations(rendered.root);
    }
    await type(rendered, "Year", "x");
    expect(bodyRows()).toHaveLength(ROW_COUNT);
    await expectNoAxeViolations(rendered.root);
  });

  it("clicks every preset and keeps the preset menu in step", async () => {
    const rendered = await mount();
    for (const p of LEAP_PRESETS) {
      await rendered.user.selectOptions(preset(), p.id);
      expect(preset()).toHaveValue(p.id);
      expect(field("Birthday or yearly date")).toHaveValue(p.value);
    }
    await type(rendered, "Birthday or yearly date", "12-25");
    expect(preset()).toHaveValue("custom");
    await expectNoAxeViolations(rendered.root);
  });

  it("a typed year moves the slider and the rows", async () => {
    const rendered = await mount({ value: "--02-29", year: 2023 });
    await type(rendered, "Year", "2096");
    expect(screen.getByRole("slider", { name: "Year slider" })).toHaveValue(
      "2096",
    );
    expect(within(bodyRows()[0]!).getByRole("rowheader")).toHaveTextContent(
      "2096",
    );
    expect(summary()).toHaveTextContent("2096: 2096-02-29, kept");
    expect(summary()).toHaveTextContent("2100: 2100-02-28, moved earlier");
    await expectNoAxeViolations(rendered.root);
  });

  it("dragging the slider moves the year field and the rows", async () => {
    const rendered = await mount({ value: "--02-29", year: 2023 });
    setRange(screen.getByRole("slider", { name: "Year slider" }), 2100);
    expect(field("Year")).toHaveValue(2100);
    expect(summary()).toHaveTextContent("2100: 2100-02-28, moved earlier");
    await expectNoAxeViolations(rendered.root);
  });
});

describe("NO SIGNAL against an empty result", () => {
  it("a value no reader accepts is NO SIGNAL on every cell, with the reason", async () => {
    const rendered = await mount({ value: "--02-30" });
    expect(summary()).toHaveTextContent("NO SIGNAL");
    for (const row of bodyRows()) expect(isSignal(cellsOf(row)[0]!)).toBe(true);
    expect(reason()).toHaveTextContent("NO SIGNAL");
    await expectNoAxeViolations(rendered.root);
  });

  it("a year the library cannot place is NO SIGNAL while the stored date still reads", async () => {
    const rendered = await mount({ value: "--12-25" });
    await type(rendered, "Year", "2024.5");
    expect(summary()).toHaveTextContent("Stored as --12-25");
    for (const row of bodyRows()) expect(isSignal(cellsOf(row)[0]!)).toBe(true);
    await expectNoAxeViolations(rendered.root);
  });

  it("a kept date is a correct answer and is never NO SIGNAL", async () => {
    const rendered = await mount({ value: "12-25", year: 2025 });
    const first = bodyRows()[0]!;
    expect(summary()).toHaveTextContent("2025: 2025-12-25, kept");
    expect(summary()).not.toHaveTextContent("NO SIGNAL");
    for (const cell of cellsOf(first)) expect(isSignal(cell)).toBe(false);
    expect(cellsOf(first)[2]).toHaveTextContent("2025-12-25");
    await expectNoAxeViolations(rendered.root);
  });
});

describe("the printed calls", () => {
  it("print the library calls that ran, in the order they ran", async () => {
    const rendered = await mount({ value: "--02-29", year: 2023 });
    recorded.length = 0;
    await type(rendered, "Year", "2023");
    // The last render's calls are the recorder's tail; the printed frame is the
    // readers, the locale form and the first row's calls, in that order.
    const lines = (calls().textContent ?? "").split("\n").filter(Boolean);
    const parsed = lines.map((l) => {
      const m = /^(\w+)\((.*)\); \/\/ /u.exec(l);
      return {
        name: m![1]!,
        args: new Function(`return [${m![2]!}]`)() as unknown[],
      };
    });
    expect(parsed[0]!.name).toBe("isValidMonthDay");
    // Rows share one draw, so the printed lines are the first row's share of the
    // recorder: every one ran, in the order they ran, with the arguments it printed.
    let from = 0;
    for (const [i, call] of parsed.entries()) {
      const at = recorded.findIndex(
        (c, k) =>
          k >= from &&
          c.name === call.name &&
          JSON.stringify(c.args) === JSON.stringify(call.args),
      );
      expect(at, lines[i]).toBeGreaterThanOrEqual(from);
      from = at + 1;
    }
    await expectNoAxeViolations(rendered.root);
  });

  it("print every call of the first row only", async () => {
    await mount({ value: "--02-29", year: 2023 });
    const lines = (calls().textContent ?? "").split("\n");
    expect(lines.filter((l) => l.startsWith("monthDayToDate("))).toHaveLength(
      1,
    );
  });
});

describe("permalink state", () => {
  it("is the preset while the controls match one and the three strings otherwise", async () => {
    const rendered = await mount();
    expect(decodeURIComponent(rendered.permalink())).toContain(
      '"preset":"leap-day-birth"',
    );
    await type(rendered, "Birthday or yearly date", "--02-29");
    await type(rendered, "Year", "2023");
    await rendered.user.selectOptions(
      screen.getByRole("combobox", { name: "Locale" }),
      "fr-FR",
    );
    const link = decodeURIComponent(rendered.permalink());
    expect(link).toContain("--02-29");
    expect(link).toContain("2023");
    expect(link).toContain("fr-FR");
    expect(link).not.toContain("preset");
  });

  it("reopens the state a link names, an unknown locale included", async () => {
    const rendered = await mount({
      value: "--02-29",
      year: "2023",
      locale: "xx-YY",
    });
    expect(screen.getByRole("combobox", { name: "Locale" })).toHaveValue(
      "xx-YY",
    );
    expect(field("Year")).toHaveValue(2023);
    await expectNoAxeViolations(rendered.root);
  });
});

describe("the length cap", () => {
  it("stops the birthday field at 64 characters", async () => {
    const w = await mount();
    const box = field("Birthday or yearly date");
    await w.user.clear(box);
    await w.user.type(box, "x".repeat(72));
    expect(box).toHaveValue("x".repeat(64));
  });
});
