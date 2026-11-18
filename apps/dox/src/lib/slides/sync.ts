/**
 * The deck window and the presenter window talk over one `BroadcastChannel`, `gmt-slides:<slug>`.
 *
 * The deck window is the one source of truth. It posts its `state`; the presenter never changes
 * its own state, it posts a `step` and renders the next `state` it hears. A presenter that has just
 * opened posts `hello` and gets a `state` back. A deck that is closing posts `bye`, so the presenter
 * can say the deck window is gone and fall back to stepping on its own.
 *
 * The union is closed: a message of any other shape, from anything else that shares the channel,
 * is dropped by `parseMessage` and never thrown on. The channel closes with the caller's signal.
 */
import type { DeckAction } from "./keys";

/** Which renderer the deck window's globe is on, as the deck reports it. */
export type DeckRenderer = "webgpu" | "canvas2d" | "sky" | "pending";

/** What the readiness check reads from the deck window besides its place in the talk. */
export interface DeckEnv {
  renderer: DeckRenderer;
  reducedMotion: boolean;
  fullscreen: boolean;
}

/** A network demo: waiting for its answer, playing it live, or playing the recording. */
export type DemoSource = "pending" | "live" | "recorded";
export type DemoState = { id: string; source: DemoSource } | null;

export interface StateMessage {
  type: "state";
  /** Zero-based slide and how many of its builds are shown. */
  slide: number;
  build: number;
  blanked: boolean;
  demo: DemoState;
  env: DeckEnv;
}

/** The actions a presenter may ask of the deck window. Fullscreen needs the deck's own click. */
export const STEP_ACTIONS = [
  "next",
  "prev",
  "nextSlide",
  "prevSlide",
  "first",
  "last",
  "goTo",
  "blank",
  "home",
] as const satisfies readonly DeckAction[];
export type StepAction = (typeof STEP_ACTIONS)[number];

export interface StepMessage {
  type: "step";
  action: StepAction;
  /** For `goTo`: the one-based slide number. */
  n?: number;
}

export type SyncMessage =
  | StateMessage
  | StepMessage
  | { type: "hello" }
  | { type: "bye" };

/** The channel's name for a deck. */
/** The `window.open` name of the presenter window: a second press of T finds the same window. */
export const PRESENTER_WINDOW = "gmt-presenter";

export const channelName = (slug: string): string => `gmt-slides:${slug}`;

const RENDERERS: readonly DeckRenderer[] = [
  "webgpu",
  "canvas2d",
  "sky",
  "pending",
];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

function parseDemo(v: unknown): DemoState | undefined {
  if (v === null) return null;
  if (!isRecord(v) || typeof v["id"] !== "string") return undefined;
  const source = v["source"];
  if (source !== "pending" && source !== "live" && source !== "recorded")
    return undefined;
  return { id: v["id"], source };
}

function parseEnv(v: unknown): DeckEnv | undefined {
  if (!isRecord(v)) return undefined;
  const renderer = v["renderer"];
  if (!RENDERERS.includes(renderer as DeckRenderer)) return undefined;
  if (typeof v["reducedMotion"] !== "boolean") return undefined;
  if (typeof v["fullscreen"] !== "boolean") return undefined;
  return {
    renderer: renderer as DeckRenderer,
    reducedMotion: v["reducedMotion"],
    fullscreen: v["fullscreen"],
  };
}

/** The message `data` is, or `null` for anything outside the union. Never throws. */
export function parseMessage(data: unknown): SyncMessage | null {
  if (!isRecord(data)) return null;
  switch (data["type"]) {
    case "hello":
      return { type: "hello" };
    case "bye":
      return { type: "bye" };
    case "step": {
      const action = data["action"];
      if (!STEP_ACTIONS.includes(action as StepAction)) return null;
      const n = data["n"];
      if (action === "goTo") {
        if (typeof n !== "number" || !Number.isInteger(n) || n < 1) return null;
        return { type: "step", action: "goTo", n };
      }
      return { type: "step", action: action as StepAction };
    }
    case "state": {
      const demo = parseDemo(data["demo"]);
      const env = parseEnv(data["env"]);
      if (
        !isCount(data["slide"]) ||
        !isCount(data["build"]) ||
        typeof data["blanked"] !== "boolean" ||
        demo === undefined ||
        env === undefined
      )
        return null;
      return {
        type: "state",
        slide: data["slide"],
        build: data["build"],
        blanked: data["blanked"],
        demo,
        env,
      };
    }
    default:
      return null;
  }
}

export interface SyncChannel {
  post(message: SyncMessage): void;
}

/**
 * Opens the deck's channel until `signal` aborts. `onMessage` gets each valid message from the
 * other windows (a channel never hears itself). `null` where the browser has no `BroadcastChannel`.
 */
export function openSync(
  slug: string,
  o: {
    signal: AbortSignal;
    onMessage(message: SyncMessage): void;
    /** Posted as the signal aborts, just before the channel closes. */
    farewell?: SyncMessage;
  },
): SyncChannel | null {
  if (typeof BroadcastChannel === "undefined" || o.signal.aborted) return null;
  const channel = new BroadcastChannel(channelName(slug));
  let open = true;
  channel.addEventListener(
    "message",
    (event) => {
      const message = parseMessage(event.data);
      if (message) o.onMessage(message);
    },
    { signal: o.signal },
  );
  o.signal.addEventListener(
    "abort",
    () => {
      if (o.farewell) channel.postMessage(o.farewell);
      open = false;
      channel.close();
    },
    { once: true },
  );
  return {
    post(message) {
      if (open) channel.postMessage(message);
    },
  };
}

/**
 * The deck window's side: posts `state` on `publish()` and on every `hello`, runs each `step` the
 * presenter sends, and says `bye` when the page goes away or the signal aborts.
 */
export function mountDeckSync(o: {
  slug: string;
  signal: AbortSignal;
  /** The deck's present state, as a message. */
  snapshot(): StateMessage;
  /** Runs one presenter step. */
  step(message: StepMessage): void;
}): { publish(): void } | null {
  const channel = openSync(o.slug, {
    signal: o.signal,
    farewell: { type: "bye" },
    onMessage(message) {
      if (message.type === "hello") channel?.post(o.snapshot());
      else if (message.type === "step") o.step(message);
    },
  });
  if (!channel) return null;
  const doc = typeof document === "undefined" ? null : document;
  doc?.defaultView?.addEventListener(
    "pagehide",
    () => channel.post({ type: "bye" }),
    { signal: o.signal },
  );
  channel.post(o.snapshot());
  return { publish: () => channel.post(o.snapshot()) };
}
