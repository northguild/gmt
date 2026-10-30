/**
 * @vitest-environment jsdom
 *
 * The Duration Parser Bench end to end: template, mount, interact, assert, against the real
 * `@northguild/gmt`, through roles and accessible names.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { GMT_MODULES } from "./gmt-modules";
import { showUnavailable, WidgetLoadError } from "./widget-mount";
import {
  CELL_NO_SIGNAL,
  RESULT_NO_SIGNAL,
  SAME_DURATION_TEXT,
  mountDurationParserBench,
} from "./duration-parser-bench-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showDurationParserBench"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });

const textBox = () =>
  screen.getByRole("textbox", { name: "Duration string" }) as HTMLInputElement;
const localeBox = () =>
  screen.getByRole("combobox", { name: "Locale" }) as HTMLSelectElement;
const result = () => screen.getByRole("status", { name: "Parsed duration" });
const minuteTable = () =>
  screen.getByRole("table", {
    name: "Seven spellings of a minute, a month and a millisecond",
  });
const laytimeTable = () => screen.getByRole("table", { name: /^Rotterdam/ });
const callsOutput = () =>
  screen.getByRole("status", { name: "What the calls returned" });
const fields = () =>
  within(screen.getByRole("list", { name: "Duration fields" })).getAllByRole(
    "listitem",
  );
/** The value beside a term in the facts list, paired by position. */
const fact = (term: string) => {
  const terms = screen.getAllByRole("term");
  const at = terms.findIndex((t) => within(t).queryByText(term) !== null);
  return screen.getAllByRole("definition")[at]!;
};

/** Replaces what the text box holds, in one input event. */
async function enter(w: RenderedWidget, value: string) {
  await w.user.clear(textBox());
  if (value !== "") await w.user.paste(value);
}

const textsOf = (cells: HTMLElement[]) =>
  cells.map((c) => c.textContent?.trim() ?? "");

describe("the template", () => {
  it("holds a real text input with maxlength 64, a locale, eight Try buttons and ten fields", async () => {
    await open();
    const input = textBox();
    expect(input).toHaveAttribute("maxlength", "64");
    expect(input).toHaveValue("2h 30m");
    expect(localeBox()).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Try" });
    expect(within(group).getAllByRole("button")).toHaveLength(8);
    expect(fields()).toHaveLength(10);
    for (const name of [
      "1. Your string",
      "2. What it reads as",
      "3. Minute or month, day or 24 hours",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("is seeded: the text and a locale outside the list", async () => {
    await open({ text: "1m", locale: "xx-YY" });
    expect(textBox()).toHaveValue("1m");
    expect(localeBox()).toHaveValue("xx-YY");
  });

  it("writes the same parts before the mount as after", async () => {
    const names = [
      "Parsed duration",
      "Calls made",
      "What the calls returned",
      "Duration fields",
    ];
    const early = await renderWidget(entry, { args: {}, aborted: true });
    for (const name of names) {
      expect(screen.getAllByLabelText(name).length).toBeGreaterThan(0);
    }
    early.destroy();
    await open();
    for (const name of names) {
      expect(screen.getAllByLabelText(name).length).toBeGreaterThan(0);
    }
  });
});

describe("mount", () => {
  it("reads the default string and fills both tables", async () => {
    await open();
    expect(result()).toHaveTextContent("PT2H30M");
    expect(screen.getByText("human")).toBeInTheDocument();
    expect(fact("Compact form")).toHaveTextContent("2h 30m");
    expect(fact("Round trip")).toHaveTextContent(SAME_DURATION_TEXT);
    expect(cellsInColumn(minuteTable(), "parseDuration")).toHaveLength(7);
    expect(
      textsOf(
        cellsInColumn(laytimeTable(), "Hours from Fri 27 Mar 2026 12:00"),
      ),
    ).toEqual(["71", "72"]);
    expect(
      textsOf(
        cellsInColumn(laytimeTable(), "Hours from Fri 23 Oct 2026 12:00"),
      ),
    ).toEqual(["73", "72"]);
    expect(
      screen.getByRole("link", { name: /BIMCO|laytime|Laytime/i }),
    ).toHaveAttribute("href", expect.stringMatching(/bimco\.org/));
    await expectNoAxeViolations(document.body);
  });

  it("shows P1M's human cell as a sentinel and its ISO cell as P1M", async () => {
    await open();
    const table = minuteTable();
    const human = cellsInColumn(table, "parseHumanDuration");
    const iso = cellsInColumn(table, "parseDuration");
    const unit = cellsInColumn(table, "Unit");
    expect(human[6]).toHaveTextContent(CELL_NO_SIGNAL);
    expect(iso[6]).toHaveTextContent("P1M");
    expect(unit[6]).toHaveTextContent("month");
  });

  it("re-draws section 2 when the reader types, and lights the fields", async () => {
    const w = await open();
    await enter(w, "1.5h");
    expect(result()).toHaveTextContent("PT1H30M");
    const item = (name: string) =>
      fields().find((f) => within(f).queryByText(name) !== null);
    expect(item("hours")).toHaveTextContent("1");
    expect(item("minutes")).toHaveTextContent("30");
    expect(item("years")).toHaveTextContent("y0years");
    expect(screen.getByRole("group", { name: "Calls made" })).toHaveTextContent(
      'parseHumanDuration("1.5h")',
    );
    await expectNoAxeViolations(document.body);
  });

  it("keeps a leading space and shows a sentinel, not a blank", async () => {
    const w = await open();
    await enter(w, " 2h");
    expect(textBox().value).toBe(" 2h");
    expect(screen.getByText("neither parser")).toBeInTheDocument();
    expect(result()).toHaveTextContent(RESULT_NO_SIGNAL);
    expect(screen.getByText(/Neither parser reads it/)).toBeInTheDocument();
    expect(fact("Compact form")).toHaveTextContent("not called");
    expect(callsOutput().textContent?.match(/NO SIGNAL/g)).toHaveLength(2);
    await expectNoAxeViolations(document.body);
  });

  it("does not call a valid human string a failure for the ISO parser", async () => {
    await open();
    expect(callsOutput()).not.toHaveTextContent(/NO SIGNAL/);
  });

  it("fills the field from a Try button and runs the call", async () => {
    const w = await open();
    await w.user.click(screen.getByRole("button", { name: "PT90M" }));
    expect(textBox()).toHaveValue("PT90M");
    expect(screen.getByText("ISO 8601")).toBeInTheDocument();
    expect(fact("Compact form")).toHaveTextContent("90m");
    await expectNoAxeViolations(document.body);
  });

  it("re-draws only the formatDuration cells on a locale change", async () => {
    const w = await open();
    const table = minuteTable();
    const humanCells = cellsInColumn(table, "parseHumanDuration");
    const before = textsOf(cellsInColumn(table, "formatDuration"));
    await w.user.selectOptions(localeBox(), "de-DE");
    expect(textsOf(cellsInColumn(minuteTable(), "formatDuration"))).not.toEqual(
      before,
    );
    expect(result()).toHaveTextContent("PT2H30M");
    // The other cells are the same nodes: they were not re-drawn.
    const after = cellsInColumn(minuteTable(), "parseHumanDuration");
    after.forEach((cell, i) => expect(cell).toBe(humanCells[i]));
    await expectNoAxeViolations(document.body);
  });
});

describe("permalinks", () => {
  it("round-trips the text, with spaces and commas, through a permalink", async () => {
    const w = await open();
    await enter(w, "2h, and 30m");
    await w.user.selectOptions(localeBox(), "de-DE");
    const url = w.permalink();
    const state = { text: "2h, and 30m", locale: "de-DE" };
    expect(encodeWidgetPermalink("durationbench", state)).toBe(url);
    const seed = seedFromLocation("durationbench", url.slice(url.indexOf("?")));
    expect(seed).toEqual(state);
    w.destroy();

    await open(seed ?? {});
    expect(textBox()).toHaveValue("2h, and 30m");
    expect(localeBox()).toHaveValue("de-DE");
    expect(result()).toHaveTextContent("PT2H30M");
  });
});

describe("when the library does not load", () => {
  it("rejects with a load error the host turns into the unavailable notice", async () => {
    const originals = { ...GMT_MODULES };
    try {
      const shown = await renderWidget(entry, { args: {}, aborted: true });
      for (const key of Object.keys(GMT_MODULES)) {
        GMT_MODULES[key] = () => Promise.reject(new Error("offline"));
      }
      const failure = await mountDurationParserBench(
        shown.root,
        {},
        new AbortController().signal,
      ).then(
        () => null,
        (e: unknown) => e,
      );
      expect(failure).toBeInstanceOf(WidgetLoadError);
      showUnavailable(shown.root, failure);
      expect(shown.root).not.toBeEmptyDOMElement();
    } finally {
      Object.assign(GMT_MODULES, originals);
    }
  });
});

describe("the length cap", () => {
  it("stops the duration string at 64 characters", async () => {
    const w = await open();
    const box = textBox();
    await w.user.clear(box);
    await w.user.type(box, "x".repeat(72));
    expect(box).toHaveValue("x".repeat(64));
  });
});
