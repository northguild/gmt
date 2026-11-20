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
import { describe, expect, it, vi } from "vitest";
import { installJsdomShims, stubReducedMotion } from "~/test/jsdom-shims";
import { NOW, stageHarness } from "~/test/stage-fixture";
import { FIXTURE_STAGE as STAGE } from "~/test/deck-stage-fixture";
import { loadDeckGmt } from "./gmt-loader";
import { moonCameraPoint } from "./places";
import { mountSpaceStage } from "./stage";

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

const h = stageHarness((root, signal) =>
  mountSpaceStage(root, { signal, data: STAGE }),
);

/**
 * Takes the frame loop over: the returned `play(forMs)` runs the queued frames, 16 ms apart, for
 * that long.
 */
function heldFrames(): (forMs: number) => void {
  const frames: ((stamp: number) => void)[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    frames.push(cb);
    return frames.length;
  });
  let stamp = 0;
  return (forMs) => {
    const until = stamp + forMs;
    while (frames.length > 0 && stamp < until) {
      stamp += 16;
      frames.splice(0).forEach((cb) => cb(stamp));
    }
  };
}

/**
 * Mounts the stage with the frame loop held and starts the named lapse: `play` runs the frames,
 * `sun` reads the instant the globe lights.
 */
async function heldLapse(
  name: string,
): Promise<{ play: (forMs: number) => void; sun: () => number }> {
  await loadDeckGmt();
  const play = heldFrames();
  h.mount();
  const fake = await h.ready();
  const sun = fake.options["sunInstant"] as () => number;
  await vi.waitFor(() => {
    h.stage.lapse(name);
    expect(h.root.querySelector("[data-deck-space]")).toHaveAttribute(
      "data-lapse",
      name,
    );
  });
  return { play, sun };
}

describe("the globe's time and pins", () => {
  describe("time moving under a held camera", () => {
    const reduce = (): (() => void) => stubReducedMotion(true);

    it("moves the sun and dates the zone's pin from gmt, then stops with the lapse", async () => {
      const undo = reduce();
      try {
        // The lapse reads gmt from five modules loaded on first use. Loading them here keeps that
        // cold import, slow on a busy worker, out of the wait below, which then times the h.stage.
        await loadDeckGmt();
        const events = recordLapses(h.root);
        h.mount();
        const fake = await h.ready();
        await vi.waitFor(() => {
          h.stage.lapse("open");
          expect(events.length).toBeGreaterThan(0);
        });
        expect(events.at(-1)!.name).toBe("open");
        expect(events.at(-1)!.dates["Asia/Tehran"]).toMatch(
          /^\d{4}-\d\d-\d\d$/,
        );
        const sun = (fake.options["sunInstant"] as () => number)();
        expect(sun).not.toBe(NOW);
        const host = h.root.querySelector("[data-deck-space]")!;
        expect(host).toHaveAttribute("data-lapse", "open");
        h.stage.lapse(null);
        expect(host).not.toHaveAttribute("data-lapse");
        expect((fake.options["sunInstant"] as () => number)()).toBe(NOW);
      } finally {
        undo();
      }
    });

    it("aims the Moon at the instant the slide's lapse stops on", async () => {
      h.root.querySelector("[data-deck-stage]")!.insertAdjacentHTML(
        "beforeend",
        `<section data-slide data-place="planet"><h2>Four</h2>
          <div data-build="2" data-place="moon" data-lapse="ends">m</div></section>`,
      );
      h.mount();
      const fake = await h.ready();
      const end = Temporal.Instant.from(
        "2027-02-06T15:56:00Z",
      ).epochMilliseconds;
      h.stage.goTo("moon", { at: { slide: 3, build: 2 } });
      const aimed = fake.flyTo.mock.calls.at(-1)![0] as [number, number];
      const point = moonCameraPoint(end);
      expect(aimed[0]).toBeCloseTo(-point[0], 6);
      expect(aimed[1]).toBeCloseTo(-point[1], 6);
    });

    it("glides the sun back to now when the lapse ends, never cutting", async () => {
      const { play, sun } = await heldLapse("ends");
      // The sun glides from now into the lapse, then the lapse plays to its end and holds.
      expect(sun()).toBe(NOW);
      play(30_000);
      const held = sun();
      expect(held).toBe(
        Temporal.Instant.from("2027-02-06T15:56:00Z").epochMilliseconds,
      );
      h.stage.lapse(null);
      // The first frame stands where the lapse left the sun, then the sun eases back to now.
      expect(sun()).toBe(held);
      play(1000);
      expect(sun()).not.toBe(held);
      expect(sun()).not.toBe(NOW);
      play(10_000);
      expect(sun()).toBe(NOW);
    });

    it("carries the sun on into the next day-long lapse, forward or back, never back to now", async () => {
      const { play, sun } = await heldLapse("open");
      // The glide from the test's fixed now onto gmt's settles first.
      play(2_000);
      const start = sun();
      // A step part way through: the next lapse starts where the sun stands, still moving on.
      play(6_000);
      const before = sun();
      expect(before).toBeGreaterThan(start);
      h.stage.lapse("plain");
      expect(sun()).toBe(before);
      play(48);
      const next = sun();
      expect(next).toBeGreaterThan(before);
      // Back again: Tehran's day carries on from there too.
      play(4_000);
      const back = sun();
      h.stage.lapse("open");
      expect(sun()).toBe(back);
      play(48);
      expect(sun()).toBeGreaterThan(back);
    });

    it("ignores a lapse name it does not know", async () => {
      h.mount();
      const fake = await h.ready();
      h.stage.lapse("nonsense");
      expect((fake.options["sunInstant"] as () => number)()).toBe(NOW);
    });
  });

  describe("the filings' pins", () => {
    it("counts up to the total and lights a pin at each named zone", async () => {
      const undo = stubReducedMotion(true);
      try {
        h.root.insertAdjacentHTML(
          "beforeend",
          `<div data-filing-steps="a|Asia/Manila;b|;c|Asia/Tokyo"><output data-filing-count>3</output></div>`,
        );
        h.mount();
        const fake = await h.ready();
        h.stage.pinFilings(true);
        const out = pick(h.root, "[data-filing-count]")!;
        await vi.waitFor(() => expect(textOf(out)).toBe("3"));
        const labels = fake.setMarkers.mock.calls
          .at(-1)![0]
          .map((m: { label?: string }) => m.label)
          .filter(Boolean);
        expect(labels).toEqual(expect.arrayContaining(["Manila 1", "Tokyo 1"]));
        h.stage.pinFilings(false);
        expect(textOf(out)).toBe("3");
      } finally {
        undo();
      }
    });
  });
});
