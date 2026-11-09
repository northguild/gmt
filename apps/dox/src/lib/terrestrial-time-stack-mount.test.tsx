/**
 * @vitest-environment jsdom
 *
 * The Terrestrial Time Stack end to end: template -> mount -> interact -> assert, against the
 * real `@northguild/gmt`, through roles and accessible names the way a person (or a screen
 * reader) meets the page. Every expectation is a live library call, so a drift in the library
 * or the widget fails here. The registry entry belongs to the page that hosts the widget, so
 * the test hands `renderWidget` the template and the mount directly.
 */
import { screen, within } from "@testing-library/dom";
import type { LoadedWidget } from "~/components/ask/widget-registry";
import { lib } from "~/test/timescale-lib";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import {
  mountTerrestrialTimeStack,
  renderTerrestrialTimeStackTemplate,
} from "./terrestrial-time-stack-mount";
import {
  INSIDE_SECOND_TEXT,
  NO_RESULT_TEXT,
  PAST_9999_FOOTNOTE,
  SENTENCES,
  STACK_PRESETS,
  secondsText,
  yearInstant,
} from "./terrestrial-time-stack";
import { setHtml } from "~/widgets/builders";

installJsdomShims();

const loaded = {
  renderTemplate: renderTerrestrialTimeStackTemplate,
  mount: mountTerrestrialTimeStack,
} as unknown as LoadedWidget<never>;

const PILL = "⟨ NO SIGNAL — invalid input ⟩";

type Widget = RenderedWidget;

const open = (args: Record<string, unknown> = {}): Promise<Widget> =>
  renderWidget(loaded, { args });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const valueBox = () =>
  screen.getByRole("textbox", { name: /^A time on UTC, TAI, TT or TCG/ });
const slider = () => screen.getByRole("slider", { name: "Move the year" });
const table = () =>
  screen.getByRole("table", { name: "The same instant on every scale" });
const status = () => screen.getByRole("status", { name: "Reading summary" });
const bar = () => screen.getByRole("img", { name: /^TAI − UTC / });
const lane = () =>
  screen.getByRole("img", { name: /^TCG − TT against the year/ });

/** Replaces what the text box holds, in one input event. */
async function enter(w: Widget, value: string) {
  await w.user.clear(valueBox());
  if (value !== "") await w.user.paste(value);
}

/** The text a person sees in a node: what is not hidden from assistive technology. */
function shown(node: Element): string {
  const copy = node.cloneNode(true) as Element;
  // oxlint-disable-next-line testing-library/no-node-access -- a hold keeps hidden ghosts beside the live text, and no query drops a hidden subtree from a cell's text
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

const PLATE_CAPTIONS = ["TT − UTC", "TAI − UTC", "TT − TAI", "TCG − TT"];

/** A plate is a term and two definitions (the value, then its line). */
function plateValue(caption: string): string {
  const index = PLATE_CAPTIONS.indexOf(caption);
  return shown(screen.getAllByRole("definition")[index * 2]!);
}

const pillIsShown = () => !screen.getByText(PILL).hasAttribute("aria-hidden");

/** The expected reading of an instant, from live library calls. */
function expected(value: string) {
  const space = value.indexOf(" ");
  const token = space < 0 ? "UTC" : value.slice(space + 1);
  const utc =
    token === "UTC"
      ? lib.fromTT(lib.toTT(value))
      : token === "TAI"
        ? lib.fromTAI(value)
        : token === "TT"
          ? lib.fromTT(value)
          : lib.fromTCG(value);
  if (utc === "") return null;
  const tt = lib.toTT(utc);
  return {
    utc,
    labels: [utc, lib.toTAI(utc), tt, lib.toTCG(utc)],
    steps: lib.taiMinusUtc(utc),
    drift: lib.tcgMinusTt(utc),
    inside: lib.hasSecond60(utc),
  };
}

const seconds = (n: number | null): string =>
  n === null ? NO_RESULT_TEXT : `${secondsText(n)} s`;

describe("renderTerrestrialTimeStackTemplate", () => {
  it("is a named region with four numbered sections, four plates and four scales", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "Terrestrial Time Stack" }),
    ).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 4 });
    [
      "1. Say what a clock reads",
      "2. How far TT is from UTC",
      "3. The same instant on every scale",
      "4. What the library returns",
    ].forEach((name, i) => expect(headings[i]).toHaveTextContent(name));
    expect(headings).toHaveLength(4);
    expect(screen.getAllByRole("term")).toHaveLength(4);
    expect(cellsInColumn(table(), "Scale")).toHaveLength(4);
    expect(bar()).toBeInTheDocument();
    expect(lane()).toBeInTheDocument();
  });

  it("joins a plate's value and its unit with a no-break space", async () => {
    await open();
    expect(
      screen.getAllByText("69.184\u00a0s", { normalizer: (t) => t }).length,
    ).toBeGreaterThan(0);
  });

  it("limits the value to 64 characters and names every control", async () => {
    await open();
    expect(valueBox()).toHaveAttribute("maxlength", "64");
    for (const role of ["combobox", "textbox", "slider"] as const) {
      for (const control of screen.getAllByRole(role)) {
        expect(control).toHaveAccessibleName(/\S/);
      }
    }
  });

  it("shows a hostile seed as text, never as elements", async () => {
    await open({ value: '"><img src=x onerror=alert(1)><script>x</script>' });
    expect(screen.queryByRole("img", { name: /^x$/ })).not.toBeInTheDocument();
    expect(valueBox()).toHaveValue(
      '"><img src=x onerror=alert(1)><script>x</script>',
    );
  });

  it("opens on the start of 2026 and puts the slider on its year", async () => {
    await open();
    expect(valueBox()).toHaveValue("2026-01-01T00:00:00Z");
    expect(preset()).toHaveValue("utc-2026");
    expect(slider()).toHaveValue("2026");
  });
});

describe("every preset, against the real library", () => {
  it.each(STACK_PRESETS.map((p) => [p.id, p.state.value] as const))(
    "%s",
    async (id, value) => {
      const w = await open();
      await w.user.selectOptions(preset(), id);
      expect(preset()).toHaveValue(id);
      expect(screen.getAllByRole("term")).toHaveLength(4);
      expect(cellsInColumn(table(), "Scale")).toHaveLength(4);

      const want = expected(value);
      if (want === null) {
        expect(pillIsShown()).toBe(true);
        PLATE_CAPTIONS.forEach((c) =>
          expect(plateValue(c)).toBe(NO_RESULT_TEXT),
        );
        cellsInColumn(table(), "Label").forEach((cell) =>
          expect(shown(cell)).toBe(NO_RESULT_TEXT),
        );
      } else {
        expect(pillIsShown()).toBe(false);
        const labels = cellsInColumn(table(), "Label").map(shown);
        expect(labels).toEqual(want.labels);
        const backs = cellsInColumn(table(), "Back to UTC").map(shown);
        expect(backs).toEqual([want.utc, want.utc, want.utc, want.utc]);
        expect(plateValue("TAI − UTC")).toBe(seconds(want.steps));
        expect(plateValue("TCG − TT")).toBe(seconds(want.drift));
        if (want.inside) {
          expect(plateValue("TT − UTC")).toBe(INSIDE_SECOND_TEXT);
        } else {
          const gap = lib.diffUtcAsDuration(
            want.utc,
            `${want.labels[2]!.slice(0, -3)}Z`,
            "seconds",
          );
          expect(plateValue("TT − UTC")).toBe(
            seconds(Number(gap.replace(/^PT|S$/g, ""))),
          );
        }
        expect(bar()).toHaveAccessibleName(
          new RegExp(`TAI − UTC ${seconds(want.steps)}`),
        );
        expect(status()).toHaveTextContent(/TT − UTC/);
      }
      await expectNoAxeViolations(w.root);
    },
  );
});

describe("typing and dragging", () => {
  it("moves the slider to the year of a value that reads", async () => {
    const w = await open();
    await enter(w, "1999-06-15T12:00:00Z");
    expect(slider()).toHaveValue("1999");
    expect(preset()).toHaveValue("custom");
    expect(plateValue("TAI − UTC")).toBe(
      seconds(lib.taiMinusUtc("1999-06-15T12:00:00Z")),
    );
    await expectNoAxeViolations(w.root);
  });

  it("leaves the slider where it is for a value that does not read", async () => {
    const w = await open();
    await enter(w, "not a time");
    expect(slider()).toHaveValue("2026");
    expect(pillIsShown()).toBe(true);
  });

  it("rewrites the value to the first instant of the year and shows Your values", async () => {
    const w = await open();
    setRange(slider(), 2100);
    expect(valueBox()).toHaveValue(yearInstant(2100));
    expect(preset()).toHaveValue("custom");
    expect(
      within(preset()).getByRole("option", { selected: true }),
    ).toHaveTextContent("Your values");
    expect(plateValue("TCG − TT")).toBe(
      seconds(lib.tcgMinusTt(yearInstant(2100))),
    );
    await expectNoAxeViolations(w.root);
  });

  it("matches a preset again when the typed value is one", async () => {
    const w = await open({ preset: "epoch" });
    await enter(w, "1972-01-01T00:00:00Z");
    expect(preset()).toHaveValue("first-integer-utc");
  });
});

describe("what a reading says in place of an answer", () => {
  it("always has the NO SIGNAL pill and only shows it for a sentinel", async () => {
    const w = await open();
    expect(screen.getByText(PILL)).toBeInTheDocument();
    expect(pillIsShown()).toBe(false);
    await enter(w, "1971-12-31T23:59:59Z");
    expect(screen.getByText(PILL)).toBeInTheDocument();
    expect(pillIsShown()).toBe(true);
    expect(status()).toHaveTextContent(SENTENCES.before1972);
    await enter(w, "2026-01-01T00:00:00Z");
    expect(pillIsShown()).toBe(false);
  });

  it("gives the unknown-token sentence", async () => {
    const w = await open();
    await enter(w, "2026-01-01T00:00:00 GPS");
    expect(pillIsShown()).toBe(true);
    expect(status()).toHaveTextContent(SENTENCES.unknownToken);
    await expectNoAxeViolations(w.root);
  });

  it("says nothing is wrong, and shows no pill, before anything is typed", async () => {
    const w = await open();
    await enter(w, "");
    expect(pillIsShown()).toBe(false);
    PLATE_CAPTIONS.forEach((c) => expect(plateValue(c)).toBe(NO_RESULT_TEXT));
  });

  it("shows no result in a row the library wrote no label for, and says why", async () => {
    const value = "9999-12-31T23:57:00Z";
    const w = await open({ value });
    expect(pillIsShown()).toBe(false);
    expect(cellsInColumn(table(), "Label").map(shown)).toEqual([
      value,
      lib.toTAI(value),
      lib.toTT(value),
      NO_RESULT_TEXT,
    ]);
    expect(shown(cellsInColumn(table(), "Back to UTC")[3]!)).toBe(
      NO_RESULT_TEXT,
    );
    expect(shown(w.root)).toContain(PAST_9999_FOOTNOTE);
    await enter(w, "2026-01-01T00:00:00Z");
    expect(shown(w.root)).not.toContain(PAST_9999_FOOTNOTE);
    await expectNoAxeViolations(w.root);
  });

  it("gives the year-9999 sentence for a valid instant with no TT label", async () => {
    const w = await open();
    await enter(w, "9999-12-31T23:59:59Z");
    expect(pillIsShown()).toBe(true);
    expect(status()).toHaveTextContent(SENTENCES.past9999);
  });

  it("names the reader's own scale", async () => {
    await open({ value: "2026-01-01T00:01:09.184 TT" });
    const rows = within(table()).getAllByRole("row");
    // Every row holds the tag; only the reader's own scale shows it.
    expect(rows.filter((r) => shown(r).includes("your value"))).toHaveLength(1);
    expect(shown(cellsInColumn(table(), "Scale")[2]!)).toBe("TT your value");
  });
});

describe("the permalink", () => {
  /** Mounts without the registry to ask the handle for its permalink state. */
  async function permalinkOf(args: Record<string, unknown>, then?: () => void) {
    const root = document.createElement("div");
    document.body.append(root);
    const controller = new AbortController();
    try {
      setHtml(root, renderTerrestrialTimeStackTemplate("link", args));
      const handle = await mountTerrestrialTimeStack(
        root,
        args,
        controller.signal,
      );
      then?.();
      const state = handle.getPermalinkState?.() ?? null;
      handle.destroy();
      return state;
    } finally {
      controller.abort();
      root.remove();
    }
  }

  it("writes nothing for the default and the value for anything else", async () => {
    expect(await permalinkOf({})).toEqual({});
    expect(await permalinkOf({ preset: "epoch" })).toEqual({
      value: "1977-01-01T00:00:32.184 TT",
    });
  });

  it("round-trips a value of at most 64 characters", async () => {
    const value = "2030-05-05T05:05:05Z";
    const state = await permalinkOf({ value });
    expect(state).toEqual({ value });
    const w = await open(state as Record<string, unknown>);
    expect(valueBox()).toHaveValue(value);
    w.destroy();
  });
});

describe("destroy", () => {
  it("leaves no listener running", async () => {
    const w = await open();
    await enter(w, "2000-01-01T00:00:00Z");
    // `destroy` fails when any listener outlives the mount's signal.
    expect(() => w.destroy()).not.toThrow();
  });

  it("mounts nothing when the signal is already aborted", async () => {
    await renderWidget(loaded, { aborted: true });
  });
});
