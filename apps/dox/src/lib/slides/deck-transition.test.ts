/**
 * @vitest-environment jsdom
 *
 * The deck's slide transition decides, per change, whether the browser's view transition plays. A
 * fake `document.startViewTransition` stands in for the browser; what is asserted is when it is
 * called, with what type, and when the page's commit runs.
 */
/*
 * Nothing here is perceivable on its own: the manager only gates a browser API and orders the
 * page's changes, so its contract is the calls it makes and the order commits run in.
 */
import {
  BURST_MS,
  createDeckTransition,
  TRANSITION_ATTR,
  type DeckTransition,
} from "./deck-transition";

/** A stand-in for a view transition: it runs the update on `next()` and ends on `finish()`. */
interface Fake {
  options: { update: () => void; types: string[] };
  skipTransition: ReturnType<typeof vi.fn>;
  finished: Promise<void>;
  next(): void;
  finish(): void;
}

function setup(flags: { reduced?: boolean; covered?: boolean } = {}) {
  const made: Fake[] = [];
  const doc = document;
  const start = vi.fn((options: Fake["options"]) => {
    let done!: () => void;
    const finished = new Promise<void>((r) => (done = r));
    const fake: Fake = {
      options,
      finished,
      skipTransition: vi.fn(() => done()),
      next: () => options.update(),
      finish: () => done(),
    };
    made.push(fake);
    return fake;
  });
  doc.startViewTransition = start as unknown as Document["startViewTransition"];
  const own = new AbortController();
  const transition: DeckTransition = createDeckTransition({
    doc,
    signal: own.signal,
    reduced: () => flags.reduced ?? false,
    covered: () => flags.covered ?? false,
  });
  return { transition, start, made, own };
}

/** Holds the page's animation frames until the test runs them. */
function holdFrames(): FrameRequestCallback[] {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    frames.push(cb);
    return frames.length;
  });
  return frames;
}

describe("the deck's slide transition", () => {
  let own: AbortController | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    own?.abort();
    own = undefined;
    delete (document as { startViewTransition?: unknown }).startViewTransition;
    document.documentElement.removeAttribute(TRANSITION_ATTR);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs a slide change inside a transition typed with its direction", () => {
    const s = setup();
    own = s.own;
    const commit = vi.fn();
    s.transition.run(commit, "forward");
    expect(s.start).toHaveBeenCalledTimes(1);
    expect(s.made[0].options.types).toEqual(["forward"]);
    // The page waits for the browser's picture of the old slide.
    expect(commit).not.toHaveBeenCalled();
    s.made[0].next();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("types a step back as back", () => {
    const s = setup();
    own = s.own;
    s.transition.run(vi.fn(), "back");
    expect(s.made[0].options.types).toEqual(["back"]);
  });

  it("names the page only while the transition plays", async () => {
    const s = setup();
    own = s.own;
    s.transition.run(vi.fn(), "forward");
    expect(document.documentElement).toHaveAttribute(
      TRANSITION_ATTR,
      "forward",
    );
    s.made[0].next();
    s.made[0].finish();
    await s.made[0].finished;
    expect(document.documentElement).not.toHaveAttribute(TRANSITION_ATTR);
  });

  it("cuts a build, which has no direction", () => {
    const s = setup();
    own = s.own;
    const commit = vi.fn();
    s.transition.run(commit);
    expect(s.start).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("starts what moves after a cut once the frame that paints the cut has gone", () => {
    const s = setup();
    own = s.own;
    const frames = holdFrames();
    s.transition.run(vi.fn());
    const fly = vi.fn();
    s.transition.afterSwap(fly);
    // The cut's own frame restyles what it shows; a flight started in it stutters at its start.
    expect(fly).not.toHaveBeenCalled();
    frames.shift()!(0);
    expect(fly).toHaveBeenCalledTimes(1);
  });

  it("drops what waits on a cut when the deck is torn down", () => {
    const s = setup();
    own = s.own;
    const frames = holdFrames();
    const fly = vi.fn();
    s.transition.afterSwap(fly);
    s.own.abort();
    frames.shift()?.(0);
    expect(fly).not.toHaveBeenCalled();
  });

  it("cuts under reduced motion", () => {
    const s = setup({ reduced: true });
    own = s.own;
    const commit = vi.fn();
    s.transition.run(commit, "forward");
    expect(s.start).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("cuts while a dialog covers the stage", () => {
    const s = setup({ covered: true });
    own = s.own;
    const commit = vi.fn();
    s.transition.run(commit, "forward");
    expect(s.start).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("cuts in a browser without view transitions", () => {
    const s = setup();
    own = s.own;
    delete (document as { startViewTransition?: unknown }).startViewTransition;
    const commit = vi.fn();
    s.transition.run(commit, "forward");
    expect(commit).toHaveBeenCalledTimes(1);
    expect(document.documentElement).not.toHaveAttribute(TRANSITION_ATTR);
  });

  it("runs a commit that arrives before the update behind the first, in order", () => {
    const s = setup();
    own = s.own;
    const order: string[] = [];
    s.transition.run(() => order.push("slide"), "forward");
    s.transition.run(() => order.push("build"));
    s.transition.run(() => order.push("slide again"), "forward");
    expect(s.start).toHaveBeenCalledTimes(1);
    s.made[0].next();
    expect(order).toEqual(["slide", "build", "slide again"]);
  });

  it("skips a playing transition when a press comes, and cuts to the new slide", () => {
    const s = setup();
    own = s.own;
    s.transition.run(vi.fn(), "forward");
    s.made[0].next();
    const second = vi.fn();
    s.transition.run(second, "forward");
    expect(s.made[0].skipTransition).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(s.start).toHaveBeenCalledTimes(1);
  });

  it("never stacks transitions while a key is held", async () => {
    const s = setup();
    own = s.own;
    const commits = vi.fn();
    for (let i = 0; i < 12; i++) {
      s.transition.run(commits, "forward");
      // The browser runs the update of the one transition that started, then the next press comes.
      s.made.at(-1)?.next();
      await vi.advanceTimersByTimeAsync(33);
    }
    expect(s.start).toHaveBeenCalledTimes(1);
    expect(commits).toHaveBeenCalledTimes(12);
  });

  it("plays a transition again once the key has been let go", async () => {
    const s = setup();
    own = s.own;
    s.transition.run(vi.fn(), "forward");
    s.made[0].next();
    s.transition.run(vi.fn(), "forward");
    await vi.advanceTimersByTimeAsync(BURST_MS + 1);
    s.transition.run(vi.fn(), "forward");
    expect(s.start).toHaveBeenCalledTimes(2);
  });

  it("ends the transition and drops waiting commits when the deck is torn down", () => {
    const s = setup();
    s.transition.run(vi.fn(), "forward");
    s.own.abort();
    expect(s.made[0].skipTransition).toHaveBeenCalled();
    expect(document.documentElement).not.toHaveAttribute(TRANSITION_ATTR);
  });
});
