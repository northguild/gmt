/**
 * @vitest-environment jsdom
 *
 * The Cut-off Countdown widget end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`, through roles and accessible names the way a
 * person (or a screen reader) meets the page. Every preset's printed calls and outputs are
 * appendix Z rows.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  expectNoAxeViolations,
  renderWidget,
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import { COUNTDOWN_PRESETS } from "./cutoff-countdown";
import { renderCutoffCountdownTemplate } from "./cutoff-countdown-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showCutoffCountdown"] as AnyWidgetEntry;

const AMS_CUTOFF = "2024-06-12T17:00:00+02:00[Europe/Amsterdam]";

const EXPECTED: Record<string, [string, string]> = {
  late: ["true", "-PT20M"],
  "on-time": ["false", "PT50M"],
  "at-cutoff": ["true", "PT0S"],
  "other-clock": ["true", "PT0S"],
  "repeated-hour": ["true", "-PT1H"],
  "zoneless-now": ["NO SIGNAL", "NO SIGNAL"],
};

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });

// The controls and results, by the names a person reads.
const presetBox = () => screen.getByRole("combobox", { name: "Preset" });
const cutoffBox = () => screen.getByRole("textbox", { name: "Cut-off" });
const nowBox = () => screen.getByRole("textbox", { name: "Now" });
const zoneBox = () => screen.getByRole("combobox", { name: "Clock" });
const slider = () => screen.getByRole("slider", { name: "Drag now" });
const outPast = () =>
  screen.getByRole("status", { name: "isPastCutoff returned" });
const outLeft = () =>
  screen.getByRole("status", { name: "timeToCutoff returned" });
const face = () => screen.getByRole("status", { name: "Time to cut-off" });
const announcement = () =>
  screen.getByRole("status", { name: "Cut-off announcement" });
/** The verdict's words. The hold keeps aria-hidden ghosts of the others, which a role query
 *  leaves out, as a screen reader does. */
const verdictText = (text: string | RegExp) => {
  const hit = screen
    .getAllByRole("strong")
    .find((el) =>
      typeof text === "string"
        ? el.textContent === text
        : text.test(el.textContent ?? ""),
    );
  if (hit === undefined) throw new Error(`no verdict reads ${String(text)}`);
  return hit;
};

async function enter(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2026-10-15T00:00:00Z");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("renderCutoffCountdownTemplate", () => {
  it("is a named region with three numbered sections and a slider named Drag now", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "Cut-off Countdown" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. The cut-off and now",
      "2. Late or on time",
      "3. What the calls return",
    ]);
    expect(slider()).toBeInTheDocument();
    expect(presetBox()).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use my clock" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Now = the cut-off" }),
    ).toBeInTheDocument();
  });

  it("with no now, contains no date read from the clock", () => {
    const markup = renderCutoffCountdownTemplate("p", {
      cutoff: AMS_CUTOFF,
      timeZone: "Europe/Amsterdam",
    });
    // The only dates present are the ones the caller supplied.
    expect(markup.value.match(/\d{4}-\d{2}-\d{2}/g)).toEqual(["2024-06-12"]);
  });
});

describe("mountCutoffCountdown", () => {
  it.each(COUNTDOWN_PRESETS.map((p) => [p.id]))(
    "prints the documented outputs for %s",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(presetBox(), id!);
      const [past, left] = EXPECTED[id!]!;
      expect(outPast()).toHaveTextContent(past);
      expect(outLeft()).toHaveTextContent(left);
      await expectNoAxeViolations(w.root);
    },
  );

  it("opens pinned on the first preset", async () => {
    await open();
    expect(presetBox()).toHaveValue("late");
    expect(screen.getByText("Now is pinned.")).toBeInTheDocument();
    expect(outLeft()).toHaveTextContent("-PT20M");
  });

  it("shows the late verdict and the rule's local time for the late preset", async () => {
    const w = await open();
    await w.user.selectOptions(presetBox(), "late");
    expect(verdictText("Late by 20 min.")).toBeInTheDocument();
    expect(screen.getByText(/half-open: \[ … , 17:00 \)/)).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("draws hourly ticks for a same-day window", async () => {
    await open();
    expect(screen.getAllByText(/^\d{2}:00$/).length).toBeGreaterThan(0);
  });

  it("draws day ticks once the window spans several days (C8)", async () => {
    await open({
      cutoff: "2024-06-09T16:00:00+08:00[Asia/Shanghai]",
      now: "2024-06-15T04:00:00+08:00",
      timeZone: "Asia/Shanghai",
    });
    expect(screen.getAllByText(/^9 Jun$/).length).toBeGreaterThan(0);
  });

  it("reads a chat seed as late by 20 minutes", async () => {
    await open({
      cutoff: AMS_CUTOFF,
      now: "2024-06-12T17:20:00+02:00",
      timeZone: "Europe/Amsterdam",
    });
    expect(outPast()).toHaveTextContent("true");
    expect(outLeft()).toHaveTextContent("-PT20M");
    expect(verdictText("Late by 20 min.")).toBeInTheDocument();
  });

  it("keeps a seeded zone the list does not carry, and reads through it", async () => {
    await open({
      cutoff: "2024-06-09T16:00:00+03:00[Europe/Helsinki]",
      now: "2024-06-09T15:00:00+03:00",
      timeZone: "Europe/Helsinki",
    });
    expect(zoneBox()).toHaveValue("Europe/Helsinki");
    expect(outLeft()).not.toHaveTextContent("NO SIGNAL");
    expect(outLeft()).toHaveTextContent("PT1H");
  });

  it("the slider reads on time one minute before the cut-off, then closed at the cut-off", async () => {
    const w = await open();
    setRange(slider(), -1);
    expect(verdictText("On time: 1 min left.")).toBeInTheDocument();
    setRange(slider(), 0);
    expect(outLeft()).toHaveTextContent("PT0S");
    expect(verdictText(/^Closed/)).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("Now = the cut-off closes the window", async () => {
    const w = await open();
    await w.user.click(
      screen.getByRole("button", { name: "Now = the cut-off" }),
    );
    expect(outLeft()).toHaveTextContent("PT0S");
    expect(verdictText(/^Closed/)).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("describes the slider in words and gives the chip the short form", async () => {
    await open();
    expect(slider()).toHaveAttribute(
      "aria-valuetext",
      "17:20, 20 min after the cut-off",
    );
    expect(screen.getByText("17:20 · −20 min")).toBeInTheDocument();
  });

  it("speaks the seconds-level value at 20 s before the cut-off", async () => {
    const w = await open();
    await enter(w, cutoffBox(), AMS_CUTOFF);
    await enter(w, nowBox(), "2024-06-12T16:59:40+02:00");
    expect(verdictText("On time: 20 s left.")).toBeInTheDocument();
    expect(face()).toHaveTextContent("+20 s");
    expect(screen.getByText("16:59:40 · +20 s")).toBeInTheDocument();
    expect(slider()).toHaveAttribute(
      "aria-valuetext",
      "16:59:40, 20 s before the cut-off",
    );
  });

  it("shows the signed time on the face, and NO SIGNAL for a sentinel, never blank", async () => {
    const w = await open();
    expect(face()).toHaveTextContent("−20 min");
    await w.user.selectOptions(presetBox(), "zoneless-now");
    expect(face()).toHaveTextContent("NO SIGNAL");
    expect(
      screen.getByRole("complementary", { name: "Why NO SIGNAL" }),
    ).toBeInTheDocument();
    expect(slider()).toBeDisabled();
    expect(slider()).toHaveAttribute("aria-valuetext", "");
    await expectNoAxeViolations(w.root);
  });

  it("a garbage cut-off blanks the chip and says NO SIGNAL", async () => {
    const w = await open();
    await enter(w, cutoffBox(), "not a cut-off");
    expect(outLeft()).toHaveTextContent("NO SIGNAL");
    expect(screen.queryByText(/^\d{2}:\d{2} · /)).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("the chart has no tab stop inside it", async () => {
    await open();
    const lane = screen.getByRole("group", { name: "Time window" });
    expect(within(lane).queryAllByRole("button")).toHaveLength(0);
    expect(within(lane).queryAllByRole("link")).toHaveLength(0);
    expect(within(lane).queryAllByRole("slider")).toHaveLength(0);
  });

  it("names the cut-off and now marks for a reader", async () => {
    await open();
    expect(
      screen.getByRole("img", { name: "cut-off 17:00" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "now 17:20" })).toBeInTheDocument();
  });

  it("destroys twice without error and leaves no observer", async () => {
    const spy = spyOnResizeObservers();
    try {
      const w = await open();
      w.destroy();
      expect(() => w.destroy()).not.toThrow();
      expect(spy.live.size).toBe(0);
    } finally {
      spy.restore();
    }
  });
});

describe("permalinks", () => {
  it.each(COUNTDOWN_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await first.user.selectOptions(presetBox(), id!);
      const url = first.permalink();
      const seeded = seedFromLocation(
        "cutoffcountdown",
        url.slice(url.indexOf("?")),
      );
      expect(Object.values(seeded).every((v) => typeof v === "string")).toBe(
        true,
      );
      expect(encodeWidgetPermalink("cutoffcountdown", seeded)).toBe(url);
      first.destroy();

      const again = await renderWidget(entry, {
        args: seeded,
        idPrefix: "again",
      });
      const second = within(again.root);
      expect(second.getByRole("combobox", { name: "Preset" })).toHaveValue(id);
      expect(
        second.getByRole("status", { name: "timeToCutoff returned" }),
      ).toHaveTextContent(EXPECTED[id!]?.[1] ?? /./);
    },
  );
});

describe("the live clock", () => {
  // The widget under test, so a failing test still tears its timer down before the fake clock.
  let widget: RenderedWidget | null = null;

  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime("2024-06-12T15:20:00Z");
  });

  afterEach(() => {
    widget?.destroy();
    widget = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const seed = { cutoff: AMS_CUTOFF, timeZone: "Europe/Amsterdam" };
  const liveSwitch = () => screen.getByRole("switch", { name: "Live clock" });

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

  async function openLive(args: Record<string, unknown> = seed) {
    widget = await settle(open(args));
    return widget;
  }

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

  it("reads the clock, says it is live and counts down each second", async () => {
    await openLive();
    expect(outLeft()).toHaveTextContent("-PT20M");
    expect(screen.getByText("Now is your clock, live.")).toBeInTheDocument();
    expect(liveSwitch()).toBeChecked();
    vi.advanceTimersByTime(60_000);
    expect(outLeft()).toHaveTextContent("-PT21M");
  });

  it("ticks on the second, not a second after the last tick", async () => {
    vi.setSystemTime("2024-06-12T15:20:00.250Z");
    await openLive();
    expect(outLeft()).toHaveTextContent("-PT20M");
    vi.advanceTimersByTime(749);
    expect(outLeft()).toHaveTextContent("-PT20M");
    vi.advanceTimersByTime(1);
    expect(outLeft()).toHaveTextContent("-PT20M1S");
    vi.advanceTimersByTime(1000);
    expect(outLeft()).toHaveTextContent("-PT20M2S");
  });

  it("a drag switches to pinned, freezes the output and turns the switch off", async () => {
    await openLive();
    setRange(slider(), -10);
    expect(screen.getByText("Now is pinned.")).toBeInTheDocument();
    expect(liveSwitch()).not.toBeChecked();
    expect(outLeft()).toHaveTextContent("PT10M");
    vi.advanceTimersByTime(120_000);
    expect(outLeft()).toHaveTextContent("PT10M");
  });

  it("pauses on the last values and resumes from the clock", async () => {
    const w = await openLive();
    vi.advanceTimersByTime(2000);
    await settle(w.user.click(liveSwitch()));
    expect(liveSwitch()).not.toBeChecked();
    expect(screen.getByText("Now is your clock, paused.")).toBeInTheDocument();
    const held = outLeft().textContent ?? "";
    const heldNow = (nowBox() as HTMLInputElement).value;
    vi.advanceTimersByTime(3000);
    expect(outLeft()).toHaveTextContent(held, { normalizeWhitespace: false });
    expect((nowBox() as HTMLInputElement).value).toBe(heldNow);
    expect(vi.getTimerCount()).toBe(0);
    await settle(w.user.click(liveSwitch()));
    expect(liveSwitch()).toBeChecked();
    expect(screen.getByText("Now is your clock, live.")).toBeInTheDocument();
    expect(outLeft()).not.toHaveTextContent(held, {
      normalizeWhitespace: false,
    });
    expect(vi.getTimerCount()).toBe(1);
  });

  it("starts paused under reduced motion, holds the reading and can be turned on", async () => {
    reducedMotion();
    const w = await openLive();
    expect(liveSwitch()).not.toBeChecked();
    expect(outLeft()).toHaveTextContent("-PT20M");
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(outLeft()).toHaveTextContent("-PT20M");
    await settle(w.user.click(liveSwitch()));
    expect(liveSwitch()).toBeChecked();
    expect(outLeft()).toHaveTextContent("-PT20M5S");
  });

  it("starts the clock from the pinned page when the switch is turned on", async () => {
    const w = await openLive({});
    expect(liveSwitch()).not.toBeChecked();
    expect(screen.getByText("Now is pinned.")).toBeInTheDocument();
    await settle(w.user.click(liveSwitch()));
    expect(liveSwitch()).toBeChecked();
    expect(screen.getByText("Now is your clock, live.")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("keeps focus on the switch and on the copy button through a tick", async () => {
    await openLive();
    const copy = screen.getByRole("button", { name: "Copy timeToCutoff call" });
    liveSwitch().focus();
    vi.advanceTimersByTime(1000);
    expect(liveSwitch()).toHaveFocus();
    copy.focus();
    vi.advanceTimersByTime(1000);
    expect(copy).toBeInTheDocument();
    expect(copy).toHaveFocus();
  });

  it("speaks about once a minute, and not each second", async () => {
    await openLive();
    const status = announcement();
    expect(status).not.toHaveTextContent(/Now is/);
    vi.advanceTimersByTime(30_000);
    expect(status).not.toHaveTextContent(/Now is/);
    vi.advanceTimersByTime(30_000);
    expect(status).toHaveTextContent(/^Now is /);
  });

  it("leaves no timer after the mount is destroyed", async () => {
    const w = await openLive();
    expect(vi.getTimerCount()).toBe(1);
    w.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("has no accessibility violations while it ticks", async () => {
    const w = await openLive();
    vi.advanceTimersByTime(2000);
    await settle(expectNoAxeViolations(w.root));
  });
});

describe("the announcement", () => {
  it("is not the verdict: the verdict is not a live region", async () => {
    await open();
    expect(verdictText("Late by 20 min.")).toBeVisible();
  });

  it("speaks the summary when the reader leaves a field", async () => {
    const w = await open();
    const status = announcement();
    await enter(w, nowBox(), "2024-06-12T17:30:00+02:00");
    await w.user.tab();
    expect(status).toHaveTextContent(/^Now is /);
  });

  it("speaks the summary when the slider is released", async () => {
    await open();
    expect(announcement()).not.toHaveTextContent(/Now is/);
    setRange(slider(), -3);
    expect(announcement()).toHaveTextContent(/On time: 3 min left/);
  });
});
