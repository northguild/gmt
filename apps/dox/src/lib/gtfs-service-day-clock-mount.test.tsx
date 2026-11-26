/**
 * @vitest-environment jsdom
 *
 * The GTFS Service Day Clock end to end: template, mount, interact, assert, against the real
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
  DIFFERENT_TITLE,
  GTFS_CARD_TITLE,
  MIDNIGHT_CARD_TITLE,
  NOTHING_TYPED,
  PRESETS,
  REASONS,
  SAME_TITLE,
  type GtfsServiceDayClockArgs,
} from "./gtfs-service-day-clock";
import {
  mountGtfsServiceDayClock,
  renderGtfsServiceDayClockTemplate,
} from "./gtfs-service-day-clock-mount";
import { WidgetLoadError } from "./widget-mount";

const gtfsSpy = vi.hoisted(() => vi.fn());
const failLoad = vi.hoisted(() => ({ on: false }));

// The real library, with `gtfsToInstant` watched so "no call" can be asserted, and a switch that
// makes the loader fail so the "could not load" path can be asserted.
vi.mock("./rail-lib", async (importOriginal) => {
  const real = await importOriginal<typeof import("./rail-lib")>();
  return {
    ...real,
    loadServiceDayLib: async () => {
      if (failLoad.on) throw new Error("rail/convert failed to import");
      const lib = await real.loadServiceDayLib();
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

const entry: LoadedWidget<GtfsServiceDayClockArgs> = {
  renderTemplate: renderGtfsServiceDayClockTemplate,
  mount: mountGtfsServiceDayClock,
};

let live: RenderedWidget | null = null;

const open = async (
  args: GtfsServiceDayClockArgs = {},
): Promise<RenderedWidget> => {
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

const dateBox = () =>
  screen.getByRole("textbox", { name: "Service date (calendar.txt)" });
const timeBox = () =>
  screen.getByRole("textbox", { name: "Stop time (stop_times.txt)" });
const zoneBox = () =>
  screen.getByRole("textbox", { name: "Zone (agency.txt, agency_timezone)" });
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

// What a person reads: every text the widget shows, without the hidden twins a hold keeps.
// Split pieces of a value (`zonedValue` breaks only at `<wbr>`) join back into the string the
// library gave.
const perceived = (): string =>
  screen
    .queryAllByText(/\S/, {
      ignore: "[aria-hidden='true'], [aria-hidden='true'] *, script, style",
    })
    .map((el) => el.textContent)
    .join("");
const shows = (text: string) => perceived().includes(text);
const calls = () => perceived();

describe("opening", () => {
  it("opens on the spring-forward preset with both anchors", async () => {
    await open();
    expect(dateBox()).toHaveValue("20260329");
    expect(timeBox()).toHaveValue("08:00:00");
    expect(zoneBox()).toHaveValue("Europe/Berlin");
    expect(
      screen.getByRole("group", { name: GTFS_CARD_TITLE }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: MIDNIGHT_CARD_TITLE }),
    ).toBeInTheDocument();
    expect(shows("2026-03-29T06:00:00Z")).toBe(true);
    expect(shows("2026-03-29T07:00:00Z")).toBe(true);
    expect(many(DIFFERENT_TITLE)).toBeGreaterThan(0);
    expect(many(/60 minutes later/)).toBeGreaterThan(0);
  });

  it("has no accessibility violations", async () => {
    const w = await open();
    await expectNoAxeViolations(w.root);
  });

  it("prints the calls it made", async () => {
    await open();
    expect(calls()).toContain(
      'gtfsToInstant("20260329", "08:00:00", "Europe/Berlin"); // "2026-03-29T06:00:00Z"',
    );
  });
});

describe("a seed", () => {
  it("opens on the named preset", async () => {
    await open({ preset: "no-noon" });
    expect(dateBox()).toHaveValue(
      PRESETS.find((p) => p.id === "no-noon")!.date,
    );
  });

  it("opens on three typed values, as the page would", async () => {
    await open({
      serviceDate: "20240331",
      time: "03:00:00",
      timeZone: "Europe/Berlin",
    });
    expect(dateBox()).toHaveValue("20240331");
    expect(timeBox()).toHaveValue("03:00:00");
    expect(zoneBox()).toHaveValue("Europe/Berlin");
  });

  it("opens cleared when the link was made from cleared boxes", async () => {
    await open({ serviceDate: "", time: "", timeZone: "" });
    expect(dateBox()).toHaveValue("");
    expect(timeBox()).toHaveValue("");
  });
});

describe("typing", () => {
  it("re-renders on a typed date and says the anchors agree on an ordinary day", async () => {
    const w = await open();
    await paste(w, dateBox(), "20260615");
    expect(shows("2026-06-15T06:00:00Z")).toBe(true);
    expect(many(SAME_TITLE)).toBeGreaterThan(0);
    expect(many(DIFFERENT_TITLE)).toBe(0);
    await expectNoAxeViolations(w.root);
  });

  it("reads past 24:00:00 as elapsed time", async () => {
    const w = await open();
    await paste(w, dateBox(), "20260328");
    await paste(w, timeBox(), "26:30:00");
    expect(shows("2026-03-29T01:30:00Z")).toBe(true);
  });

  it("accepts an offset as the zone", async () => {
    const w = await open();
    await paste(w, zoneBox(), "+05:30");
    expect(shows("2026-03-29T02:30:00Z")).toBe(true);
    expect(many(/NO SIGNAL/)).toBe(0);
  });

  it("shows a later midnight answer as earlier on fall back", async () => {
    const w = await open();
    await paste(w, dateBox(), "20261025");
    expect(many(/60 minutes earlier/)).toBeGreaterThan(0);
  });
});

describe("the presets", () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))(
    "%s shows the library's output",
    async (_id, p) => {
      const w = await open();
      const chip = screen.getByRole("combobox", { name: "Preset" });
      await w.user.selectOptions(chip, p.id);
      expect(dateBox()).toHaveValue(p.date);
      expect(timeBox()).toHaveValue(p.time);
      expect(zoneBox()).toHaveValue(p.zone);
      expect(calls()).toContain(
        `gtfsToInstant("${p.date}", "${p.time}", "${p.zone}");`,
      );
      if (p.id === "no-noon") {
        expect(many(/NO SIGNAL/)).toBeGreaterThan(0);
        expect(many(REASONS.nonexistent)).toBeGreaterThan(0);
      } else {
        expect(many(/NO SIGNAL/)).toBe(0);
      }
      await expectNoAxeViolations(w.root);
    },
  );

  it("shows your values once a box differs from the preset", async () => {
    const w = await open();
    await paste(w, timeBox(), "09:00:00");
    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveValue(
      "custom",
    );
  });
});

describe("a refusal", () => {
  it.each([
    ["20240230", "08:00:00", "Europe/Berlin", REASONS.date],
    ["20260329", "25:60:00", "Europe/Berlin", REASONS.time],
    ["20260329", "08:00:00", "Not/AZone", REASONS.zone],
  ])(
    "%s %s %s reads NO SIGNAL and its reason",
    async (date, time, zone, reason) => {
      const w = await open();
      await paste(w, dateBox(), date);
      await paste(w, timeBox(), time);
      await paste(w, zoneBox(), zone);
      expect(many(/NO SIGNAL/)).toBeGreaterThan(0);
      expect(many(reason)).toBeGreaterThan(0);
      await expectNoAxeViolations(w.root);
    },
  );

  it("names the skipped noon", async () => {
    const w = await open();
    await w.user.selectOptions(
      screen.getByRole("combobox", { name: "Preset" }),
      "no-noon",
    );
    expect(many(REASONS.nonexistent)).toBeGreaterThan(0);
    // The midnight card still answers for the day that never happened.
    expect(shows("2011-12-30T22:00:00Z")).toBe(true);
  });
});

describe("an empty box", () => {
  it.each([
    ["date", dateBox],
    ["time", timeBox],
    ["zone", zoneBox],
  ])("the %s box reads nothing typed and makes no call", async (_n, box) => {
    const w = await open();
    gtfsSpy.mockClear();
    await paste(w, box(), "");
    expect(many(NOTHING_TYPED)).toBeGreaterThan(0);
    expect(many(/NO SIGNAL/)).toBe(0);
    expect(gtfsSpy).not.toHaveBeenCalled();
    expect(calls()).not.toContain("gtfsToInstant(");
  });
});

describe("tool links", () => {
  it("links the time to the GTFS Time Reader", async () => {
    await open();
    const link = screen.getByRole("link", { name: /GTFS Time Reader/ });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("08%3A00%3A00"),
    );
  });

  it("disables the DST link on a zone with no clock change", async () => {
    const w = await open();
    await paste(w, zoneBox(), "+05:30");
    expect(screen.getByText(/DST Inspector/)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("a library that cannot load", () => {
  it("throws a WidgetLoadError for the shell to show", async () => {
    failLoad.on = true;
    const abort = new AbortController();
    try {
      await expect(
        mountGtfsServiceDayClock(
          document.createElement("div"),
          {},
          abort.signal,
        ),
      ).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      abort.abort();
    }
  });
});
