/** @vitest-environment jsdom */
/**
 * A stack slides its column up as builds are reached. The column in every case is three 200px
 * pieces 20px apart (0, 220, 440): the code, then builds 1 and 2.
 */
import { dataOf, pick, pickAll, sendDeckState } from "~/test/deck-events";
import { html, setHtml } from "~/widgets/builders";
import { mountBuildStacks, stackShift } from "./build-stack";

/** The column with pieces up to `build` reached; the code is always reached. */
const column = (build: number) =>
  [0, 220, 440].map((top, i) => ({ top, height: 200, reached: i <= build }));

describe("how far a stack's column goes up", () => {
  it("stays put while the reached pieces fit above the foot", () => {
    expect(stackShift(column(0), 400)).toEqual({
      shift: 0,
      gone: [false, false, false],
    });
  });

  it("goes up until the newest reached piece ends at the foot, the one above still shown", () => {
    expect(stackShift(column(1), 400)).toEqual({
      shift: 20,
      gone: [false, false, false],
    });
  });

  it("fades a piece more than half gone, the next one cut under the edge", () => {
    expect(stackShift(column(2), 400)).toEqual({
      shift: 240,
      gone: [true, false, false],
    });
  });

  it("starts the column at the first piece shown when the faded one would leave a gap", () => {
    expect(stackShift(column(1), 300)).toEqual({
      shift: 220,
      gone: [true, false, false],
    });
    expect(stackShift(column(2), 300)).toEqual({
      shift: 440,
      gone: [true, true, false],
    });
  });

  it("never goes up when the slide gives it no foot", () => {
    expect(stackShift(column(2), Number.POSITIVE_INFINITY)).toEqual({
      shift: 0,
      gone: [false, false, false],
    });
  });
});

/**
 * jsdom lays nothing out, so each piece's place and the slide's box are stated here: the slide's
 * foot is 400px under the stack's top, which fits the code and build 1 only once the column moves.
 */
function place(el: HTMLElement, top: number, height: number): void {
  Object.defineProperty(el, "offsetTop", { value: top });
  Object.defineProperty(el, "offsetHeight", { value: height });
}

function box(el: HTMLElement, top: number, bottom: number): void {
  el.getBoundingClientRect = () => ({ top, bottom }) as DOMRect;
}

let root: HTMLElement;
let control: AbortController;

/** Marks builds reached up to `build`, as `deck-nav` does, and announces the state. */
function step(build: number): void {
  pickAll(root, "[data-build]").forEach((b, i) => {
    b.dataset["reached"] = String(i + 1 <= build);
  });
  sendDeckState(root, "kinds", build);
}

const shifted = (): boolean =>
  dataOf(pick(root, "[data-stack]"), "shifted") !== undefined;
const gone = (): boolean[] =>
  pickAll(root, "[data-stack-track] > *").map(
    (piece) => dataOf(piece, "stackGone") !== undefined,
  );

beforeEach(() => {
  root = document.createElement("div");
  setHtml(
    root,
    html`
      <section data-slide id="kinds">
        <div data-stack>
          <div data-stack-track>
            <pre></pre>
            <div data-build></div>
            <div data-build></div>
          </div>
        </div>
      </section>
    `,
  );
  pickAll(root, "[data-stack-track] > *").forEach((piece, i) =>
    place(piece, i * 220, 200),
  );
  box(pick(root, "[data-slide]")!, -100, 400);
  box(pick(root, "[data-stack]")!, 0, 0);
  control = new AbortController();
  mountBuildStacks(root, { signal: control.signal, win: window });
});

afterEach(() => control.abort());

describe("a stack of builds on a slide", () => {
  it("marks the stack shifted and the piece gone once the talk reaches the last build", () => {
    step(0);
    expect(shifted()).toBe(false);
    expect(gone()).toEqual([false, false, false]);
    step(2);
    expect(shifted()).toBe(true);
    expect(gone()).toEqual([true, false, false]);
  });

  it("clears the marks when the talk steps back", () => {
    step(2);
    step(0);
    expect(shifted()).toBe(false);
    expect(gone()).toEqual([false, false, false]);
  });

  it("reads nothing for a state on another slide", () => {
    step(2);
    const slide = pick(root, "[data-slide]")!;
    let reads = 0;
    slide.getBoundingClientRect = () => {
      reads += 1;
      return { top: -100, bottom: 400 } as DOMRect;
    };
    sendDeckState(root, "day-off", 3);
    expect(reads).toBe(0);
    expect(shifted()).toBe(true);
  });

  it("stops following the deck once its signal aborts", () => {
    control.abort();
    step(2);
    expect(shifted()).toBe(false);
    expect(gone()).toEqual([false, false, false]);
  });
});
