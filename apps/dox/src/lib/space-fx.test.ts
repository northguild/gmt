// @vitest-environment jsdom
import { mountSpaceFx } from "./space-fx";

const WIDTH = 1000;
const HEIGHT = 600;

/** Every draw call a stub context received, in order. */
interface StubContext {
  calls: string[];
  moves: [number, number][];
  clears: number;
}

function stubContext(canvas: HTMLCanvasElement): StubContext {
  const log: StubContext = { calls: [], moves: [], clears: 0 };
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    clearRect: () => {
      log.clears += 1;
    },
    createLinearGradient: () => gradient,
    beginPath: () => log.calls.push("beginPath"),
    moveTo: (x: number, y: number) => log.moves.push([x, y]),
    lineTo: () => log.calls.push("lineTo"),
    stroke: () => log.calls.push("stroke"),
    fillRect: () => log.calls.push("fillRect"),
  };
  canvas.getContext = (() => ctx) as unknown as typeof canvas.getContext;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: WIDTH,
    bottom: HEIGHT,
    width: WIDTH,
    height: HEIGHT,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return log;
}

const rect = (left: number, top: number, right: number, bottom: number) =>
  ({
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  }) as DOMRect;

/** A media query the test can flip. */
class Query extends EventTarget {
  matches = false;
  set(matches: boolean): void {
    this.matches = matches;
    // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action changes visibility or a media query; the event is the input
    this.dispatchEvent(new Event("change"));
  }
}

/** The observer the code under test made, so a test can say the hero left the screen. */
class Watcher {
  static last: Watcher | undefined;
  disconnected = false;
  constructor(private readonly callback: IntersectionObserverCallback) {
    Watcher.last = this;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  show(isIntersecting: boolean): void {
    /* A real observer reports nothing after it is disconnected. */
    if (this.disconnected) return;
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

/** `random` that returns the queued values first, then 0.5. */
function scripted(...queue: number[]): {
  random: () => number;
  calls: () => number;
} {
  let calls = 0;
  return {
    random: () => {
      calls += 1;
      return queue.shift() ?? 0.5;
    },
    calls: () => calls,
  };
}

const WAIT = -Math.log(0.5) * 45_000;
const FIRST = Math.round(WAIT + 8_000);

let controller: AbortController;
let canvas: HTMLCanvasElement;
let log: StubContext;
let reduced: Query;
let frames: ReturnType<typeof vi.spyOn>;
let hidden = false;

function mount(random: () => number, avoid: () => DOMRect[] = () => []): void {
  mountSpaceFx({
    canvas,
    signal: controller.signal,
    avoid,
    random,
    now: () => performance.now(),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  controller = new AbortController();
  canvas = document.createElement("canvas");
  document.body.append(canvas);
  log = stubContext(canvas);
  reduced = new Query();
  hidden = false;
  vi.stubGlobal("matchMedia", () => reduced);
  vi.stubGlobal("IntersectionObserver", Watcher);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  frames = vi.spyOn(globalThis, "requestAnimationFrame");
});

afterEach(() => {
  controller.abort();
  delete (document as { hidden?: boolean }).hidden;
  Watcher.last = undefined;
  vi.useRealTimers();
});

describe("when a meteor falls", () => {
  it("waits the mean 45 s plus 8 s for the first, then the plain wait for the next", () => {
    mount(scripted(0.5).random);
    vi.advanceTimersByTime(FIRST - 100);
    expect(frames).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(frames).toHaveBeenCalled();
    expect(Math.round(WAIT + 8_000)).toBe(39_192);

    /* The meteor lives 450 ms; the next wait starts when it ends. */
    vi.advanceTimersByTime(1_000);
    frames.mockClear();
    vi.advanceTimersByTime(Math.round(WAIT) - 1_000 - 100);
    expect(frames).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(frames).toHaveBeenCalled();
  });

  it("holds each wait between 20 and 120 s", () => {
    mount(scripted(0.999999).random);
    vi.advanceTimersByTime(120_000 + 8_000 - 100);
    expect(frames).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(frames).toHaveBeenCalled();
  });

  it("never waits less than 20 s, however small the draw", () => {
    mount(scripted(0).random);
    vi.advanceTimersByTime(20_000 + 8_000 - 100);
    expect(frames).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(frames).toHaveBeenCalled();
  });
});

describe("frames", () => {
  it("are requested only while a meteor lives, and the canvas is clear after", () => {
    mount(scripted(0.5).random);
    vi.advanceTimersByTime(FIRST - 10);
    expect(frames).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(12);
    expect(frames).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    expect(frames.mock.calls.length).toBeGreaterThan(5);

    vi.advanceTimersByTime(1_000);
    const after = frames.mock.calls.length;
    const clears = log.clears;
    vi.advanceTimersByTime(10_000);
    expect(frames).toHaveBeenCalledTimes(after);
    expect(log.clears).toBe(clears);
    /* Only the timer for the next meteor is left. */
    expect(vi.getTimerCount()).toBe(1);
  });

  it("draw a streak that starts at the head and fades to the tail", () => {
    mount(scripted(0.5).random);
    vi.advanceTimersByTime(FIRST + 200);
    expect(log.calls).toContain("stroke");
    expect(log.calls).toContain("fillRect");
  });
});

describe("placement", () => {
  it("rejects a path that crosses an avoided box and takes the next start point", () => {
    /* The wait, then per try: length, slope, side, x, y, life. */
    const script = scripted(
      0.5,
      0.5,
      0.5,
      0.9,
      0.5,
      0.5,
      0.5,
      0.5,
      0.5,
      0.9,
      0.1,
      0.1,
      0.5,
    );
    mount(script.random, () => [rect(480, 280, 520, 320)]);
    vi.advanceTimersByTime(FIRST + 100);
    expect(frames).toHaveBeenCalled();
    const [x, y] = log.moves[0] ?? [Number.NaN, Number.NaN];
    expect(x).toBeGreaterThan(90);
    expect(x).toBeLessThan(260);
    expect(y).toBeGreaterThan(50);
    expect(y).toBeLessThan(150);
  });

  it("gives up after 8 tries and spawns nothing", () => {
    const script = scripted();
    const avoid = vi.fn(() => [rect(-10, -10, WIDTH + 10, HEIGHT + 10)]);
    mount(script.random, avoid);
    vi.advanceTimersByTime(FIRST + 100);
    expect(avoid).toHaveBeenCalledTimes(1);
    /* One for the first wait, six for each of the 8 tries, one for the next wait. */
    expect(script.calls()).toBe(1 + 8 * 6 + 1);
    expect(frames).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("keeps the whole streak on the canvas", () => {
    /* A start at the right edge, heading right, cannot fit: the next try, near the left, does. */
    const script = scripted(
      0.5,
      0.5,
      0.5,
      0.9,
      0.999,
      0.5,
      0.5,
      0.5,
      0.5,
      0.9,
      0.1,
      0.5,
      0.5,
    );
    mount(script.random);
    vi.advanceTimersByTime(FIRST + 100);
    expect(log.moves[0]?.[0]).toBeLessThan(300);
  });
});

describe("when nobody would see it", () => {
  it("spawns nothing under reduced motion", () => {
    reduced.matches = true;
    mount(scripted().random);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(600_000);
    expect(frames).not.toHaveBeenCalled();
  });

  it("stops the wait when reduced motion turns on, and restarts it when it turns off", () => {
    mount(scripted().random);
    expect(vi.getTimerCount()).toBe(1);
    reduced.set(true);
    expect(vi.getTimerCount()).toBe(0);
    reduced.set(false);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("ends a live meteor and clears the canvas when reduced motion turns on", () => {
    mount(scripted().random);
    vi.advanceTimersByTime(FIRST + 100);
    expect(frames).toHaveBeenCalled();
    const clears = log.clears;
    reduced.set(true);
    expect(log.clears).toBeGreaterThan(clears);
    frames.mockClear();
    vi.advanceTimersByTime(5_000);
    expect(frames).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("spawns nothing while the tab is hidden, and waits again when it returns", () => {
    hidden = true;
    mount(scripted().random);
    vi.advanceTimersByTime(600_000);
    expect(frames).not.toHaveBeenCalled();
    hidden = false;
    // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action changes visibility or a media query; the event is the input
    document.dispatchEvent(new Event("visibilitychange"));
    expect(vi.getTimerCount()).toBe(1);
    hidden = true;
    // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action changes visibility or a media query; the event is the input
    document.dispatchEvent(new Event("visibilitychange"));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("spawns nothing while the hero is off screen, and waits again when it returns", () => {
    mount(scripted().random);
    Watcher.last?.show(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(600_000);
    expect(frames).not.toHaveBeenCalled();
    Watcher.last?.show(true);
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe("abort", () => {
  it("clears the timer, the frame, the observer and the listeners", () => {
    mount(scripted().random);
    vi.advanceTimersByTime(FIRST + 100);
    expect(frames).toHaveBeenCalled();
    controller.abort();
    expect(vi.getTimerCount()).toBe(0);
    expect(Watcher.last?.disconnected).toBe(true);

    /* A change the code used to listen to starts nothing. */
    reduced.set(false);
    // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action changes visibility or a media query; the event is the input
    document.dispatchEvent(new Event("visibilitychange"));
    Watcher.last?.show(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does nothing when the signal is already aborted", () => {
    controller.abort();
    mount(scripted().random);
    expect(vi.getTimerCount()).toBe(0);
    expect(Watcher.last).toBeUndefined();
  });
});
