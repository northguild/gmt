/**
 * The landing's aura: one of two tracks the reader picks in the Settings panel, ported from the
 * audition's `aura` step (context/dox/reference/sound-audition.html). Loaded by the
 * engine on `/` only, so no other page fetches it.
 *
 * - "Ice cavern" (variant D, the default): six held glassy sines beating against each other, a
 *   faint low drone and a crystal glint every 1.6 to 4 s, all in a 4.5 s hall.
 * - "Deep drone" (variant A): a sub drone breathing through a slow filter, suspended pad chords,
 *   a distant beacon and sparse pings lost in a long echo, at 56 beats a minute.
 *
 * Everything sits on one bus 12 dB under the cues (0.25 of master); the bus does the aura's fades
 * in and out. Each track plays into its own gain under the bus, with its own hall, so a change of
 * track crossfades the two gains while the bus holds still. On a stop the playing track's gain
 * drops to 0 the moment the bus reaches 0, so its tails (Deep drone's pads ring up to 10 s past
 * their bar) do not come back when the bus rises again. Every fade, note and glint is on
 * `ctx.currentTime`.
 */
import {
  bell,
  biquad,
  echo,
  hall,
  hz,
  rand,
  scheduler,
  sharedFx,
  tone,
} from "./kit";
import type { AuraTrack } from "./settings";

/** The bus level: 12 dB under the cues. */
export const AURA_LEVEL = 0.25;

export interface Aura {
  /** Fade the bus out over `fade` seconds, then stop every track's sources. */
  stop(fade: number): void;
  /** Fade the playing track out and `track` in, both over `over` seconds; the bus holds. */
  switchTo(track: AuraTrack, over: number): void;
}

/** A track, playing into `out` (its own gain). Returns its stop: sources end after `fade`. */
type Track = (c: AudioContext, out: AudioNode) => (fade: number) => void;

const GLINTS = [86, 88, 91, 93, 95, 98];

/** Ice cavern, ported from the audition's `start(c, bus)` unchanged. */
const iceCavern: Track = (c, out) => {
  const verb = hall(c, out, 4.5, 0.7);
  const held: OscillatorNode[] = [];
  for (const freq of [1318.5, 1975.5, 2637]) {
    for (const cents of [-4, 4]) {
      const o = c.createOscillator();
      o.frequency.value = freq;
      o.detune.value = cents;
      const g = c.createGain();
      g.gain.value = 0.004;
      o.connect(g).connect(verb);
      o.start();
      held.push(o);
    }
  }
  const drone = c.createOscillator();
  drone.frequency.value = 73.4;
  const dg = c.createGain();
  dg.gain.value = 0.045;
  drone.connect(dg).connect(out);
  drone.start();
  held.push(drone);
  const stopGlints = scheduler(
    c,
    () => rand(1.6, 4),
    (t) => {
      bell(c, verb, t, {
        freq: hz(GLINTS[Math.floor(Math.random() * GLINTS.length)]),
        ratios: [1, 2.76, 5.4],
        peak: 0.03,
        decay: 1.4,
      });
    },
  );
  return (fade) => {
    stopGlints();
    for (const o of held) o.stop(c.currentTime + fade + 0.05);
  };
};

const BEAT = 60 / 56;
const BAR = BEAT * 4;
/** Two bars each: the pad's MIDI notes and the drone's root. */
const CHORDS = [
  { pad: [50, 52, 57, 64], root: 26 },
  { pad: [46, 53, 57, 62], root: 22 },
  { pad: [53, 55, 60, 67], root: 29 },
  { pad: [48, 53, 55, 60], root: 24 },
];
/** [bar of eight, beat in the bar, MIDI note]. */
const PINGS = [
  [0, 1.5, 81],
  [1, 3, 76],
  [2, 0.5, 84],
  [3, 2.5, 79],
  [5, 1, 86],
  [6, 3.5, 77],
  [7, 2, 81],
] as const;

/**
 * Deep drone's trim, so its peak stays under Ice cavern's: the aura is a bed, and a track picked
 * later must never be the louder one. Rendered offline through the bus (60 s, six seeds), the
 * port as written peaks at 0.139 to 0.148 of full scale and Ice cavern at 0.0148 to 0.0163; 0.09
 * (−21 dB) keeps Deep drone's loudest under Ice cavern's quietest.
 */
const DEEP_TRIM = 0.09;

/**
 * Deep drone, ported from the audition's `start(c, bus)` unchanged but for the trim. Its notes are
 * scheduled a bar ahead and end on their own; the stop ends the scheduling, and the track's gain
 * silences what is still ringing.
 */
const deepDrone: Track = (c, bus) => {
  const out = c.createGain();
  out.gain.value = DEEP_TRIM;
  out.connect(bus);
  const verb = hall(c, out, 4, 0.5);
  const far = echo(c, out, BEAT * 0.75, 0.55, 0.45);
  far.connect(verb);
  const stopBars = scheduler(
    c,
    () => BAR,
    (t, bar) => {
      if (bar % 2 === 0) {
        const { pad, root } = CHORDS[(bar / 2) % CHORDS.length];
        const len = BAR * 2;
        const lp = biquad(c, "lowpass", 300, 1.5);
        lp.frequency.setValueAtTime(300, t);
        lp.frequency.linearRampToValueAtTime(1100, t + len * 0.55);
        lp.frequency.linearRampToValueAtTime(350, t + len + 1);
        const g = c.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.035, t + 2.5);
        g.gain.setValueAtTime(0.035, t + len - 1.5);
        g.gain.linearRampToValueAtTime(0, t + len + 1.5);
        lp.connect(g).connect(out);
        g.connect(verb);
        for (const note of pad) {
          for (const cents of [-8, 8]) {
            const o = c.createOscillator();
            o.type = "triangle";
            o.frequency.value = hz(note);
            o.detune.value = cents;
            o.connect(lp);
            o.start(t);
            o.stop(t + len + 1.6);
          }
        }
        const dg = c.createGain();
        dg.gain.setValueAtTime(0, t);
        dg.gain.linearRampToValueAtTime(0.14, t + 1.5);
        dg.gain.setValueAtTime(0.14, t + len - 0.5);
        dg.gain.linearRampToValueAtTime(0, t + len + 1);
        const dlp = biquad(c, "lowpass", 220);
        dlp.connect(dg).connect(out);
        for (const [step, type] of [
          [0, "sine"],
          [12, "sine"],
          [19, "triangle"],
        ] as const) {
          const o = c.createOscillator();
          o.type = type;
          o.frequency.value = hz(root + step);
          o.connect(dlp);
          o.start(t);
          o.stop(t + len + 1.1);
        }
      }
      tone(c, out, t, {
        freq: hz(38),
        to: hz(36),
        peak: 0.08,
        attack: 0.05,
        release: 1.2,
      });
      for (const [at, beat, note] of PINGS) {
        if (at !== bar % 8) continue;
        tone(c, far, t + beat * BEAT, {
          freq: hz(note),
          peak: 0.05,
          attack: 0.01,
          release: 1.8,
        });
        tone(c, verb, t + beat * BEAT, {
          freq: hz(note),
          peak: 0.03,
          attack: 0.01,
          release: 1.8,
        });
      }
    },
  );
  return () => stopBars();
};

export const TRACKS: Record<AuraTrack, Track> = {
  ice: iceCavern,
  deep: deepDrone,
};

/** A track playing into its own gain under the bus. */
interface Playing {
  gain: GainNode;
  stop: (fade: number) => void;
}

/** Ramp `param` from where it is now to `to` over `over` seconds. */
function ramp(c: AudioContext, param: AudioParam, to: number, over: number) {
  const t = c.currentTime;
  param.cancelScheduledValues(t);
  param.setValueAtTime(param.value, t);
  param.linearRampToValueAtTime(to, t + over);
}

/** Start the aura playing `track`, fading in over `fadeIn` seconds from now. */
export function startAura(
  c: AudioContext,
  master: AudioNode,
  fadeIn = 3,
  track: AuraTrack = "ice",
): Aura {
  const bus = sharedFx(c, "aura", (cc) => {
    const g = cc.createGain();
    g.gain.value = 0;
    g.connect(master);
    return g;
  });
  ramp(c, bus.gain, AURA_LEVEL, fadeIn);

  const play = (name: AuraTrack, from: number): Playing => {
    const gain = c.createGain();
    gain.gain.value = from;
    gain.connect(bus);
    return { gain, stop: TRACKS[name](c, gain) };
  };
  let current = play(track, 1);
  let playing: AuraTrack = track;
  let stopped = false;
  return {
    stop(fade) {
      if (stopped) return;
      stopped = true;
      ramp(c, bus.gain, 0, fade);
      // The bus does the fade; the track's own gain only closes behind it, with no ramp of its own.
      const t = c.currentTime;
      const own = current.gain.gain;
      own.cancelScheduledValues(t);
      own.setValueAtTime(own.value, t);
      own.setValueAtTime(0, t + fade);
      current.stop(fade);
    },
    switchTo(next, over) {
      if (stopped || next === playing) return;
      ramp(c, current.gain.gain, 0, over);
      current.stop(over);
      current = play(next, 0);
      playing = next;
      ramp(c, current.gain.gain, 1, over);
    },
  };
}
