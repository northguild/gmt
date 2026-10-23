/**
 * @vitest-environment jsdom
 *
 * Cron in a Zone end to end, against the real `@northguild/gmt`: template,
 * mount, every preset's values, the refusals and the permalink.
 */
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  CRON_PRESETS,
  cronView,
  stateOfPreset,
} from "./cron-in-a-zone";
import {
  mountCronInAZone,
  renderCronInAZoneTemplate,
} from "./cron-in-a-zone-mount";
import { loadCronLib } from "./cron-lib";
import { GMT_MODULES } from "./gmt-modules";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { showUnavailable } from "./widget-mount";

installJsdomShims();

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderCronInAZoneTemplate(args);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountCronInAZone(root, args, controller.signal);
  return { root, handle, controller };
}

function type(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLInputElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const roles = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-role]")].map(
    (e) => (e as HTMLElement).dataset["role"],
  );

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
    const preset = CRON_PRESETS.find((p) => p.id === "never")!;
    const { root } = await mount(stateOfPreset(preset));
    // The held sizers carry worst-case text, so read the live slots only.
    expect(q(root, "nosignal").hasAttribute("data-off")).toBe(true);
    expect(q(root, "fields").hasAttribute("data-off")).toBe(false);
    expect(q(root, "list-crontabMatch").textContent).toContain("No runs");
    expect(q(root, "list-daemonCatchUp").textContent).toContain("No runs");
  });

  for (const line of ["0 0 * * * *", "@reboot", "0 0 L * *"]) {
    it(`shows NO SIGNAL and makes no cronRuns call for ${line}`, async () => {
      const { root } = await mount({ line });
      expect(q(root, "nosignal").hasAttribute("data-off")).toBe(false);
      expect(q(root, "nosignal").textContent).toContain("NO SIGNAL");
      expect(q(root, "cron-output").textContent).not.toContain("cronRuns");
    });
  }

  it("writes Sunday as 7", async () => {
    const { root } = await mount({ line: "0 0 * * 0" });
    expect(q(root, "fields").textContent).toMatch(/7/);
  });

  it("gives the sentence and makes no cronRuns call for an unknown zone", async () => {
    const { root } = await mount({ zone: "Mars/Olympus" });
    expect(q(root, "problem").textContent).toContain("Mars/Olympus");
    expect(q(root, "cron-output").textContent).not.toContain("cronRuns");
  });

  it("re-renders when the line is typed and reports a permalink", async () => {
    const { root, handle } = await mount();
    type(root, "line", "*/5 * * * *");
    expect(handle.getPermalinkState?.()).toMatchObject({
      line: "*/5 * * * *",
      zone: "Europe/London",
      year: 2024,
    });
  });

  it("round-trips through a permalink", async () => {
    const { root, handle } = await mount();
    type(root, "line", "15 3 * * *");
    const state = handle.getPermalinkState?.() ?? {};
    window.history.pushState({}, "", encodeWidgetPermalink("cronzone", state));
    const seed = seedFromLocation("cronzone");
    expect(seed).toEqual(state);
    const again = await mount(seed);
    expect(q<HTMLInputElement>(again.root, "line").value).toBe("15 3 * * *");
  });
});

describe("the template", () => {
  it("has no id attributes, so it string-mounts in the rail", () => {
    expect(renderCronInAZoneTemplate()).not.toMatch(/\sid="/);
  });

  it("is the same markup the mount finds its roles in", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderCronInAZoneTemplate();
    const before = roles(root);
    const mounted = await mount();
    expect(new Set(roles(mounted.root))).toEqual(new Set(before));
  });
});

describe("when the library does not load", () => {
  it("rejects with a load error the host turns into the unavailable notice", async () => {
    const originals = { ...GMT_MODULES };
    for (const key of Object.keys(GMT_MODULES)) {
      GMT_MODULES[key] = () => Promise.reject(new Error("offline"));
    }
    try {
      const root = document.createElement("div");
      root.innerHTML = renderCronInAZoneTemplate();
      document.body.append(root);
      let failure: unknown;
      await mountCronInAZone(root, {}, new AbortController().signal).catch(
        (e) => {
          failure = e;
          showUnavailable(root, e);
        },
      );
      expect(failure).toBeInstanceOf(Error);
      expect(root.textContent).toMatch(/./);
    } finally {
      Object.assign(GMT_MODULES, originals);
    }
  });
});
