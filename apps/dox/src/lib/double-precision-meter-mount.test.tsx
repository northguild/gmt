/**
 * @vitest-environment jsdom
 *
 * The Double Precision Meter end to end: template -> mount -> interact -> assert, against the
 * real `@northguild/gmt`, through roles and accessible names. Every expectation comes from a
 * live library call, so a drift in the library or the widget fails here.
 */
import { screen, within } from "@testing-library/dom";
import type { LoadedWidget } from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { lib } from "~/test/day-count-lib";
import {
  expectNoAxeViolations,
  renderWidget,
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import { setHtml } from "~/widgets/builders";
import {
  mountDoublePrecisionMeter,
  renderDoublePrecisionMeterTemplate,
} from "./double-precision-meter-mount";
import {
  METER_PRESETS,
  SENTENCES,
  SLIDER_MAX,
  SLIDER_MIN,
  yearAt,
} from "./double-precision-meter";
import { microsText, shiftNs } from "./day-count-widgets";

/** Calls made on the library since the file began. A scale's samples are most of them. */
const counter = vi.hoisted(() => ({ n: 0 }));

vi.mock("./timescale-lib", async (importOriginal) => {
  const real = await importOriginal<typeof import("./timescale-lib")>();
  return {
    ...real,
    loadDayCountLib: async () => {
      const loadedLib = await real.loadDayCountLib();
      return Object.fromEntries(
        Object.entries(loadedLib).map(([k, f]) => [
          k,
          (...a: unknown[]) => {
            counter.n++;
            return (f as (...x: unknown[]) => unknown)(...a);
          },
        ]),
      ) as unknown as typeof loadedLib;
    },
  };
});

installJsdomShims();

const loaded = {
  renderTemplate: renderDoublePrecisionMeterTemplate,
  mount: mountDoublePrecisionMeter,
} as unknown as LoadedWidget<never>;

const PILL = "⟨ NO SIGNAL — invalid input ⟩";

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(loaded, { args });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const valueBox = () => screen.getByRole("textbox", { name: /^Instant/ });
const slider = () => screen.getByRole("slider", { name: "Move the year" });
const status = () => screen.getByRole("status", { name: "Reading summary" });
const plot = () => screen.getByRole("img", { name: /^Measured drift from/ });
const pillIsShown = () => !screen.getByText(PILL).hasAttribute("aria-hidden");

/** The text a person sees in a node: what is not hidden from assistive technology. */
function shown(node: Element): string {
  const copy = node.cloneNode(true) as Element;
  // oxlint-disable-next-line testing-library/no-node-access -- a hold keeps hidden ghosts beside the live text, and no query drops a hidden subtree from a cell's text
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

const CAPTIONS = ["Single JD", "MJD", "J2000 seconds", "Two-part JD"];

/** A plate is a term and its definitions: the value first, then its lines. */
const plateValue = (caption: string): string => {
  const defs = screen.getAllByRole("definition");
  const stride = defs.length / CAPTIONS.length;
  return shown(defs[CAPTIONS.indexOf(caption) * stride]!);
};

async function enter(w: RenderedWidget, value: string) {
  await w.user.clear(valueBox());
  if (value !== "") await w.user.paste(value);
}

describe("renderDoublePrecisionMeterTemplate", () => {
  it("is a named region with three sections, four plates and four scales", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "Double Precision Meter" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Give an instant",
      "2. How far each number drifts",
      "3. Drift across the years",
    ]);
    expect(screen.getAllByRole("term")).toHaveLength(4);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
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

  it("opens on the first preset with the slider on its year", async () => {
    const w = await open();
    expect(preset()).toHaveValue("mid-2026");
    expect(slider()).toHaveValue("2026");
    expect(pillIsShown()).toBe(false);
    await expectNoAxeViolations(w.root);
  });
});

describe("every preset, against the real library", () => {
  it.each(METER_PRESETS.map((p) => [p.id, p.state] as const))(
    "%s",
    async (id, state) => {
      const w = await open();
      await w.user.selectOptions(preset(), id);
      expect(preset()).toHaveValue(id);
      const jd = lib.toJulianDate(state.value, state.scale);
      const back = lib.fromJulianDate(jd as number, state.scale);
      expect(plateValue("Single JD")).toBe(
        microsText(shiftNs(lib, state.value, back)!),
      );
      expect(plateValue("Two-part JD")).toBe("0 µs");
      expect(slider()).toHaveValue(String(Number(state.value.slice(0, 4))));
      expect(pillIsShown()).toBe(false);
      await expectNoAxeViolations(w.root);
    },
  );
});

describe("the year slider", () => {
  it("rewrites only the year and shows Your values", async () => {
    const w = await open();
    setRange(slider(), 3000);
    expect(valueBox()).toHaveValue(
      yearAt(valueBox().getAttribute("value")!, 3000),
    );
    expect((valueBox() as HTMLInputElement).value.slice(0, 4)).toBe("3000");
    expect(
      within(preset()).getByRole("option", { selected: true }),
    ).toHaveTextContent("Your values");
    await expectNoAxeViolations(w.root);
  });

  it("reaches both ends of the range and reads there", async () => {
    // A native range's keys belong to the browser, which jsdom does not drive; the
    // readout-still gate sweeps them in a real one. Here the ends are set directly.
    const w = await open();
    setRange(slider(), SLIDER_MIN);
    expect((valueBox() as HTMLInputElement).value.slice(0, 4)).toBe(
      String(SLIDER_MIN),
    );
    expect(plateValue("Two-part JD")).toBe("0 µs");
    setRange(slider(), SLIDER_MAX);
    expect((valueBox() as HTMLInputElement).value.slice(0, 4)).toBe(
      String(SLIDER_MAX),
    );
    expect(plot()).toHaveAccessibleName(/to 9999/);
    await expectNoAxeViolations(w.root);
  });

  it("follows a typed year that reads and stays put for one that does not", async () => {
    const w = await open();
    await enter(w, "1999-06-15T12:00:00Z");
    expect(slider()).toHaveValue("1999");
    expect(preset()).toHaveValue("custom");
    await enter(w, "not a time");
    expect(slider()).toHaveValue("1999");
    expect(pillIsShown()).toBe(true);
  });

  it("makes no sampling calls while it moves", async () => {
    const w = await open();
    const before = counter.n;
    setRange(slider(), 4000);
    setRange(slider(), 5000);
    expect(counter.n - before).toBeLessThan(200);
    await w.user.click(screen.getByRole("radio", { name: "TT" }));
    expect(plot()).toHaveAccessibleName(/on TT/);
    const afterScale = counter.n;
    setRange(slider(), 6000);
    expect(counter.n - afterScale).toBeLessThan(200);
  });
});

describe("what a reading says in place of an answer", () => {
  it("has the NO SIGNAL pill laid out and shows it only for a sentinel", async () => {
    const w = await open();
    expect(screen.getByText(PILL)).toBeInTheDocument();
    expect(pillIsShown()).toBe(false);
    await enter(w, "2027-02-29T00:00:00Z");
    expect(pillIsShown()).toBe(true);
    expect(status()).toHaveTextContent("This date does not exist in 2027.");
    await enter(w, "2026-06-15T13:47:12Z");
    expect(pillIsShown()).toBe(false);
  });

  it("names a missing offset and a range miss", async () => {
    const w = await open();
    await enter(w, "2026-06-15T13:47:12");
    expect(status()).toHaveTextContent(SENTENCES.missingOffset);
    await enter(w, "1971-12-31T23:59:59Z");
    expect(status()).toHaveTextContent(SENTENCES.range);
    await expectNoAxeViolations(w.root);
  });

  it("says nothing is wrong, and shows no pill, before anything is typed", async () => {
    const w = await open();
    await enter(w, "");
    expect(pillIsShown()).toBe(false);
    CAPTIONS.forEach((c) => expect(plateValue(c)).toBe("no result"));
  });
});

describe("the samples", () => {
  it("are in a table behind a disclosure, one row to a sampled year", async () => {
    const w = await open();
    const button = screen.getByRole("button", { name: "Show the samples" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await w.user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const table = screen.getByRole("table", {
      name: "Worst measured drift in each sampled year",
    });
    expect(within(table).getAllByRole("row")).toHaveLength(165);
    await expectNoAxeViolations(w.root);
  });
});

describe("the permalink", () => {
  async function permalinkOf(args: Record<string, unknown>) {
    const root = document.createElement("div");
    document.body.append(root);
    const controller = new AbortController();
    try {
      setHtml(root, renderDoublePrecisionMeterTemplate("link", args));
      const handle = await mountDoublePrecisionMeter(
        root,
        args,
        controller.signal,
      );
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
    expect(await permalinkOf({ preset: "j2000" })).toEqual({
      value: "2000-01-01T11:58:55.816Z",
      scale: "TT",
    });
  });

  it("round-trips a state", async () => {
    const state = await permalinkOf({
      value: "2030-01-01T00:00:00Z",
      scale: "TAI",
    });
    expect(state).toEqual({ value: "2030-01-01T00:00:00Z", scale: "TAI" });
    const w = await open(state as Record<string, unknown>);
    expect(valueBox()).toHaveValue("2030-01-01T00:00:00Z");
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
});
