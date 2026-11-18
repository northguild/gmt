/**
 * @vitest-environment jsdom
 *
 * The PTP Clock Converter end to end: template, mount, interact, assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person meets the page.
 */
import { taiMinusUtc } from "@northguild/gmt/timescale/calculate";
import { utcToPtp } from "@northguild/gmt/iot/convert";
import { screen, within } from "@testing-library/dom";
import type { LoadedWidget } from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import {
  NOTHING_TYPED,
  WRITE_REASONS,
  lit,
  type PtpClockArgs,
} from "./ptp-clock-converter";
import {
  mountPtpClockConverter,
  renderPtpClockConverterTemplate,
} from "./ptp-clock-converter-mount";

installJsdomShims();

const entry: LoadedWidget<PtpClockArgs> = {
  renderTemplate: renderPtpClockConverterTemplate,
  mount: mountPtpClockConverter,
};

let live: RenderedWidget | null = null;

const open = async (args: PtpClockArgs = {}): Promise<RenderedWidget> => {
  live?.destroy();
  live = await renderWidget(entry as LoadedWidget<never>, { args });
  return live;
};

afterEach(() => {
  live?.destroy();
  live = null;
});

const secondsBox = () => screen.getByRole("textbox", { name: "Seconds" });
const nanosBox = () => screen.getByRole("textbox", { name: "Nanoseconds" });
const offsetBox = () =>
  screen.getByRole("textbox", { name: "currentUtcOffset (s)" });
const instantBox = () => screen.getByRole("textbox", { name: "UTC instant" });
const useRead = () =>
  screen.getByRole("button", { name: "Use the reading above" });
// A hold keeps hidden twins of every text it can say; only the live one is perceived.
const many = (text: string | RegExp) =>
  screen.queryAllByText(text, {
    ignore: "[aria-hidden='true'], [aria-hidden='true'] *, script, style",
  }).length;

async function paste(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") {
    await w.user.click(box);
    await w.user.paste(value);
  }
}

describe("opening", () => {
  it("opens on 1704067237 with offset 37, read as midnight UTC", async () => {
    await open();
    expect(secondsBox()).toHaveValue("1704067237");
    expect(offsetBox()).toHaveValue("37");
    expect(many("2024-01-01T00:00:00Z")).toBeGreaterThan(0);
    expect(many("2024-01-01T00:00:37Z")).toBeGreaterThan(0);
    expect(many("Offset matches the table")).toBe(1);
    expect(useRead()).toBeEnabled();
  });

  it("uses typed text inputs for the numbers", async () => {
    await open();
    for (const box of [secondsBox(), nanosBox(), offsetBox()]) {
      expect(box).toHaveAttribute("type", "text");
      expect(box).toHaveAttribute("inputmode", "numeric");
    }
  });

  it("has no accessibility violations", async () => {
    const w = await open();
    await expectNoAxeViolations(w.root);
  });

  it("opens seeded from arguments", async () => {
    await open({ seconds: "1704067237", nanoseconds: "0", offset: "36" });
    expect(offsetBox()).toHaveValue("36");
    expect(many("Offset differs from the table by 1 s")).toBe(1);
  });
});

describe("reading", () => {
  it("shows a refusal as the signal-lost state", async () => {
    const w = await open();
    await paste(w, secondsBox(), "0");
    expect(many(/NO SIGNAL/)).toBeGreaterThan(0);
    expect(useRead()).toBeDisabled();
    await expectNoAxeViolations(w.root);
  });

  it("shows an empty box as nothing typed, not as NO SIGNAL", async () => {
    const w = await open();
    await paste(w, secondsBox(), "");
    expect(many(NOTHING_TYPED)).toBeGreaterThan(0);
    expect(many(/NO SIGNAL/)).toBe(0);
    expect(many("No reading, so nothing to check")).toBe(1);
  });

  it("states an out of range record", async () => {
    const w = await open();
    await paste(w, secondsBox(), "281474976710656");
    expect(many("record out of range")).toBe(1);
  });

  it("keeps a stale offset's difference on the page", async () => {
    const w = await open();
    await paste(w, offsetBox(), "0");
    expect(many("Offset differs from the table by 37 s")).toBe(1);
    expect(many("Every reading is 37 s later than UTC")).toBe(1);
  });
});

describe("the ruler", () => {
  it("names the marks and the gap", async () => {
    const w = await open();
    await paste(w, offsetBox(), "36");
    expect(
      screen.getByRole("img", { name: "Announced offset, 36 s" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Table offset, 37 s" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "1 s apart" })).toBeInTheDocument();
  });

  it("says when an offset falls off the ruler", async () => {
    const w = await open();
    await paste(w, offsetBox(), "90");
    expect(
      screen.getByRole("img", {
        name: "Announced offset, off the ruler: 90 s",
      }),
    ).toBeInTheDocument();
  });
});

describe("writing", () => {
  it("copies the UTC reading into the instant box and writes it back", async () => {
    const w = await open();
    await w.user.click(useRead());
    expect(instantBox()).toHaveValue("2024-01-01T00:00:00Z");
    expect(many(WRITE_REASONS.written)).toBeGreaterThan(0);
    expect(many("1704067237n")).toBeGreaterThan(0);
    await expectNoAxeViolations(w.root);
  });

  it("names a leap second", async () => {
    const w = await open();
    await paste(w, instantBox(), "2016-12-31T23:59:60Z");
    expect(many(WRITE_REASONS.leapSecond)).toBeGreaterThan(0);
    expect(many(/NO SIGNAL/)).toBeGreaterThan(0);
  });

  it("asks for the offset when it is empty", async () => {
    const w = await open();
    await paste(w, offsetBox(), "");
    expect(many(WRITE_REASONS.needOffset)).toBeGreaterThan(0);
  });
});

describe("PTP now", () => {
  const AT = "2024-06-12T15:20:00.250Z";
  const SIGNAL = "⟨ NO SIGNAL ⟩";

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(AT);
  });

  // `live` is destroyed before the mocks and the timers are undone, so the ticker is cleared
  // while its fake clock still exists, and the file leaves nothing behind when a test fails.
  afterEach(() => {
    live?.destroy();
    live = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * user-event and the mount's own module load wait on `setTimeout` and on real I/O, and the
   * timer is fake here. `step` runs what is due and yields a real turn until `work` settles.
   * Opening runs only the timers pending before the mount, so the clock does not move; a click
   * moves it by a millisecond per step, so its asserts read the clock rather than assume it.
   */
  async function settle<T>(
    work: Promise<T>,
    step: () => Promise<unknown>,
  ): Promise<T> {
    let done = false;
    const tracked = work.finally(() => {
      done = true;
    });
    while (!done) {
      await step();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    return tracked;
  }

  const openNow = (args: PtpClockArgs = {}) =>
    settle(open(args), () => vi.runOnlyPendingTimersAsync());
  const settled = <T,>(work: Promise<T>) =>
    settle(work, () => vi.advanceTimersByTimeAsync(1));
  const liveSwitch = () => screen.getByRole("switch", { name: "Live clock" });
  // The readout is the first plate row: each plate is a term, its value and its line. The value
  // keeps hidden twins of its widest texts, so only the perceived span is read.
  const PLATES = ["UTC now", "TAI − UTC", "PTP seconds", "PTP nanoseconds"];
  const plate = (caption: string): string => {
    const value =
      screen.getAllByRole("definition")[PLATES.indexOf(caption) * 2]!;
    return within(value).getByText(/./, { ignore: "[aria-hidden='true']" })
      .textContent!;
  };
  const nowCalls = () =>
    screen.getByRole("group", { name: "Calls made for PTP now" });

  it("shows the PTP count utcToPtp(now, taiMinusUtc(now))", async () => {
    await openNow();
    // The library reads the clock to the nanosecond, so the instant is read off the plate.
    const now = plate("UTC now");
    expect(now).toMatch(/^2024-06-12T15:20:00\.25\d*Z$/);
    const count = utcToPtp(now, taiMinusUtc(now)!)!;
    expect(plate("TAI − UTC")).toBe("37 s");
    expect(plate("PTP seconds")).toBe(`${count.seconds}n`);
    expect(plate("PTP seconds")).toBe("1718205637n");
    expect(plate("PTP nanoseconds")).toBe(String(count.nanoseconds));
    expect(nowCalls()).toHaveTextContent(`taiMinusUtc(${lit(now)})`);
    expect(nowCalls()).toHaveTextContent(`utcToPtp(${lit(now)}, 37)`);
    expect(liveSwitch()).toBeChecked();
  });

  /** The nanoseconds plate is the fraction of the UTC plate, read off the page. */
  const expectNanosOfUtc = (): void => {
    const fraction = /\.(\d+)Z$/.exec(plate("UTC now"))?.[1] ?? "";
    expect(plate("PTP nanoseconds")).toBe(
      String(Number(fraction.padEnd(9, "0"))),
    );
  };

  it("ticks once a second, on the second", async () => {
    await openNow();
    vi.advanceTimersByTime(750);
    expect(plate("UTC now")).toMatch(/^2024-06-12T15:20:01(\.000\d{0,6})?Z$/);
    expect(plate("PTP seconds")).toBe("1718205638n");
    expectNanosOfUtc();
    vi.advanceTimersByTime(1000);
    expect(plate("UTC now")).toMatch(/^2024-06-12T15:20:02(\.000\d{0,6})?Z$/);
    expect(plate("PTP seconds")).toBe("1718205639n");
    expectNanosOfUtc();
  });

  it("keeps focus on the copy button and the calls through a tick, and copies the new calls", async () => {
    const w = await openNow();
    const copy = screen.getByRole("button", {
      name: "Copy the calls for PTP now",
    });
    copy.focus();
    expect(copy).toHaveFocus();
    await settled(w.user.click(copy));
    const before = await navigator.clipboard.readText();
    copy.focus();
    vi.advanceTimersByTime(750);
    expect(copy).toBeInTheDocument();
    expect(copy).toHaveFocus();
    await settled(w.user.click(copy));
    const after = await navigator.clipboard.readText();
    expect(after).not.toBe(before);
    // The copy text is the calls the frame now shows.
    expect(after).toContain(`taiMinusUtc(${lit(plate("UTC now"))})`);
    expect(nowCalls()).toHaveTextContent(after.split("\n")[0]!);

    let pre: EventTarget | null = null;
    nowCalls().addEventListener("focusin", (e) => {
      pre = e.target;
    });
    await settled(w.user.tab());
    expect(pre).not.toBeNull();
    expect(pre).not.toBe(copy);
    expect(pre).toHaveFocus();
    vi.advanceTimersByTime(1000);
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveFocus();
  });

  it("pauses and resumes with the switch", async () => {
    const w = await openNow();
    await settled(w.user.click(liveSwitch()));
    expect(liveSwitch()).not.toBeChecked();
    const held = plate("UTC now");
    vi.advanceTimersByTime(3000);
    expect(plate("UTC now")).toBe(held);
    expect(vi.getTimerCount()).toBe(0);
    await settled(w.user.click(liveSwitch()));
    expect(plate("UTC now")).toMatch(/^2024-06-12T15:20:03\.2[5-9]\d*Z$/);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("under reduced motion reads the clock once and holds it", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("reduce"),
          media: query,
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    );
    await openNow();
    expect(liveSwitch()).not.toBeChecked();
    const held = plate("UTC now");
    expect(held).toMatch(/^2024-06-12T15:20:00\.25\d*Z$/);
    expect(plate("PTP seconds")).toBe("1718205637n");
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(plate("UTC now")).toBe(held);
  });

  it("shows NO SIGNAL for a clock before 1972 and prints only the taiMinusUtc call", async () => {
    vi.setSystemTime("1971-06-01T00:00:00Z");
    await openNow();
    expect(plate("UTC now")).toMatch(/^1971-06-01T00:00:00(\.\d+)?Z$/);
    expect(plate("TAI − UTC")).toBe(SIGNAL);
    expect(plate("PTP seconds")).toBe(SIGNAL);
    expect(plate("PTP nanoseconds")).toBe(SIGNAL);
    // The frame holds a hidden sizer of its widest text; only what is perceived counts.
    const perceived = (text: RegExp) =>
      within(nowCalls()).queryAllByText(text, {
        ignore: "[aria-hidden='true'], [aria-hidden='true'] *",
      });
    expect(perceived(/taiMinusUtc\(/)).toHaveLength(1);
    expect(perceived(/utcToPtp\(/)).toHaveLength(0);
  });

  it("leaves no timer after the mount is destroyed", async () => {
    const w = await openNow();
    expect(vi.getTimerCount()).toBe(1);
    w.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("has no accessibility violations while it ticks", async () => {
    const w = await openNow();
    await settled(expectNoAxeViolations(w.root));
  });

  it("is rendered by the server template without reading the clock", () => {
    vi.setSystemTime("2020-01-01T00:00:00Z");
    const first = String(renderPtpClockConverterTemplate("t"));
    vi.setSystemTime("2031-12-31T23:59:59Z");
    expect(String(renderPtpClockConverterTemplate("t"))).toBe(first);
  });
});
