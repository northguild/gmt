/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeAudioContext,
  type FakeNode,
  installFakeAudio,
  installMemoryStorage,
} from "../../test/fake-audio";
import { installJsdomShims } from "../../test/jsdom-shims";
import { cue } from "./cue";
import { createEngine, type Engine } from "./engine";
import { SOUND_KEY, writeSound } from "./settings";
import { VOICES, type Voice } from "./voices";

installJsdomShims();

let engine: Engine | undefined;
let ctx: FakeAudioContext;

function boot(saved?: object) {
  if (saved) localStorage.setItem(SOUND_KEY, JSON.stringify(saved));
  engine = createEngine();
  ctx = new FakeAudioContext();
  engine.attach(ctx as unknown as AudioContext);
  ctx.become("running");
  return ctx.nodes[0]; // the master gain
}

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action here hides the tab; the event is the input
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  installFakeAudio();
  installMemoryStorage();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
  }));
});

const voices = { ...VOICES };

afterEach(() => {
  Object.assign(VOICES, voices);
  engine?.destroy();
  engine = undefined;
  localStorage.clear();
  delete (document as unknown as Record<string, unknown>).visibilityState;
  expect(vi.getTimerCount()).toBe(0);
});

describe("level and mute", () => {
  it("maps the level to a gain of level / 11 * 0.6", () => {
    const master = boot({ level: 11 });
    expect(master.gain.value).toBeCloseTo(0.6);
    const [shaper] = master.outputs;
    expect(shaper.kind).toBe("waveShaper");
    expect(shaper.outputs).toContain(ctx.destination);
  });

  it("follows the fader on the audio clock", () => {
    const master = boot({ level: 5 });
    expect(master.gain.value).toBeCloseTo((5 / 11) * 0.6);
    writeSound({ level: 11 });
    expect(master.gain.of("setTargetAtTime")[0].args[0]).toBeCloseTo(0.6);
  });

  it("ramps to silence over 0.05 s, then suspends", () => {
    const master = boot({ level: 5, muted: false });
    ctx.advance(2);
    writeSound({ muted: true });
    expect(master.gain.of("linearRampToValueAtTime")[0].args).toEqual([
      0, 2.05,
    ]);
    expect(ctx.calls).not.toContain("suspend");
    vi.advanceTimersByTime(100);
    expect(ctx.calls).toContain("suspend");
  });

  it("resumes and ramps back up on unmute", () => {
    const master = boot({ level: 11, muted: true });
    expect(master.gain.value).toBe(0);
    writeSound({ muted: false });
    expect(ctx.calls).toContain("resume");
    expect(
      master.gain.of("linearRampToValueAtTime").at(-1)?.args[0],
    ).toBeCloseTo(0.6);
  });
});

describe("a cue", () => {
  let click: ReturnType<typeof vi.fn<Voice>>;
  beforeEach(() => {
    click = vi.fn<Voice>();
    VOICES.click = click;
  });

  it("plays 5 ms ahead on the audio clock", () => {
    boot();
    ctx.advance(3);
    cue("click");
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.calls[0][0]).toBe(ctx);
    expect(click.mock.calls[0][2]).toBeCloseTo(3.005);
  });

  it("drops the same cue inside its gap and plays it after", () => {
    boot();
    cue("click");
    ctx.advance(0.02);
    cue("click");
    expect(click).toHaveBeenCalledTimes(1);
    ctx.advance(0.02);
    cue("click");
    expect(click).toHaveBeenCalledTimes(2);
  });

  it("keeps a cue's own gap: key 25 ms, stream 60 ms", () => {
    boot();
    const key = vi.fn<Voice>();
    const stream = vi.fn<Voice>();
    VOICES.key = key;
    VOICES.stream = stream;
    for (const name of ["key", "stream"] as const) cue(name);
    ctx.advance(0.03);
    for (const name of ["key", "stream"] as const) cue(name);
    expect(key).toHaveBeenCalledTimes(2);
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it("holds a zoom's steps 60 ms apart, in and out as one run", () => {
    boot();
    const zoomIn = vi.fn<Voice>();
    const zoomOut = vi.fn<Voice>();
    VOICES.zoomIn = zoomIn;
    VOICES.zoomOut = zoomOut;
    cue("zoomIn", 0.2);
    ctx.advance(0.03);
    cue("zoomOut", 0.1);
    cue("zoomIn", 0.3);
    expect(zoomIn).toHaveBeenCalledTimes(1);
    expect(zoomOut).not.toHaveBeenCalled();
    ctx.advance(0.04);
    cue("zoomOut", 0.1);
    expect(zoomOut).toHaveBeenCalledTimes(1);
    expect(zoomOut.mock.calls[0][3]).toBe(0.1);
  });

  it("hears a globe and a map arriving inside 1.2 s as one arrival", () => {
    boot();
    const globe = vi.fn<Voice>();
    const map = vi.fn<Voice>();
    VOICES.appearGlobe = globe;
    VOICES.appearMap = map;
    cue("appearGlobe");
    ctx.advance(1);
    cue("appearMap");
    expect(map).not.toHaveBeenCalled();
    ctx.advance(0.3);
    cue("appearMap");
    expect(globe).toHaveBeenCalledTimes(1);
    expect(map).toHaveBeenCalledTimes(1);
  });

  it("hands a cue's rank to its voice, 0 when none is given", () => {
    boot();
    cue("click");
    ctx.advance(1);
    cue("click", 3);
    expect(click.mock.calls.map((call) => call[3])).toEqual([0, 3]);
  });

  it("is silent while muted, and before the context is attached", () => {
    engine = createEngine();
    cue("click");
    expect(click).not.toHaveBeenCalled();
    engine.destroy();
    boot({ muted: true });
    cue("click");
    expect(click).not.toHaveBeenCalled();
  });

  it("is dropped while the context is suspended outside a gesture, so nothing plays late", () => {
    // An arrival the browser did not let start: the clock is stopped until the first press.
    vi.stubGlobal("navigator", {
      ...navigator,
      userActivation: { isActive: false },
    });
    engine = createEngine();
    ctx = new FakeAudioContext();
    engine.attach(ctx as unknown as AudioContext);
    cue("click");
    ctx.become("running");
    expect(click).not.toHaveBeenCalled();
  });

  it("plays the press's own cue while that press is starting the context", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userActivation: { isActive: true },
    });
    engine = createEngine();
    ctx = new FakeAudioContext();
    engine.attach(ctx as unknown as AudioContext);
    cue("click");
    expect(click).toHaveBeenCalledOnce();
  });

  it("drops a cue on a suspended context where the browser has no userActivation", () => {
    engine = createEngine();
    ctx = new FakeAudioContext();
    engine.attach(ctx as unknown as AudioContext);
    cue("click");
    ctx.become("running");
    expect(click).not.toHaveBeenCalled();
  });

  it("is ignored when its cue has no voice yet", () => {
    boot();
    expect(() => cue("send")).not.toThrow();
  });
});

describe("the real Sonar voice", () => {
  it("starts a tone and its echo, each stopped after its release", () => {
    boot();
    cue("click");
    const started = ctx.started("oscillator");
    expect(started).toHaveLength(2);
    expect(started[0].startedAt).toBeCloseTo(0.005);
    expect(started.every((o) => (o.stoppedAt ?? 0) > (o.startedAt ?? 0))).toBe(
      true,
    );
  });
});

describe("the chrome voices", () => {
  it.each(["open", "close", "paint", "glint", "copy", "error"] as const)(
    "%s starts something and stops it",
    (name) => {
      boot();
      cue(name);
      const started = [
        ...ctx.started("oscillator"),
        ...ctx.started("bufferSource"),
      ];
      expect(started.length).toBeGreaterThan(0);
      expect(
        started.every((n) => (n.stoppedAt ?? 0) > (n.startedAt ?? 0)),
      ).toBe(true);
    },
  );
});

describe("visibility", () => {
  it("suspends once what is sounding has finished when hidden, and resumes when shown", () => {
    boot();
    setVisibility("hidden");
    // A link that opened a new tab hid this one: its ping and the aura's fade play out first.
    vi.advanceTimersByTime(600);
    expect(ctx.calls).not.toContain("suspend");
    vi.advanceTimersByTime(50);
    expect(ctx.calls).toContain("suspend");
    setVisibility("visible");
    expect(ctx.calls.at(-1)).toBe("resume");
  });

  it("never sleeps when shown again before the tail has played", () => {
    boot();
    setVisibility("hidden");
    vi.advanceTimersByTime(300);
    setVisibility("visible");
    vi.advanceTimersByTime(1000);
    expect(ctx.calls).not.toContain("suspend");
  });

  it("stays suspended when shown while muted", () => {
    boot({ muted: true });
    setVisibility("visible");
    expect(ctx.calls).not.toContain("resume");
  });
});

describe("the silent switch", () => {
  it("asks for an ambient audio session where the browser has one", () => {
    const session = { type: "auto" };
    Object.defineProperty(navigator, "audioSession", {
      value: session,
      configurable: true,
    });
    boot();
    expect(session.type).toBe("ambient");
    delete (navigator as unknown as Record<string, unknown>).audioSession;
  });
});

describe("destroy", () => {
  it("closes the context and leaves no listener, timer or later sound", () => {
    boot({ muted: false });
    writeSound({ muted: true });
    const click = vi.fn<Voice>();
    VOICES.click = click;
    engine?.destroy();
    expect(ctx.state).toBe("closed");
    expect(vi.getTimerCount()).toBe(0);
    cue("click");
    setVisibility("hidden");
    expect(click).not.toHaveBeenCalled();
    engine = undefined;
  });
});

describe("the landing's aura", () => {
  const ramps = (node: FakeNode) =>
    node.gain.of("linearRampToValueAtTime").map((c) => c.args);
  /** The aura's bus: the gain whose ramp goes to 0.25. */
  const auraBus = () =>
    ctx.nodes.find((n) => ramps(n).some(([v]) => v === 0.25));
  /** Let the engine's dynamic import of aura.ts settle. */
  const loaded = () => vi.dynamicImportSettled();

  afterEach(() => {
    document.documentElement.removeAttribute("data-aura");
  });

  const landing = () => document.documentElement.setAttribute("data-aura", "");

  it("does not load or start the aura off the landing", async () => {
    boot();
    await loaded();
    expect(auraBus()).toBeUndefined();
  });

  it("starts on the landing with a 3 s fade, 12 dB under the cues", async () => {
    landing();
    boot();
    await loaded();
    expect(ramps(auraBus()!)[0]).toEqual([0.25, 3]);
  });

  it("does not start with the Aura switch off", async () => {
    landing();
    boot({ aura: false });
    await loaded();
    expect(auraBus()).toBeUndefined();
  });

  it("does not start while muted, and unmuting starts it with a 1.5 s fade", async () => {
    landing();
    boot({ muted: true });
    await loaded();
    expect(auraBus()).toBeUndefined();
    writeSound({ muted: false });
    await loaded();
    expect(ramps(auraBus()!)[0]).toEqual([0.25, 1.5]);
  });

  it("fades out over 0.6 s when the switch goes off and back in over 1.5 s when it goes on", async () => {
    landing();
    boot();
    await loaded();
    ctx.advance(5);
    writeSound({ aura: false });
    expect(ramps(auraBus()!).at(-1)).toEqual([0, 5.6]);
    writeSound({ aura: true });
    await loaded();
    expect(ramps(auraBus()!).at(-1)).toEqual([0.25, 6.5]);
  });

  it("stops while the tab is hidden and fades back in on return", async () => {
    landing();
    boot();
    await loaded();
    ctx.advance(5);
    setVisibility("hidden");
    expect(ramps(auraBus()!).at(-1)).toEqual([0, 5.6]);
    vi.advanceTimersByTime(650);
    expect(ctx.calls).toContain("suspend");
    setVisibility("visible");
    await loaded();
    expect(ramps(auraBus()!).at(-1)).toEqual([0.25, 6.5]);
  });

  it("plays the saved track", async () => {
    landing();
    boot({ track: "deep" });
    await loaded();
    // Deep drone's first chord: eight triangle pad voices; Ice cavern has none.
    expect(
      ctx.started("oscillator").filter((o) => o.type === "triangle").length,
    ).toBeGreaterThanOrEqual(8);
  });

  it("crossfades over 1.5 s to a newly picked track while the bus holds", async () => {
    landing();
    boot();
    await loaded();
    ctx.advance(5);
    const bus = auraBus()!;
    const busRamps = ramps(bus).length;
    writeSound({ track: "deep" });
    expect(ramps(bus)).toHaveLength(busRamps);
    const tracks = ctx.nodes.filter((n) => n.outputs.includes(bus));
    expect(tracks.map((n) => ramps(n).at(-1))).toEqual([
      [0, 6.5],
      [1, 6.5],
    ]);
  });

  it("starts the picked track next time when it was picked with the aura off", async () => {
    landing();
    boot({ aura: false });
    await loaded();
    writeSound({ track: "deep" });
    expect(auraBus()).toBeUndefined();
    writeSound({ aura: true });
    await loaded();
    expect(ctx.started("oscillator").some((o) => o.type === "triangle")).toBe(
      true,
    );
  });

  it("is cut when the page is hidden to the cache", async () => {
    landing();
    boot();
    await loaded();
    window.dispatchEvent(new Event("pagehide")); // oxlint-disable-line dox-test/no-dispatch-event -- no user action hides the page; the event is the input
    expect(ramps(auraBus()!).at(-1)).toEqual([0, 0]);
  });
});
