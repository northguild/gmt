/**
 * @vitest-environment jsdom
 *
 * The CCSDS Time Code Decoder end to end: template, mount, interact, assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person meets the page.
 */
import { screen } from "@testing-library/dom";
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
import {
  CCSDS_MAX_CHARS,
  CODE_PRESETS,
  EMPTY_CODE_TEXT,
  EMPTY_INSTANT_TEXT,
  NO_RESULT_WORDS,
  WRITE_PRESETS,
} from "./ccsds-time-code-decoder";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showCcsdsTimeCodeDecoder"] as AnyWidgetEntry;

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

const codePreset = () => screen.getByRole("combobox", { name: "Preset" });
const writePreset = () =>
  screen.getByRole("combobox", { name: "Instant preset" });
const codeBox = () =>
  screen.getByRole("textbox", { name: "CCSDS ASCII time code" });
const writeBox = () => screen.getByRole("textbox", { name: "Instant" });
const useRead = () =>
  screen.getByRole("button", { name: "Use the instant read above" });
const instantRead = () => screen.getByLabelText("Instant read");
const digitChip = (v: string) => screen.getByRole("radio", { name: v });

async function paste(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") {
    await w.user.click(box);
    await w.user.paste(value);
  }
}

describe("opening", () => {
  it("opens on the leap-second preset, read", async () => {
    await open();
    expect(codePreset()).toHaveValue("leap-2016-b");
    expect(codeBox()).toHaveValue("2016-366T23:59:60.5Z");
    expect(instantRead()).toHaveTextContent("2016-12-31T23:59:60.5Z");
    expect(useRead()).toBeEnabled();
  });

  it("opens on seeded values", async () => {
    await open({ preset: "code-a", writePreset: "offset" });
    expect(codePreset()).toHaveValue("code-a");
    expect(writePreset()).toHaveValue("offset");
  });

  it.each(CODE_PRESETS.map((p) => p.id))(
    "has no accessibility violations on %s",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(codePreset(), id);
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

describe("reading a code", () => {
  it("reads every preset it accepts and refuses the rest with NO SIGNAL", async () => {
    const w = await open();
    await w.user.selectOptions(codePreset(), "code-a");
    expect(instantRead()).toHaveTextContent("1988-01-18T17:20:43.123456Z");
    await w.user.selectOptions(codePreset(), "false-60");
    expect(screen.getAllByText("⟨ NO SIGNAL ⟩").length).toBeGreaterThan(0);
    expect(useRead()).toBeDisabled();
    await w.user.selectOptions(codePreset(), "lower-case");
    expect(screen.getAllByText(/upper case only/).length).toBeGreaterThan(0);
  });

  it("switches the preset to Your values on typing", async () => {
    const w = await open();
    await paste(w, codeBox(), "2024-061T00:00:00Z");
    expect(codePreset()).toHaveValue("custom");
    expect(instantRead()).toHaveTextContent("2024-03-01T00:00:00Z");
  });

  it("treats an empty box as empty, not as NO SIGNAL", async () => {
    const w = await open();
    await paste(w, codeBox(), "");
    expect(screen.queryByText("⟨ NO SIGNAL ⟩")).not.toBeInTheDocument();
    expect(screen.getAllByText(EMPTY_CODE_TEXT).length).toBeGreaterThan(0);
    expect(useRead()).toBeDisabled();
  });
});

describe("writing an instant", () => {
  it("cuts the end of a year and shows what was cut", async () => {
    const w = await open();
    await w.user.selectOptions(writePreset(), "year-end-cut");
    expect(
      screen.getAllByText("2026-365T23:59:59.999Z").length,
    ).toBeGreaterThan(0);
  });

  it("follows every digit chip", async () => {
    const w = await open();
    await w.user.selectOptions(writePreset(), "offset");
    for (const v of [
      "auto",
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]) {
      await w.user.click(digitChip(v));
      expect(digitChip(v)).toBeChecked();
    }
    expect(writePreset()).toHaveValue("custom");
  });

  it("refuses a local time, and an empty box is not refused", async () => {
    const w = await open();
    await w.user.selectOptions(writePreset(), "local-time");
    expect(screen.getAllByText(NO_RESULT_WORDS).length).toBeGreaterThan(0);
    await paste(w, writeBox(), "");
    expect(screen.getAllByText(EMPTY_INSTANT_TEXT).length).toBeGreaterThan(0);
  });

  it("keeps the written plates, the cut line and the reason the same nodes when an instant is refused", async () => {
    const w = await open();
    // The output frame is the EDI kit's and draws its own sentinel row; the rest is this widget's.
    const shape = () =>
      ["out-a", "out-b", "copy-a", "copy-b", "cut", "write-reason"].map((p) => {
        // oxlint-disable-next-line testing-library/no-node-access -- counting nodes is the assertion
        const el = document.querySelector<HTMLElement>(`[id$="-${p}"]`)!;
        // oxlint-disable-next-line testing-library/no-node-access -- counting nodes is the assertion
        return `${p}:${el.querySelectorAll("*").length}`;
      });
    await w.user.selectOptions(writePreset(), "offset");
    const written = shape();
    await w.user.selectOptions(writePreset(), "local-time");
    expect(screen.getAllByText(NO_RESULT_WORDS).length).toBeGreaterThan(0);
    expect(shape()).toEqual(written);
    await paste(w, writeBox(), "");
    expect(shape()).toEqual(written);
    await paste(w, writeBox(), "2024-06-15T14:30:00Z");
    expect(shape()).toEqual(written);
  });

  it("round-trips a leap second through the button", async () => {
    const w = await open();
    await w.user.click(useRead());
    expect(writeBox()).toHaveValue("2016-12-31T23:59:60.5Z");
    expect(writePreset()).toHaveValue("custom");
    expect(screen.getByRole("status", { name: "Code B" })).toHaveTextContent(
      "2016-366T23:59:60.500Z",
    );
  });
});

describe("the call frames", () => {
  it.each(["parseCcsdsAsciiA", "parseCcsdsAsciiB"])(
    "the %s frame reserves a call with the longest text a box takes",
    async (fn) => {
      await open();
      const longest = new RegExp(`${fn}\\(.${"0".repeat(CCSDS_MAX_CHARS)}.`);
      expect(screen.getAllByText(longest)).not.toHaveLength(0);
    },
  );
});

describe("the permalink", () => {
  it("round-trips both boxes", async () => {
    const w = await open();
    await w.user.selectOptions(codePreset(), "no-z");
    await w.user.selectOptions(writePreset(), "offset");
    const url = w.permalink();
    expect(url).toMatch(
      new RegExp(`^${SITE_BASE}/tools/ccsds-time-code-decoder/\\?w=ccsds&wa=`),
    );
    const state = { preset: "no-z", writePreset: "offset" };
    expect(url).toBe(encodeWidgetPermalink("ccsds", state));
    expect(seedFromLocation("ccsds", url.slice(url.indexOf("?")))).toEqual(
      state,
    );
  });

  it("carries typed text and digits, and reopens on them", async () => {
    const w = await open();
    await paste(w, codeBox(), "2024-061T00:00:00Z");
    await paste(w, writeBox(), "2024-06-15T14:30:00Z");
    await w.user.click(digitChip("4"));
    const url = w.permalink();
    const state = seedFromLocation("ccsds", url.slice(url.indexOf("?")));
    expect(state).toEqual({
      code: "2024-061T00:00:00Z",
      instant: "2024-06-15T14:30:00Z",
      digits: "4",
    });
    const again = await open(state ?? {});
    expect(codeBox()).toHaveValue("2024-061T00:00:00Z");
    expect(digitChip("4")).toBeChecked();
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
