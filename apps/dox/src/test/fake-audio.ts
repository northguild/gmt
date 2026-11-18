/**
 * A fake `AudioContext` for jsdom, which has none.
 *
 * Nothing here makes a sound. Every node records what it was connected to, when it started and
 * stopped, and every `AudioParam` records each automation call, so a test asserts on the
 * schedule rather than on audio. `currentTime` is the test's: it moves only when `advance` is
 * called, which makes the engine's gaps and fades deterministic.
 *
 * `installFakeAudio()` puts the fake on `globalThis.AudioContext` with `vi.stubGlobal`, which the
 * shared setup undoes after each test, and returns the contexts the code under test created.
 */
import { vi } from "vitest";

export interface ParamCall {
  method: string;
  args: number[];
}

export class FakeParam {
  value: number;
  readonly calls: ParamCall[] = [];
  constructor(value = 0) {
    this.value = value;
  }
  private record(method: string, args: number[]): this {
    this.calls.push({ method, args });
    return this;
  }
  setValueAtTime(v: number, t: number) {
    return this.record("setValueAtTime", [v, t]);
  }
  linearRampToValueAtTime(v: number, t: number) {
    return this.record("linearRampToValueAtTime", [v, t]);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    return this.record("exponentialRampToValueAtTime", [v, t]);
  }
  setTargetAtTime(v: number, t: number, c: number) {
    return this.record("setTargetAtTime", [v, t, c]);
  }
  cancelScheduledValues(t: number) {
    return this.record("cancelScheduledValues", [t]);
  }
  /** The calls of one method, for a short assertion. */
  of(method: string): ParamCall[] {
    return this.calls.filter((c) => c.method === method);
  }
}

export class FakeNode {
  readonly kind: string;
  readonly outputs: FakeNode[] = [];
  readonly gain = new FakeParam(1);
  readonly frequency = new FakeParam(350);
  readonly detune = new FakeParam(0);
  readonly Q = new FakeParam(1);
  readonly delayTime = new FakeParam(0);
  type = "";
  loop = false;
  buffer: unknown = null;
  curve: Float32Array | null = null;
  startedAt: number | undefined;
  stoppedAt: number | undefined;
  constructor(kind: string) {
    this.kind = kind;
  }
  connect<T>(node: T): T {
    this.outputs.push(node as unknown as FakeNode);
    return node;
  }
  disconnect() {
    this.outputs.length = 0;
  }
  start(t?: number) {
    this.startedAt = t ?? 0;
  }
  stop(t?: number) {
    this.stoppedAt = t ?? 0;
  }
}

export type FakeState = "suspended" | "running" | "closed";

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  /** When true, `resume()` leaves the context suspended, as a browser does without a gesture. */
  static refuse = false;

  currentTime = 0;
  readonly sampleRate = 48000;
  readonly destination = new FakeNode("destination");
  readonly options: unknown;
  readonly nodes: FakeNode[] = [];
  readonly calls: string[] = [];
  onstatechange: (() => void) | null = null;
  private current: FakeState = "suspended";

  constructor(options?: unknown) {
    this.options = options;
    FakeAudioContext.instances.push(this);
  }

  get state(): FakeState {
    return this.current;
  }
  private set(state: FakeState) {
    if (this.current === state) return;
    this.current = state;
    this.onstatechange?.();
  }
  /** The browser starting or stopping the context on its own (a late autoplay grant). */
  become(state: FakeState) {
    this.set(state);
  }
  resume(): Promise<void> {
    this.calls.push("resume");
    if (!FakeAudioContext.refuse && this.current !== "closed")
      this.set("running");
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.calls.push("suspend");
    if (this.current !== "closed") this.set("suspended");
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.calls.push("close");
    this.set("closed");
    return Promise.resolve();
  }
  advance(seconds: number) {
    this.currentTime += seconds;
  }
  private make(kind: string): FakeNode {
    const node = new FakeNode(kind);
    this.nodes.push(node);
    return node;
  }
  createGain() {
    return this.make("gain");
  }
  createOscillator() {
    return this.make("oscillator");
  }
  createBiquadFilter() {
    return this.make("biquad");
  }
  createBufferSource() {
    return this.make("bufferSource");
  }
  createConvolver() {
    return this.make("convolver");
  }
  createDelay() {
    return this.make("delay");
  }
  createWaveShaper() {
    return this.make("waveShaper");
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      length,
      sampleRate,
      numberOfChannels: channels,
      getChannelData: () => new Float32Array(length),
    };
  }
  /** Every node of a kind that was started, in creation order. */
  started(kind: string): FakeNode[] {
    return this.nodes.filter(
      (n) => n.kind === kind && n.startedAt !== undefined,
    );
  }
}

/** Put the fake on `globalThis`; the setup's `vi.unstubAllGlobals` removes it after the test. */
export function installFakeAudio(): typeof FakeAudioContext {
  FakeAudioContext.instances = [];
  FakeAudioContext.refuse = false;
  vi.stubGlobal("AudioContext", FakeAudioContext);
  return FakeAudioContext;
}

/**
 * An in-memory `localStorage` and `sessionStorage`. jsdom's own queues a task for each write under fake timers, which
 * a test that asserts `vi.getTimerCount() === 0` would count as its own. Undone by the setup.
 */
export function installMemoryStorage(): Storage {
  vi.stubGlobal("sessionStorage", memoryStorage());
  const storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  return storage;
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  } as Storage;
}
