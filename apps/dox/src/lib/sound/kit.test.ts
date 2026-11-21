/**
 * @vitest-environment jsdom
 */
import {
  FakeAudioContext,
  FakeNode,
  installFakeAudio,
} from "../../test/fake-audio";
import {
  bell,
  CEILING,
  ceilingCurve,
  hz,
  noise,
  noiseBuffer,
  scheduler,
  setMaster,
  sharedFx,
  sonarEcho,
  tone,
} from "./kit";

function context(): FakeAudioContext {
  installFakeAudio();
  return new FakeAudioContext();
}
const as = (c: FakeAudioContext) => c as unknown as AudioContext;

describe("the safety ceiling", () => {
  it("passes a voice's level unchanged and never lets a sample past −12 dBFS", () => {
    const curve = ceilingCurve();
    const at = (x: number) =>
      curve[Math.round(((x + 1) / 2) * (curve.length - 1))];
    expect(at(0.1)).toBeCloseTo(0.1, 3);
    expect(at(-0.15)).toBeCloseTo(-0.15, 3);
    expect(Math.max(...curve.map(Math.abs))).toBeLessThanOrEqual(CEILING);
    expect(at(1)).toBeGreaterThan(0.24);
  });
});

describe("hz", () => {
  it("is A440 at MIDI 69 and doubles an octave up", () => {
    expect(hz(69)).toBe(440);
    expect(hz(81)).toBeCloseTo(880);
  });
});

describe("tone", () => {
  it("schedules its envelope and stops after the release", () => {
    const c = context();
    const out = c.destination;
    tone(as(c), out as unknown as AudioNode, 1, {
      freq: 1180,
      peak: 0.12,
      attack: 0.003,
      release: 0.32,
    });
    const [osc] = c.nodes.filter((n) => n.kind === "oscillator");
    const [gain] = c.nodes.filter((n) => n.kind === "gain");
    expect(osc.startedAt).toBe(1);
    expect(osc.stoppedAt).toBeCloseTo(1 + 0.003 + 0.32 + 0.03);
    expect(gain.gain.of("setValueAtTime")[0].args).toEqual([0, 1]);
    expect(gain.gain.of("linearRampToValueAtTime")[0].args[0]).toBe(0.12);
    expect(gain.gain.of("exponentialRampToValueAtTime")[0].args[1]).toBeCloseTo(
      1.323,
    );
    expect(gain.outputs).toContain(out);
  });

  it("glides the pitch and routes through a filter when asked", () => {
    const c = context();
    tone(as(c), c.destination as unknown as AudioNode, 0, {
      freq: 600,
      to: 300,
      peak: 0.1,
      release: 0.2,
      filter: ["lowpass", 1800],
    });
    const osc = c.nodes.find((n) => n.kind === "oscillator") as FakeNode;
    expect(osc.frequency.of("exponentialRampToValueAtTime")).toHaveLength(1);
    expect(c.nodes.some((n) => n.kind === "biquad")).toBe(true);
  });
});

describe("noise", () => {
  it("starts a looped buffer source and stops it after the decay", () => {
    const c = context();
    noise(as(c), c.destination as unknown as AudioNode, 2, {
      freq: 3000,
      peak: 0.1,
      decay: 0.1,
    });
    const src = c.nodes.find((n) => n.kind === "bufferSource") as FakeNode;
    expect(src.loop).toBe(true);
    expect(src.stoppedAt).toBeCloseTo(2 + 0.004 + 0.1 + 0.03);
  });
});

describe("bell", () => {
  it("rings one partial per ratio, each stopping after its own decay", () => {
    const c = context();
    bell(as(c), c.destination as unknown as AudioNode, 0, {
      freq: 500,
      ratios: [1, 2.7, 5.4],
      peak: 0.1,
      decay: 1,
    });
    const oscs = c.nodes.filter((n) => n.kind === "oscillator");
    expect(oscs).toHaveLength(3);
    expect(oscs.every((o) => o.stoppedAt !== undefined)).toBe(true);
    expect(oscs[0].stoppedAt as number).toBeGreaterThan(
      oscs[2].stoppedAt as number,
    );
  });
});

describe("sharedFx", () => {
  it("builds once per context, and a second context builds its own", () => {
    const a = context();
    const b = new FakeAudioContext();
    const build = vi.fn(() => ({}));
    const first = sharedFx(as(a), "x", build);
    expect(sharedFx(as(a), "x", build)).toBe(first);
    sharedFx(as(b), "x", build);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("shares one noise buffer and one echo, wired to the master", () => {
    const c = context();
    const master = c.createGain();
    setMaster(as(c), master as unknown as AudioNode);
    expect(noiseBuffer(as(c))).toBe(noiseBuffer(as(c)));
    expect(sonarEcho(as(c))).toBe(sonarEcho(as(c)));
    expect(c.nodes.filter((n) => n.kind === "delay")).toHaveLength(1);
    const damp = c.nodes.find((n) => n.kind === "biquad") as FakeNode;
    expect(
      damp.outputs.some((n) =>
        n.outputs.includes(master as unknown as FakeNode),
      ),
    ).toBe(true);
  });
});

describe("scheduler", () => {
  it("fills 0.6 s ahead on the audio clock and tops up each 150 ms until stopped", () => {
    vi.useFakeTimers();
    const c = context();
    const fn = vi.fn();
    const stop = scheduler(as(c), () => 0.25, fn);
    expect(fn.mock.calls.map((x) => x[0])).toEqual([0.05, 0.3, 0.55]);
    c.advance(0.3);
    vi.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledTimes(4);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
