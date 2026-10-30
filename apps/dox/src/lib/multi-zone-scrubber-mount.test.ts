// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { expectNoAxeViolations, setRange } from "~/test/render-widget";
import { installJsdomShims } from "~/test/jsdom-shims";
import { setHtml } from "~/widgets/builders";
import {
  renderScrubberTemplate,
  SHIFT_LABEL,
  formatShift,
} from "~/widgets/families/zones/zone-planner-template";
import {
  decodeState,
  encodeState,
  initScrubber,
  openingPins,
  sameZone,
  type ScrubberOptions,
} from "./multi-zone-scrubber";
import { COORDINATES_BY_ID } from "./globe-zones";
import { zoneSwitchesInYear } from "./scrubber-dst";
import { MAX_SEEDED_ZONES } from "./zone-planner";

installJsdomShims();

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

const MIN = 60_000;
const utc = (ms: number) =>
  convertUnixToUtc(ms, { epochUnit: "milliseconds" }).replace(/\.\d{3}Z$/, "Z");
const switchesOf = (zone: string, year = 2026) =>
  zoneSwitchesInYear(zone, year);

/** Mounts the planner's own template and wires it, as the page and the rail do. */
async function open(options: ScrubberOptions = {}) {
  const root = document.createElement("div");
  document.body.append(root);
  setHtml(root, renderScrubberTemplate("test"));
  const scrubber = await initScrubber(root, { syncUrl: false, ...options });
  const ui = within(root);
  const user = userEvent.setup({
    advanceTimers: (ms) => {
      if (vi.isFakeTimers()) vi.advanceTimersByTime(ms);
    },
  });
  return {
    root,
    scrubber,
    ui,
    user,
    slider: () => ui.getByRole("slider", { name: SHIFT_LABEL }),
    shift: (minutes: number) => setRange(ui.getByRole("slider"), minutes),
    anchor: () => ui.getByLabelText("Reference time (UTC)"),
    jump: () =>
      ui.getByRole("button", { name: "Jump to the next DST transition" }),
    reset: () => ui.getByRole("button", { name: "Reset to today" }),
    live: () => ui.getByRole("status", { name: "Zone Planner announcements" }),
    tile: (name: string) => ui.getByRole("article", { name }),
    /** The zones pinned, in order, read from the remove buttons' names. */
    pinned: () =>
      ui.getAllByRole("button", { name: /^Remove / }).map((b) =>
        b
          .getAttribute("aria-label")!
          .replace(/^Remove /, "")
          .replace(/ \(your time zone\)$/, ""),
      ),
  };
}

beforeAll(async () => {
  await import("./multi-zone-scrubber");
}, 120_000);

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  systemZone.mockReturnValue("");
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
});

describe("the shift slider", () => {
  it("words its value as the thumb moves, and the page stays accessible", async () => {
    const w = await open({ pinned: ["Asia/Tokyo"] });
    expect(w.slider()).toHaveAttribute("aria-valuetext", "0 min");
    w.shift(75);
    expect(w.slider()).toHaveAttribute("aria-valuetext", "+1 h 15 min");
    w.shift(-30);
    expect(w.slider()).toHaveAttribute("aria-valuetext", formatShift(-30));
    await expectNoAxeViolations(w.root);
    w.scrubber.destroy();
  });

  it("moves the reading and the readout with the shift", async () => {
    const w = await open({
      pinned: ["America/New_York"],
      time: "2026-03-08T06:45:00Z",
    });
    expect(w.tile("New York")).toHaveTextContent("01:45");
    expect(w.ui.getByText("Sun 8 Mar 2026, 06:45 UTC")).toBeVisible();
    w.shift(15);
    expect(w.ui.getByText("Sun 8 Mar 2026, 07:00 UTC")).toBeVisible();
    expect(w.tile("New York")).toHaveTextContent("03:00");
    w.scrubber.destroy();
  });
});

describe("the browse button", () => {
  async function setup() {
    const w = await open({ pinned: ["Asia/Tokyo"] });
    const browse = w.ui.getByRole("button", { name: "Browse every zone" });
    const input = w.ui.getByRole("combobox", { name: "Add a zone" });
    return { ...w, browse, input };
  }

  it("lists every zone, not the first sixty", async () => {
    const { user, browse, ui, scrubber } = await setup();
    await user.click(browse);
    expect(COORDINATES_BY_ID.size).toBeGreaterThan(60);
    expect(ui.getAllByRole("option")).toHaveLength(COORDINATES_BY_ID.size);
    scrubber.destroy();
  });

  it("keeps aria-expanded true only while the list is open", async () => {
    const { user, browse, input, ui, scrubber } = await setup();
    await user.click(browse);
    expect(browse).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(browse).toHaveAttribute("aria-expanded", "false");

    await user.click(browse);
    expect(browse).toHaveAttribute("aria-expanded", "true");
    await user.click(ui.getAllByRole("option")[0]!);
    expect(browse).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-expanded", "false");
    scrubber.destroy();
  });

  it("leaves focus on the input when the button closes the list", async () => {
    const { user, browse, input, scrubber } = await setup();
    await user.click(browse);
    await user.click(browse);
    expect(browse).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveFocus();
    scrubber.destroy();
  });
});

describe("pinning and removing zones", () => {
  it("adds a zone typed in full and takes it off with its remove button", async () => {
    const w = await open({ pinned: ["Asia/Tokyo"] });
    await w.user.click(w.ui.getByRole("combobox", { name: "Add a zone" }));
    await w.user.keyboard("America/New_York{Enter}");
    expect(w.pinned()).toEqual(["Asia/Tokyo", "America/New_York"]);
    await expectNoAxeViolations(w.root);

    await w.user.click(
      w.ui.getByRole("button", { name: "Remove America/New_York" }),
    );
    expect(w.pinned()).toEqual(["Asia/Tokyo"]);
    expect(w.scrubber.getState().pinned).toEqual(["Asia/Tokyo"]);
    w.scrubber.destroy();
  });
});

describe("the share link", () => {
  it("copies a link that names the pinned zones and the time", async () => {
    const w = await open({
      pinned: ["Asia/Tokyo"],
      time: "2026-03-08T06:45:00Z",
      sharePath: "/gmt/tools/zone-planner/",
    });
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await w.user.click(
      w.ui.getByRole("button", { name: "Copy shareable link" }),
    );
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    const url = String((writeText.mock.calls[0] as unknown[])[0]);
    expect(new URL(url).pathname).toBe("/gmt/tools/zone-planner/");
    expect(url).toContain("tz=Asia%2FTokyo");
    expect(decodeState(new URL(url).search).pinned).toEqual(["Asia/Tokyo"]);
    expect(await w.ui.findByText("Copied")).toBeVisible();
    w.scrubber.destroy();
  });

  it("shows the link to copy by hand when the clipboard refuses it", async () => {
    const w = await open({
      pinned: ["Asia/Tokyo"],
      time: "2026-03-08T06:45:00Z",
      sharePath: "/gmt/tools/zone-planner/",
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    await w.user.click(
      w.ui.getByRole("button", { name: "Copy shareable link" }),
    );
    const status = await w.ui.findByText(/Copy failed/);
    expect(status).toHaveTextContent("/gmt/tools/zone-planner/");
    expect(status).toHaveTextContent("tz=Asia%2FTokyo");
    w.scrubber.destroy();
  });
});

/**
 * The reader's own zone opens first. `getSystemTimeZone` is mocked so each case
 * names the zone it needs; the last block runs the real one under two ambient
 * `TZ` values, so nothing passes only in the machine's own zone.
 */
describe("the opening set", () => {
  const TOUR = [
    "Atlantic/Reykjavik",
    "Europe/Helsinki",
    "America/Los_Angeles",
    "Asia/Shanghai",
    "Asia/Calcutta",
    "Asia/Katmandu",
  ];

  async function openAs(zone: string, options?: ScrubberOptions) {
    systemZone.mockReturnValue(zone);
    return open(options);
  }

  it("pins a zone that is not in the tour ahead of it, and says it is the reader's", async () => {
    const w = await openAs("America/Sao_Paulo");
    expect(w.pinned()).toEqual(["America/Sao_Paulo", ...TOUR]);
    expect(w.ui.getAllByText("Your time zone")).toHaveLength(1);
    expect(w.tile("Sao Paulo")).toHaveTextContent("Your time zone");
    expect(
      w.ui.getByRole("button", {
        name: "Remove America/Sao_Paulo (your time zone)",
      }),
    ).toBeVisible();
    await expectNoAxeViolations(w.root);
    w.scrubber.destroy();
  });

  it("moves a zone already in the tour to first place instead of repeating it", async () => {
    const w = await openAs("Asia/Shanghai");
    expect(w.pinned()).toEqual([
      "Asia/Shanghai",
      "Atlantic/Reykjavik",
      "Europe/Helsinki",
      "America/Los_Angeles",
      "Asia/Calcutta",
      "Asia/Katmandu",
    ]);
    w.scrubber.destroy();
  });

  it("treats two names for one zone as one, whichever name the engine reports", async () => {
    for (const [reported, kept] of [
      ["Asia/Kolkata", "Asia/Calcutta"],
      ["Asia/Calcutta", "Asia/Calcutta"],
      ["Asia/Kathmandu", "Asia/Katmandu"],
    ] as const) {
      const w = await openAs(reported);
      const ids = w.pinned();
      expect(ids[0]).toBe(kept);
      expect(ids).toHaveLength(TOUR.length);
      expect(new Set(ids).size).toBe(ids.length);
      w.scrubber.destroy();
      w.root.remove();
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
    const w = await openAs("Etc/GMT+5");
    expect(w.pinned()).toEqual(TOUR);
    expect(w.ui.queryByText("Your time zone")).not.toBeInTheDocument();
    w.scrubber.destroy();
  });

  it("keeps the tour when getSystemTimeZone returns its sentinel", async () => {
    const w = await openAs("");
    expect(w.pinned()).toEqual(TOUR);
    expect(w.ui.queryByText("Your time zone")).not.toBeInTheDocument();
    w.scrubber.destroy();
  });

  it("never pins more than eight, whatever the tour holds", () => {
    expect(openingPins("America/Sao_Paulo").pinned.length).toBeLessThanOrEqual(
      MAX_SEEDED_ZONES,
    );
  });

  it("shows zones a call or a link names exactly as given, with nothing prepended", async () => {
    const first = await openAs("America/Sao_Paulo", {
      pinned: ["Asia/Tokyo", "Europe/London"],
    });
    expect(first.pinned()).toEqual(["Asia/Tokyo", "Europe/London"]);
    expect(first.ui.queryByText("Your time zone")).not.toBeInTheDocument();
    first.scrubber.destroy();
    first.root.remove();

    window.history.replaceState(null, "", "/?tz=Europe/Paris,Asia/Seoul");
    const second = await openAs("America/Sao_Paulo", { syncUrl: true });
    expect(second.pinned()).toEqual(["Europe/Paris", "Asia/Seoul"]);
    second.scrubber.destroy();
  });

  it("puts the reader's zone in getState, and a share link built from it reproduces the screen", async () => {
    const w = await openAs("America/Sao_Paulo");
    const { pinned, time } = w.scrubber.getState();
    expect(pinned).toEqual(["America/Sao_Paulo", ...TOUR]);
    const ms = convertUtcToUnix(time, { epochUnit: "milliseconds" })!;
    // The link the Copy button writes is `encodeState`; reading it back with
    // `decodeState` must give the same zones, in the same order.
    expect(decodeState(encodeState(pinned, ms)).pinned).toEqual(pinned);
    // And opening from that link shows the same tiles with nothing prepended.
    window.history.replaceState(null, "", encodeState(pinned, ms));
    w.scrubber.destroy();
    w.root.remove();
    const again = await openAs("Pacific/Auckland", { syncUrl: true });
    expect(again.pinned()).toEqual(pinned);
    again.scrubber.destroy();
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
        const w = await open();
        const ids = w.pinned();
        expect(w.ui.getAllByText("Your time zone")).toHaveLength(1);
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
        w.scrubber.destroy();
      });
    },
  );
});

/**
 * The DST state, the switch, the jump and reset buttons, and the default time.
 * The clock is injected; switches are found from the library's own list, never
 * typed in.
 */
describe("the DST state, jump and reset", () => {
  async function openAt(
    zones: string[],
    atMs: number,
    options: { now?: number } = {},
  ) {
    vi.useFakeTimers();
    return open({
      pinned: zones,
      time: utc(atMs),
      now: () => options.now ?? atMs,
    });
  }
  const cityOf = (zone: string) => zone.split("/").pop()!.replace(/_/g, " ");

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
          const w = await openAt([zone], s.instantMs - 60 * MIN);
          const tile = () => w.tile(cityOf(zone));
          const change = /Spring forward|Fall back/;
          // Before: nothing crossed, and the state is the one before.
          w.shift(59);
          expect(within(tile()).queryByText(change)).not.toBeInTheDocument();
          expect(tile()).toHaveTextContent(
            s.shiftMin > 0 ? "Standard time" : "DST",
          );
          // At the switch's own instant.
          w.shift(60);
          expect(
            within(tile()).getByText(
              s.shiftMin > 0 ? /Spring forward/ : /Fall back/,
            ),
          ).toBeVisible();
          // After it.
          w.shift(120);
          expect(
            within(tile()).getByText(
              Math.abs(s.shiftMin) === 30 ? /30 min/ : /1 h/,
            ),
          ).toBeVisible();
          expect(
            within(tile()).getByText(s.shiftMin > 0 ? "DST" : "Standard time"),
          ).toBeVisible();
          // The new offset is on the tile.
          expect(within(tile()).getByText(`UTC${s.offsetAfter}`)).toBeVisible();
          // Scrubbing back past the switch takes the badge away again.
          w.shift(0);
          expect(within(tile()).queryByText(change)).not.toBeInTheDocument();
          w.scrubber.destroy();
          w.root.remove();
        }
      },
    );

    it("a zone that keeps one offset says so, and never draws a switch", async () => {
      const [ny] = switchesOf("America/New_York");
      const w = await openAt(["Asia/Tokyo"], ny!.instantMs - 60 * MIN);
      for (const shift of [0, 60, 120, 1200, -1200]) {
        w.shift(shift);
        expect(within(w.tile("Tokyo")).getByText("No DST")).toBeVisible();
        expect(
          within(w.tile("Tokyo")).queryByText(/Spring forward|Fall back/),
        ).not.toBeInTheDocument();
      }
      vi.useRealTimers();
      await expectNoAxeViolations(w.root);
      w.scrubber.destroy();
    });

    it("says the state once the scrub settles, not on every step", async () => {
      const [ny] = switchesOf("America/New_York");
      const w = await openAt(["America/New_York"], ny!.instantMs - 60 * MIN);
      for (const shift of [10, 30, 50, 70, 90, 110, 120]) w.shift(shift);
      expect(w.live()).toBeEmptyDOMElement();
      vi.advanceTimersByTime(499);
      expect(w.live()).toBeEmptyDOMElement();
      vi.advanceTimersByTime(2);
      expect(w.live()).toHaveTextContent("New York");
      expect(w.live()).toHaveTextContent("spring forward");
      expect(w.live()).toHaveTextContent(`UTC${ny!.offsetAfter}`);
      // The tile's own text is not a live region.
      expect(
        within(w.tile("New York")).queryByRole("status"),
      ).not.toBeInTheDocument();
      w.scrubber.destroy();
    });
  });

  describe("the opening reference time is now, rounded forward to 5 minutes", () => {
    const BASE = 1_780_000_000_000 - (1_780_000_000_000 % (5 * MIN)); // on a boundary
    const ZONES = ["Asia/Tokyo"];
    const hhmm = (ms: number) => utc(ms).slice(0, 16);

    const anchorAt = async (now: number) => {
      const w = await open({ pinned: ZONES, now: () => now });
      const value = (w.anchor() as HTMLInputElement).value;
      const { time } = w.scrubber.getState();
      w.scrubber.destroy();
      w.root.remove();
      return { value, time };
    };

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
      const w = await open({
        pinned: ZONES,
        time: "2026-03-08T06:45:00Z",
        now: () => BASE,
      });
      expect(w.anchor()).toHaveValue("2026-03-08T06:45");
      w.scrubber.destroy();
    });

    it("reads the clock it was given", async () => {
      const now = vi.fn(() => BASE + 1);
      const w = await open({ pinned: ZONES, now });
      expect(now).toHaveBeenCalled();
      w.scrubber.destroy();
    });
  });

  describe("Jump to the next DST transition", () => {
    it("goes to the next switch of either kind, and on to the one after when pressed again", async () => {
      const [spring, fall] = switchesOf("America/New_York");
      // 10 minutes before the spring switch.
      const w = await openAt(
        ["America/New_York"],
        spring!.instantMs - 10 * MIN,
      );
      await w.user.click(w.jump());
      // The reference time is an hour before the switch, the slider an hour past it.
      expect(w.anchor()).toHaveValue(
        utc(spring!.instantMs - 60 * MIN).slice(0, 16),
      );
      expect(w.scrubber.getState().time).toBe(
        utc(spring!.instantMs + 60 * MIN),
      );
      expect(w.ui.getByText(/New York springs forward/)).toBeVisible();
      expect(within(w.tile("New York")).getByText("DST")).toBeVisible();
      expect(
        within(w.tile("New York")).getByText(/Spring forward/),
      ).toBeVisible();
      // Again: the fall-back switch, never the one it is already at.
      await w.user.click(w.jump());
      expect(w.scrubber.getState().time).toBe(utc(fall!.instantMs + 60 * MIN));
      expect(w.ui.getByText(/New York falls back/)).toBeVisible();
      expect(
        within(w.tile("New York")).getByText("Standard time"),
      ).toBeVisible();
      w.scrubber.destroy();
    });

    it("from just before a fall-back goes to the fall-back", async () => {
      const [, fall] = switchesOf("America/New_York");
      const w = await openAt(["America/New_York"], fall!.instantMs - 5 * MIN);
      await w.user.click(w.jump());
      expect(w.scrubber.getState().time).toBe(utc(fall!.instantMs + 60 * MIN));
      w.scrubber.destroy();
    });

    it("from exactly on a switch advances to the next one", async () => {
      const [spring, fall] = switchesOf("America/New_York");
      const w = await openAt(["America/New_York"], spring!.instantMs);
      expect(w.scrubber.getState().time).toBe(utc(spring!.instantMs));
      await w.user.click(w.jump());
      expect(w.scrubber.getState().time).toBe(utc(fall!.instantMs + 60 * MIN));
      w.scrubber.destroy();
    });

    it("finds a southern zone's switch, and the earliest across the shown zones", async () => {
      const sydney = switchesOf("Australia/Sydney");
      const ny = switchesOf("America/New_York");
      // Only Sydney shown: from January its first switch is the April one.
      const only = await openAt(
        ["Australia/Sydney"],
        sydney[0]!.instantMs - 3 * 24 * 60 * MIN,
      );
      await only.user.click(only.jump());
      expect(only.scrubber.getState().time).toBe(
        utc(sydney[0]!.instantMs + 60 * MIN),
      );
      expect(only.ui.getByText(/Sydney falls back/)).toBeVisible();
      only.scrubber.destroy();
      only.root.remove();

      // Both shown, just after Sydney's April switch: New York's spring one is
      // behind, so the next is the earlier of Sydney's October and New York's fall.
      const from = sydney[0]!.instantMs + 60 * MIN;
      const both = await openAt(["America/New_York", "Australia/Sydney"], from);
      await both.user.click(both.jump());
      const expected = [...sydney, ...ny]
        .filter((s) => s.instantMs > from)
        .sort((a, b) => a.instantMs - b.instantMs)[0]!;
      expect(both.scrubber.getState().time).toBe(
        utc(expected.instantMs + 60 * MIN),
      );
      both.scrubber.destroy();
    });

    it.each([
      ["America/Denver", "America/Los_Angeles"],
      ["America/New_York", "America/Chicago"],
      ["Australia/Lord_Howe", "Australia/Sydney"],
    ])(
      "names %s's switch and then %s's, though the second is inside the landing hour",
      async (first, second) => {
        // Find, from the library's lists, a switch of `first` followed within the
        // hour by a switch of `second`.
        let pair: [number, number] | null = null;
        for (const year of [2026, 2027]) {
          for (const a of switchesOf(first, year)) {
            for (const b of switchesOf(second, year)) {
              if (
                b.instantMs > a.instantMs &&
                b.instantMs - a.instantMs <= 60 * MIN
              ) {
                pair ??= [a.instantMs, b.instantMs];
              }
            }
          }
        }
        expect(pair).not.toBeNull();
        const [a, b] = pair!;
        const w = await openAt([first, second], a - 3 * MIN);
        await w.user.click(w.jump());
        expect(w.scrubber.getState().time).toBe(utc(a + 60 * MIN));
        await w.user.click(w.jump());
        // The second press goes on to the second zone's switch, not past it.
        expect(w.scrubber.getState().time).toBe(utc(b + 60 * MIN));
        expect(
          w.ui.getByText(
            new RegExp(`${cityOf(second)} (springs forward|falls back)`),
          ),
        ).toBeVisible();
        w.scrubber.destroy();
      },
    );

    it("searches from the scrubbed time again once the reader has moved it", async () => {
      const [spring, fall] = switchesOf("America/New_York");
      const w = await openAt(
        ["America/New_York"],
        spring!.instantMs - 10 * MIN,
      );
      await w.user.click(w.jump());
      w.shift(2160); // the reader drags to the far end
      await w.user.click(w.jump());
      expect(w.scrubber.getState().time).toBe(utc(fall!.instantMs + 60 * MIN));
      w.scrubber.destroy();
    });

    it("is disabled, with its reason in words, when no shown zone changes its clocks", async () => {
      const w = await openAt(
        ["Asia/Tokyo", "Atlantic/Reykjavik"],
        1_780_000_000_000,
      );
      expect(w.jump()).toBeDisabled();
      expect(
        w.ui.getByText(
          "None of the shown zones changes its clocks in the next two years.",
        ),
      ).toBeVisible();
      const before = w.scrubber.getState().time;
      await w.user.click(w.jump());
      expect(w.scrubber.getState().time).toBe(before);
      vi.useRealTimers();
      await expectNoAxeViolations(w.root);
      w.scrubber.destroy();
    });

    it("comes back when a zone with a switch is added, and clears its reason", async () => {
      const w = await openAt(["Asia/Tokyo"], 1_780_000_000_000);
      expect(w.jump()).toBeDisabled();
      await w.user.click(w.ui.getByRole("combobox", { name: "Add a zone" }));
      await w.user.keyboard("America/New_York{Enter}");
      expect(w.jump()).toBeEnabled();
      expect(
        w.ui.queryByText(/None of the shown zones changes its clocks/),
      ).not.toBeInTheDocument();
      w.scrubber.destroy();
    });

    it("says where it landed once, when the scrub settles", async () => {
      const [spring] = switchesOf("America/New_York");
      const w = await openAt(
        ["America/New_York"],
        spring!.instantMs - 10 * MIN,
      );
      await w.user.click(w.jump());
      expect(w.live()).toBeEmptyDOMElement();
      vi.advanceTimersByTime(600);
      expect(w.live()).toHaveTextContent(
        /New York springs forward .* Showing one hour after it\./,
      );
      w.scrubber.destroy();
    });
  });

  describe("Reset to today", () => {
    it("returns to now, rounded forward, taken at the press", async () => {
      const [spring] = switchesOf("America/New_York");
      let now = spring!.instantMs - 10 * MIN + 1;
      vi.useFakeTimers();
      const w = await open({ pinned: ["America/New_York"], now: () => now });
      expect(w.anchor()).toHaveValue(
        utc(spring!.instantMs - 5 * MIN).slice(0, 16),
      );
      // Wander off: jump.
      await w.user.click(w.jump());
      expect(w.anchor()).not.toHaveValue(
        utc(spring!.instantMs - 5 * MIN).slice(0, 16),
      );
      // Time has moved on since the page opened.
      now += 47 * MIN;
      await w.user.click(w.reset());
      const expected = utc(spring!.instantMs + 40 * MIN).slice(0, 16);
      expect(w.anchor()).toHaveValue(expected);
      expect(w.slider()).toHaveValue("0");
      // The state, and so the link, carries the concrete time.
      expect(w.scrubber.getState().time).toBe(`${expected}:00Z`);
      expect(w.ui.getByText(/Reset to now/)).toBeVisible();
      w.scrubber.destroy();
    });

    it("is a button beside the jump button, with its rounding explained", async () => {
      const w = await openAt(["America/New_York"], 1_780_000_000_000);
      expect(w.reset()).toHaveAccessibleDescription(
        "Set the reference time to now, rounded forward to the next 5 minutes",
      );
      await w.user.click(w.reset());
      expect(w.reset()).toHaveFocus();
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
        const w = await openAt(
          ["America/New_York"],
          spring!.instantMs - 10 * MIN,
          { now: spring!.instantMs - 10 * MIN + 1 },
        );
        await w.user.click(w.jump());
        expect(w.scrubber.getState().time).toBe(
          utc(spring!.instantMs + 60 * MIN),
        );
        await w.user.click(w.reset());
        expect(w.anchor()).toHaveValue(
          utc(spring!.instantMs - 5 * MIN).slice(0, 16),
        );
        w.scrubber.destroy();
      });
    },
  );
});
