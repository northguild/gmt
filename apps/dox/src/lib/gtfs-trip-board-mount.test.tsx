/**
 * @vitest-environment jsdom
 *
 * The GTFS Trip Board end to end: template, mount, interact, assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person meets the page.
 */
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
  NOT_READ,
  PRESETS,
  type GtfsTripBoardArgs,
} from "./gtfs-trip-board";
import {
  mountGtfsTripBoard,
  renderGtfsTripBoardTemplate,
} from "./gtfs-trip-board-mount";
import { WidgetLoadError } from "./widget-mount";

const gtfsSpy = vi.hoisted(() => vi.fn());
const failLoad = vi.hoisted(() => ({ on: false }));

// The real library, with `gtfsToInstant` watched so "no call" can be asserted, and a switch that
// makes the loader fail so the "could not load" path can be asserted.
vi.mock("./rail-lib", async (importOriginal) => {
  const real = await importOriginal<typeof import("./rail-lib")>();
  return {
    ...real,
    loadTripBoardLib: async () => {
      if (failLoad.on) throw new Error("rail/convert failed to import");
      const lib = await real.loadTripBoardLib();
      return {
        ...lib,
        gtfsToInstant: (...a: Parameters<typeof lib.gtfsToInstant>) => {
          gtfsSpy(...a);
          return lib.gtfsToInstant(...a);
        },
      };
    },
  };
});

installJsdomShims();

const entry: LoadedWidget<GtfsTripBoardArgs> = {
  renderTemplate: renderGtfsTripBoardTemplate,
  mount: mountGtfsTripBoard,
};

let live: RenderedWidget | null = null;

const open = async (args: GtfsTripBoardArgs = {}): Promise<RenderedWidget> => {
  live?.destroy();
  live = await renderWidget(entry as LoadedWidget<never>, { args });
  return live;
};

afterEach(() => {
  live?.destroy();
  live = null;
  failLoad.on = false;
  gtfsSpy.mockClear();
});

const rowsBox = () =>
  screen.getByRole("textbox", {
    name: "Trip rows (stop_times.txt, with stop_timezone from stops.txt)",
  });
const dateBox = () =>
  screen.getByRole("textbox", { name: "Service date (calendar.txt)" });
const zoneBox = () =>
  screen.getByRole("textbox", { name: "Zone (agency.txt, agency_timezone)" });
const presetBox = () => screen.getByRole("combobox", { name: "Preset" });
const callsFor = () => screen.getByRole("combobox", { name: "Calls for" });

const IGNORE = "[aria-hidden='true'], [aria-hidden='true'] *, script, style";
// A hold keeps hidden twins of every text it can say; only the live one is perceived.
const many = (text: string | RegExp) =>
  screen.queryAllByText(text, { ignore: IGNORE }).length;
// What a person reads, with `zonedValue`'s pieces joined back into the string the library gave.
const perceived = (): string =>
  screen
    .queryAllByText(/\S/, { ignore: IGNORE })
    .map((el) => el.textContent)
    .join("");
const shows = (text: string) => perceived().includes(text);

async function paste(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") {
    await w.user.click(box);
    await w.user.paste(value);
  }
}

const preset = (id: string) => PRESETS.find((p) => p.id === id)!;

describe("opening", () => {
  it("opens on the border preset with every stop read", async () => {
    await open();
    expect(rowsBox()).toHaveValue(preset("border").rows);
    expect(dateBox()).toHaveValue("20260615");
    expect(zoneBox()).toHaveValue("Europe/Madrid");
    expect(presetBox()).toHaveValue("border");
    expect(screen.getAllByRole("row")).toHaveLength(7);
    expect(shows("6 h 15 min")).toBe(true);
    expect(shows("3 of 6 stops")).toBe(true);
    expect(shows("2026-06-15T10:52:00+01:00[Europe/Lisbon]")).toBe(true);
  });

  it("has no accessibility violations", async () => {
    const w = await open();
    await expectNoAxeViolations(w.root);
  });

  it("prints the calls for the first stop the wrong zone moves", async () => {
    await open();
    expect(callsFor()).toHaveValue("5");
    expect(perceived()).toContain(
      'gtfsToInstant("20260615", "11:52:00", "Europe/Madrid"); // "2026-06-15T09:52:00Z"',
    );
  });
});

describe("a seed", () => {
  it("opens on the named preset", async () => {
    await open({ preset: "no-noon" });
    expect(dateBox()).toHaveValue("20111230");
    expect(zoneBox()).toHaveValue("Pacific/Apia");
  });

  it("opens on typed values, as the page would", async () => {
    await open({
      stopTimes: preset("andes-june").rows,
      date: "20260615",
      zone: "America/Santiago",
    });
    expect(presetBox()).toHaveValue("andes-june");
  });
});

describe("the presets", () => {
  it.each([
    ["border", "6 h 15 min", "3 of 6 stops"],
    ["night-train", "11 h 7 min", "0 of 8 stops"],
    ["andes-june", "8 h 0 min", "3 of 5 stops"],
    ["andes-january", "8 h 0 min", "0 of 5 stops"],
  ])("%s shows the library's plates", async (id, trip, moved) => {
    const w = await open();
    await w.user.selectOptions(presetBox(), id);
    expect(rowsBox()).toHaveValue(preset(id).rows);
    expect(shows(trip)).toBe(true);
    expect(shows(moved)).toBe(true);
    expect(many(/NO SIGNAL/)).toBe(0);
    await expectNoAxeViolations(w.root);
  });

  it("no-noon reads NO SIGNAL with its reasons", async () => {
    const w = await open();
    await w.user.selectOptions(presetBox(), "no-noon");
    expect(many(/NO SIGNAL/)).toBeGreaterThan(0);
    expect(many(/Line 2, arrival_time:/)).toBeGreaterThan(0);
    await expectNoAxeViolations(w.root);
  });

  it("the night train shows the clock change inside a leg", async () => {
    const w = await open();
    await w.user.selectOptions(presetBox(), "night-train");
    expect(shows("clock change in leg at 2026-10-25T01:00:00Z")).toBe(true);
  });

  it("shows your values once a box differs from the preset", async () => {
    const w = await open();
    await paste(w, dateBox(), "20260616");
    expect(presetBox()).toHaveValue("custom");
  });
});

describe("typing", () => {
  it("re-reads the trip when the date changes", async () => {
    const w = await open();
    await paste(w, dateBox(), "20261025");
    expect(shows("2026-10-25T")).toBe(true);
    await expectNoAxeViolations(w.root);
  });

  it("names a row it cannot read and still reads the others", async () => {
    const w = await open();
    const text = preset("border").rows.replace(
      "caceres,10:32:00,10:35:00,",
      "caceres,10:32:00,10:35:00",
    );
    await paste(w, rowsBox(), text);
    expect(many(/Line 3 has 3 cells; the header has 4\./)).toBeGreaterThan(0);
    expect(many(NOT_READ)).toBeGreaterThan(0);
    expect(shows("2026-06-15T10:52:00+01:00[Europe/Lisbon]")).toBe(true);
  });

  it("reads a time that GTFS refuses as NO SIGNAL with its reason", async () => {
    const w = await open();
    await paste(w, zoneBox(), "Not/AZone");
    expect(many(/NO SIGNAL/)).toBeGreaterThan(0);
  });

  it("accepts an offset as the agency's zone", async () => {
    const w = await open();
    await paste(w, zoneBox(), "+05:30");
    expect(shows("2026-06-15T02:30:00Z")).toBe(true);
  });
});

describe("an empty box", () => {
  it.each([
    ["date", dateBox],
    ["zone", zoneBox],
    ["rows", rowsBox],
  ])("the %s box reads nothing typed and makes no call", async (_n, box) => {
    const w = await open();
    gtfsSpy.mockClear();
    await paste(w, box(), "");
    expect(many(NOTHING_TYPED)).toBeGreaterThan(0);
    expect(many(/NO SIGNAL/)).toBe(0);
    expect(gtfsSpy).not.toHaveBeenCalled();
  });
});

describe("calls for", () => {
  it("lists a stop for each row read and prints the chosen stop's calls", async () => {
    const w = await open();
    expect(
      within(callsFor())
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(["2", "3", "4", "5", "6", "7"]);
    await w.user.selectOptions(callsFor(), "2");
    expect(perceived()).toContain(
      'gtfsToInstant("20260615", "08:00:00", "Europe/Madrid"); // "2026-06-15T06:00:00Z"',
    );
  });

  it("keeps the chosen stop while the reader types", async () => {
    const w = await open();
    await w.user.selectOptions(callsFor(), "3");
    await paste(w, dateBox(), "20260616");
    expect(callsFor()).toHaveValue("3");
  });
});

describe("a library that cannot load", () => {
  it("throws a WidgetLoadError for the shell to show", async () => {
    failLoad.on = true;
    const abort = new AbortController();
    try {
      await expect(
        mountGtfsTripBoard(document.createElement("div"), {}, abort.signal),
      ).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      abort.abort();
    }
  });
});
