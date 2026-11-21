/** @vitest-environment jsdom */
import { screen } from "@testing-library/dom";
import { installJsdomShims } from "~/test/jsdom-shims";
import { html, setHtml } from "~/widgets/builders";
import { mountBugVisuals } from "./bug-visuals";
import { writeDeckState } from "./deck-state";
import {
  dataOf,
  pick,
  pickAll,
  sendDeckState,
  sendLapse,
  sendStageBusy,
  textOf,
} from "~/test/deck-events";

installJsdomShims();

let abort: AbortController;
let root: HTMLElement;

/** A `matchMedia` that answers every query with `matches`. */
const media = (matches: boolean) =>
  (() => ({ matches })) as unknown as Window["matchMedia"];

const win = {
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  matchMedia: media(true),
};

const go = (id: string, build: number): void => sendDeckState(root, id, build);

/** Mounts with motion allowed; returns the frame callbacks the visuals asked for, to run by hand. */
const mountWithMotion = (): Array<(stamp: number) => void> => {
  const frames: Array<(stamp: number) => void> = [];
  mountBugVisuals(root, {
    signal: abort.signal,
    win: {
      requestAnimationFrame: (cb) => frames.push(cb),
      cancelAnimationFrame: () => {},
      matchMedia: media(false),
    },
  });
  return frames;
};

beforeEach(() => {
  abort = new AbortController();
  root = document.createElement("div");
  setHtml(
    root,
    html`
      <section data-slide id="abort">
        <div data-visual="run">
          <span data-type data-text="node -e boom"></span>
          <p data-after>Node stops the whole process.</p>
        </div>
      </section>
      <section data-slide id="years">
        <div data-visual="run">
          <span data-roll data-end="2124-03-20"></span>
          <span data-roll data-end="2124-03-21"></span>
        </div>
      </section>
      <section data-slide id="manila">
        <ol data-visual="pages" data-zone="Asia/Manila">
          <li data-page data-date="1844-12-30" data-gap="false">30</li>
          <li data-page data-date="1844-12-31" data-gap="true">31</li>
          <li data-page data-date="1845-01-01" data-gap="false">1</li>
        </ol>
      </section>
    `,
  );
  document.body.append(root);
});

afterEach(() => {
  abort.abort();
  root.remove();
});

const pages = (): Array<string | undefined> =>
  pickAll(root, "[data-page]").map((p) => dataOf(p, "state"));

describe("a visual that arrives while the stage's motion runs", () => {
  const typed = (): string => textOf(pick(root, "#abort [data-type]"));

  it("starts only once the stage is idle, then plays", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    sendStageBusy(root, true);
    go("abort", 0);
    expect(typed()).toBe("");
    sendStageBusy(root, false);
    expect(typed()).toBe("node -e boom");
  });

  it("does not start for a slide the deck has left before the stage is idle", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    sendStageBusy(root, true);
    go("abort", 0);
    go("years", 0);
    sendStageBusy(root, false);
    expect(typed()).toBe("");
  });
});

describe("the bug visuals", () => {
  it("hides the process's answer until its slide is reached, then shows it", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    expect(
      screen.queryByText("Node stops the whole process."),
    ).not.toBeVisible();
    go("abort", 0);
    expect(screen.getByText("Node stops the whole process.")).toBeVisible();
    expect(textOf(pick(root, "[data-type]"))).toBe("node -e boom");
  });

  it("resets a visual when its slide is left", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    go("abort", 0);
    go("years", 0);
    expect(textOf(pick(root, "[data-type]"))).toBe("");
    expect(pickAll(root, "[data-roll]").map((r) => textOf(r))).toEqual([
      "2124-03-20",
      "2124-03-21",
    ]);
  });

  it("types the code before its answer shows, and lands each roll in turn", () => {
    const frames = mountWithMotion();
    const flush = (until: () => boolean): void => {
      for (let stamp = 0; !until() && frames.length > 0; stamp += 1000)
        for (const f of frames.splice(0)) f(stamp);
    };
    const answer = screen.getByText("Node stops the whole process.");
    const run = pick(root, "#abort [data-visual]")!;
    go("abort", 0);
    expect(dataOf(pick(run, "[data-type]"), "typing")).toBe("true");
    expect(answer).not.toBeVisible();
    flush(() => dataOf(run, "ended") === "true");
    expect(textOf(pick(run, "[data-type]"))).toBe("node -e boom");
    expect(answer).toBeVisible();

    go("years", 0);
    const rolls = pickAll(root, "#years [data-roll]");
    flush(() => dataOf(rolls[0]!, "landed") === "true");
    expect(rolls.map((r) => dataOf(r, "landed"))).toEqual(["true", undefined]);
    flush(() => dataOf(rolls[1]!, "landed") === "true");
    expect(rolls.map((r) => textOf(r))).toEqual(["2124-03-20", "2124-03-21"]);
  });

  it("lands both counters on their values", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    go("years", 0);
    expect(pickAll(root, "[data-roll]").map((r) => textOf(r))).toEqual([
      "2124-03-20",
      "2124-03-21",
    ]);
  });

  it("starts from a deck already on the slide when it mounts", () => {
    writeDeckState(root, { id: "years", build: 0 });
    mountBugVisuals(root, { signal: abort.signal, win });
    expect(pickAll(root, "[data-roll]").map((r) => textOf(r))).toEqual([
      "2124-03-20",
      "2124-03-21",
    ]);
  });

  it("turns the skipped page over as the zone's date crosses it", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    go("manila", 0);
    const lapse = (date: string): void => {
      sendLapse(root, { dates: { "Asia/Manila": date } });
    };
    lapse("1844-12-30");
    expect(pages()).toEqual(["current", "future", "future"]);
    lapse("1845-01-01");
    expect(pages()).toEqual(["past", "dropped", "current"]);
  });

  it("ignores a lapse for a visual that is not on screen", () => {
    mountBugVisuals(root, { signal: abort.signal, win });
    go("abort", 0);
    sendLapse(root, { dates: { "Asia/Manila": "1845-01-01" } });
    expect(pages()).toEqual(["future", "future", "future"]);
  });
});
