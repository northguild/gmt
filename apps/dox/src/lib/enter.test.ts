/**
 * @vitest-environment jsdom
 *
 * `enter` / `holdEntrance`: the contract is in the file header of enter.ts.
 * jsdom runs no animations, so the end of one is fired through Testing Library.
 */
import { fireEvent, screen } from "@testing-library/dom";
import { ENTER_CLASS, enter, holdEntrance } from "./enter";

/** jsdom has no AnimationEvent, so Testing Library would drop `animationName`. */
class FakeAnimationEvent extends Event {
  readonly animationName: string;
  constructor(type: string, init: AnimationEventInit = {}) {
    super(type, init);
    this.animationName = init.animationName ?? "";
  }
}

function animationEnd(el: HTMLElement, animationName = ENTER_CLASS): void {
  // oxlint-disable-next-line dox-test/no-dispatch-event -- jsdom runs no animations; this is the end of one
  fireEvent.animationEnd(el, { animationName });
}

function setReducedMotion(matches: boolean): void {
  vi.stubGlobal("AnimationEvent", FakeAnimationEvent);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches } as MediaQueryList),
  );
}

function mountTarget(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "Target");
  document.body.append(el);
  return el;
}

describe("enter", () => {
  let el: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
    el = mountTarget();
  });

  afterEach(() => {
    el.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports the entrance done when its animation ends, not before", () => {
    const onEntered = vi.fn();
    enter(el, { onEntered });
    expect(onEntered).not.toHaveBeenCalled();

    animationEnd(el);
    expect(onEntered).toHaveBeenCalledOnce();
    expect(screen.getByRole("group", { name: "Target" })).toBeVisible();
  });

  it("ignores another animation ending on the element", () => {
    const onEntered = vi.fn();
    enter(el, { onEntered });
    animationEnd(el, "another-animation");
    expect(onEntered).not.toHaveBeenCalled();
  });

  it("finishes on its timer when animationend never comes, and only once", () => {
    const onEntered = vi.fn();
    enter(el, { delayMs: 80, onEntered });
    vi.advanceTimersByTime(80 + 1500);
    expect(onEntered).toHaveBeenCalledOnce();

    animationEnd(el);
    expect(onEntered).toHaveBeenCalledOnce();
  });

  it("enters at once under reduced motion", () => {
    setReducedMotion(true);
    const onEntered = vi.fn();
    enter(el, { onEntered });
    expect(onEntered).toHaveBeenCalledOnce();
  });

  it("does nothing a second time, while playing or after", () => {
    const onEntered = vi.fn();
    enter(el, { onEntered });
    enter(el, { onEntered });
    animationEnd(el);
    enter(el, { onEntered });
    expect(onEntered).toHaveBeenCalledOnce();
  });

  it("works where matchMedia does not exist", () => {
    vi.stubGlobal("matchMedia", undefined);
    const onEntered = vi.fn();
    enter(el, { onEntered });
    vi.advanceTimersByTime(1500);
    expect(onEntered).toHaveBeenCalledOnce();
  });
});

describe("holdEntrance", () => {
  let el: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
    el = mountTarget();
  });

  afterEach(() => {
    el.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plays the entrance only once released", () => {
    const onEntered = vi.fn();
    const release = holdEntrance(el, 5000);
    vi.advanceTimersByTime(1000);
    expect(onEntered).not.toHaveBeenCalled();

    release({ onEntered });
    animationEnd(el);
    expect(onEntered).toHaveBeenCalledOnce();
  });

  it("releases itself when nobody does, so the element is never left hidden", () => {
    holdEntrance(el, 1500);
    vi.advanceTimersByTime(1500);
    // The entrance is already running, so a second one adds nothing.
    const onEntered = vi.fn();
    enter(el, { onEntered });
    vi.advanceTimersByTime(1500);
    expect(onEntered).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Target" })).toBeVisible();
  });

  it("does not hold under reduced motion", () => {
    setReducedMotion(true);
    const onEntered = vi.fn();
    const release = holdEntrance(el);
    release({ onEntered });
    expect(onEntered).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Target" })).toBeVisible();
  });
});
