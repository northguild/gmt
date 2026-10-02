/**
 * @vitest-environment jsdom
 *
 * The Cut-off Countdown widget end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`. Every preset's printed calls
 * and outputs are appendix Z rows.
 */
/// <reference types="vitest/globals" />
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
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

const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

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

describe("the countdown's hero and axis", () => {
  const hero = (root: HTMLElement) =>
    q(root, "countdown-axis").querySelector(".gmt-cutoff-countdown-hero-value")
      ?.textContent;

  it.each([
    ["late", "\u221220 min"],
    ["on-time", "+50 min"],
    ["at-cutoff", "0 min"],
  ])("shows the signed time to the cut-off on %s", async (id, text) => {
    const { root } = await mount();
    choosePreset(root, id);
    expect(hero(root)).toBe(text);
  });

  it("draws no hero when the now has no offset (zoneless-now)", async () => {
    const { root } = await mount();
    choosePreset(root, "zoneless-now");
    expect(
      q(root, "countdown-axis").querySelector("[data-role=countdown-hero]"),
    ).toBeNull();
    expect(hero(root)).toBeUndefined();
  });

  it("names the gate and now chips with their local times", async () => {
    const { root } = await mount();
    choosePreset(root, "late");
    const chips = [
      ...q(root, "countdown-axis").querySelectorAll(".gmt-cutoff-chip"),
    ].map((c) => c.textContent);
    expect(chips).toContain("cut-off 17:00");
    expect(chips).toContain("now 17:20");
  });

  it("holds no focusable descendant", async () => {
    const { root } = await mount();
    for (const id of ["late", "on-time", "zoneless-now"]) {
      choosePreset(root, id);
      expect(
        q(root, "countdown-axis").querySelectorAll(FOCUSABLE),
      ).toHaveLength(0);
    }
  });
});

describe("a seed applied to the default template (the tool page)", () => {
  it("keeps a zone outside the curated list and reads it", async () => {
    const { root } = await mount(
      {
        cutoff: "2024-06-09T16:00:00+03:00[Europe/Helsinki]",
        now: "2024-06-09T15:00:00+03:00[Europe/Helsinki]",
        timeZone: "Europe/Helsinki",
      },
      {},
    );
    expect(q<HTMLSelectElement>(root, "time-zone").value).toBe(
      "Europe/Helsinki",
    );
    expect(q(root, "countdown-output-left").textContent).not.toBe("NO SIGNAL");
  });
});

describe("the slider's chip and spoken value", () => {
  const type = (root: HTMLElement, role: string, value: string) => {
    const input = q<HTMLInputElement>(root, role);
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const slider = (root: HTMLElement) => q<HTMLInputElement>(root, "now-slider");
  const heroValue = (root: HTMLElement) =>
    q(root, "countdown-axis").querySelector(".gmt-cutoff-countdown-hero-value")!
      .textContent;

  it("is blank, not the last reading, once the cut-off is garbage", async () => {
    const { root } = await mount();
    choosePreset(root, "late");
    expect(q(root, "now-value").textContent).toBe("17:20 · −20 min");
    type(root, "cutoff", "garbage");
    expect(q(root, "now-value").textContent).toBe("");
    expect(slider(root).getAttribute("aria-valuetext")).toBe("");
  });

  it("agrees with the hero on sign and precision 20 seconds before the cut-off", async () => {
    const { root } = await mount();
    choosePreset(root, "late");
    type(root, "cutoff", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]");
    type(root, "now", "2024-06-12T16:59:40+02:00[Europe/Amsterdam]");
    expect(q(root, "verdict").textContent).toContain("On time: 20 s left");
    expect(heroValue(root)).toBe("+20 s");
    expect(q(root, "now-value").textContent).toBe("16:59:40 · +20 s");
    expect(slider(root).getAttribute("aria-valuetext")).toBe(
      "16:59:40, 20 s before the cut-off",
    );
  });

  it("uses the hero's sign when late", async () => {
    const { root } = await mount();
    choosePreset(root, "late");
    expect(heroValue(root)).toBe("−20 min");
    expect(q(root, "now-value").textContent).toBe("17:20 · −20 min");
    expect(slider(root).getAttribute("aria-valuetext")).toBe(
      "17:20, 20 min after the cut-off",
    );
  });
});

describe("the verdict's announcement", () => {
  it("is not a live region itself; a status region carries it", async () => {
    const { root } = await mount();
    expect(q(root, "verdict").hasAttribute("aria-live")).toBe(false);
    expect(q(root, "verdict-status").getAttribute("role")).toBe("status");
  });

  it("is written once when the reader settles, not per slider step or live tick", async () => {
    vi.useFakeTimers();
    // oxlint-disable-next-line @northguild/gmt-oxlint/no-new-date
    vi.setSystemTime(new Date("2024-06-12T15:20:00Z")); // date-ban: vi.setSystemTime's own API takes a Date
    try {
      const { root } = await mount({
        cutoff: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]",
        timeZone: "Europe/Amsterdam",
      });
      const status = q(root, "verdict-status");
      const writes: string[] = [];
      new MutationObserver(() => writes.push(status.textContent ?? "")).observe(
        status,
        { childList: true, characterData: true, subtree: true },
      );
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
      expect(writes).toEqual([]);

      const slider = q<HTMLInputElement>(root, "now-slider");
      for (const step of [-3, -4, -5]) {
        slider.value = String(Number.parseInt(slider.value, 10) + step);
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        vi.advanceTimersByTime(100);
      }
      await Promise.resolve();
      expect(writes).toEqual([]);
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(writes).toHaveLength(1);
      expect(status.textContent).toBe(q(root, "verdict").textContent);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("releasing observers", () => {
  it("destroy disconnects every ResizeObserver the mount created", async () => {
    const spy = spyOnResizeObservers();
    try {
      const { handle } = await mount();
      expect(spy.live.size).toBeGreaterThan(0);
      handle.destroy();
      expect(spy.live.size).toBe(0);
    } finally {
      spy.restore();
    }
  });
});
