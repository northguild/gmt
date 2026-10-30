/**
 * @vitest-environment jsdom
 *
 * The interval visualizer end to end: template, mount, interact, assert, against the real
 * `@northguild/gmt`, through roles and accessible names. Each handle is a native slider
 * with its own keyboard model, so the drag's keyboard equivalent is tested by focusing a
 * handle and pressing keys, the way a keyboard user meets it.
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
import { INTERVAL_OPERATIONS } from "./interval-visualizer";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showIntervalVisualizer"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });

const typed = (name: string) =>
  screen.getByRole("textbox", { name }) as HTMLInputElement;
const handleOf = (name: string) => screen.getByRole("slider", { name });
const resultOf = (label: string) => screen.getByRole("status", { name: label });
const presetBox = () =>
  screen.getByRole("combobox", { name: "Relationship preset" });

/** Replaces what a text box holds, in one input event. */
async function enter(w: RenderedWidget, name: string, value: string) {
  const box = typed(name);
  await w.user.clear(box);
  await w.user.paste(value);
}

const RESULT_LABELS = INTERVAL_OPERATIONS.map((op) => `${op.label} result`);
const NO_SIGNAL = /NO SIGNAL/;

describe("the template", () => {
  it("offers a preset, four typed instants and four sliders, each by name", async () => {
    await open();
    expect(presetBox()).toBeInTheDocument();
    for (const name of ["A start", "A end", "B start", "B end"]) {
      expect(typed(name)).toBeInTheDocument();
    }
    for (const name of [
      "Interval A start",
      "Interval A end",
      "Interval B start",
      "Interval B end",
    ]) {
      expect(handleOf(name)).toBeInTheDocument();
    }
  });

  it("gives every operation a lane, a call and a result", async () => {
    await open();
    for (const op of INTERVAL_OPERATIONS) {
      expect(screen.getByRole("group", { name: op.label })).toBeInTheDocument();
      expect(
        screen.getByRole("group", { name: `${op.label} call` }),
      ).toBeInTheDocument();
      expect(resultOf(`${op.label} result`)).toBeInTheDocument();
    }
  });

  it("lays the lanes out in the operations' order after A and B", async () => {
    await open();
    const names = screen
      .getAllByRole("group")
      .map((g) => g.getAttribute("aria-label"))
      .filter(
        (n) =>
          n === "Interval A" ||
          n === "Interval B" ||
          INTERVAL_OPERATIONS.some((op) => op.label === n),
      );
    expect(names).toEqual([
      "Interval A",
      "Interval B",
      ...INTERVAL_OPERATIONS.map((op) => op.label),
    ]);
  });
});

describe("the mount", () => {
  it("fills the typed instants from the first preset and computes every operation", async () => {
    const w = await open();
    for (const name of ["A start", "A end", "B start", "B end"]) {
      expect(typed(name)).not.toHaveValue("");
    }
    for (const label of RESULT_LABELS) {
      expect(resultOf(label)).not.toBeEmptyDOMElement();
      expect(resultOf(label)).not.toHaveTextContent(NO_SIGNAL);
    }
    expect(
      screen.getByRole("complementary", { name: "Relationship of A and B" }),
    ).toHaveTextContent(/partially overlap/);
    await expectNoAxeViolations(w.root);
  });

  it("recomputes when an instant is typed", async () => {
    const w = await open();
    expect(resultOf("Intersection result")).not.toHaveTextContent("2024-05-01");
    await enter(w, "B start", "2024-05-01T00:00:00+00:00[UTC]");
    expect(resultOf("Intersection result")).toHaveTextContent("2024-05-01");
    await expectNoAxeViolations(w.root);
  });

  it("moves an instant when its handle is scrubbed with the keyboard", async () => {
    const w = await open();
    const before = typed("A start").value;
    const slider = handleOf("Interval A start");
    slider.focus();
    await w.user.keyboard("{ArrowRight}");
    const afterStep = typed("A start").value;
    expect(afterStep).not.toBe(before);
    expect(resultOf("Intersection result")).not.toBeEmptyDOMElement();

    await w.user.keyboard("{Home}");
    expect(typed("A start").value).not.toBe(afterStep);
    await expectNoAxeViolations(w.root);
  });

  it("takes a bigger step with PageUp than with an arrow", async () => {
    const w = await open();
    const slider = handleOf("Interval A start");
    slider.focus();
    await w.user.keyboard("{Home}");
    const home = typed("A start").value;
    await w.user.keyboard("{ArrowRight}");
    const small = typed("A start").value;
    await w.user.keyboard("{Home}{PageUp}");
    const big = typed("A start").value;
    expect(small).not.toBe(home);
    expect(big).not.toBe(small);
    expect(big > small).toBe(true);
  });

  it("names a slider's value as the instant it stands for", async () => {
    await open();
    expect(handleOf("Interval A start")).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/\d/),
    );
  });

  it("switches the whole scenario when the preset changes", async () => {
    const w = await open();
    // Every preset starts A on the same day, so watch the fields that move.
    const aEnd = typed("A end").value;
    const bStart = typed("B start").value;
    await w.user.selectOptions(presetBox(), "disjoint");
    expect(typed("A end").value).not.toBe(aEnd);
    expect(typed("B start").value).not.toBe(bStart);
    await expectNoAxeViolations(w.root);
  });

  it("reports disjoint intervals as a correct empty answer, not as no signal", async () => {
    const w = await open();
    await w.user.selectOptions(presetBox(), "disjoint");
    expect(resultOf("Intersection result")).toHaveTextContent(
      /correctly empty/,
    );
    expect(resultOf("Intersection result")).not.toHaveTextContent(NO_SIGNAL);
    await expectNoAxeViolations(w.root);
  });

  it("reports a reversed interval as no signal, with the caution", async () => {
    const w = await open();
    await enter(w, "A start", "2030-01-01T00:00:00+00:00[UTC]");
    for (const label of RESULT_LABELS) {
      expect(resultOf(label)).toHaveTextContent(NO_SIGNAL);
    }
    expect(
      screen.getByRole("complementary", { name: "Relationship of A and B" }),
    ).toHaveTextContent(/Invalid input/);
    expect(
      screen.getByRole("img", { name: "Interval A, not a valid interval" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("draws a mark in the intersection lane for overlapping intervals", async () => {
    await open();
    expect(
      screen.getByRole("img", { name: /^Intersection: / }),
    ).toBeInTheDocument();
  });

  it("seeds from arguments, overriding the preset", async () => {
    const seeded = "2024-05-05T00:00:00+00:00[UTC]";
    await open({ aStart: seeded });
    expect(typed("A start")).toHaveValue(seeded);
    expect(resultOf("Intersection result")).not.toBeEmptyDOMElement();
  });

  it("reports the typed instants for a permalink", async () => {
    const w = await open();
    await enter(w, "A start", "2024-02-02T00:00:00+00:00[UTC]");
    expect(w.permalink()).toContain("aStart");
    expect(decodeURIComponent(w.permalink())).toContain(
      "2024-02-02T00:00:00+00:00[UTC]",
    );
  });

  it("round-trips a permalink into a seeded widget", async () => {
    const link = encodeWidgetPermalink("interval", {
      aStart: "2024-05-05T00:00:00+00:00[UTC]",
    });
    const seed = seedFromLocation("interval", link.slice(link.indexOf("?")));
    await open(seed as Record<string, unknown>);
    expect(typed("A start")).toHaveValue("2024-05-05T00:00:00+00:00[UTC]");
  });

  it("survives destroy twice and an aborted mount", async () => {
    const w = await open();
    w.destroy();
    expect(() => w.destroy()).not.toThrow();
    const aborted = await renderWidget(entry, { aborted: true, idPrefix: "b" });
    expect(() => aborted.destroy()).not.toThrow();
  });
});

/**
 * Regression: the values a model actually sends.
 *
 * Asked "if one meeting runs 9am to 11am and another runs 10am to noon, how do they
 * overlap?", the model called the tool with plain date-times. This widget is the zoned one,
 * so every input failed `isValidZonedDateTime` and the panel said "Invalid input" until the
 * reader changed a preset. The values are repaired, not replaced.
 */
describe("seeding with unzoned values, as a model supplies them", () => {
  const PLAIN = {
    aStart: "2024-10-24T09:00:00",
    aEnd: "2024-10-24T11:00:00",
    bStart: "2024-10-24T10:00:00",
    bEnd: "2024-10-24T12:00:00",
  };

  it("does not show the invalid caution or flag a bar", async () => {
    const w = await open(PLAIN);
    expect(
      screen.getByRole("complementary", { name: "Relationship of A and B" }),
    ).not.toHaveTextContent(/Invalid input/);
    expect(
      screen.queryByRole("img", { name: /not a valid interval/ }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("computes a real result for every operation", async () => {
    await open(PLAIN);
    for (const label of RESULT_LABELS) {
      expect(resultOf(label)).not.toHaveTextContent(NO_SIGNAL);
      expect(resultOf(label)).not.toBeEmptyDOMElement();
    }
  });

  it("rescales the axis to the seeded span", async () => {
    await open(PLAIN);
    expect(screen.queryByText("Jan 2024")).not.toBeInTheDocument();
    const labels = screen.getAllByText(/^\d{2}:\d{2}$/);
    expect(labels).toHaveLength(3);
  });

  it("gives the seeded canvas a step a reader can scrub with", async () => {
    const w = await open(PLAIN);
    const slider = handleOf("Interval A start");
    slider.focus();
    await w.user.keyboard("{ArrowRight}");
    expect(typed("A start").value).toContain("2024-10-24");
    expect(typed("A start")).not.toHaveValue("2024-10-24T09:00:00");
  });

  it("finds the one-hour overlap the reader asked about", async () => {
    await open(PLAIN);
    expect(resultOf("Intersection result")).toHaveTextContent(/10:00/);
    expect(resultOf("Intersection result")).toHaveTextContent(/11:00/);
  });

  it("keeps the reader's values visible, repaired rather than replaced", async () => {
    await open(PLAIN);
    expect(typed("A start").value).toContain("2024-10-24T09:00:00");
  });

  it("honours an explicit zone when the model supplies one", async () => {
    await open({
      ...PLAIN,
      aStart: "2024-10-24T09:00:00-04:00[America/New_York]",
    });
    expect(typed("A start")).toHaveValue(
      "2024-10-24T09:00:00-04:00[America/New_York]",
    );
  });
});

describe("typing instants near the ends of the supported range", () => {
  it("never throws, and recovers on the next value", async () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message);
    window.addEventListener("error", onError);
    try {
      const w = await open();
      const names = ["A start", "A end", "B start", "B end"];
      for (const year of ["+270000", "-270000", "+275000", "-271000"]) {
        for (const name of names) {
          await enter(w, name, `${year}-06-01T00:00:00Z`);
          typed(name).blur();
        }
      }
      expect(errors.map(String)).toEqual([]);

      const values = [
        "2024-06-01T09:00:00+00:00[UTC]",
        "2024-06-01T10:00:00+00:00[UTC]",
        "2024-06-01T09:30:00+00:00[UTC]",
        "2024-06-01T11:00:00+00:00[UTC]",
      ];
      for (const [i, name] of names.entries()) {
        await enter(w, name, values[i]!);
        typed(name).blur();
      }
      expect(errors.map(String)).toEqual([]);
      expect(screen.getAllByText(/^\d{2}:\d{2}$/)).toHaveLength(3);
      expect(
        within(resultOf("Intersection result")).queryByText(NO_SIGNAL),
      ).not.toBeInTheDocument();
    } finally {
      window.removeEventListener("error", onError);
    }
  });
});
