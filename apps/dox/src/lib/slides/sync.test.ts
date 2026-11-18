// @vitest-environment jsdom
import {
  channelName,
  mountDeckSync,
  openSync,
  parseMessage,
  type StateMessage,
  type SyncMessage,
} from "./sync";

const ENV = {
  renderer: "canvas2d",
  reducedMotion: false,
  fullscreen: false,
} as const;
const STATE: StateMessage = {
  type: "state",
  slide: 2,
  build: 1,
  blanked: false,
  demo: null,
  env: ENV,
};

let controller: AbortController;
let closes: number;

beforeEach(() => {
  controller = new AbortController();
  closes = 0;
  const close = BroadcastChannel.prototype.close;
  vi.spyOn(BroadcastChannel.prototype, "close").mockImplementation(
    function (this: BroadcastChannel) {
      closes += 1;
      close.call(this);
    },
  );
});

afterEach(() => {
  controller.abort();
});

/** Waits for `list` to hold `count` messages. */
const heard = (list: SyncMessage[], count: number) =>
  vi.waitFor(() => expect(list.length).toBeGreaterThanOrEqual(count));

describe("parseMessage", () => {
  it("accepts each message of the union", () => {
    expect(parseMessage(STATE)).toEqual(STATE);
    expect(parseMessage({ type: "hello" })).toEqual({ type: "hello" });
    expect(parseMessage({ type: "bye" })).toEqual({ type: "bye" });
    expect(parseMessage({ type: "step", action: "next" })).toEqual({
      type: "step",
      action: "next",
    });
    expect(parseMessage({ type: "step", action: "goTo", n: 4 })).toEqual({
      type: "step",
      action: "goTo",
      n: 4,
    });
    expect(
      parseMessage({ ...STATE, demo: { id: "ask-dox", source: "recorded" } }),
    ).toMatchObject({ demo: { id: "ask-dox", source: "recorded" } });
  });

  it.each([
    ["a string", "state"],
    ["null", null],
    ["an array", []],
    ["an unknown type", { type: "reboot" }],
    ["a step with an unknown action", { type: "step", action: "fullscreen" }],
    ["a goTo with no number", { type: "step", action: "goTo" }],
    ["a goTo below one", { type: "step", action: "goTo", n: 0 }],
    ["a state with a negative slide", { ...STATE, slide: -1 }],
    ["a state with a fractional build", { ...STATE, build: 1.5 }],
    [
      "a state with a bad demo",
      { ...STATE, demo: { id: "x", source: "later" } },
    ],
    [
      "a state with a bad renderer",
      { ...STATE, env: { ...ENV, renderer: "vulkan" } },
    ],
    ["a state with no env", { ...STATE, env: undefined }],
  ])("drops %s without throwing", (_name, data) => {
    expect(parseMessage(data)).toBeNull();
  });
});

describe("openSync", () => {
  it("delivers a message to the other window and never to its sender", async () => {
    const left: SyncMessage[] = [];
    const right: SyncMessage[] = [];
    const a = openSync("one", {
      signal: controller.signal,
      onMessage: (m) => left.push(m),
    });
    const b = openSync("one", {
      signal: controller.signal,
      onMessage: (m) => right.push(m),
    });
    a?.post({ type: "hello" });
    await heard(right, 1);
    expect(right).toEqual([{ type: "hello" }]);
    b?.post({ type: "step", action: "prev" });
    await heard(left, 1);
    expect(left).toEqual([{ type: "step", action: "prev" }]);
    expect(right).toHaveLength(1);
  });

  it("ignores unknown messages from anything else on the channel", async () => {
    const heardBy: SyncMessage[] = [];
    openSync("two", {
      signal: controller.signal,
      onMessage: (m) => heardBy.push(m),
    });
    const stranger = new BroadcastChannel(channelName("two"));
    stranger.postMessage({ type: "nonsense" });
    stranger.postMessage("text");
    stranger.postMessage({ type: "hello" });
    await heard(heardBy, 1);
    stranger.close();
    expect(heardBy).toEqual([{ type: "hello" }]);
  });

  it("keeps decks apart by their slug", async () => {
    const heardBy: SyncMessage[] = [];
    const other: SyncMessage[] = [];
    const a = openSync("a", { signal: controller.signal, onMessage: () => {} });
    openSync("a", {
      signal: controller.signal,
      onMessage: (m) => heardBy.push(m),
    });
    openSync("b", {
      signal: controller.signal,
      onMessage: (m) => other.push(m),
    });
    a?.post({ type: "hello" });
    await heard(heardBy, 1);
    expect(other).toEqual([]);
  });

  it("closes its channel when the signal aborts, and posts nothing after", () => {
    const own = new AbortController();
    const channel = openSync("three", {
      signal: own.signal,
      onMessage: () => {},
    });
    own.abort();
    expect(closes).toBe(1);
    expect(() => channel?.post({ type: "hello" })).not.toThrow();
  });

  it("opens nothing for a signal that has already aborted", () => {
    const own = new AbortController();
    own.abort();
    expect(
      openSync("four", { signal: own.signal, onMessage: () => {} }),
    ).toBeNull();
    expect(closes).toBe(0);
  });
});

describe("mountDeckSync", () => {
  it("posts its state at once, on publish and on hello, and runs a step", async () => {
    const presenter: SyncMessage[] = [];
    const steps: unknown[] = [];
    const me = openSync("deck", {
      signal: controller.signal,
      onMessage: (m) => presenter.push(m),
    });
    const sync = mountDeckSync({
      slug: "deck",
      signal: controller.signal,
      snapshot: () => STATE,
      step: (m) => steps.push(m),
    });
    await heard(presenter, 1);
    expect(presenter[0]).toEqual(STATE);

    sync?.publish();
    await heard(presenter, 2);

    me?.post({ type: "hello" });
    await heard(presenter, 3);
    expect(presenter.every((m) => m.type === "state")).toBe(true);

    me?.post({ type: "step", action: "next" });
    await vi.waitFor(() =>
      expect(steps).toEqual([{ type: "step", action: "next" }]),
    );
  });

  it("says bye and closes its channel when it is aborted", async () => {
    const presenter: SyncMessage[] = [];
    const own = new AbortController();
    openSync("bye", {
      signal: controller.signal,
      onMessage: (m) => presenter.push(m),
    });
    mountDeckSync({
      slug: "bye",
      signal: own.signal,
      snapshot: () => STATE,
      step: () => {},
    });
    await heard(presenter, 1);
    own.abort();
    await heard(presenter, 2);
    expect(presenter.at(-1)).toEqual({ type: "bye" });
    expect(closes).toBe(1);
  });

  it("never changes its own state when a message is not a step", async () => {
    const steps: unknown[] = [];
    const me = openSync("deck2", {
      signal: controller.signal,
      onMessage: () => {},
    });
    mountDeckSync({
      slug: "deck2",
      signal: controller.signal,
      snapshot: () => STATE,
      step: (m) => steps.push(m),
    });
    me?.post({ ...STATE, slide: 9 });
    me?.post({ type: "bye" });
    me?.post({ type: "hello" });
    // Messages arrive in order, so once this step has run the three above have been read.
    me?.post({ type: "step", action: "last" });
    await vi.waitFor(() => expect(steps).toHaveLength(1));
    expect(steps).toEqual([{ type: "step", action: "last" }]);
  });
});
