/**
 * @vitest-environment jsdom
 *
 * The Cut-off Countdown widget end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`. Every preset's printed calls
 * and outputs are appendix Z rows.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { COUNTDOWN_PRESETS } from "./cutoff-countdown";
import {
  mountCutoffCountdown,
  renderCutoffCountdownTemplate,
} from "./cutoff-countdown-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "cutoff",
  "time-zone",
  "now",
  "use-clock",
  "snap",
  "now-mode",
  "verdict",
  "countdown-axis",
  "now-slider",
  "now-value",
  "rule",
  "countdown-summary",
  "reason-aside",
  "call-countdown-past",
  "countdown-output-past",
  "call-countdown-left",
  "countdown-output-left",
];

const EXPECTED: Record<string, [boolean | null, string]> = {
  late: [true, "-PT20M"],
  "on-time": [false, "PT50M"],
  "at-cutoff": [true, "PT0S"],
  "other-clock": [true, "PT0S"],
  "repeated-hour": [true, "-PT1H"],
  "zoneless-now": [null, ""],
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderCutoffCountdownTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountCutoffCountdown(root, args, controller.signal);
  return { root, handle, controller };
}

function choosePreset(root: HTMLElement, id: string) {
  const preset = q<HTMLSelectElement>(root, "preset");
  preset.value = id;
  preset.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderCutoffCountdownTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCutoffCountdownTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("uses a real range input for the now slider", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCutoffCountdownTemplate();
    expect(q(root, "now-slider").tagName).toBe("INPUT");
    expect(q<HTMLInputElement>(root, "now-slider").type).toBe("range");
  });

  it("with no now, contains no date read from the clock", () => {
    const html = renderCutoffCountdownTemplate({
      cutoff: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]",
      timeZone: "Europe/Amsterdam",
    });
    // The only dates present are the ones the caller supplied.
    expect(html.match(/\d{4}-\d{2}-\d{2}/g)).toEqual(["2024-06-12"]);
  });
});

describe("mountCutoffCountdown", () => {
  it.each(COUNTDOWN_PRESETS.map((p) => [p.id]))(
    "prints the documented calls and outputs for %s",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const [past, left] = EXPECTED[id]!;
      if (past === null) {
        expect(q(root, "countdown-output-past").textContent).toBe("NO SIGNAL");
        expect(q(root, "countdown-output-left").textContent).toBe("NO SIGNAL");
      } else {
        expect(q(root, "countdown-output-past").textContent).toBe(String(past));
        expect(q(root, "countdown-output-left").textContent).toBe(left);
      }
    },
  );

  it("shows the rule box's local time and the verdict for the pill preset", async () => {
    const { root } = await mount();
    choosePreset(root, "late");
    expect(q(root, "verdict").textContent).toContain("Late by 20 min");
    expect(q(root, "rule").textContent).toContain("17:00");
  });

  it("the axis is not a tab stop, and draws hourly ticks for a same-day window", async () => {
    const { root } = await mount();
    choosePreset(root, "late");
    expect(q(root, "countdown-axis").getAttribute("tabindex")).toBe("-1");
    const ticks = [
      ...q(root, "countdown-axis").querySelectorAll(".gmt-cutoff-axis-tick"),
    ];
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.some((t) => /^\d{2}:00$/.test(t.textContent ?? ""))).toBe(
      true,
    );
  });

  it("draws day ticks once the window spans several days (C8)", async () => {
    const seed = {
      cutoff: "2024-06-09T16:00:00+08:00[Asia/Shanghai]",
      now: "2024-06-12T04:00:00+08:00[Asia/Shanghai]",
      timeZone: "Asia/Shanghai",
    };
    const { root } = await mount(seed);
    const ticks = [
      ...q(root, "countdown-axis").querySelectorAll(".gmt-cutoff-axis-tick"),
    ];
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.some((t) => /[A-Za-z]{3}$/.test(t.textContent ?? ""))).toBe(
      true,
    );
  });

  it("renders the chat seed (the pill args) as C1: Late by 20 min", async () => {
    const seed = {
      cutoff: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]",
      now: "2024-06-12T17:20:00+02:00",
      timeZone: "Europe/Amsterdam",
    };
    const { root } = await mount(seed);
    expect(q(root, "countdown-output-past").textContent).toBe("true");
    expect(q(root, "countdown-output-left").textContent).toBe("-PT20M");
    expect(q(root, "verdict").textContent).toContain("Late by 20 min");
  });

  it("setting the slider on 'late' to -1 gives C3b, to 0 gives C3; 'Now = the cut-off' gives C3", async () => {
    const { root } = await mount();
    choosePreset(root, "late");
    const slider = q<HTMLInputElement>(root, "now-slider");
    slider.value = "-1";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(q(root, "verdict").textContent).toContain("On time: 1 min left");

    slider.value = "0";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(q(root, "countdown-output-left").textContent).toBe("PT0S");
    expect(q(root, "verdict").textContent).toContain("Closed");

    choosePreset(root, "late");
    const snap = q<HTMLButtonElement>(root, "snap");
    snap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(q(root, "countdown-output-left").textContent).toBe("PT0S");
    expect(q(root, "verdict").textContent).toContain("Closed");
  });

  it("live mode: fake timers, tick, drag stops it, abort clears the interval", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    // oxlint-disable-next-line @northguild/gmt-oxlint/no-new-date
    vi.setSystemTime(new Date("2024-06-12T15:20:00Z")); // date-ban: vi.setSystemTime's own API takes a Date
    try {
      const args = {
        cutoff: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]",
        timeZone: "Europe/Amsterdam",
      };
      const { root, controller } = await mount(args);
      expect(q(root, "countdown-output-left").textContent).toBe("-PT20M");
      expect(q(root, "now-mode").textContent).toContain("live");

      vi.advanceTimersByTime(60_000);
      expect(q(root, "countdown-output-left").textContent).toBe("-PT21M");

      const slider = q<HTMLInputElement>(root, "now-slider");
      slider.value = String(Number.parseInt(slider.value, 10) - 1);
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      expect(q(root, "now-mode").textContent).toContain("pinned");
      const before = q(root, "countdown-output-left").textContent;
      vi.advanceTimersByTime(5000);
      expect(q(root, "countdown-output-left").textContent).toBe(before);

      controller.abort();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("round-trips every preset's state as a permalink of strings", async () => {
    for (const preset of COUNTDOWN_PRESETS) {
      const { root, handle } = await mount();
      choosePreset(root, preset.id);
      const state = handle.getPermalinkState?.() as Record<string, string>;
      expect(state).not.toBeNull();
      for (const value of Object.values(state))
        expect(typeof value).toBe("string");
      const url = encodeWidgetPermalink("cutoffcountdown", state);
      const seeded = seedFromLocation(
        "cutoffcountdown",
        url.slice(url.indexOf("?")),
      );
      const again = await mount(seeded);
      expect(q(again.root, "countdown-output-left").textContent).toBe(
        q(root, "countdown-output-left").textContent,
      );
      document.body.innerHTML = "";
    }
  });

  it("is inert when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderCutoffCountdownTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountCutoffCountdown(root, {}, controller.signal);
    expect(handle.getPermalinkState?.()).toBeNull();
  });

  it("can be destroyed twice", async () => {
    const { handle } = await mount();
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });
});
