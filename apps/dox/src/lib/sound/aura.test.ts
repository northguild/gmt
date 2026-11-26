/**
 * @vitest-environment jsdom
 */
import {
  FakeAudioContext,
  installFakeAudio,
  type FakeNode,
} from "../../test/fake-audio";
import { startAura, type Aura } from "./aura";
import { hz } from "./kit";
import type { AuraTrack } from "./settings";

let ctx: FakeAudioContext;
let master: FakeNode;
let aura: Aura | undefined;

const as = <T>(x: unknown) => x as T;

function start(fadeIn?: number, track?: AuraTrack) {
  aura = startAura(as<AudioContext>(ctx), as<AudioNode>(master), fadeIn, track);
  return aura;
}

/** The held sources: oscillators started with no time, which is every one but a glint's. */
const held = () => ctx.started("oscillator").filter((o) => o.startedAt === 0);
/** The bus: the one gain that feeds the master. */
const bus = () => ctx.nodes.find((n) => n.outputs.includes(master))!;
/** The tracks' own gains, in the order they started: the gains that feed the bus. */
const trackGains = () =>
  ctx.nodes.filter((n) => n.kind === "gain" && n.outputs.includes(bus()));
/** Deep drone's sub note: a kit tone, so its pitch is set on the clock; its start times. */
const subs = () =>
  ctx
    .started("oscillator")
    .filter((o) => o.frequency.of("setValueAtTime")[0]?.args[0] === hz(38))
    .map((o) => Number(o.startedAt!.toFixed(3)));
/** The frequencies of the oscillators started so far, rounded to 0.1 Hz. */
const freqs = () =>
  ctx.started("oscillator").map((o) => Math.round(o.frequency.value * 10) / 10);

beforeEach(() => {
  vi.useFakeTimers();
  installFakeAudio();
  ctx = new FakeAudioContext();
  master = ctx.createGain();
});

afterEach(() => {
  aura?.stop(0);
  aura = undefined;
  ctx.close();
  expect(vi.getTimerCount()).toBe(0);
});

describe("the Ice cavern aura", () => {
  it("ramps its bus from silence to 0.25 of master over 3 s from now", () => {
    ctx.advance(2);
    start();
    expect(bus().gain.of("setValueAtTime")[0].args[1]).toBe(2);
    expect(bus().gain.of("linearRampToValueAtTime")[0].args).toEqual([0.25, 5]);
  });

  it("fades in over the time it is given", () => {
    start(1.5);
    expect(bus().gain.of("linearRampToValueAtTime")[0].args).toEqual([
      0.25, 1.5,
    ]);
  });

  it("holds six sines at the picked frequencies and one drone, once", () => {
    start();
    const freqs = held().map((o) => o.frequency.value);
    expect(freqs.slice(0, 6)).toEqual([
      1318.5, 1318.5, 1975.5, 1975.5, 2637, 2637,
    ]);
    expect(held().map((o) => o.detune.value)).toEqual([-4, 4, -4, 4, -4, 4, 0]);
    expect(freqs[6]).toBe(73.4);
    expect(held()).toHaveLength(7);
  });

  it("schedules glints only inside the 0.6 s window, 1.6 to 4 s apart", () => {
    const rnd = vi.spyOn(Math, "random").mockReturnValue(0);
    start();
    const glints = () =>
      ctx
        .started("oscillator")
        .filter((o) => o.startedAt !== 0)
        .map((o) => Number(o.startedAt!.toFixed(3)));
    const first = [...new Set(glints())];
    expect(first).toEqual([0.05]);
    expect(Math.max(...glints())).toBeLessThan(ctx.currentTime + 0.6);
    // The next glint is 1.6 s later, scheduled once the window reaches it.
    ctx.advance(1);
    vi.advanceTimersByTime(150);
    expect([...new Set(glints())]).toEqual([0.05]);
    ctx.advance(0.1);
    vi.advanceTimersByTime(150);
    expect([...new Set(glints())]).toEqual([0.05, 1.65]);
    rnd.mockReturnValue(0.999);
    ctx.advance(1.1);
    vi.advanceTimersByTime(150);
    ctx.advance(1);
    vi.advanceTimersByTime(150);
    const times = [...new Set(glints())];
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      expect(gap).toBeGreaterThanOrEqual(1.6 - 1e-9);
      expect(gap).toBeLessThanOrEqual(4);
    }
  });

  it("fades out over the time it is given, stops every source and clears the interval", () => {
    start();
    ctx.advance(5);
    aura!.stop(0.6);
    expect(bus().gain.of("linearRampToValueAtTime").at(-1)?.args).toEqual([
      0, 5.6,
    ]);
    for (const o of held()) expect(o.stoppedAt).toBeGreaterThanOrEqual(5.6);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not double the sources when started again after a stop", () => {
    start();
    aura!.stop(0.6);
    const before = held().length;
    start(1.5);
    const live = held().filter((o) => o.stoppedAt === undefined);
    expect(held()).toHaveLength(before + 7);
    expect(live).toHaveLength(7);
  });

  it("stops once: a second stop changes nothing", () => {
    start();
    aura!.stop(0.6);
    const calls = bus().gain.calls.length;
    aura!.stop(0.6);
    expect(bus().gain.calls).toHaveLength(calls);
  });
});

describe("the Deep drone aura", () => {
  it("rides the same bus, ramping to 0.25 of master over the fade it is given", () => {
    start(3, "deep");
    expect(bus().gain.of("linearRampToValueAtTime")[0].args).toEqual([0.25, 3]);
  });

  it("starts the first chord's pad, its drone and the bar's sub note, and no Ice cavern sine", () => {
    start(3, "deep");
    const pad = [50, 52, 57, 64].map((n) => Math.round(hz(n) * 10) / 10);
    for (const f of pad) expect(freqs().filter((x) => x === f)).toHaveLength(2);
    for (const step of [0, 12, 19])
      expect(freqs()).toContain(Math.round(hz(26 + step) * 10) / 10);
    expect(subs()).toEqual([0.05]);
    expect(freqs()).not.toContain(1318.5);
    expect(held()).toHaveLength(0);
  });

  it("schedules one bar ahead at 56 beats a minute, a chord every two bars", () => {
    start(3, "deep");
    const bar = (60 / 56) * 4;
    const chords = () =>
      ctx
        .started("oscillator")
        .filter((o) => o.type === "triangle" && o.detune.value === -8)
        .map((o) => Number(o.startedAt!.toFixed(3)));
    expect(subs()).toEqual([0.05]);
    ctx.advance(bar);
    vi.advanceTimersByTime(150);
    expect(subs()).toEqual([0.05, Number((0.05 + bar).toFixed(3))]);
    // The second bar holds the first chord: no new pad until the third.
    expect(new Set(chords())).toEqual(new Set([0.05]));
    ctx.advance(bar);
    vi.advanceTimersByTime(150);
    expect(new Set(chords())).toEqual(
      new Set([0.05, Number((0.05 + 2 * bar).toFixed(3))]),
    );
  });

  it("stops scheduling on stop and silences what still rings with its own gain", () => {
    start(3, "deep");
    ctx.advance(2);
    aura!.stop(0.6);
    expect(vi.getTimerCount()).toBe(0);
    expect(trackGains()[0].gain.of("setValueAtTime").at(-1)?.args).toEqual([
      0, 2.6,
    ]);
  });
});

describe("a change of track", () => {
  it("crossfades the tracks' own gains over the time given while the bus holds", () => {
    start(3, "ice");
    ctx.advance(10);
    const busCalls = bus().gain.calls.length;
    aura!.switchTo("deep", 1.5);
    expect(bus().gain.calls).toHaveLength(busCalls);
    const [ice, deep] = trackGains();
    expect(ice.gain.of("linearRampToValueAtTime").at(-1)?.args).toEqual([
      0, 11.5,
    ]);
    expect(deep.gain.value).toBe(0);
    expect(deep.gain.of("linearRampToValueAtTime").at(-1)?.args).toEqual([
      1, 11.5,
    ]);
    for (const o of held()) expect(o.stoppedAt).toBeGreaterThanOrEqual(11.5);
  });

  it("does nothing for the track already playing, or after a stop", () => {
    start(3, "ice");
    aura!.switchTo("ice", 1.5);
    expect(trackGains()).toHaveLength(1);
    aura!.stop(0.6);
    aura!.switchTo("deep", 1.5);
    expect(trackGains()).toHaveLength(1);
  });

  it("stops the new track, not the old, when the aura stops after a change", () => {
    start(3, "ice");
    aura!.switchTo("deep", 1.5);
    ctx.advance(5);
    aura!.stop(0.6);
    const deep = trackGains()[1];
    expect(deep.gain.of("setValueAtTime").at(-1)?.args).toEqual([0, 5.6]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
