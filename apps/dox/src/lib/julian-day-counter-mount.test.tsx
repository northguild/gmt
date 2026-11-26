/**
 * @vitest-environment jsdom
 *
 * The Julian Day Counter end to end: template -> mount -> interact -> assert, against the real
 * `@northguild/gmt`, through roles and accessible names. Every expectation is a live library
 * call, so a drift in the library or the widget fails here.
 */
import { screen, within } from "@testing-library/dom";
import type { LoadedWidget } from "~/components/ask/widget-registry";
import { lib } from "~/test/day-count-lib";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { setHtml } from "~/widgets/builders";
import { numberText } from "./day-count-widgets";
import {
  COUNTER_PRESETS,
  EDGE_NOTE,
  EMPTY_TEXT,
  LEAP_NOTE,
  NO_RESULT_TEXT,
  SENTENCES,
} from "./julian-day-counter";
import {
  mountJulianDayCounter,
  renderJulianDayCounterTemplate,
} from "./julian-day-counter-mount";

installJsdomShims();

const loaded = {
  renderTemplate: renderJulianDayCounterTemplate,
  mount: mountJulianDayCounter,
} as unknown as LoadedWidget<never>;

const PILL = "⟨ NO SIGNAL — invalid input ⟩";

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(loaded, { args });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const valueBox = () => screen.getByRole("textbox", { name: /^Value/ });
const table = () =>
  screen.getByRole("table", { name: "The same instant in each form" });
const status = () => screen.getByRole("status", { name: "Reading summary" });
const pillIsShown = () => !screen.getByText(PILL).hasAttribute("aria-hidden");

/** The text a person sees in a node: what is not hidden from assistive technology. */
function shown(node: Element): string {
  const copy = node.cloneNode(true) as Element;
  // oxlint-disable-next-line testing-library/no-node-access -- a hold keeps hidden ghosts beside the live text, and no query drops a hidden subtree from a cell's text
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A plate is a term, then its value, then its lines. */
function plateValue(index: number): string {
  // oxlint-disable-next-line testing-library/no-node-access -- a plate's value is the definition that follows its term, and no query pairs the two
  return shown(screen.getAllByRole("term")[index]!.nextElementSibling!);
}

async function enter(w: RenderedWidget, value: string) {
  await w.user.clear(valueBox());
  if (value !== "") await w.user.paste(value);
}

describe("renderJulianDayCounterTemplate", () => {
  it("is a named region with five numbered sections and four plates", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "Julian Day Counter" }),
    ).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 4 });
    [
      "1. Give an instant or a count",
      "2. The same instant, four ways",
      "3. Where each day begins",
      "4. Each form and its way back",
      "5. What the library returns",
    ].forEach((name, i) => expect(headings[i]).toHaveTextContent(name));
    expect(screen.getAllByRole("term")).toHaveLength(4);
    expect(cellsInColumn(table(), "Form")).toHaveLength(4);
  });

  it("limits the value to 64 characters and names every control", async () => {
    await open();
    expect(valueBox()).toHaveAttribute("maxlength", "64");
    for (const role of ["combobox", "textbox", "radio"] as const) {
      for (const control of screen.getAllByRole(role)) {
        expect(control).toHaveAccessibleName(/\S/);
      }
    }
  });

  it("shows a hostile seed as text, never as elements", async () => {
    const hostile = '"><img src=x onerror=alert(1)><script>x</script>';
    await open({ value: hostile });
    expect(valueBox()).toHaveValue(hostile);
    expect(screen.queryByRole("img", { name: /^x$/ })).not.toBeInTheDocument();
  });

  it("opens on J2000.0 read as a JD on TT", async () => {
    await open();
    expect(valueBox()).toHaveValue(COUNTER_PRESETS[0]!.state.value);
    expect(preset()).toHaveValue(COUNTER_PRESETS[0]!.id);
    expect(screen.getByRole("radio", { name: "JD" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "TT" })).toBeChecked();
  });
});

describe("every preset, against the real library", () => {
  it.each(COUNTER_PRESETS.map((p) => [p.id, p] as const))(
    "%s",
    async (id, p) => {
      const w = await open();
      await w.user.selectOptions(preset(), id);
      expect(preset()).toHaveValue(id);
      expect(valueBox()).toHaveValue(p.state.value);

      const utc =
        p.state.read === "instant"
          ? p.state.value
          : lib.fromJulianDate(Number(p.state.value), p.state.scale);
      const parts = lib.toJulianDateParts(utc, p.state.scale)!;
      expect(plateValue(0)).toBe(
        `${numberText(parts.jd1)} + ${numberText(parts.jd2)}`,
      );
      const jd = lib.toJulianDate(utc, p.state.scale);
      expect(plateValue(1)).toBe(jd === null ? NO_RESULT_TEXT : numberText(jd));
      const mjd = lib.toModifiedJulianDate(utc, p.state.scale);
      expect(plateValue(2)).toBe(
        mjd === null ? NO_RESULT_TEXT : numberText(mjd),
      );
      const sec = lib.toJ2000Seconds(utc, p.state.scale);
      expect(plateValue(3)).toBe(
        sec === null ? NO_RESULT_TEXT : numberText(sec),
      );
      expect(pillIsShown()).toBe(false);
      expect(cellsInColumn(table(), "Form")).toHaveLength(4);
      expect(status()).toHaveTextContent(/Two-part JD/);
      await expectNoAxeViolations(w.root);
    },
  );

  it("the leap-second preset says why its JD is a quasi-JD", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "leap");
    expect(w.root).toHaveTextContent(LEAP_NOTE);
  });

  it("the twenty-microsecond preset shows what a single JD drops", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "lost");
    const shifts = cellsInColumn(table(), "Shift").map(shown);
    expect(shifts[0]).toBe("0 ns");
    expect(shifts[1]).toBe("−20.000 µs");
  });
});

describe("typing and choosing", () => {
  it("reads a typed count in the chosen read mode", async () => {
    const w = await open();
    await w.user.click(screen.getByRole("radio", { name: "MJD" }));
    await enter(w, "61041.5");
    expect(preset()).toHaveValue("custom");
    const utc = lib.fromModifiedJulianDate(61041.5, "TT");
    expect(shown(cellsInColumn(table(), "Back to UTC")[2]!)).toBe(utc);
  });

  it("reads two parts joined by a plus", async () => {
    const w = await open();
    await enter(w, "2461042 + 0.5");
    const parts = lib.toJulianDateParts(
      lib.fromJulianDateParts({ jd1: 2461042, jd2: 0.5 }, "TT"),
      "TT",
    )!;
    expect(plateValue(0)).toBe(
      `${numberText(parts.jd1)} + ${numberText(parts.jd2)}`,
    );
    expect(pillIsShown()).toBe(false);
  });

  it("moves between scales with the keyboard", async () => {
    const w = await open({ value: "2026-01-01T12:00:00Z", read: "instant" });
    await w.user.click(screen.getByRole("radio", { name: "UTC" }));
    await w.user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "TAI" })).toBeChecked();
    expect(plateValue(1)).toBe(
      numberText(lib.toJulianDate("2026-01-01T12:00:00Z", "TAI")!),
    );
    await expectNoAxeViolations(w.root);
  });

  it("draws the scale's midnights apart from UTC's only off UTC", async () => {
    const w = await open({
      value: "2026-01-01T12:00:00Z",
      read: "instant",
      scale: "TT",
    });
    expect(screen.getAllByRole("img", { name: "TT midnight" })).toHaveLength(3);
    expect(
      screen.getAllByRole("img", { name: "UTC midnight" }).length,
    ).toBeGreaterThan(0);
    await w.user.click(screen.getByRole("radio", { name: "UTC" }));
    expect(screen.queryAllByRole("img", { name: "TT midnight" })).toHaveLength(
      0,
    );
    expect(
      screen.getAllByRole("img", { name: "UTC midnight" }).length,
    ).toBeGreaterThan(0);
  });
});

describe("what a reading says in place of an answer", () => {
  it("always has the NO SIGNAL pill and only shows it for a sentinel", async () => {
    const w = await open();
    expect(screen.getByText(PILL)).toBeInTheDocument();
    expect(pillIsShown()).toBe(false);
    await enter(w, "abc");
    expect(pillIsShown()).toBe(true);
    expect(status()).toHaveTextContent(SENTENCES.notANumber);
    await enter(w, "2451545");
    expect(pillIsShown()).toBe(false);
    await expectNoAxeViolations(w.root);
  });

  it("gives the before-1972 sentence for an instant", async () => {
    const w = await open({ value: "1971-12-31T23:59:59Z", read: "instant" });
    expect(pillIsShown()).toBe(true);
    expect(status()).toHaveTextContent(SENTENCES.range);
    cellsInColumn(table(), "Value").forEach((c) =>
      expect(shown(c)).toBe(NO_RESULT_TEXT),
    );
    await expectNoAxeViolations(w.root);
  });

  it("says nothing is wrong, and shows no pill, before anything is typed", async () => {
    const w = await open();
    await enter(w, "");
    expect(pillIsShown()).toBe(false);
    expect(status()).toHaveTextContent(EMPTY_TEXT);
    for (let i = 0; i < 4; i++) expect(plateValue(i)).toBe(NO_RESULT_TEXT);
  });

  it("a correct answer is never shown as NO SIGNAL when only a single double fails", async () => {
    const w = await open({
      value: "9999-12-31T23:59:59.99997Z",
      read: "instant",
      scale: "UTC",
    });
    expect(pillIsShown()).toBe(false);
    if (lib.toJulianDate("9999-12-31T23:59:59.99997Z", "UTC") === null) {
      expect(w.root).toHaveTextContent(EDGE_NOTE);
    }
  });
});

describe("the permalink", () => {
  async function permalinkOf(
    args: Record<string, unknown>,
    then?: (root: HTMLElement) => Promise<void> | void,
  ) {
    const root = document.createElement("div");
    document.body.append(root);
    const controller = new AbortController();
    try {
      setHtml(root, renderJulianDayCounterTemplate("link", args));
      const handle = await mountJulianDayCounter(root, args, controller.signal);
      await then?.(root);
      const state = handle.getPermalinkState?.() ?? null;
      handle.destroy();
      return state;
    } finally {
      controller.abort();
      root.remove();
    }
  }

  it("writes nothing for the default and the state for anything else", async () => {
    expect(await permalinkOf({})).toEqual({});
    expect(await permalinkOf({ preset: "midnight" })).toEqual({
      value: "2000-01-01T00:00:00Z",
      read: "instant",
      scale: "UTC",
    });
  });

  it("round-trips a state", async () => {
    const state = await permalinkOf({
      value: "2461041 + 0.5",
      read: "jd",
      scale: "TAI",
    });
    expect(state).toEqual({ value: "2461041 + 0.5", read: "jd", scale: "TAI" });
    const w = await open(state as Record<string, unknown>);
    expect(valueBox()).toHaveValue("2461041 + 0.5");
    expect(screen.getByRole("radio", { name: "TAI" })).toBeChecked();
    w.destroy();
  });
});

describe("destroy", () => {
  it("leaves no listener running", async () => {
    const w = await open();
    await enter(w, "2000-01-01T00:00:00Z");
    expect(() => w.destroy()).not.toThrow();
  });

  it("mounts nothing when the signal is already aborted", async () => {
    await renderWidget(loaded, { aborted: true });
  });

  it("owns its own controller when mounted by hand", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const controller = new AbortController();
    try {
      setHtml(root, renderJulianDayCounterTemplate("hand", {}));
      const handle = await mountJulianDayCounter(root, {}, controller.signal);
      expect(
        within(root).getByRole("combobox", { name: "Preset" }),
      ).toBeInTheDocument();
      handle.destroy();
    } finally {
      controller.abort();
      root.remove();
    }
  });
});
