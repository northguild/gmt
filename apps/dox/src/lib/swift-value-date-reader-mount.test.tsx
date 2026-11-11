/**
 * @vitest-environment jsdom
 *
 * The SWIFT Value Date Reader end to end: template, mount, interact, assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person meets the page. The
 * widget is mounted from its template and mount directly: its registration is the next slice.
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
  READ_PRESETS,
  WRITE_PRESETS,
  type SwiftValueDateReaderArgs,
} from "./swift-value-date-reader";
import {
  mountSwiftValueDateReader,
  renderSwiftValueDateReaderTemplate,
} from "./swift-value-date-reader-mount";

installJsdomShims();

const entry: LoadedWidget<SwiftValueDateReaderArgs> = {
  renderTemplate: renderSwiftValueDateReaderTemplate,
  mount: mountSwiftValueDateReader,
};

let live: RenderedWidget | null = null;

const open = async (
  args: SwiftValueDateReaderArgs = {},
): Promise<RenderedWidget> => {
  live?.destroy();
  live = await renderWidget(entry as LoadedWidget<never>, { args });
  return live;
};

afterEach(() => {
  live?.destroy();
  live = null;
});

const readPreset = () => screen.getByRole("combobox", { name: "Preset" });
const writePreset = () => screen.getByRole("combobox", { name: "Date preset" });
const valueBox = () =>
  screen.getByRole("textbox", { name: "Value date (YYMMDD)" });
const dateBox = () => screen.getByRole("textbox", { name: "ISO date" });
const useRead = () =>
  screen.getByRole("button", { name: "Use the date read above" });
// A hold keeps hidden twins of every text it can say; only the live one is perceived.
const shown = (text: string | RegExp) =>
  screen.queryAllByText(text, {
    ignore: "[aria-hidden='true'], [aria-hidden='true'] *, script, style",
  });
const many = (text: string | RegExp) => shown(text).length;

async function paste(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") {
    await w.user.click(box);
    await w.user.paste(value);
  }
}

describe("opening", () => {
  it("opens on 990615, read as 1999", async () => {
    await open();
    expect(readPreset()).toHaveValue("nineteen");
    expect(valueBox()).toHaveValue("990615");
    expect(many("1999-06-15")).toBeGreaterThan(0);
    expect(dateBox()).toHaveValue("2024-06-15");
    expect(writePreset()).toHaveValue("round-trip");
    expect(useRead()).toBeEnabled();
  });

  it("opens on seeded values", async () => {
    await open({ value: "750101", writePreset: "after-last" });
    expect(readPreset()).toHaveValue("past-limit");
    expect(dateBox()).toHaveValue("2061-01-01");
  });

  it("opens cleared on a blank seed", async () => {
    await open({ value: "" });
    expect(valueBox()).toHaveValue("");
    expect(many("nothing typed")).toBeGreaterThan(0);
  });

  it.each(READ_PRESETS.map((p) => p.id))(
    "has no accessibility violations on %s",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(readPreset(), id);
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

describe("reading a value date", () => {
  it("reads a 20YY date and moves the marked band", async () => {
    const w = await open();
    await w.user.selectOptions(readPreset(), "twenty");
    expect(many("2024-06-15")).toBeGreaterThan(0);
    const rows = screen.getAllByRole("row");
    const marked = rows.filter(
      (r) => r.getAttribute("aria-current") === "true",
    );
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent("2000–2060");
  });

  it("shows T50 for a refused six-character text, and the band that names it", async () => {
    const w = await open();
    await w.user.selectOptions(readPreset(), "past-limit");
    expect(many("⟨ NO SIGNAL ⟩")).toBeGreaterThan(0);
    expect(many("Error code T50")).toBe(1);
    expect(many(/falls in 61–79/)).toBeGreaterThan(0);
    expect(useRead()).toBeDisabled();
  });

  it("names the year the library gave for a refused 29 February", async () => {
    const w = await open();
    await w.user.selectOptions(readPreset(), "no-leap-1985");
    expect(many(/29 February does not exist in 1985/)).toBeGreaterThan(0);
  });

  it("shows no code and marks no band for a whole subfield", async () => {
    const w = await open();
    await w.user.selectOptions(readPreset(), "whole-subfield");
    expect(many(/six characters, YYMMDD/)).toBeGreaterThan(0);
    expect(many("Error code T50")).toBe(0);
    expect(
      screen
        .getAllByRole("row")
        .filter((r) => r.getAttribute("aria-current") === "true"),
    ).toHaveLength(0);
  });

  it("switches the preset to Your values on typing", async () => {
    const w = await open();
    await paste(w, valueBox(), "240631");
    expect(readPreset()).toHaveValue("custom");
    expect(many(/Day 31 does not exist in month 06 of 2024/)).toBeGreaterThan(
      0,
    );
  });

  it("treats an empty box as empty, not as NO SIGNAL", async () => {
    const w = await open();
    await paste(w, valueBox(), "");
    expect(many("nothing typed")).toBeGreaterThan(0);
    expect(many("⟨ NO SIGNAL ⟩")).toBe(0);
    expect(useRead()).toBeDisabled();
  });
});

describe("writing a value date", () => {
  it("writes and reads back a date in range", async () => {
    await open();
    expect(many("240615")).toBeGreaterThan(0);
    expect(many("Same date")).toBeGreaterThan(0);
  });

  it("refuses a year outside the range, with the range from the bands", async () => {
    const w = await open();
    await w.user.selectOptions(writePreset(), "before-first");
    expect(many("Refused")).toBeGreaterThan(0);
    expect(
      many("Outside 1980–2060, would read back as another year."),
    ).toBeGreaterThan(0);
  });

  it("sends a date-time back to the date", async () => {
    const w = await open();
    await w.user.selectOptions(writePreset(), "date-time");
    expect(many(/take the date first/)).toBeGreaterThan(0);
  });

  it("copies the date read above into the box", async () => {
    const w = await open();
    await w.user.selectOptions(readPreset(), "last-day");
    await w.user.click(useRead());
    expect(dateBox()).toHaveValue("2060-12-31");
    expect(writePreset()).toHaveValue("last-year");
    expect(many("601231")).toBeGreaterThan(0);
  });
});

describe("the call frames", () => {
  it("prints the calls actually made", async () => {
    await open();
    const [readFrame, writeFrame] = screen.getAllByRole("group", {
      name: "Calls made",
    });
    expect(readFrame).toHaveTextContent('parseSwiftDate("990615")');
    expect(readFrame).toHaveTextContent('isValidSwiftDate("990615")');
    expect(writeFrame).toHaveTextContent('formatSwiftDate("2024-06-15")');
  });
});

describe("teardown", () => {
  it("is inert when aborted before the mount, and destroy twice is safe", async () => {
    live = await renderWidget(entry as LoadedWidget<never>, {
      args: {},
      aborted: true,
    });
    live.destroy();
    live.destroy();
  });
});
