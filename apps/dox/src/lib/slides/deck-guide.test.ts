// @vitest-environment jsdom
import { sendBrowserEvent } from "~/test/deck-events";
import { mountDeckGuide } from "./deck-guide";

const controllers: AbortController[] = [];
const restore: (() => void)[] = [];

afterEach(() => {
  for (const c of controllers.splice(0)) c.abort();
  for (const r of restore.splice(0).reverse()) r();
  document.body.replaceChildren();
});

/** Stubs a property on `target` and puts it back in `afterEach`. */
function stub(target: object, key: string, value: unknown): void {
  const before = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  restore.push(() => {
    if (before) Object.defineProperty(target, key, before);
    else Reflect.deleteProperty(target, key);
  });
}

function setup() {
  const el = document.createElement("div");
  el.hidden = true;
  const line = document.createElement("p");
  line.setAttribute("data-guide-size", "");
  el.append(line);
  document.body.append(el);
  const ctl = new AbortController();
  controllers.push(ctl);
  const guide = mountDeckGuide({ el, signal: ctl.signal });
  return { el, ctl, guide, line };
}

describe("the safe-area guide", () => {
  it("shows then hides on toggle", () => {
    const { el, guide } = setup();
    guide.toggle();
    expect(el.hidden).toBe(false);
    guide.toggle();
    expect(el.hidden).toBe(true);
  });

  it("reads the window's size, pixel ratio and fullscreen state", () => {
    stub(window, "innerWidth", 1920);
    stub(window, "innerHeight", 1080);
    stub(window, "devicePixelRatio", 2);
    stub(document, "fullscreenElement", document.body);
    const { guide, line } = setup();
    guide.toggle();
    expect(line).toHaveTextContent("1920 x 1080 CSS px at 2x, fullscreen");
  });

  it("says windowed when nothing is fullscreen", () => {
    stub(document, "fullscreenElement", null);
    stub(window, "devicePixelRatio", 1);
    const { guide, line } = setup();
    guide.toggle();
    expect(line).toHaveTextContent(/ at 1x, windowed$/);
  });

  it("rewrites the line on resize while open, and again after it reopens", () => {
    stub(window, "innerWidth", 1920);
    stub(window, "innerHeight", 1080);
    const { guide, line } = setup();
    guide.toggle();
    stub(window, "innerWidth", 1280);
    sendBrowserEvent(window, "resize");
    expect(line).toHaveTextContent(/^1280 x 1080/);
    guide.toggle();
    guide.toggle();
    stub(window, "innerWidth", 1000);
    sendBrowserEvent(window, "resize");
    expect(line).toHaveTextContent(/^1000 x 1080/);
  });

  it("stops listening once the signal aborts, and a later toggle does nothing", () => {
    stub(window, "innerWidth", 1920);
    const { el, ctl, guide, line } = setup();
    guide.toggle();
    const before = line.textContent ?? "";
    ctl.abort();
    expect(el.hidden).toBe(true);
    stub(window, "innerWidth", 800);
    sendBrowserEvent(window, "resize");
    expect(line).toHaveTextContent(before);
    guide.toggle();
    expect(el.hidden).toBe(true);
  });

  it("does nothing without a layer", () => {
    const ctl = new AbortController();
    controllers.push(ctl);
    expect(() =>
      mountDeckGuide({ el: null, signal: ctl.signal }).toggle(),
    ).not.toThrow();
  });
});
