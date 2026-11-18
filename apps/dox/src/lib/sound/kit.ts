/**
 * The helpers every voice is built from, ported from the sound audition's kit. Every time is a
 * time on the audio clock, `AudioContext.currentTime`: nothing here reads a wall clock.
 *
 * Effects are shared per context: one hall, one echo and one noise buffer, built on first use.
 * The engine tells the kit which node is the master bus (`setMaster`), so a voice asks for
 * `sonarEcho(c)` and the effect comes back already wired to it.
 */

import { SONAR_ECHO } from "./sonar-lock";

export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
export const rand = (lo: number, hi: number): number =>
  lo + Math.random() * (hi - lo);

const masters = new WeakMap<AudioContext, AudioNode>();
const shared = new WeakMap<AudioContext, Map<string, unknown>>();

/** Name the bus the shared effects feed. */
export function setMaster(c: AudioContext, node: AudioNode): void {
  masters.set(c, node);
}

/** Build `key` once per context. */
export function sharedFx<T>(
  c: AudioContext,
  key: string,
  build: (c: AudioContext, out: AudioNode) => T,
): T {
  let fx = shared.get(c);
  if (!fx) shared.set(c, (fx = new Map()));
  if (!fx.has(key)) fx.set(key, build(c, masters.get(c) ?? c.destination));
  return fx.get(key) as T;
}

/** The loudest the bus lets out: −12 dBFS, about 10 dB over the loudest voice at full volume. */
export const CEILING = 0.25;
/** Where the ceiling's soft knee starts; below it the bus passes the signal unchanged. */
const KNEE = 0.18;

/**
 * The safety ceiling between the master bus and the speakers: a fixed curve that passes every
 * sample under `KNEE` unchanged and bends louder ones softly towards `CEILING`, never past it,
 * however loud a voice, a resonance or a pile of overlapping voices gets. A curve, not a
 * `DynamicsCompressorNode`, whose automatic makeup gain would lift every quiet voice.
 */
export function ceilingCurve(points = 4097): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * 2 - 1;
    const m = Math.abs(x);
    const y =
      m <= KNEE
        ? m
        : KNEE + (CEILING - KNEE) * Math.tanh((m - KNEE) / (CEILING - KNEE));
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

/** A node that applies the ceiling; signals past ±1 meet the curve's ends, still under it. */
export function ceiling(c: AudioContext): WaveShaperNode {
  const shaper = c.createWaveShaper();
  shaper.curve = ceilingCurve();
  return shaper;
}

/** One second of white noise, shared by every voice on a context. */
export function noiseBuffer(c: AudioContext): AudioBuffer {
  return sharedFx(c, "noise", (cc) => {
    const length = cc.sampleRate;
    const buffer = cc.createBuffer(1, length, cc.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  });
}

/** A gain envelope: silence, a linear attack, a hold, an exponential release. */
export function envelope(
  c: AudioContext,
  t: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return g;
}

export function biquad(
  c: AudioContext,
  type: BiquadFilterType,
  freq: number,
  q?: number,
): BiquadFilterNode {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q ?? 0.7;
  return f;
}

export interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  /** Glide to this frequency over the note. */
  to?: number;
  detune?: number;
  peak: number;
  attack?: number;
  hold?: number;
  release: number;
  /** [type, freq, q] */
  filter?: [BiquadFilterType, number, number?];
}

/** One oscillator note. */
export function tone(
  c: AudioContext,
  out: AudioNode,
  t: number,
  o: ToneOptions,
): OscillatorNode {
  const attack = o.attack ?? 0.004;
  const hold = o.hold ?? 0;
  const end = t + attack + hold + o.release;
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, end);
  if (o.detune) osc.detune.value = o.detune;
  const g = envelope(c, t, o.peak, attack, hold, o.release);
  if (o.filter) {
    const f = biquad(c, o.filter[0], o.filter[1], o.filter[2]);
    osc.connect(f).connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(out);
  osc.start(t);
  osc.stop(end + 0.03);
  return osc;
}

export interface NoiseOptions {
  type?: BiquadFilterType;
  freq: number;
  /** Sweep the filter to this frequency over the burst. */
  to?: number;
  q?: number;
  peak: number;
  attack?: number;
  hold?: number;
  decay: number;
}

/** A burst of filtered noise. */
export function noise(
  c: AudioContext,
  out: AudioNode,
  t: number,
  o: NoiseOptions,
): void {
  const attack = o.attack ?? 0.004;
  const hold = o.hold ?? 0;
  const end = t + attack + hold + o.decay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const f = biquad(c, o.type ?? "bandpass", o.freq, o.q ?? 1);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, end);
  const g = envelope(c, t, o.peak, attack, hold, o.decay);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(end + 0.03);
}

export interface BellOptions {
  freq: number;
  ratios: number[];
  peak: number;
  decay: number;
  attack?: number;
}

/** A struck metal or ice bar: inharmonic partials, the higher ones dying first. */
export function bell(
  c: AudioContext,
  out: AudioNode,
  t: number,
  o: BellOptions,
): void {
  o.ratios.forEach((ratio, i) => {
    tone(c, out, t, {
      freq: o.freq * ratio,
      peak: o.peak / (i + 1),
      attack: o.attack ?? 0.002,
      release: o.decay / Math.sqrt(i + 1),
    });
  });
}

/**
 * A dark hall: a decaying noise impulse. Returns the send. The impulse is built once per context
 * and length, so a voice that makes its own hall on every start (the aura's) costs one buffer.
 */
export function hall(
  c: AudioContext,
  out: AudioNode,
  seconds: number,
  wet: number,
): ConvolverNode {
  const impulse = sharedFx(c, `impulse ${seconds}`, (cc) => {
    const length = Math.ceil(cc.sampleRate * seconds);
    const buffer = cc.createBuffer(2, length, cc.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++)
        d[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    return buffer;
  });
  const verb = c.createConvolver();
  verb.buffer = impulse;
  const g = c.createGain();
  g.gain.value = wet;
  verb
    .connect(biquad(c, "lowpass", 3000))
    .connect(g)
    .connect(out);
  return verb;
}

/** A feedback echo. Returns the send. */
export function echo(
  c: AudioContext,
  out: AudioNode,
  seconds: number,
  feedback: number,
  wet: number,
): GainNode {
  const input = c.createGain();
  const delay = c.createDelay(2);
  delay.delayTime.value = seconds;
  const loop = c.createGain();
  loop.gain.value = feedback;
  const damp = biquad(c, "lowpass", 3200);
  const g = c.createGain();
  g.gain.value = wet;
  input.connect(delay).connect(damp).connect(loop).connect(delay);
  damp.connect(g).connect(out);
  return input;
}

export const space = (c: AudioContext): ConvolverNode =>
  sharedFx(c, "hall", (cc, out) => hall(cc, out, 2.6, 0.5));
export const sonarEcho = (c: AudioContext): GainNode =>
  sharedFx(c, "echo", (cc, out) =>
    echo(cc, out, SONAR_ECHO.seconds, SONAR_ECHO.feedback, SONAR_ECHO.wet),
  );

/**
 * A lookahead scheduler on the audio clock: tops up `fn(time, index)` calls for the next 0.6 s
 * every 150 ms. `gap(index)` is the seconds to the next call. Returns a stop function. The
 * interval is a delay between top-ups, never a clock read.
 */
export function scheduler(
  c: AudioContext,
  gap: (index: number) => number,
  fn: (time: number, index: number) => void,
): () => void {
  let next = c.currentTime + 0.05;
  let index = 0;
  const tick = () => {
    while (next < c.currentTime + 0.6) {
      fn(next, index);
      next += gap(index);
      index += 1;
    }
  };
  tick();
  const id = setInterval(tick, 150);
  return () => clearInterval(id);
}
