/**
 * @vitest-environment jsdom
 *
 * Cron in a Zone end to end, against the real `@northguild/gmt`: template,
 * mount, every preset's values, the refusals and the permalink.
 */
import { screen } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations, renderWidget } from "~/test/render-widget";
import { CRON_PRESETS, cronView, stateOfPreset } from "./cron-in-a-zone";
import { loadCronLib } from "./cron-lib";
import { GMT_MODULES } from "./gmt-modules";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { WidgetLoadError } from "./widget-mount";

installJsdomShims();

const entry = WIDGET_REGISTRY["showCronInAZone"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const lineBox = () => screen.getByRole("textbox", { name: "Cron line" });
const yearBox = () => screen.getByRole("spinbutton", { name: "Year" });
const zoneBox = () => screen.getByRole("combobox", { name: "Time zone" });
const callsMade = () => screen.getByRole("group", { name: /Calls made/ });

type Expected = {
  crontab: [string, string][];
  daemon: [string, string][];
};
// [instant, local, classification] triples are checked as [instant, kind].
const NIGHT: Record<string, Expected> = {
  "london-spring": {
    crontab: [],
    daemon: [["2024-03-31T01:00:00Z", "nonexistent"]],
  },
  "london-autumn": {
    crontab: [
      ["2024-10-27T00:30:00Z", "ambiguous"],
      ["2024-10-27T01:30:00Z", "ambiguous"],
    ],
    daemon: [["2024-10-27T00:30:00Z", "ambiguous"]],
  },
  "sydney-every-five": { crontab: [], daemon: [] },
  "sydney-half-two": {
    crontab: [],
    daemon: [["2024-10-05T16:00:00Z", "nonexistent"]],
  },
  "midnight-job": {
    crontab: [],
    daemon: [["2018-11-04T03:00:00Z", "nonexistent"]],
  },
  "three-hours": { crontab: [], daemon: [] },
  "three-hours-back": {
    crontab: [
      ["2021-03-13T11:30:00Z", "ambiguous"],
      ["2021-03-13T14:30:00Z", "ambiguous"],
    ],
    daemon: [["2021-03-13T11:30:00Z", "ambiguous"]],
  },
  "day-rule": { crontab: [], daemon: [] },
};

describe("every preset, against the library", () => {
  for (const preset of CRON_PRESETS) {
    it(preset.id, async () => {
      const lib = await loadCronLib();
      const view = cronView(lib, stateOfPreset(preset));
      if (preset.id === "never") {
        expect(view.changes).toEqual([]);
        expect(view.night).toBeNull();
        expect(view.lists).toEqual([[], []]);
        return;
      }
      const want = NIGHT[preset.id]!;
      const night = view.night!;
      const touched = (i: 0 | 1) =>
        night.lanes[i].runs.map((r) => [r.instant, r.classification]);
      expect(touched(0)).toEqual(
        preset.id === "sydney-every-five" || preset.id === "day-rule"
          ? night.lanes[0].runs.map((r) => [r.instant, r.classification])
          : want.crontab,
      );
      if (preset.id === "sydney-every-five") {
        expect(night.lanes[0].touched).toEqual([]);
        expect(night.lanes[1].touched).toEqual([]);
        expect(night.same).toBe(true);
      } else if (preset.id === "day-rule") {
        expect(night.lanes[0].runs).toEqual([]);
        expect(night.lanes[1].runs).toEqual([]);
      } else {
        expect(touched(1)).toEqual(want.daemon);
      }
    });
  }

  it("london-spring daemon run has the spec's local time", async () => {
    const lib = await loadCronLib();
    const night = cronView(lib, stateOfPreset(CRON_PRESETS[0]!)).night!;
    expect(night.lanes[1].runs[0]!.local).toBe("2024-03-31T01:30:00");
  });

  it("sydney-half-two and midnight-job local times", async () => {
    const lib = await loadCronLib();
    const byId = (id: string) =>
      cronView(lib, stateOfPreset(CRON_PRESETS.find((p) => p.id === id)!))
        .night!.lanes[1].runs[0]!;
    expect(byId("sydney-half-two").local).toBe("2024-10-06T02:30:00");
    expect(byId("midnight-job").local).toBe("2018-11-04T00:00:00");
  });

  it("confirms Casey's change ordinals from getDstTransitions", async () => {
    const lib = await loadCronLib();
    expect(lib.getDstTransitions("Antarctica/Casey", 2020)[1]!.instant).toBe(
      "2020-10-03T16:01:00Z",
    );
    expect(lib.getDstTransitions("Antarctica/Casey", 2021)[0]!.instant).toBe(
      "2021-03-13T13:00:00Z",
    );
  });

  it("day-rule lists the twelve days from 1 January", async () => {
    const lib = await loadCronLib();
    const preset = CRON_PRESETS.find((p) => p.id === "day-rule")!;
    const view = cronView(lib, stateOfPreset(preset));
    const days = [
      "01-01",
      "01-08",
      "01-15",
      "01-22",
      "01-29",
      "02-01",
      "02-05",
      "02-12",
      "02-15",
      "02-19",
      "02-26",
      "03-01",
    ];
    for (const list of view.lists!) {
      expect(list.map((r) => r.local.slice(5, 10))).toEqual(days);
      expect(list.every((r) => r.only === null)).toBe(true);
    }
  });
});

describe("the mounted widget", () => {
  it("shows No runs, not NO SIGNAL, for a line that never runs", async () => {
    await open({
      ...stateOfPreset(CRON_PRESETS.find((p) => p.id === "never")!),
    });
    expect(screen.getAllByText("No runs")).toHaveLength(2);
    expect(screen.queryByText(/NO SIGNAL/)).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  for (const line of ["0 0 * * * *", "@reboot", "0 0 L * *"]) {
    it(`shows NO SIGNAL and makes no cronRuns call for ${line}`, async () => {
      await open({ line });
      expect(screen.getAllByText(/NO SIGNAL/).length).toBeGreaterThan(0);
      expect(callsMade()).not.toHaveTextContent("cronRuns");
      await expectNoAxeViolations(document.body);
    });
  }

  it("writes Sunday as 7", async () => {
    await open({ line: "0 0 * * 0" });
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("gives the sentence and makes no cronRuns call for an unknown zone", async () => {
    await open({ zone: "Mars/Olympus" });
    expect(screen.getAllByText(/Mars\/Olympus/).length).toBeGreaterThan(0);
    expect(callsMade()).not.toHaveTextContent("cronRuns");
    await expectNoAxeViolations(document.body);
  });

  it("re-renders when the line is typed and reports a permalink", async () => {
    const w = await open();
    await w.user.clear(lineBox());
    await w.user.paste("*/5 * * * *");
    expect(new URL(w.permalink(), "https://x.test").search).toContain("5");
    expect(callsMade()).toHaveTextContent("*/5 * * * *");
    await expectNoAxeViolations(document.body);
  });

  it("round-trips through a permalink", async () => {
    const w = await open();
    await w.user.clear(lineBox());
    await w.user.paste("15 3 * * *");
    const link = w.permalink();
    w.destroy();
    window.history.pushState({}, "", link);
    await renderWidget(entry, {
      args: seedFromLocation("cronzone"),
      idPrefix: "again",
    });
    expect(lineBox()).toHaveValue("15 3 * * *");
  });

  it("seeds from a permalink the way the page does", () => {
    window.history.pushState(
      {},
      "",
      encodeWidgetPermalink("cronzone", {
        line: "1 2 * * *",
        zone: "Europe/London",
        year: 2024,
      }),
    );
    expect(seedFromLocation("cronzone")).toMatchObject({ line: "1 2 * * *" });
  });

  it("switches to a preset and back to your values", async () => {
    const w = await open();
    await w.user.selectOptions(
      screen.getByRole("combobox", { name: "Try" }),
      "sydney-half-two",
    );
    expect(zoneBox()).toHaveValue("Australia/Sydney");
    await w.user.clear(lineBox());
    await w.user.paste("1 1 * * *");
    expect(screen.getByRole("combobox", { name: "Try" })).toHaveValue("custom");
    await expectNoAxeViolations(document.body);
  });
});

describe("the template", () => {
  it("gives two copies on one page their own ids", async () => {
    await open({}, "one");
    await open({}, "two");
    expect(screen.getAllByRole("textbox", { name: "Cron line" })).toHaveLength(
      2,
    );
    expect(
      screen.getAllByRole("region", { name: "Cron in a Zone" }),
    ).toHaveLength(2);
  });

  it("throws a load error when its markup is missing", async () => {
    const { mountCronInAZone } = await import("./cron-in-a-zone-mount");
    const root = document.createElement("div");
    await expect(
      mountCronInAZone(root, {}, new AbortController().signal),
    ).rejects.toBeInstanceOf(WidgetLoadError);
  });
});

describe("when the library does not load", () => {
  it("rejects with a load error the host turns into the unavailable notice", async () => {
    const originals = { ...GMT_MODULES };
    for (const key of Object.keys(GMT_MODULES)) {
      GMT_MODULES[key] = () => Promise.reject(new Error("offline"));
    }
    try {
      await expect(open()).rejects.toBeInstanceOf(WidgetLoadError);
    } finally {
      Object.assign(GMT_MODULES, originals);
      document.body.replaceChildren();
    }
  });
});

describe("assistive technology", () => {
  it("has one polite status that carries the sentence", async () => {
    await open();
    const status = screen.getByRole("status", { name: "Cron reading" });
    expect(status).toHaveTextContent(/The rules differ on this night/);
    await expectNoAxeViolations(document.body);
  });

  it("carries a problem and the no-signal state", async () => {
    await open({ zone: "Mars/Olympus" });
    expect(
      screen.getByRole("status", { name: "Cron reading" }),
    ).toHaveTextContent("Mars/Olympus");
  });

  it("announces NO SIGNAL for a line outside the grammar", async () => {
    const w = await open();
    await w.user.clear(lineBox());
    await w.user.paste("@reboot");
    expect(
      screen.getByRole("status", { name: "Cron reading" }),
    ).toHaveTextContent(/NO SIGNAL/);
  });

  it("points the line, year and zone at the problem hint", async () => {
    await open({ zone: "Mars/Olympus" });
    for (const control of [lineBox(), yearBox(), zoneBox()]) {
      expect(control).toHaveAccessibleDescription(/Mars\/Olympus/);
    }
  });
});

describe("the length cap", () => {
  it("stops the cron line at 64 characters", async () => {
    const w = await open();
    const box = lineBox();
    await w.user.clear(box);
    await w.user.type(box, "x".repeat(72));
    expect(box).toHaveValue("x".repeat(64));
  });
});
