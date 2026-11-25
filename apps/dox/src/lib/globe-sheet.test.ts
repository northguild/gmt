// @vitest-environment jsdom
import { cardBand, followViewport, SHEET_BOTTOM } from "./globe-sheet";

/** A stand-in for `window.visualViewport`: the three numbers read, and listeners that honour a signal. */
class FakeViewport {
  height = 800;
  offsetTop = 0;
  scale = 1;
  #listeners = new Set<() => void>();
  addEventListener(
    _type: string,
    listener: () => void,
    options: { signal: AbortSignal },
  ): void {
    this.#listeners.add(listener);
    options.signal.addEventListener("abort", () =>
      this.#listeners.delete(listener),
    );
  }
  /** The browser reports a resize or a scroll. */
  emit(): void {
    for (const listener of this.#listeners) listener();
  }
}

let viewport: FakeViewport;
let ctl: AbortController;
let frames: (() => void)[];
const sheet = document.createElement("div");
// oxlint-disable-next-line dox-test/no-implementation-assert -- the custom property is this module's whole output; the browser gates see its effect
const written = () => getComputedStyle(sheet).getPropertyValue(SHEET_BOTTOM);
/** Runs the frames asked for so far, as the browser's next frame does. */
const flush = () => {
  const due = frames.splice(0);
  for (const frame of due) frame();
};

beforeEach(() => {
  viewport = new FakeViewport();
  ctl = new AbortController();
  frames = [];
  sheet.setAttribute("style", "");
  Object.defineProperty(window, "visualViewport", {
    value: viewport,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    value: 800,
    configurable: true,
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(() => callback(0));
    return frames.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  document.body.append(sheet);
});

afterEach(() => {
  ctl.abort();
  sheet.remove();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "visualViewport");
  Reflect.deleteProperty(document.documentElement, "clientHeight");
});

describe("followViewport", () => {
  it("starts at the gap there is and writes once per frame however many events come", () => {
    followViewport(sheet, ctl.signal);
    expect(written()).toBe("0px");

    viewport.height = 500;
    viewport.emit();
    viewport.emit();
    viewport.offsetTop = 20;
    viewport.emit();
    const set = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty");
    expect(written()).toBe("0px");
    expect(frames).toHaveLength(1);

    flush();
    expect(set).toHaveBeenCalledTimes(1);
    expect(written()).toBe("280px");

    viewport.emit();
    flush();
    expect(set).toHaveBeenCalledTimes(2);
  });

  it("writes nothing for a pinched-in page, which is not a keyboard", () => {
    followViewport(sheet, ctl.signal);
    viewport.height = 300;
    viewport.scale = 2;
    viewport.emit();
    flush();
    expect(written()).toBe("0px");
  });

  it("stops listening when its signal aborts, and a later event writes nothing", () => {
    followViewport(sheet, ctl.signal);
    viewport.height = 500;
    viewport.emit();
    ctl.abort();
    flush();
    expect(written()).toBe("0px");

    viewport.emit();
    viewport.emit();
    flush();
    expect(frames).toHaveLength(0);
    expect(written()).toBe("0px");
  });

  it("writes nothing and does not throw without a visual viewport", () => {
    Reflect.deleteProperty(window, "visualViewport");
    expect(() => followViewport(sheet, ctl.signal)).not.toThrow();
    expect(written()).toBe("");
  });
});

describe("cardBand", () => {
  /** An element whose box starts at `top` in the viewport. */
  const at = <T extends Element>(el: T, top: number): T => {
    el.getBoundingClientRect = () => ({ top }) as DOMRect;
    return el;
  };

  it("runs from the stage's top to the open sheet's top, in host pixels", () => {
    const sheet = at(document.createElement("div"), 520);
    sheet.setAttribute("role", "region");
    const drawer = document.createElement("div");
    drawer.dataset["open"] = "true";
    drawer.append(sheet);
    const host = at(document.createElement("div"), -200);
    const stage = at(document.createElement("div"), 300);
    expect(cardBand(stage, drawer, host)).toEqual({ top: 500, bottom: 720 });
    drawer.dataset["open"] = "false";
    expect(cardBand(stage, drawer, host)).toEqual({ top: 500, bottom: null });
    expect(cardBand(stage, null, host)).toEqual({ top: 500, bottom: null });
  });
});
