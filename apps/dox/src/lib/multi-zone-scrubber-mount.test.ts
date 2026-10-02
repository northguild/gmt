// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { describe, expect, it, vi } from "vitest";
import {
  decodeState,
  encodeState,
  initScrubber,
  openingPins,
  sameZone,
} from "./multi-zone-scrubber";
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { COORDINATES_BY_ID } from "./globe-zones";
import { zoneSwitchesInYear } from "./scrubber-dst";
import { MAX_SEEDED_ZONES } from "./zone-planner";

/* The widget reads the reader's zone through gmt; each test says which zone it
   is, and one block puts the real function back. */
const { systemZone, actualSystemZone } = vi.hoisted(() => ({
  systemZone: vi.fn<() => string>(() => ""),
  actualSystemZone: { current: (): string => "" },
}));
vi.mock("@northguild/gmt/zoned/get", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@northguild/gmt/zoned/get")>();
  actualSystemZone.current = actual.getSystemTimeZone;
  return { ...actual, getSystemTimeZone: systemZone };
});

describe("initScrubber slider", () => {
  it("keeps the chip, fill and aria-valuetext in step with the thumb", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const scrubber = await initScrubber(host);
    const slider = host.querySelector<HTMLInputElement>(
      '[data-role="slider"]',
    )!;
    const chip = host.querySelector<HTMLElement>(".gmt-range-chip")!;
    expect(slider.classList.contains("gmt-range")).toBe(true);
    expect(chip.textContent).toBe("0 min");
    expect(slider.style.getPropertyValue("--gmt-range-pct")).toBe("50");

    slider.value = "75";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(chip.textContent).toBe("+1 h 15 min");
    expect(slider.getAttribute("aria-valuetext")).toBe("+1 h 15 min");
    expect(
      Number(slider.style.getPropertyValue("--gmt-range-pct")),
    ).toBeGreaterThan(50);
    scrubber.destroy();
    host.remove();
  });
});

describe("initScrubber's browse button", () => {
  async function setup() {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const scrubber = await initScrubber(host);
    const button = host.querySelector<HTMLButtonElement>(
      '[data-role="add-open"]',
    )!;
    const input = host.querySelector<HTMLInputElement>('[data-role="add"]')!;
    const list = host.querySelector<HTMLElement>('[role="listbox"]')!;
    const press = (holdMs = 0) => {
      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
      });
      button.dispatchEvent(down);
      vi.advanceTimersByTime(holdMs);
      button.click();
      return down;
    };
    return { host, scrubber, button, input, list, press };
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("lists every zone, not the first sixty", async () => {
    const { scrubber, list, press } = await setup();
    press();
    expect(COORDINATES_BY_ID.size).toBeGreaterThan(60);
    expect(list.querySelectorAll('[role="option"]')).toHaveLength(
      COORDINATES_BY_ID.size,
    );
    scrubber.destroy();
  });

  it("keeps aria-expanded true only while the list is open", async () => {
    const { scrubber, button, input, list, press } = await setup();
    press();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(list.hidden).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");

    press();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    list
      .querySelector('[role="option"]')!
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(list.hidden).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");

    press();
    input.dispatchEvent(new FocusEvent("blur"));
    vi.advanceTimersByTime(200);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    scrubber.destroy();
  });

  it("does not take focus from the input, so a long press cannot shut and reopen the list", async () => {
    const { scrubber, input, list, press } = await setup();
    press();
    expect(list.hidden).toBe(false);
    input.focus();
    const down = press(500);
    expect(down.defaultPrevented).toBe(true);
    // The second press closes it, and the timer that blur would have started
    // has nothing to reopen.
    expect(list.hidden).toBe(true);
    vi.advanceTimersByTime(500);
    expect(list.hidden).toBe(true);
    scrubber.destroy();
  });

  it("leaves focus on the input when the button closes the list", async () => {
    const { scrubber, input, list, press } = await setup();
    press();
    press();
    expect(list.hidden).toBe(true);
    expect(document.activeElement).toBe(input);
    scrubber.destroy();
  });
});

/**
 * The reader's own zone opens first. `getSystemTimeZone` is mocked so each case
 * names the zone it needs; the last block runs the real one under two ambient
 * `TZ` values, so nothing passes only in the machine's own zone.
 */
describe("initScrubber's opening set", () => {
  const TOUR = [
    "Atlantic/Reykjavik",
    "Europe/Helsinki",
    "America/Los_Angeles",
    "Asia/Shanghai",
    "Asia/Calcutta",
    "Asia/Katmandu",
  ];
  const pinnedIn = (host: HTMLElement) =>
    [...host.querySelectorAll<HTMLElement>("[data-zone-row]")].map(
      (row) => row.dataset["zoneRow"]!,
    );

  async function open(
    zone: string,
    options?: Parameters<typeof initScrubber>[1],
  ) {
    systemZone.mockReturnValue(zone);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const scrubber = await initScrubber(host, options);
    return { host, scrubber };
  }

  // An earlier suite's timers may have written `?tz=` into the URL.
  beforeEach(() => window.history.replaceState(null, "", "/"));
  afterEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
  });

  it("pins a zone that is not in the tour ahead of it, and says it is the reader's", async () => {
    const { host, scrubber } = await open("America/Sao_Paulo");
    expect(pinnedIn(host)).toEqual(["America/Sao_Paulo", ...TOUR]);
    const mine = host.querySelector<HTMLElement>('[data-yours="true"]')!;
    expect(mine.dataset["zoneRow"]).toBe("America/Sao_Paulo");
    expect(mine.textContent).toContain("Your time zone");
    expect(host.querySelectorAll('[data-yours="true"]')).toHaveLength(1);
    expect(
      mine.querySelector("[data-role='remove']")!.getAttribute("aria-label"),
    ).toBe("Remove America/Sao_Paulo (your time zone)");
    scrubber.destroy();
  });

  it("moves a zone already in the tour to first place instead of repeating it", async () => {
    const { host, scrubber } = await open("Asia/Shanghai");
    expect(pinnedIn(host)).toEqual([
      "Asia/Shanghai",
      "Atlantic/Reykjavik",
      "Europe/Helsinki",
      "America/Los_Angeles",
      "Asia/Calcutta",
      "Asia/Katmandu",
    ]);
    scrubber.destroy();
  });

  it("compares canonical ids: Asia/Kolkata is the tour's Asia/Calcutta", async () => {
    const { host, scrubber } = await open("Asia/Kolkata");
    const ids = pinnedIn(host);
    expect(ids).toHaveLength(TOUR.length);
    expect(ids[0]).toBe("Asia/Calcutta");
    expect(ids.filter((id) => id === "Asia/Calcutta")).toHaveLength(1);
    expect(ids.slice(1)).toEqual(TOUR.filter((id) => id !== "Asia/Calcutta"));
    scrubber.destroy();
  });

  it("treats two names for one zone as one, whichever name the engine reports", async () => {
    for (const [reported, kept] of [
      ["Asia/Kolkata", "Asia/Calcutta"],
      ["Asia/Calcutta", "Asia/Calcutta"],
      ["Asia/Kathmandu", "Asia/Katmandu"],
    ] as const) {
      const { host, scrubber } = await open(reported);
      const ids = pinnedIn(host);
      expect(ids[0]).toBe(kept);
      expect(ids).toHaveLength(TOUR.length);
      expect(new Set(ids).size).toBe(ids.length);
      scrubber.destroy();
      host.remove();
    }
  });

  it("does not mistake two different zones for one", () => {
    expect(sameZone("Asia/Calcutta", "Asia/Kolkata")).toBe(true);
    expect(sameZone("Asia/Shanghai", "Asia/Calcutta")).toBe(false);
    expect(sameZone("Europe/London", "Europe/Dublin")).toBe(false);
    expect(sameZone("Asia/Calcutta", "Not/AZone")).toBe(false);
  });

  it("keeps the tour when the reader's zone has no coordinate", async () => {
    expect(COORDINATES_BY_ID.has("Etc/GMT+5")).toBe(false);
    const { host, scrubber } = await open("Etc/GMT+5");
    expect(pinnedIn(host)).toEqual(TOUR);
    expect(host.querySelector("[data-yours]")).toBeNull();
    scrubber.destroy();
  });

  it("keeps the tour when getSystemTimeZone returns its sentinel", async () => {
    const { host, scrubber } = await open("");
    expect(pinnedIn(host)).toEqual(TOUR);
    expect(host.querySelector("[data-yours]")).toBeNull();
    scrubber.destroy();
  });

  it("never pins more than eight, whatever the tour holds", () => {
    expect(openingPins("America/Sao_Paulo").pinned.length).toBeLessThanOrEqual(
      MAX_SEEDED_ZONES,
    );
  });

  it("shows zones a call or a link names exactly as given, with nothing prepended", async () => {
    const { host, scrubber } = await open("America/Sao_Paulo", {
      pinned: ["Asia/Tokyo", "Europe/London"],
    });
    expect(pinnedIn(host)).toEqual(["Asia/Tokyo", "Europe/London"]);
    expect(host.querySelector("[data-yours]")).toBeNull();
    scrubber.destroy();

    window.history.replaceState(null, "", "/?tz=Europe/Paris,Asia/Seoul");
    const second = await open("America/Sao_Paulo");
    expect(pinnedIn(second.host)).toEqual(["Europe/Paris", "Asia/Seoul"]);
    second.scrubber.destroy();
  });

  it("puts the reader's zone in getState, and a share link built from it reproduces the screen", async () => {
    const { host, scrubber } = await open("America/Sao_Paulo");
    const { pinned, time } = scrubber.getState();
    expect(pinned).toEqual(["America/Sao_Paulo", ...TOUR]);
    const ms = convertUtcToUnix(time, { epochUnit: "milliseconds" })!;
    // The link the Copy button writes is `encodeState`; reading it back with
    // `decodeState` must give the same zones, in the same order.
    const decoded = decodeState(encodeState(pinned, ms));
    expect(decoded.pinned).toEqual(pinned);
    // And opening from that link shows the same tiles with nothing prepended.
    window.history.replaceState(null, "", encodeState(pinned, ms));
    scrubber.destroy();
    const again = await open("Pacific/Auckland");
    expect(pinnedIn(again.host)).toEqual(pinned);
    again.scrubber.destroy();
    host.remove();
  });

  describe.each(["America/Sao_Paulo", "Asia/Kolkata"])(
    "with the real getSystemTimeZone under TZ=%s",
    (tz) => {
      const before = process.env["TZ"];
      beforeEach(() => {
        process.env["TZ"] = tz;
        systemZone.mockImplementation(() => actualSystemZone.current());
      });
      afterEach(() => {
        if (before === undefined) delete process.env["TZ"];
        else process.env["TZ"] = before;
      });

      it("opens on the zone the runtime reports, once", async () => {
        const reported = actualSystemZone.current();
        expect(reported).not.toBe("");
        const host = document.createElement("div");
        document.body.appendChild(host);
        const scrubber = await initScrubber(host);
        const ids = pinnedIn(host);
        const mine = host.querySelector<HTMLElement>('[data-yours="true"]')!;
        expect(ids[0]).toBe(mine.dataset["zoneRow"]);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBeLessThanOrEqual(MAX_SEEDED_ZONES);
        // The tile is the runtime's zone, or its tour name for the same zone.
        expect(
          new Intl.DateTimeFormat("en-US", {
            timeZone: ids[0]!,
          }).resolvedOptions().timeZone,
        ).toBe(
          new Intl.DateTimeFormat("en-US", {
            timeZone: reported,
          }).resolvedOptions().timeZone,
        );
        scrubber.destroy();
      });
    },
  );
});

/**
 * The DST state, the switch, the jump and reset buttons, and the default time.
 * The clock is injected; switches are found from the library's own list, never
 * typed in.
 */
describe("the Zone Planner's DST state, jump and reset", () => {
  const MIN = 60_000;
  const utc = (ms: number) =>
    convertUnixToUtc(ms, { epochUnit: "milliseconds" }).replace(
      /\.\d{3}Z$/,
      "Z",
    );
  const switchesOf = (zone: string, year = 2026) =>
    zoneSwitchesInYear(zone, year);

  async function open(
    zones: string[],
    atMs: number,
    options: { now?: number } = {},
  ) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const scrubber = await initScrubber(host, {
      pinned: zones,
      time: utc(atMs),
      syncUrl: false,
      now: () => options.now ?? atMs,
    });
    const q = <T extends HTMLElement>(sel: string) =>
      host.querySelector<T>(sel)!;
    const tile = (zone: string) =>
      host.querySelector<HTMLElement>(`[data-zone-row="${zone}"]`)!;
    return {
      host,
      scrubber,
      q,
      tile,
      dst: (zone: string) =>
        tile(zone).querySelector<HTMLElement>("[data-field='dst']")!,
      sw: (zone: string) =>
        tile(zone).querySelector<HTMLElement>("[data-field='switch']")!,
      shift(minutes: number) {
        const slider = q<HTMLInputElement>("[data-role='slider']");
        slider.value = String(minutes);
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      },
      anchor: () => q<HTMLInputElement>("[data-role='anchor']").value,
      jump: () => q<HTMLButtonElement>("[data-role='dst-preset']"),
      reset: () => q<HTMLButtonElement>("[data-role='reset']"),
      status: () => q("[data-role='jump-status']").textContent ?? "",
      live: () => q("[data-role='live']").textContent ?? "",
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/");
    systemZone.mockReturnValue("");
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  describe("a tile's DST state follows the scrubbed instant", () => {
    it.each([
      ["America/New_York", "a northern zone"],
      ["Australia/Sydney", "a southern zone"],
      ["Europe/Dublin", "a zone with negative DST in the tz source"],
      ["Australia/Lord_Howe", "a zone that shifts by thirty minutes"],
    ])(
      "%s (%s): the pill and the switch at, before and after each change",
      async (zone) => {
        for (const s of switchesOf(zone)) {
          const w = await open([zone], s.instantMs - 60 * MIN);
          // Before: nothing crossed, and the state is the one before.
          w.shift(59); // one minute before the switch (the reference is an hour before)
          expect(w.sw(zone).textContent).toBe("");
          const beforeState = w.dst(zone).dataset["state"];
          // At the switch's own instant.
          w.shift(60);
          expect(w.sw(zone).textContent).toContain(
            s.shiftMin > 0 ? "Spring forward" : "Fall back",
          );
          expect(w.tile(zone).dataset["switched"]).toBe("true");
          // After it.
          w.shift(120);
          expect(w.sw(zone).textContent).toContain(
            Math.abs(s.shiftMin) === 30 ? "30 min" : "1 h",
          );
          const afterState = w.dst(zone).dataset["state"];
          expect(beforeState).toBe(s.shiftMin > 0 ? "standard" : "dst");
          expect(afterState).toBe(s.shiftMin > 0 ? "dst" : "standard");
          expect(w.dst(zone).textContent).toBe(
            s.shiftMin > 0 ? "DST" : "Standard time",
          );
          // The new offset is on the tile.
          expect(tileText(w.tile(zone))).toContain(`UTC${s.offsetAfter}`);
          // Scrubbing back past the switch takes the badge away again.
          w.shift(0);
          expect(w.sw(zone).textContent).toBe("");
          expect(w.tile(zone).dataset["switched"]).toBe("false");
          w.scrubber.destroy();
          w.host.remove();
        }
      },
    );

    it("a zone that keeps one offset says so, and never draws the pill or a switch", async () => {
      const [ny] = switchesOf("America/New_York");
      const w = await open(["Asia/Tokyo"], ny!.instantMs - 60 * MIN);
      for (const shift of [0, 60, 120, 1200, -1200]) {
        w.shift(shift);
        expect(w.dst("Asia/Tokyo").dataset["state"]).toBe("none");
        expect(w.dst("Asia/Tokyo").textContent).toBe("No DST");
        expect(w.sw("Asia/Tokyo").textContent).toBe("");
      }
      w.scrubber.destroy();
    });

    it("draws a mark on the track for each shown zone's switch inside the range, and none for a zone without one", async () => {
      const [ny] = switchesOf("America/New_York");
      const w = await open(
        ["America/New_York", "Asia/Tokyo"],
        ny!.instantMs - 60 * MIN,
      );
      const marks = w.host.querySelectorAll<HTMLElement>(".gmt-scrubber-mark");
      expect(marks).toHaveLength(1);
      // An hour after the reference time, in a ±36 h range.
      const pct = Number(marks[0]!.style.getPropertyValue("--gmt-mark-pct"));
      expect(pct).toBeCloseTo(((60 + 2160) / 4320) * 100, 5);
      expect(marks[0]!.dataset["kind"]).toBe("forward");
      expect(
        w.host
          .querySelector(".gmt-scrubber-marks")!
          .getAttribute("aria-hidden"),
      ).toBe("true");
      w.scrubber.destroy();
    });

    it("holds one slot per tile for the state and the switch, in every state, so nothing resizes", async () => {
      const [ny] = switchesOf("America/New_York");
      const w = await open(
        ["America/New_York", "Asia/Tokyo"],
        ny!.instantMs - 60 * MIN,
      );
      const shape = () =>
        [...w.host.querySelectorAll<HTMLElement>("[data-zone-row]")].map(
          (row) => [...row.children].map((c) => c.tagName + "." + c.className),
        );
      const before = shape();
      for (const shift of [0, 90, 200, -300]) {
        w.shift(shift);
        expect(shape()).toEqual(before);
      }
      expect(w.host.querySelectorAll(".gmt-scrubber-dst-slot")).toHaveLength(2);
      expect(w.host.querySelectorAll(".gmt-scrubber-switch-slot")).toHaveLength(
        2,
      );
      w.scrubber.destroy();
    });

    it("says the state once the scrub settles, not on every step", async () => {
      const [ny] = switchesOf("America/New_York");
      const w = await open(["America/New_York"], ny!.instantMs - 60 * MIN);
      for (const shift of [10, 30, 50, 70, 90, 110, 120]) w.shift(shift);
      expect(w.live()).toBe("");
      vi.advanceTimersByTime(499);
      expect(w.live()).toBe("");
      vi.advanceTimersByTime(2);
      expect(w.live()).toContain("New York");
      expect(w.live()).toContain("spring forward");
      expect(w.live()).toContain(`UTC${ny!.offsetAfter}`);
      // The tile's own text is not a live region.
      expect(
        w.tile("America/New_York").querySelector("[aria-live]"),
      ).toBeNull();
      w.scrubber.destroy();
    });
  });

  describe("the opening reference time is now, rounded forward to 5 minutes", () => {
    const BASE = 1_780_000_000_000 - (1_780_000_000_000 % (5 * MIN)); // on a boundary
    const ZONES = ["Asia/Tokyo"];

    const anchorAt = async (now: number) => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const scrubber = await initScrubber(host, {
        pinned: ZONES,
        syncUrl: false,
        now: () => now,
      });
      const value = host.querySelector<HTMLInputElement>(
        "[data-role='anchor']",
      )!.value;
      const state = scrubber.getState();
      scrubber.destroy();
      host.remove();
      return { value, time: state.time };
    };
    const hhmm = (ms: number) => utc(ms).slice(0, 16);

    it("keeps an instant already on a boundary", async () => {
      expect((await anchorAt(BASE)).value).toBe(hhmm(BASE));
    });

    it("moves 1 ms past a boundary to the next one", async () => {
      expect((await anchorAt(BASE + 1)).value).toBe(hhmm(BASE + 5 * MIN));
    });

    it("moves 4 min 59 s past a boundary to the next one, not the nearest", async () => {
      expect((await anchorAt(BASE + 4 * MIN + 59_000)).value).toBe(
        hhmm(BASE + 5 * MIN),
      );
      // 2 min 29 s past: the nearest boundary is behind, the forward one is not.
      expect((await anchorAt(BASE + 2 * MIN + 29_000)).value).toBe(
        hhmm(BASE + 5 * MIN),
      );
    });

    it("carries into the next hour and the next day", async () => {
      const dayEnd = 1_780_099_200_000; // 2026-05-30T00:00:00Z
      expect(utc(dayEnd)).toBe("2026-05-30T00:00:00Z");
      expect((await anchorAt(dayEnd - 2 * MIN)).value).toBe("2026-05-30T00:00");
      expect((await anchorAt(dayEnd - MIN - 1)).value).toBe("2026-05-30T00:00");
      expect((await anchorAt(dayEnd - 5 * MIN - 1)).value).toBe(
        "2026-05-29T23:55",
      );
      const hour = dayEnd - 24 * 60 * MIN + 13 * 60 * MIN;
      expect((await anchorAt(hour - 3 * MIN)).value).toBe(hhmm(hour));
    });

    it("rounds in UTC, so a transition in the reader's zone cannot move it", async () => {
      const [ny] = switchesOf("America/New_York");
      // 90 s before New York springs forward, with New York as the reader's zone.
      systemZone.mockReturnValue("America/New_York");
      const got = await anchorAt(ny!.instantMs - 90_000);
      expect(got.value).toBe(hhmm(ny!.instantMs));
    });

    it("keeps a time a link or a call names, to the slider's step", async () => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const scrubber = await initScrubber(host, {
        pinned: ZONES,
        time: "2026-03-08T06:45:00Z",
        syncUrl: false,
        now: () => BASE,
      });
      expect(
        host.querySelector<HTMLInputElement>("[data-role='anchor']")!.value,
      ).toBe("2026-03-08T06:45");
      scrubber.destroy();
    });

    it("never reads a clock the test did not give it", async () => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const now = vi.fn(() => BASE + 1);
      const scrubber = await initScrubber(host, {
        pinned: ZONES,
        syncUrl: false,
        now,
      });
      expect(now).toHaveBeenCalled();
      scrubber.destroy();
    });
  });

  describe("Jump to the next DST transition", () => {
    it("goes to the next switch of either kind, and on to the one after when pressed again", async () => {
      const [spring, fall] = switchesOf("America/New_York");
      // 10 minutes before the spring switch.
      const w = await open(["America/New_York"], spring!.instantMs - 10 * MIN);
      w.jump().click();
      // The reference time is an hour before the switch, the slider an hour past it.
      expect(w.anchor()).toBe(utc(spring!.instantMs - 60 * MIN).slice(0, 16));
      expect(w.scrubber.getState().time).toBe(
        utc(spring!.instantMs + 60 * MIN),
      );
      expect(w.status()).toContain("New York springs forward");
      expect(w.dst("America/New_York").dataset["state"]).toBe("dst");
      expect(w.sw("America/New_York").textContent).toContain("Spring forward");
      // Again: the fall-back switch, never the one it is already at.
      w.jump().click();
      expect(w.scrubber.getState().time).toBe(utc(fall!.instantMs + 60 * MIN));
      expect(w.status()).toContain("New York falls back");
      expect(w.dst("America/New_York").dataset["state"]).toBe("standard");
      w.scrubber.destroy();
    });

    it("from just before a fall-back goes to the fall-back", async () => {
      const [, fall] = switchesOf("America/New_York");
      const w = await open(["America/New_York"], fall!.instantMs - 5 * MIN);
      w.jump().click();
      expect(w.scrubber.getState().time).toBe(utc(fall!.instantMs + 60 * MIN));
      w.scrubber.destroy();
    });

    it("from exactly on a switch advances to the next one", async () => {
      const [spring, fall] = switchesOf("America/New_York");
      const w = await open(["America/New_York"], spring!.instantMs);
      expect(w.scrubber.getState().time).toBe(utc(spring!.instantMs));
      w.jump().click();
      expect(w.scrubber.getState().time).toBe(utc(fall!.instantMs + 60 * MIN));
      w.scrubber.destroy();
    });

    it("finds a southern zone's switch, and the earliest across the shown zones", async () => {
      const sydney = switchesOf("Australia/Sydney");
      const ny = switchesOf("America/New_York");
      // Only Sydney shown: from January its first switch is the April one.
      const only = await open(
        ["Australia/Sydney"],
        sydney[0]!.instantMs - 3 * 24 * 60 * MIN,
      );
      only.jump().click();
      expect(only.scrubber.getState().time).toBe(
        utc(sydney[0]!.instantMs + 60 * MIN),
      );
      expect(only.status()).toContain("Sydney falls back");
      only.scrubber.destroy();

      // Both shown, just after Sydney's April switch: New York's spring one is
      // behind, so the next is the earlier of Sydney's October and New York's fall.
      const from = sydney[0]!.instantMs + 60 * MIN;
      const both = await open(["America/New_York", "Australia/Sydney"], from);
      both.jump().click();
      const expected = [...sydney, ...ny]
        .filter((s) => s.instantMs > from)
        .sort((a, b) => a.instantMs - b.instantMs)[0]!;
      expect(both.scrubber.getState().time).toBe(
        utc(expected.instantMs + 60 * MIN),
      );
      both.scrubber.destroy();
    });

    it("is disabled, with its reason in words, when no shown zone changes its clocks", async () => {
      const w = await open(
        ["Asia/Tokyo", "Atlantic/Reykjavik"],
        1_780_000_000_000,
      );
      expect(w.jump().disabled).toBe(true);
      expect(w.status()).toContain(
        "None of the shown zones changes its clocks",
      );
      const before = w.scrubber.getState().time;
      w.jump().click();
      expect(w.scrubber.getState().time).toBe(before);
      w.scrubber.destroy();
    });

    it("comes back when a zone with a switch is added, and clears its reason", async () => {
      const w = await open(["Asia/Tokyo"], 1_780_000_000_000);
      expect(w.jump().disabled).toBe(true);
      const input = w.q<HTMLInputElement>("[data-role='add']");
      input.dispatchEvent(new Event("focus"));
      input.value = "America/New_York";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const option = [
        ...w.host.querySelectorAll<HTMLElement>('[role="option"]'),
      ].find((o) => o.textContent?.includes("America/New_York"));
      option?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(w.jump().disabled).toBe(false);
      expect(w.status()).toBe("");
      w.scrubber.destroy();
    });

    it("says where it landed once, when the scrub settles, and keeps the status line a fixed size", async () => {
      const [spring] = switchesOf("America/New_York");
      const w = await open(["America/New_York"], spring!.instantMs - 10 * MIN);
      w.jump().click();
      vi.advanceTimersByTime(600);
      expect(w.live()).toBe(w.status());
      expect(w.live()).toContain("New York");
      expect(w.q("[data-role='jump-status']").tagName).toBe("P");
      w.scrubber.destroy();
    });
  });

  describe("Reset to today", () => {
    it("returns to now, rounded forward, taken at the press", async () => {
      const [spring] = switchesOf("America/New_York");
      let now = spring!.instantMs - 10 * MIN + 1;
      const host = document.createElement("div");
      document.body.appendChild(host);
      const scrubber = await initScrubber(host, {
        pinned: ["America/New_York"],
        syncUrl: false,
        now: () => now,
      });
      const anchor = () =>
        host.querySelector<HTMLInputElement>("[data-role='anchor']")!.value;
      expect(anchor()).toBe(utc(spring!.instantMs - 5 * MIN).slice(0, 16));
      // Wander off: jump, then drag.
      host
        .querySelector<HTMLButtonElement>("[data-role='dst-preset']")!
        .click();
      expect(anchor()).not.toBe(utc(spring!.instantMs - 5 * MIN).slice(0, 16));
      // Time has moved on since the page opened.
      now += 47 * MIN;
      host.querySelector<HTMLButtonElement>("[data-role='reset']")!.click();
      const expected = utc(spring!.instantMs + 40 * MIN).slice(0, 16);
      expect(anchor()).toBe(expected);
      expect(
        Number(
          host.querySelector<HTMLInputElement>("[data-role='slider']")!.value,
        ),
      ).toBe(0);
      // The state, and so the link, carries the concrete time.
      expect(scrubber.getState().time).toBe(`${expected}:00Z`);
      expect(
        host.querySelector("[data-role='jump-status']")!.textContent,
      ).toContain("Reset to now");
      scrubber.destroy();
    });

    it("is a real button, reachable by keyboard, beside the jump button", async () => {
      const w = await open(["America/New_York"], 1_780_000_000_000);
      const reset = w.reset();
      expect(reset.tagName).toBe("BUTTON");
      expect(reset.type).toBe("button");
      expect(reset.tabIndex).toBe(0);
      expect(reset.textContent?.trim()).toBe("Reset to today");
      expect(reset.parentElement).toBe(w.jump().parentElement);
      w.scrubber.destroy();
    });
  });

  describe.each(["America/Sao_Paulo", "Pacific/Auckland"])(
    "under TZ=%s",
    (tz) => {
      const before = process.env["TZ"];
      beforeEach(() => {
        process.env["TZ"] = tz;
      });
      afterEach(() => {
        if (before === undefined) delete process.env["TZ"];
        else process.env["TZ"] = before;
      });

      it("rounds, jumps and resets to the same instants", async () => {
        const [spring] = switchesOf("America/New_York");
        const w = await open(
          ["America/New_York"],
          spring!.instantMs - 10 * MIN,
          { now: spring!.instantMs - 10 * MIN + 1 },
        );
        w.jump().click();
        expect(w.scrubber.getState().time).toBe(
          utc(spring!.instantMs + 60 * MIN),
        );
        w.reset().click();
        expect(w.anchor()).toBe(utc(spring!.instantMs - 5 * MIN).slice(0, 16));
        w.scrubber.destroy();
      });
    },
  );
});

function tileText(tile: HTMLElement): string {
  return tile.textContent ?? "";
}
