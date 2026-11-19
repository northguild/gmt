/**
 * @vitest-environment jsdom
 *
 * The Expiry Calculator end to end, through roles and accessible names. The loader hands the
 * widget the real library wrapped in a recorder, so the printed calls can be checked against
 * the calls that ran, and so a test can see that a bare mount never asks the clock.
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
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import { expiryLib } from "~/test/expiry-lib";
import type { ExpiryLib } from "./expiry-lib";

const recorded: string[] = [];

vi.mock("./expiry-lib", () => ({
  loadExpiryLib: async () => {
    const wrapped = {} as Record<string, unknown>;
    for (const [name, fn] of Object.entries(expiryLib)) {
      wrapped[name] = (...args: unknown[]) => {
        recorded.push(name);
        return (fn as (...a: unknown[]) => unknown)(...args);
      };
    }
    return wrapped as unknown as ExpiryLib;
  },
}));

const { EXPIRY_PRESETS, ROW_COUNT } = await import("./expiry-calculator");
const { renderExpiryCalculatorTemplate } =
  await import("./expiry-calculator-mount");

installJsdomShims();

const entry = WIDGET_REGISTRY["showExpiryCalculator"] as AnyWidgetEntry;

async function mount(args: unknown = {}): Promise<RenderedWidget> {
  recorded.length = 0;
  return renderWidget(entry, { args });
}

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const amount = () => screen.getByRole("textbox", { name: "Amount" });
const startDate = () => screen.getByRole("textbox", { name: "Start date" });
const nowChip = () => screen.getByRole("radio", { name: "Now" });
const dateChip = () => screen.getByRole("radio", { name: "A date" });
const table = () =>
  screen.getByRole("table", { name: "Length from each of the next 12 starts" });
const bodyRows = () => within(table()).getAllByRole("row").slice(1);
const summary = () => screen.getByRole("status", { name: "Summary" });
const count = (name: string) => recorded.filter((n) => n === name).length;

describe("the template", () => {
  it("is the same under two system times, in both modes", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (const args of [{}, { amount: 1, unit: "years" }]) {
        vi.setSystemTime(1_000_000_000_000);
        const a = String(renderExpiryCalculatorTemplate("t", args));
        vi.setSystemTime(1_900_000_000_000);
        const b = String(renderExpiryCalculatorTemplate("t", args));
        expect(a).toBe(b);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("a date", () => {
  it("shows the four plates, the verdict and 12 rows for the first preset", async () => {
    const rendered = await mount();
    expect((await screen.findAllByText("31622400")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/86400 seconds short/).length).toBeGreaterThan(
      0,
    );
    expect(bodyRows()).toHaveLength(ROW_COUNT);
    expect(screen.getAllByText("31622400").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Thu, 15 Jun 2028 12:00:00 GMT").length,
    ).toBeGreaterThan(0);
    await expectNoAxeViolations(rendered.root);
  });

  it("never asks ttlFromNow or the clock until Now is chosen", async () => {
    await mount();
    await screen.findAllByText("31622400");
    expect(count("ttlFromNow")).toBe(0);
    expect(count("getUtcIn")).toBe(0);
  });

  it("walks every preset and keeps 12 rows and the preset menu in step", async () => {
    const rendered = await mount();
    for (const p of EXPIRY_PRESETS) {
      await rendered.user.selectOptions(preset(), p.id);
      expect(preset()).toHaveValue(p.id);
      expect(bodyRows()).toHaveLength(ROW_COUNT);
      await expectNoAxeViolations(rendered.root);
    }
    await rendered.user.clear(amount());
    await rendered.user.paste("2");
    expect(preset()).toHaveValue("custom");
  });

  it("an empty amount shows no result everywhere, never 0", async () => {
    const rendered = await mount();
    await rendered.user.clear(amount());
    await vi.waitFor(() => expect(summary()).toHaveTextContent("no result"), {
      timeout: 1500,
    });
    expect(bodyRows()).toHaveLength(ROW_COUNT);
    expect(screen.queryAllByText("0")).toHaveLength(0);
    await expectNoAxeViolations(rendered.root);
  });

  it("a start the library refuses shows no result", async () => {
    const rendered = await mount();
    await rendered.user.clear(startDate());
    await rendered.user.paste("2027-06-15");
    await vi.waitFor(() => expect(summary()).toHaveTextContent("no result"), {
      timeout: 1500,
    });
  });

  it("the slider moves the start by whole days", async () => {
    const rendered = await mount();
    const slider = screen.getByRole("slider", { name: "Move the start" });
    setRange(slider, 1);
    expect(startDate()).toHaveValue("2027-06-16T12:00:00Z");
    await expectNoAxeViolations(rendered.root);
  });

  it("states the 400-day browser cap in every preset", async () => {
    const rendered = await mount();
    for (const p of EXPIRY_PRESETS) {
      await rendered.user.selectOptions(preset(), p.id);
      expect(
        screen.getByText(/browsers cap/i, { exact: false }),
      ).toBeInTheDocument();
    }
  });
});

describe("Now", () => {
  it("prints ttlFromNow, disables the date and the slider, and goes back", async () => {
    const rendered = await mount();
    await rendered.user.click(nowChip());
    await vi.waitFor(() => expect(count("ttlFromNow")).toBeGreaterThan(0));
    expect(startDate()).toBeDisabled();
    expect(
      screen.getByRole("slider", { name: "Move the start" }),
    ).toBeDisabled();
    expect(
      screen.getAllByText(/ttlFromNow\(\{ years: 1 \}\)/).length,
    ).toBeGreaterThan(0);
    await expectNoAxeViolations(rendered.root);

    await rendered.user.click(dateChip());
    expect(startDate()).toBeEnabled();
    expect(screen.queryAllByText(/ttlFromNow\(\{ years: 1 \}\)/)).toHaveLength(
      0,
    );
  });

  it("calls ttlFromNow once a second and none of the pure plate functions", async () => {
    const rendered = await mount();
    await rendered.user.click(nowChip());
    await vi.waitFor(() => expect(count("ttlFromNow")).toBeGreaterThan(0));
    const pure = () => count("addUtc") + count("totalDuration");
    const pureBefore = pure();
    const before = count("ttlFromNow");
    await vi.waitFor(() => expect(count("ttlFromNow")).toBe(before + 1), {
      timeout: 2500,
    });
    expect(pure()).toBe(pureBefore);
  });

  it("delete-cookie under Now has four no result and the library's null hint", async () => {
    const rendered = await mount();
    await rendered.user.selectOptions(preset(), "delete-cookie");
    await rendered.user.click(nowChip());
    await vi.waitFor(() => expect(summary()).toHaveTextContent("no result"), {
      timeout: 1500,
    });
    expect(bodyRows()).toHaveLength(ROW_COUNT);
    await expectNoAxeViolations(rendered.root);
  });

  it("says the one-instant hint under Now and the date hint under a date", async () => {
    const rendered = await mount();
    const hint = () => screen.getByRole("note", { name: "About the start" });
    expect(hint()).toHaveTextContent(/A date is pinned/);
    await rendered.user.click(nowChip());
    await vi.waitFor(() => expect(count("ttlFromNow")).toBeGreaterThan(0));
    expect(hint()).toHaveTextContent(
      "Now is your clock, live. All four plates come from one ttlFromNow call, so they name one instant.",
    );
    await rendered.user.click(dateChip());
    expect(hint()).toHaveTextContent(/A date is pinned/);
  });

  it("a tick updates the plates and leaves the table as it was", async () => {
    const rendered = await mount();
    await rendered.user.click(nowChip());
    await vi.waitFor(() => expect(count("ttlFromNow")).toBeGreaterThan(0));
    const plates = () =>
      screen
        .getAllByRole("definition")
        .map((d) => d.textContent)
        .join("|");
    const platesBefore = plates();
    const tableBefore = (table().textContent ?? "").replace(/\s+/g, " ").trim();
    const calls = count("ttlFromNow");
    await vi.waitFor(() => expect(count("ttlFromNow")).toBeGreaterThan(calls), {
      timeout: 2500,
    });
    await vi.waitFor(() => expect(plates()).not.toBe(platesBefore), {
      timeout: 2500,
    });
    expect(table()).toHaveTextContent(tableBefore, {
      normalizeWhitespace: true,
    });
  });

  it("stops its timer when the widget is destroyed", async () => {
    const rendered = await mount();
    await rendered.user.click(nowChip());
    await vi.waitFor(() => expect(count("ttlFromNow")).toBeGreaterThan(0));
    rendered.destroy();
    const after = count("ttlFromNow");
    await new Promise((r) => setTimeout(r, 1300));
    expect(count("ttlFromNow")).toBe(after);
  });
});

describe("the Live clock switch", () => {
  const AT = "2024-06-12T15:20:00.250Z";
  // The widget under test, so a failing test still tears its timer down before the fake clock.
  let widget: RenderedWidget | null = null;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(AT);
  });

  afterEach(() => {
    widget?.destroy();
    widget = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const liveSwitch = () => screen.getByRole("switch", { name: "Live clock" });
  const hint = () => screen.getByRole("note", { name: "About the start" });
  const plates = () =>
    screen
      .getAllByRole("definition")
      .map((d) => d.textContent)
      .join("|");

  /**
   * user-event and the mount's own module load wait on `setTimeout`, and the timer is fake
   * here: `settle` runs what is due and yields a real turn until the work is done.
   */
  async function settle<T>(work: Promise<T>): Promise<T> {
    let done = false;
    const tracked = work.finally(() => {
      done = true;
    });
    while (!done) {
      await vi.advanceTimersByTimeAsync(1);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    return tracked;
  }

  async function openNow(): Promise<RenderedWidget> {
    widget = await settle(mount());
    await settle(widget.user.click(nowChip()));
    return widget;
  }

  /** Lets the status's settle timer fire, so a count shows only the clock's own timer. */
  const flushSpeech = () => vi.advanceTimersByTime(600);

  const reducedMotion = () =>
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("reduce"),
          media: query,
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    );

  it("is off and unavailable under A date, where nothing ticks", async () => {
    widget = await settle(mount());
    expect(liveSwitch()).not.toBeChecked();
    expect(liveSwitch()).toBeDisabled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("is on and available under Now, and the plates tick on the second", async () => {
    await openNow();
    expect(liveSwitch()).toBeChecked();
    expect(liveSwitch()).toBeEnabled();
    // Opening and clicking move the fake clock a few milliseconds, so find the first tick,
    // then every later one is exactly a second on.
    let seen = plates();
    let waited = 0;
    while (plates() === seen && waited < 1100) {
      vi.advanceTimersByTime(1);
      waited += 1;
    }
    expect(waited).toBeLessThan(1000);
    seen = plates();
    vi.advanceTimersByTime(999);
    expect(plates()).toBe(seen);
    vi.advanceTimersByTime(1);
    expect(plates()).not.toBe(seen);
  });

  it("pauses on the last values and resumes from the clock", async () => {
    const w = await openNow();
    vi.advanceTimersByTime(2000);
    await settle(w.user.click(liveSwitch()));
    expect(liveSwitch()).not.toBeChecked();
    expect(hint()).toHaveTextContent(/paused on the last reading/);
    const held = plates();
    vi.advanceTimersByTime(3000);
    expect(plates()).toBe(held);
    expect(vi.getTimerCount()).toBe(0);
    await settle(w.user.click(liveSwitch()));
    expect(liveSwitch()).toBeChecked();
    expect(hint()).toHaveTextContent(/^Now is your clock, live\./);
    expect(plates()).not.toBe(held);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("keeps the pause when the reader goes to A date and back", async () => {
    const w = await openNow();
    await settle(w.user.click(liveSwitch()));
    await settle(w.user.click(dateChip()));
    expect(liveSwitch()).not.toBeChecked();
    expect(liveSwitch()).toBeDisabled();
    await settle(w.user.click(nowChip()));
    expect(liveSwitch()).not.toBeChecked();
    expect(liveSwitch()).toBeEnabled();
    flushSpeech();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("under reduced motion reads the clock once and holds it", async () => {
    reducedMotion();
    const w = await openNow();
    expect(liveSwitch()).not.toBeChecked();
    expect(count("ttlFromNow")).toBeGreaterThan(0);
    const held = plates();
    flushSpeech();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(plates()).toBe(held);
    await settle(w.user.click(liveSwitch()));
    expect(liveSwitch()).toBeChecked();
    expect(plates()).not.toBe(held);
  });

  it("keeps focus on the switch through a tick", async () => {
    await openNow();
    liveSwitch().focus();
    vi.advanceTimersByTime(1000);
    expect(liveSwitch()).toBeInTheDocument();
    expect(liveSwitch()).toHaveFocus();
  });

  it("ticks on the whole second, and a late tick does not drift", async () => {
    const wall = () => vi.getMockedSystemTime()?.toISOString();
    await openNow();
    // Now was chosen at :00.250, so the first tick is due 750 ms on, at :01.000.
    let seen = plates();
    for (let ms = 0; plates() === seen && ms < 1100; ms += 1)
      vi.advanceTimersByTime(1);
    expect(wall()).toBe("2024-06-12T15:20:01.000Z");
    // A real timer runs late. Move the wall clock 30 ms on just before the next tick fires.
    seen = plates();
    vi.advanceTimersByTime(999);
    vi.setSystemTime("2024-06-12T15:20:02.029Z");
    vi.advanceTimersByTime(1);
    expect(plates()).not.toBe(seen);
    expect(wall()).toBe("2024-06-12T15:20:02.030Z");
    // The tick after it lands back on the second, at :03.000, not at :03.030.
    seen = plates();
    vi.advanceTimersByTime(969);
    expect(plates()).toBe(seen);
    vi.advanceTimersByTime(1);
    expect(plates()).not.toBe(seen);
    expect(wall()).toBe("2024-06-12T15:20:03.000Z");
  });

  it("writes a tick in place, so focus on the copy button and the plates' nodes survive", async () => {
    const w = await openNow();
    vi.advanceTimersByTime(1000);
    const copy = within(w.root).getByRole("button", { name: "Copy calls" });
    const values = screen.getAllByRole("definition");
    const shown = plates();
    copy.focus();
    vi.advanceTimersByTime(1000);
    expect(plates()).not.toBe(shown);
    expect(copy).toHaveFocus();
    expect(within(w.root).getByRole("button", { name: "Copy calls" })).toBe(
      copy,
    );
    expect(screen.getAllByRole("definition")).toEqual(values);
    screen.getAllByRole("definition").forEach((dd, i) => {
      expect(dd).toBe(values[i]);
    });
  });

  it("leaves no timer after the mount is destroyed", async () => {
    const w = await openNow();
    flushSpeech();
    expect(vi.getTimerCount()).toBe(1);
    w.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("has no accessibility violations while it ticks", async () => {
    const w = await openNow();
    vi.advanceTimersByTime(1000);
    await settle(expectNoAxeViolations(w.root));
  });
});

describe("the permalink", () => {
  it("round-trips a typed length and start", async () => {
    const rendered = await mount({
      amount: 3,
      unit: "days",
      start: "2028-02-28T12:00:00Z",
    });
    expect(amount()).toHaveValue("3");
    expect(startDate()).toHaveValue("2028-02-28T12:00:00Z");
    expect(rendered.permalink()).toContain("expiry");
  });
});
