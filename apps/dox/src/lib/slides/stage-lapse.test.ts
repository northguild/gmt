/**
 * @vitest-environment jsdom
 *
 * The stage's time-lapses and filing pins (`stage-lapse.ts`, `stage-filings.ts`) over a fixture deck.
 */
/*
 * The stage draws into aria-hidden canvases and reads the deck's data-* hooks; nothing it does is
 * perceivable by a person or assistive technology, so its contract is asserted on those hooks and
 * on the calls it makes to the (faked) engine.
 */
/* oxlint-disable dox-test/no-markup-read, dox-test/no-implementation-assert, dox-test/no-class-query, testing-library/no-node-access */
import { Temporal } from "@js-temporal/polyfill";
import { pick, recordLapses, textOf } from "~/test/deck-events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installJsdomShims, stubReducedMotion } from "~/test/jsdom-shims";
import {
  fixture,
  NOW,
  readyEngine,
  resetFakes,
  type FakeEngine,
} from "~/test/stage-fixture";
import { STAGE } from "~/slides/give-me-temporal/stage-data";
import { loadDeckGmt } from "./gmt-loader";
import { moonCameraPoint } from "./places";
import { mountSpaceStage, type SpaceStage } from "./stage";

installJsdomShims();

vi.mock("~/lib/globe/engine", async () =>
  (await import("~/test/stage-fixture")).engineMock(),
);
vi.mock("./ice-wall/wall", async () =>
  (await import("~/test/stage-fixture")).wallMock(),
);
vi.mock("./gmt-loader", async (original) =>
  (await import("~/test/stage-fixture")).gmtLoaderMock(await original()),
);
vi.mock("./title-clock", async () =>
  (await import("~/test/stage-fixture")).titleClockMock(),
);
vi.mock("~/lib/globe/globe-theme", async () =>
  (await import("~/test/stage-fixture")).themeMock(),
);
vi.mock("~/lib/space-sky", async () =>
  (await import("~/test/stage-fixture")).skyMock(),
);

let abort: AbortController;
let root: HTMLElement;
let stage: SpaceStage | undefined;
const ready = (): Promise<FakeEngine> => readyEngine(root);

beforeEach(() => {
  resetFakes();
  abort = new AbortController();
  root = fixture();
});

afterEach(() => {
  stage?.destroy();
  stage = undefined;
  abort.abort();
  root.remove();
  vi.restoreAllMocks();
});

describe("the globe's time and pins", () => {
  describe("time moving under a held camera", () => {
    const reduce = (): (() => void) => stubReducedMotion(true);

    it("moves the sun and dates the zone's pin from gmt, then stops with the lapse", async () => {
      const undo = reduce();
      try {
        // The lapse reads gmt from five modules loaded on first use. Loading them here keeps that
        // cold import, slow on a busy worker, out of the wait below, which then times the stage.
        await loadDeckGmt();
        const events = recordLapses(root);
        stage = mountSpaceStage(root, { signal: abort.signal, data: STAGE });
        const fake = await ready();
        await vi.waitFor(() => {
          stage!.lapse("tehran");
          expect(events.length).toBeGreaterThan(0);
        });
        expect(events.at(-1)!.name).toBe("tehran");
        expect(events.at(-1)!.dates["Asia/Tehran"]).toMatch(
          /^\d{4}-\d\d-\d\d$/,
        );
        const sun = (fake.options["sunInstant"] as () => number)();
        expect(sun).not.toBe(NOW);
        const host = root.querySelector("[data-deck-space]")!;
        expect(host).toHaveAttribute("data-lapse", "tehran");
        stage.lapse(null);
        expect(host).not.toHaveAttribute("data-lapse");
        expect((fake.options["sunInstant"] as () => number)()).toBe(NOW);
      } finally {
        undo();
      }
    });

    it("aims the Moon at the instant the slide's lapse stops on", async () => {
      root.querySelector("[data-deck-stage]")!.insertAdjacentHTML(
        "beforeend",
        `<section data-slide data-place="planet"><h2>Four</h2>
          <div data-build="2" data-place="moon" data-lapse="newmoon">m</div></section>`,
      );
      stage = mountSpaceStage(root, { signal: abort.signal, data: STAGE });
      const fake = await ready();
      const end = Temporal.Instant.from(
        "2027-02-06T15:56:00Z",
      ).epochMilliseconds;
      stage.goTo("moon", { at: { slide: 3, build: 2 } });
      const aimed = fake.flyTo.mock.calls.at(-1)![0] as [number, number];
      const point = moonCameraPoint(end);
      expect(aimed[0]).toBeCloseTo(-point[0], 6);
      expect(aimed[1]).toBeCloseTo(-point[1], 6);
    });

    it("glides the sun back to now when the lapse ends, never cutting", async () => {
      await loadDeckGmt();
      const frames: ((stamp: number) => void)[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        frames.push(cb);
        return frames.length;
      });
      stage = mountSpaceStage(root, { signal: abort.signal, data: STAGE });
      const fake = await ready();
      const sun = fake.options["sunInstant"] as () => number;
      await vi.waitFor(() => {
        stage!.lapse("newmoon");
        expect(root.querySelector("[data-deck-space]")).toHaveAttribute(
          "data-lapse",
          "newmoon",
        );
      });
      // The sun glides from now into the lapse, then the lapse plays to the new moon and holds.
      expect(sun()).toBe(NOW);
      const play = (until: number): void => {
        for (let stamp = 16; frames.length > 0 && stamp <= until; stamp += 16)
          frames.splice(0).forEach((cb) => cb(stamp));
      };
      play(10_000);
      const held = sun();
      expect(held).toBe(
        Temporal.Instant.from("2027-02-06T15:56:00Z").epochMilliseconds,
      );
      stage.lapse(null);
      // The first frame stands where the lapse left the sun, then the sun eases back to now.
      expect(sun()).toBe(held);
      play(1000);
      expect(sun()).not.toBe(held);
      expect(sun()).not.toBe(NOW);
      play(10_000);
      expect(sun()).toBe(NOW);
    });

    it("carries the sun on into the next day-long lapse, forward or back, never back to now", async () => {
      await loadDeckGmt();
      const frames: ((stamp: number) => void)[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        frames.push(cb);
        return frames.length;
      });
      stage = mountSpaceStage(root, { signal: abort.signal, data: STAGE });
      const fake = await ready();
      const sun = fake.options["sunInstant"] as () => number;
      let stamp = 0;
      const play = (forMs: number): void => {
        const until = stamp + forMs;
        while (frames.length > 0 && stamp < until) {
          stamp += 16;
          frames.splice(0).forEach((cb) => cb(stamp));
        }
      };
      await vi.waitFor(() => {
        stage!.lapse("tehran");
        expect(root.querySelector("[data-deck-space]")).toHaveAttribute(
          "data-lapse",
          "tehran",
        );
      });
      // The glide from the test's fixed now onto gmt's settles first.
      play(2_000);
      const start = sun();
      // A step part way through: the next lapse starts where the sun stands, still moving on.
      play(6_000);
      const before = sun();
      expect(before).toBeGreaterThan(start);
      stage.lapse("tokyo");
      expect(sun()).toBe(before);
      play(48);
      const next = sun();
      expect(next).toBeGreaterThan(before);
      // Back again: Tehran's day carries on from there too.
      play(4_000);
      const back = sun();
      stage.lapse("tehran");
      expect(sun()).toBe(back);
      play(48);
      expect(sun()).toBeGreaterThan(back);
    });

    it("ignores a lapse name it does not know", async () => {
      stage = mountSpaceStage(root, { signal: abort.signal, data: STAGE });
      const fake = await ready();
      stage.lapse("nonsense");
      expect((fake.options["sunInstant"] as () => number)()).toBe(NOW);
    });
  });

  describe("the filings' pins", () => {
    it("counts up to the total and lights a pin at each named zone", async () => {
      const undo = stubReducedMotion(true);
      try {
        root.insertAdjacentHTML(
          "beforeend",
          `<div data-filing-steps="a|Asia/Manila;b|;c|Asia/Tokyo"><output data-filing-count>3</output></div>`,
        );
        stage = mountSpaceStage(root, { signal: abort.signal, data: STAGE });
        const fake = await ready();
        stage.pinFilings(true);
        const out = pick(root, "[data-filing-count]")!;
        await vi.waitFor(() => expect(textOf(out)).toBe("3"));
        const labels = fake.setMarkers.mock.calls
          .at(-1)![0]
          .map((m: { label?: string }) => m.label)
          .filter(Boolean);
        expect(labels).toEqual(expect.arrayContaining(["Manila 1", "Tokyo 1"]));
        stage.pinFilings(false);
        expect(textOf(out)).toBe("3");
      } finally {
        undo();
      }
    });
  });
});
