/**
 * @vitest-environment jsdom
 *
 * The PTP Clock Converter end to end: template, mount, interact, assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person meets the page.
 */
import { screen } from "@testing-library/dom";
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
