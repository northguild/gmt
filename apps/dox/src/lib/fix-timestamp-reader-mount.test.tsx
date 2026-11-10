/**
 * @vitest-environment jsdom
 *
 * The FIX Timestamp Reader end to end: template, mount, interact, assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person meets the page.
 * The figures are literal values read from a run of the built library.
 */
import { screen } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { realFinanceLib } from "~/test/finance-fixture";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { pictureOf, probeShape } from "./fix-picture";
import { reservedFigure } from "./fix-timestamp-reader-mount";
import {
  EMPTY_STAMP_TEXT,
  FIX_MAX_CHARS,
  NONE_SENT_TEXT,
  STAMP_PRESETS,
  WRITE_PRESETS,
} from "./fix-timestamp-reader";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showFixTimestampReader"] as AnyWidgetEntry;

let live: RenderedWidget | null = null;

const open = async (
  args: Record<string, unknown> = {},
): Promise<RenderedWidget> => {
  live?.destroy();
  live = await renderWidget(entry, { args });
  return live;
};

afterEach(() => {
  live?.destroy();
  live = null;
});

const stampPreset = () => screen.getByRole("combobox", { name: "Preset" });
const writePreset = () =>
  screen.getByRole("combobox", { name: "Instant preset" });
const stampBox = () => screen.getByRole("textbox", { name: "UTCTimestamp" });
const writeBox = () => screen.getByRole("textbox", { name: "Instant" });
const useRead = () =>
  screen.getByRole("button", { name: "Use the instant read above" });

const instantRead = () => screen.getByLabelText("Instant read");

async function paste(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") {
    await w.user.click(box);
    await w.user.paste(value);
  }
}

describe("opening", () => {
  it("opens on the first stamp preset, read", async () => {
    await open();
    expect(stampPreset()).toHaveValue("milliseconds");
    expect(stampBox()).toHaveValue("20240615-14:30:00.100");
    expect(instantRead()).toHaveTextContent("2024-06-15T14:30:00.100Z");
    expect(useRead()).toBeEnabled();
  });

  it("opens on seeded values", async () => {
    await open({
      stamp: "20161231-23:59:60.500",
      write: "2016-12-31T23:59:60.5Z",
    });
    expect(stampPreset()).toHaveValue("inside-2016");
    expect(writePreset()).toHaveValue("leap-2016");
  });

  it.each(STAMP_PRESETS.map((p) => p.id))(
    "has no accessibility violations on %s",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(stampPreset(), id);
      await expectNoAxeViolations(w.root);
    },
  );

  it.each(WRITE_PRESETS.map((p) => p.id))(
    "has no accessibility violations on the writer preset %s",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(writePreset(), id);
      await expectNoAxeViolations(w.root);
    },
  );
});

describe("reading a stamp", () => {
  it("shows a leap second as one, and an ordinary second 60 as refused", async () => {
    const w = await open();
    await w.user.selectOptions(stampPreset(), "inside-2016");
    expect(instantRead()).toHaveTextContent("2016-12-31T23:59:60.500Z");
    expect(
      screen.getAllByText("A leap second UTC inserted").length,
    ).toBeGreaterThan(0);
    await w.user.selectOptions(stampPreset(), "second-60-ordinary");
    expect(screen.getAllByText("⟨ NO SIGNAL ⟩").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Refused").length).toBeGreaterThan(0);
    expect(useRead()).toBeDisabled();
  });

  it("holds the picoseconds apart from the instant", async () => {
    const w = await open();
    await w.user.selectOptions(stampPreset(), "picoseconds");
    expect(instantRead()).toHaveTextContent("2024-06-15T14:30:00.123456789Z");
    expect(screen.getAllByText("012").length).toBeGreaterThan(0);
  });

  it("says none sent for whole seconds, never zero", async () => {
    const w = await open();
    await w.user.selectOptions(stampPreset(), "whole-seconds");
    expect(screen.getAllByText(NONE_SENT_TEXT).length).toBeGreaterThan(0);
  });

  it("switches the preset to Your values on typing", async () => {
    const w = await open();
    await paste(w, stampBox(), "20240615-14:30:00.500");
    expect(stampPreset()).toHaveValue("custom");
    expect(instantRead()).toHaveTextContent("2024-06-15T14:30:00.500Z");
  });

  it("treats an empty box as empty, not as NO SIGNAL", async () => {
    const w = await open();
    await paste(w, stampBox(), "");
    expect(screen.queryByText("⟨ NO SIGNAL ⟩")).not.toBeInTheDocument();
    expect(screen.getAllByText(EMPTY_STAMP_TEXT).length).toBeGreaterThan(0);
    expect(useRead()).toBeDisabled();
  });
});

describe("writing an instant", () => {
  it("writes the five precisions, cut and not rounded", async () => {
    const w = await open();
    await w.user.selectOptions(writePreset(), "near-midnight");
    expect(screen.getAllByText("20241231-23:59:59.999").length).toBeGreaterThan(
      0,
    );
  });

  it("refuses a local time with the caution, and an empty box is not refused", async () => {
    const w = await open();
    await w.user.selectOptions(writePreset(), "local-time");
    expect(screen.getAllByText("no result").length).toBeGreaterThan(0);
    await paste(w, writeBox(), "");
    expect(screen.getAllByText(/Type an instant/).length).toBeGreaterThan(0);
  });

  it("round-trips a leap second through the button", async () => {
    const w = await open();
    await w.user.selectOptions(stampPreset(), "inside-2016");
    await w.user.click(useRead());
    expect(writeBox()).toHaveValue("2016-12-31T23:59:60.500Z");
    expect(writePreset()).toHaveValue("custom");
    expect(screen.getAllByText("20161231-23:59:60.500").length).toBeGreaterThan(
      0,
    );
  });
});

describe("the figure", () => {
  it.each([
    [0, "20240615-14:30:00"],
    [3, "20240615-14:30:00.123"],
    [6, "20240615-14:30:00.123456"],
    [9, "20240615-14:30:00.123456789"],
    [12, "20240615-14:30:00.123456789012"],
  ])("reserves exactly the picture of a %i-digit stamp", (digits, text) => {
    const shape = probeShape(realFinanceLib);
    expect(reservedFigure(digits).halves).toEqual(
      pictureOf(text, shape, true)?.halves,
    );
  });
});

describe("the call frames", () => {
  // A frame scrolls sideways when a line is too long. Its hold keeps a call with the longest
  // text a box takes, so the scrollbar is reserved before anyone types that text.
  it.each(["parseFixUtcTimestamp", "formatFixUtcTimestamp"])(
    "the %s frame reserves a call with the longest text a box takes",
    async (fn) => {
      await open();
      const longest = new RegExp(`${fn}\\(.${"0".repeat(FIX_MAX_CHARS)}.`);
      expect(screen.getAllByText(longest)).not.toHaveLength(0);
    },
  );
});

describe("the permalink", () => {
  it("round-trips both boxes", async () => {
    const w = await open();
    await w.user.selectOptions(stampPreset(), "inside-2016");
    await w.user.selectOptions(writePreset(), "offset");
    const url = w.permalink();
    expect(url).toMatch(
      new RegExp(`^${SITE_BASE}/tools/fix-timestamp-reader/\\?w=fixstamp&wa=`),
    );
    const state = { preset: "inside-2016", writePreset: "offset" };
    expect(url).toBe(encodeWidgetPermalink("fixstamp", state));
    expect(seedFromLocation("fixstamp", url.slice(url.indexOf("?")))).toEqual(
      state,
    );
  });

  it("carries typed text when it matches no preset, and reopens on it", async () => {
    const w = await open();
    await paste(w, stampBox(), "20240615-14:30:00.500");
    await paste(w, writeBox(), "2024-06-15T14:30:00Z");
    const url = w.permalink();
    const state = seedFromLocation("fixstamp", url.slice(url.indexOf("?")));
    expect(state).toEqual({
      stamp: "20240615-14:30:00.500",
      write: "2024-06-15T14:30:00Z",
    });
    const again = await open(state ?? {});
    expect(stampBox()).toHaveValue("20240615-14:30:00.500");
    expect(again.permalink()).toBe(url);
  });
});

describe("teardown", () => {
  it("is inert when aborted before the mount, and destroy twice is safe", async () => {
    live = await renderWidget(entry, { args: {}, aborted: true });
    live.destroy();
    live.destroy();
  });
});
