/**
 * @vitest-environment jsdom
 */
import { LOCK_RINGS, lockRings, type LockRings } from "./globe-lock";

let el: HTMLElement;
let lock: LockRings;

/** The rings rippling now, in the order they start. */
const rings = (): Element[] => [...el.children];

/** As the browser does when a ring's animation has run its course. */
function finish(ring: Element | undefined): void {
  // oxlint-disable-next-line dox-test/no-dispatch-event -- jsdom runs no animations; this is the end of one
  ring?.dispatchEvent(new Event("animationend", { bubbles: true }));
}

beforeEach(() => {
  el = document.createElement("div");
  el.hidden = true;
  document.body.append(el);
  lock = lockRings(el);
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("the lock's rings", () => {
  it("are one for each ping and each echo heard, as the sound has them, fading with the echoes", () => {
    expect(LOCK_RINGS).toEqual([
      { delayMs: 0, peak: 0.9 },
      { delayMs: 70, peak: 0.9 },
      { delayMs: 190, peak: 0.58 },
      { delayMs: 380, peak: 0.37 },
      { delayMs: 570, peak: 0.16 },
    ]);
  });

  it("ripple from the pin, then clear once the last echo has faded", () => {
    lock.place({ x: 120, y: 80 });
    lock.play();
    expect(el).toBeVisible();
    expect(rings()).toHaveLength(LOCK_RINGS.length);
    for (const ring of rings().slice(0, -1)) finish(ring);
    expect(el).toBeVisible();
    finish(rings().at(-1));
    expect(el).not.toBeVisible();
    expect(rings()).toHaveLength(0);
  });

  it("hide while the pin is out of sight, and show again when it comes back", () => {
    lock.play();
    lock.place(null);
    expect(el).not.toBeVisible();
    lock.place({ x: 10, y: 10 });
    expect(el).toBeVisible();
  });

  it("start over for a new lock, with new rings", () => {
    lock.play();
    const first = rings();
    lock.play();
    expect(rings()).toHaveLength(LOCK_RINGS.length);
    for (const ring of first) expect(rings()).not.toContain(ring);
  });

  it("stop at once when asked", () => {
    lock.play();
    lock.stop();
    expect(el).not.toBeVisible();
    expect(rings()).toHaveLength(0);
  });
});
