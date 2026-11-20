/** @vitest-environment jsdom */
/**
 * A stack slides its column up as builds are reached. jsdom lays nothing out, so each piece's
 * place in the column and the slide's box are stated here: a column of three 200px pieces 20px
 * apart (0, 220, 440), and a slide whose foot is `room` px under the stack's top.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sendDeckState } from "~/test/deck-events";
import { mountBuildStacks } from "./build-stack";

function place(el: HTMLElement, top: number, height: number): void {
  Object.defineProperty(el, "offsetTop", { value: top });
  Object.defineProperty(el, "offsetHeight", { value: height });
}

function box(el: HTMLElement, top: number, bottom: number): void {
  el.getBoundingClientRect = () => ({ top, bottom }) as DOMRect;
}

let root: HTMLElement;
let stack: HTMLElement;
let track: HTMLElement;
let builds: HTMLElement[];
let control: AbortController;

/**
 * Gives the column `room` px down to the slide's foot, marks builds 1 and 2 reached up to
 * `build`, as `deck-nav` does, and announces the state.
 */
function step(build: number, room = 400): void {
  box(document.querySelector<HTMLElement>("[data-slide]")!, -100, room);
  builds.forEach((b, i) => {
    b.dataset["reached"] = String(i + 1 <= build);
  });
  sendDeckState(root, "kinds", build);
}

const shift = (): string => track.style.getPropertyValue("--gmt-stack-shift");
const gone = (): boolean[] =>
  Array.from(track.children, (c) => c.hasAttribute("data-stack-gone"));

beforeEach(() => {
  document.body.innerHTML = `
    <div data-deck-root>
      <section data-slide style="padding-block-end: 0px">
        <div data-stack><div data-stack-track>
          <pre></pre>
          <div class="gmt-build"></div>
          <div class="gmt-build"></div>
        </div></div>
      </section>
    </div>`;
  root = document.querySelector<HTMLElement>("[data-deck-root]")!;
  stack = document.querySelector<HTMLElement>("[data-stack]")!;
  track = document.querySelector<HTMLElement>("[data-stack-track]")!;
  const [code, ...rest] = Array.from(track.children) as HTMLElement[];
  builds = rest;
  place(code!, 0, 200);
  place(builds[0]!, 220, 200);
  place(builds[1]!, 440, 200);
  box(stack, 0, 0);
  control = new AbortController();
  mountBuildStacks(root, { signal: control.signal, win: window });
});

afterEach(() => control.abort());

describe("a stack of builds", () => {
  it("stays put while the reached pieces fit above the foot", () => {
    step(0);
    expect(shift()).toBe("0px");
    expect(stack.hasAttribute("data-shifted")).toBe(false);
    expect(gone()).toEqual([false, false, false]);
  });

  it("slides up until the newest reached piece ends at the foot, the one above still shown", () => {
    step(1);
    expect(shift()).toBe("-20px");
    expect(stack.hasAttribute("data-shifted")).toBe(true);
    expect(gone()).toEqual([false, false, false]);
  });

  it("fades a piece more than half gone, the next one cut under the edge", () => {
    step(2);
    expect(shift()).toBe("-240px");
    expect(gone()).toEqual([true, false, false]);
  });

  it("starts the column at the first piece shown when the faded one would leave a gap", () => {
    step(1, 300);
    expect(shift()).toBe("-220px");
    expect(gone()).toEqual([true, false, false]);
    step(2, 300);
    expect(shift()).toBe("-440px");
    expect(gone()).toEqual([true, true, false]);
  });

  it("slides back down when the talk steps back", () => {
    step(2);
    step(0);
    expect(shift()).toBe("0px");
    expect(stack.hasAttribute("data-shifted")).toBe(false);
    expect(gone()).toEqual([false, false, false]);
  });

  it("stops following the deck once its signal aborts", () => {
    control.abort();
    step(2);
    expect(shift()).toBe("");
  });
});
