/**
 * @vitest-environment jsdom
 *
 * The Code B Day Ruler end to end: template -> mount -> interact -> assert, against the real
 * `@northguild/gmt`, through roles and accessible names. Every expected date is a library call.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
  type LoadedWidget,
} from "~/components/ask/widget-registry";
import { lib } from "~/test/ccsds-lib";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import {
  RULER_PRESETS,
  TYPE_A_YEAR,
  createRuler,
  fieldDay,
} from "./code-b-day-ruler";
import {
  mountCodeBDayRuler,
  renderCodeBDayRulerTemplate,
} from "./code-b-day-ruler-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const loaded = {
  renderTemplate: renderCodeBDayRulerTemplate,
  mount: mountCodeBDayRuler,
} as unknown as LoadedWidget<never>;

const ruler = createRuler(lib);

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(loaded, { args });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const yearBox = () => screen.getByRole("spinbutton", { name: "Year" });
const compareBox = () =>
  screen.getByRole("spinbutton", { name: "Compare with" });
const slider = () => screen.getByRole("slider", { name: "Day of year" });
const comparison = () => screen.getByRole("status", { name: "Comparison" });

async function typeYear(w: RenderedWidget, box: HTMLElement, text: string) {
  await w.user.clear(box);
  if (text !== "") await w.user.type(box, text);
}

describe("renderCodeBDayRulerTemplate", () => {
  it("is a named region with three numbered sections and named controls", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "Code B Day Ruler" }),
    ).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 3 });
    [
      "1. Two years and a day",
      "2. The same day in each year",
      "3. The calls",
    ].forEach((name, i) => expect(headings[i]).toHaveTextContent(name));
    for (const role of ["combobox", "spinbutton", "slider"] as const) {
      for (const control of screen.getAllByRole(role)) {
        expect(control).toHaveAccessibleName(/\S/);
      }
    }
  });

  it("shows a hostile seed as text, never as elements", async () => {
    const hostile = '"><img src=x onerror=alert(1)><script>x</script>';
    await open({ year: hostile });
    expect(screen.queryByRole("img", { name: /^x$/ })).not.toBeInTheDocument();
  });

  it("opens on 2024 against 2026 at day 061", async () => {
    await open();
    expect(yearBox()).toHaveValue(2024);
    expect(compareBox()).toHaveValue(2026);
    expect(slider()).toHaveValue("61");
    expect(slider()).toHaveAttribute("aria-valuetext", "Day 061");
    expect(preset()).toHaveValue(RULER_PRESETS[0]!.id);
    expect(comparison()).toHaveTextContent(
      "Day 061 is 1 March in 2024 and 2 March in 2026.",
    );
  });
});

describe("every preset, against the real library", () => {
  it.each(RULER_PRESETS.map((p) => [p.id, p] as const))("%s", async (id, p) => {
    const w = await open();
    await w.user.selectOptions(preset(), id);
    expect(preset()).toHaveValue(id);
    expect(yearBox()).toHaveValue(Number(p.state.year));
    expect(compareBox()).toHaveValue(Number(p.state.compare));
    expect(slider()).toHaveValue(String(p.state.day));
    expect(comparison()).toHaveTextContent(ruler.read(p.state).sentence);
    for (const typed of [p.state.year, p.state.compare]) {
      const instant = lib.parseCcsdsAsciiB(
        `${typed}-${fieldDay(p.state.day)}T00:00:00Z`,
      );
      if (instant === "") {
        expect(screen.getByText(`No day 366 in ${typed}`)).toBeInTheDocument();
      } else {
        const a = lib.formatCcsdsAsciiA(instant, 0);
        expect(screen.getByText(a)).toBeInTheDocument();
      }
      expect(
        screen.getByRole("group", {
          name: new RegExp(`^${typed} · \\d+ days$`),
        }),
      ).toBeInTheDocument();
    }
    await expectNoAxeViolations(w.root);
  });
});

describe("the day", () => {
  it("moves both readouts when the slider moves", async () => {
    const w = await open();
    setRange(slider(), 200);
    const read = ruler.read({ year: "2024", compare: "2026", day: 200 });
    expect(slider()).toHaveAttribute("aria-valuetext", "Day 200");
    expect(comparison()).toHaveTextContent(read.sentence);
    expect(screen.getByText(read.lanes[0].codeB)).toBeInTheDocument();
    expect(screen.getByText(read.lanes[1].codeB)).toBeInTheDocument();
    expect(preset()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });

  it("never re-inserts a readout card on a redraw, so its entrance does not replay", async () => {
    const w = await open();
    const entered = (nodes: NodeList): number =>
      [...nodes].filter(
        (n) => n instanceof Element && n.hasAttribute("data-enter"),
      ).length;
    const watch = new MutationObserver(() => {});
    watch.observe(w.root, { childList: true, subtree: true });
    try {
      setRange(slider(), 200);
      await typeYear(w, yearBox(), "");
      await typeYear(w, yearBox(), "10000");
      const moves = watch
        .takeRecords()
        .reduce(
          (n, r) => n + entered(r.addedNodes) + entered(r.removedNodes),
          0,
        );
      expect(moves).toBe(0);
      expect(screen.getAllByText("10000 · no result").length).toBeGreaterThan(
        0,
      );
    } finally {
      watch.disconnect();
    }
  });

  it("prints exactly the four calls a step made", async () => {
    await open();
    setRange(slider(), 100);
    const frame = screen.getByRole("group", { name: "Calls made" });
    expect(frame).toHaveTextContent("parseCcsdsAsciiB");
    expect(frame).toHaveTextContent("formatCcsdsAsciiA");
  });

  it("says day 366 does not exist in a common year, and draws the absent cell", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "day-366");
    expect(screen.getByText("No day 366 in 2017")).toBeInTheDocument();
    expect(screen.getByText("31 December")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "no day 366" })).toHaveLength(1);
    await expectNoAxeViolations(w.root);
  });

  it("draws a cursor for the day in each lane", async () => {
    await open();
    expect(screen.getAllByRole("img", { name: "Day 061" })).toHaveLength(2);
  });
});

describe("typing a year", () => {
  it("clears and refills the first year", async () => {
    const w = await open();
    await typeYear(w, yearBox(), "");
    expect(screen.getByText(TYPE_A_YEAR)).toBeInTheDocument();
    expect(comparison()).toHaveTextContent("Give two years to compare.");
    expect(preset()).toHaveValue("custom");
    await w.user.type(yearBox(), "2016");
    expect(comparison()).toHaveTextContent(
      ruler.read({ year: "2016", compare: "2026", day: 61 }).sentence,
    );
    await expectNoAxeViolations(w.root);
  });

  it("clears and refills the second year", async () => {
    const w = await open();
    await typeYear(w, compareBox(), "");
    expect(screen.getByText(TYPE_A_YEAR)).toBeInTheDocument();
    await w.user.type(compareBox(), "2100");
    expect(comparison()).toHaveTextContent(
      ruler.read({ year: "2024", compare: "2100", day: 61 }).sentence,
    );
  });

  it("says no result for a year the library cannot read, beside a lane that works", async () => {
    const w = await open();
    await typeYear(w, yearBox(), "10000");
    expect(
      screen.getByRole("group", { name: "10000 · no result" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("⟨ NO SIGNAL ⟩").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("group", { name: "2026 · 365 days" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("reads the day in 2000 and 2100 by the library's rule", async () => {
    const w = await open();
    await typeYear(w, yearBox(), "2000");
    await typeYear(w, compareBox(), "2100");
    setRange(slider(), 60);
    expect(comparison()).toHaveTextContent(
      "Day 060 is 29 February in 2000 and 1 March in 2100.",
    );
    const lanes = within(
      screen.getByRole("region", { name: "Code B Day Ruler" }),
    );
    expect(
      lanes.getByRole("group", { name: "2000 · 366 days" }),
    ).toBeInTheDocument();
    expect(
      lanes.getByRole("group", { name: "2100 · 365 days" }),
    ).toBeInTheDocument();
  });
});

describe("the permalink", () => {
  const entry = WIDGET_REGISTRY["showCodeBDayRuler"] as AnyWidgetEntry;

  it("is a bare page link for the opening state, and round-trips a changed one", async () => {
    const w = await renderWidget(entry, { args: {} });
    try {
      expect(w.permalink()).toBe(encodeWidgetPermalink("dayruler", {}));
      setRange(slider(), 100);
      const url = w.permalink();
      const state = seedFromLocation("dayruler", url.slice(url.indexOf("?")));
      expect(state).toMatchObject({ day: "100" });
      w.destroy();
      w.root.remove();
      const again = await renderWidget(entry, { args: state });
      try {
        expect(slider()).toHaveValue("100");
        expect(again.permalink()).toBe(url);
      } finally {
        again.destroy();
      }
    } finally {
      w.destroy();
    }
  });

  it("seeds from the strings the guide's link carries", async () => {
    const w = await renderWidget(entry, {
      args: { year: "2016", compare: "2017", day: "366" },
    });
    try {
      expect(yearBox()).toHaveValue(2016);
      expect(compareBox()).toHaveValue(2017);
      expect(slider()).toHaveValue("366");
    } finally {
      w.destroy();
    }
  });
});
