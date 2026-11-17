/**
 * @vitest-environment jsdom
 */
/* oxlint-disable dox-test/no-house-class -- the pager is told from the sky's layers by the page's own class, so the fixture must carry it */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { raw, setHtml } from "~/widgets/builders";

const cue = vi.fn();
vi.mock("./cue", () => ({
  cue: (name: string, rank?: number) => cue(name, rank),
}));

import { entranceSounds } from "./entrance";

const root = document.documentElement;
let frames: FrameRequestCallback[] = [];
let stop: () => void = () => {};

/** Run the animation-frame callbacks the page asked for, as the browser does after the frame's events. */
function frame() {
  const due = frames;
  frames = [];
  for (const callback of due) callback(0);
}

/**
 * The browser's `animationstart` for `name` on the element `selector` finds. jsdom runs no CSS
 * animations, so the event the browser would fire is the test's input.
 */
function started(selector: string, name: string) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`no ${selector}`);
  const init = { bubbles: true };
  // oxlint-disable-next-line dox-test/no-dispatch-event -- jsdom runs no CSS animations; the browser's animationstart is this module's only input
  const event = new Event("animationstart", init);
  // oxlint-disable-next-line dox-test/no-dispatch-event -- as above
  el.dispatchEvent(Object.assign(event, { animationName: name }));
}

beforeEach(() => {
  cue.mockClear();
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
  }));
  root.dataset["entrance"] = "run";
  setHtml(
    document.body,
    raw(`
      <a href="/" id="title">GMT</a>
      <a href="/a/" id="button">A</a>
      <nav class="gmt-hero-pager" aria-label="Pages">Pages</nav>
      <div id="stars"></div>
      <section data-page data-motion="load" aria-label="First">First</section>
      <section data-page data-motion="in" aria-label="Second">Second</section>`),
  );
});

afterEach(() => {
  stop();
  stop = () => {};
  delete root.dataset["entrance"];
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("the entrance's sounds", () => {
  it("whispers as a piece freezes in, once for everything that starts in the same frame", () => {
    stop = entranceSounds(root);
    started("#title", "ng-freeze");
    expect(cue).not.toHaveBeenCalled();
    frame();
    // A button's pane and its frost start together: one whisper.
    started("#button", "ng-freeze-pane");
    started("#button", "ng-frost");
    frame();
    expect(cue.mock.calls).toEqual([
      ["paint", undefined],
      ["paint", undefined],
    ]);
  });

  it("shings on each glint, each a rank higher, and once for glints that cross together", () => {
    stop = entranceSounds(root);
    started("#title", "ng-glint");
    frame();
    started("#title", "ng-glint");
    started("#button", "ng-glint");
    frame();
    started("#button", "ng-glint");
    frame();
    expect(cue.mock.calls).toEqual([
      ["glint", 0],
      ["glint", 1],
      ["glint", 2],
    ]);
  });

  it("plays a whisper and a shing that land in the same frame", () => {
    stop = entranceSounds(root);
    started("#title", "ng-glint");
    started("#button", "ng-pop");
    frame();
    expect(cue.mock.calls).toEqual([
      ["paint", undefined],
      ["glint", 0],
    ]);
  });

  it("hears the pager's fade and the first panel's flight, not the sky's fade or a later page turn", () => {
    stop = entranceSounds(root);
    started("#stars", "ng-fade");
    started('[data-motion="in"]', "ng-freeze-fly-left");
    frame();
    expect(cue).not.toHaveBeenCalled();
    started(".gmt-hero-pager", "ng-fade");
    frame();
    started('[data-motion="load"]', "ng-freeze-fly-left");
    frame();
    expect(cue.mock.calls.map(([name]) => name)).toEqual(["paint", "paint"]);
  });

  it("is silent for the copy, even when the tagline's delayed freeze starts after `run`", () => {
    stop = entranceSounds(root);
    started("#title", "ng-freeze-text");
    started("#title", "ng-sweep-text");
    frame();
    expect(cue).not.toHaveBeenCalled();
  });

  it("leaves the chips' colour shine to their glint", () => {
    stop = entranceSounds(root);
    started("#title", "ng-shine");
    started("#title", "ng-shine-in");
    frame();
    expect(cue).not.toHaveBeenCalled();
  });

  it("is silent once the entrance has ended", () => {
    stop = entranceSounds(root);
    root.dataset["entrance"] = "done";
    started("#title", "ng-pop");
    frame();
    expect(cue).not.toHaveBeenCalled();
  });

  it("stops listening, and drops a frame's sounds not yet played, when stopped", () => {
    stop = entranceSounds(root);
    started("#title", "ng-freeze");
    stop();
    frame();
    started("#title", "ng-freeze");
    frame();
    expect(cue).not.toHaveBeenCalled();
  });

  it("is silent under reduced motion, which swaps the freeze for a fade", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
    }));
    stop = entranceSounds(root);
    started(".gmt-hero-pager", "ng-fade");
    started("#title", "ng-freeze");
    frame();
    expect(cue).not.toHaveBeenCalled();
  });
});
