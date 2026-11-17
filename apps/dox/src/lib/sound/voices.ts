/**
 * Every sound, one function each, ported from the audition
 * (context/dox/reference/sound-audition.html) with the picked variant's body unchanged.
 * `t` is a time on the audio clock; `out` is the master bus.
 */
import type { CueName, LoopName } from "./cue";
import {
  bell,
  biquad,
  echo,
  envelope,
  hz,
  noise,
  noiseBuffer,
  rand,
  sharedFx,
  sonarEcho,
  space,
  tone,
} from "./kit";
import { fadedLoop } from "./loops";
import { LOCK_PINGS, SONAR_PING } from "./sonar-lock";

/**
 * `rank` is the cue's place in a run of like cues, 0 for the first (`cue(name, rank)`); a voice
 * that does not climb ignores it.
 */
export type Voice = (
  c: AudioContext,
  out: AudioNode,
  t: number,
  rank: number,
) => void;
/** Starts a loop on `bus` and returns its stop function. */
export type Loop = (c: AudioContext, bus: AudioNode) => () => void;

interface BreathOptions {
  /** Delay time in seconds at the start of the sweep. */
  from: number;
  /** Delay time in seconds at the end of the sweep. */
  to: number;
  peak: number;
  attack: number;
  release: number;
  /** Centre of the band of air fed in, in hertz. Default 2400. */
  band?: number;
  /** How much of the delay feeds back: higher rings longer and purer. Default 0.8. */
  feedback?: number;
  /** The lowpass the ring passes through, in hertz. Default 5500. */
  lowpass?: number;
  /** The send into the shared space. Default 0.35. */
  wet?: number;
}

/**
 * Air through a short feedback delay: the delay's resonances make the breath sound like it
 * passes through a steel tube, and sweeping the delay moves that ring without any strike.
 * A shorter delay rings higher, so `from` > `to` lifts and `from` < `to` sinks.
 */
function steelBreath(
  c: AudioContext,
  out: AudioNode,
  t: number,
  {
    from,
    to,
    peak,
    attack,
    release,
    band = 2400,
    feedback: loop = 0.8,
    lowpass = 5500,
    wet: send = 0.35,
  }: BreathOptions,
): void {
  const end = t + attack + release;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const pre = biquad(c, "bandpass", band, 0.5);
  const env = envelope(c, t, peak, attack, 0, release);
  const delay = c.createDelay(0.05);
  delay.delayTime.setValueAtTime(from, t);
  delay.delayTime.exponentialRampToValueAtTime(to, end);
  const feedback = c.createGain();
  feedback.gain.value = loop;
  const colour = biquad(c, "lowpass", lowpass);
  const wet = c.createGain();
  wet.gain.value = send;
  src.connect(pre).connect(env).connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(colour).connect(out);
  colour.connect(wet).connect(space(c));
  src.start(t, Math.random() * 0.5);
  src.stop(end + 0.05);
}

/** A frequency `z` of the way from `lo` to `hi`, on a log scale. */
const zoomPitch = (lo: number, hi: number, z: number): number =>
  lo * (hi / lo) ** z;

/**
 * zoom B, "Lens servo": a soft focus-motor whirr per step, a breath of filtered air pitched by how
 * close the camera is (`z`, the cue's `rank`) that sweeps up going in (`dir` 1) and down coming
 * out (-1).
 */
function lensServo(dir: 1 | -1): Voice {
  return (c, out, t, z) => {
    const f = zoomPitch(650, 1900, z);
    noise(c, out, t, {
      freq: f,
      to: dir > 0 ? f * 1.5 : f / 1.5,
      q: 4,
      peak: 0.07,
      attack: 0.008,
      decay: 0.05,
    });
  };
}

/** `null` is a cue no slice has given a voice yet. */
export const VOICES: Record<CueName, Voice | null> = {
  // click A, "Sonar": a clean ping with a quick echo coming back off the hull. A press on a link.
  // Its tail is shorter than the audition's (`SONAR_PING`), so a link leaves the page sooner.
  click(c, out, t) {
    const { freq, peak, echoPeak, attack, release, echoRelease } = SONAR_PING;
    tone(c, out, t, { freq, peak, attack, release });
    tone(c, sonarEcho(c), t, {
      freq,
      peak: echoPeak,
      attack,
      release: echoRelease,
    });
  },
  // click B, "Deep sonar": lower and rounder, with a longer tail in a dark room, a submarine far
  // down. A press on a button, tab or other control that acts on the page.
  press(c, out, t) {
    tone(c, out, t, {
      freq: 620,
      to: 600,
      peak: 0.13,
      attack: 0.004,
      release: 0.55,
    });
    tone(c, space(c), t, {
      freq: 620,
      peak: 0.08,
      attack: 0.004,
      release: 0.5,
    });
  },
  // open K, "Steel breath": a soft breath of air passing through a cold steel tube, a gentle
  // metallic whoosh whose ring lifts as it opens. No strike, no notes.
  open(c, out, t) {
    steelBreath(c, out, t, {
      from: 0.0018,
      to: 0.0009,
      peak: 0.022,
      attack: 0.14,
      release: 0.26,
    });
  },
  // close K, "Steel breath" in reverse: the metallic whoosh sinks and closes, a little shorter.
  close(c, out, t) {
    steelBreath(c, out, t, {
      from: 0.0009,
      to: 0.0018,
      peak: 0.018,
      attack: 0.06,
      release: 0.24,
    });
  },
  // paint C, "Steel whisper": the open's Steel breath made tiny, a faint metallic air as a piece
  // of the landing freezes in, so the entrance and the panels sound like one family.
  paint(c, out, t) {
    steelBreath(c, out, t, {
      from: rand(0.0013, 0.0015),
      to: 0.0008,
      peak: 0.01,
      attack: 0.08,
      release: 0.18,
      feedback: 0.7,
      wet: 0.2,
    });
  },
  // glint B, "Steel shing": a steel sheet catching the light, a quick shimmer of metal ring with no
  // strike. Each glint of the landing rings a touch higher than the one before (`rank`).
  glint(c, out, t, rank) {
    const lift = 1 + rank * 0.04;
    steelBreath(c, out, t, {
      from: 0.00032 / lift,
      to: 0.00021 / lift,
      band: 7000,
      peak: 0.007,
      attack: 0.05,
      release: 0.2,
      feedback: 0.88,
      lowpass: 12000,
      wet: 0.15,
    });
  },
  // toggle C, "Ice snap": a thin crust of ice snapping: a hiss-click, a glassy tick and a tiny thump.
  toggle(c, out, t) {
    noise(c, out, t, {
      type: "highpass",
      freq: 4500,
      peak: 0.12,
      attack: 0.001,
      decay: 0.012,
    });
    tone(c, out, t + 0.004, {
      freq: 2800,
      peak: 0.06,
      attack: 0.001,
      release: 0.02,
    });
    tone(c, out, t, {
      freq: 150,
      to: 100,
      peak: 0.1,
      attack: 0.002,
      release: 0.03,
    });
  },
  // copy B, "Glass clink": two glasses touching: two quick high partials.
  copy(c, out, t) {
    bell(c, out, t, {
      freq: 2637,
      ratios: [1, 1.5],
      peak: 0.06,
      decay: 0.2,
    });
    bell(c, out, t + 0.05, {
      freq: 3951,
      ratios: [1, 1.5],
      peak: 0.04,
      decay: 0.25,
    });
  },
  // detent B, "Glass tick": a brighter, glassier tick with only a hint of body.
  detent(c, out, t) {
    tone(c, out, t, {
      freq: 3200,
      to: 2600,
      peak: 0.07,
      attack: 0.001,
      release: 0.012,
    });
    tone(c, out, t, {
      freq: 900,
      to: 700,
      peak: 0.05,
      attack: 0.002,
      release: 0.03,
    });
  },
  // key C, "Data blip": very quiet high blips from a pentatonic scale, like a terminal echoing keys.
  key(c, out, t) {
    const notes = [93, 95, 98, 100, 102];
    tone(c, out, t, {
      freq: hz(notes[Math.floor(Math.random() * notes.length)]),
      peak: 0.03,
      attack: 0.002,
      release: 0.03,
    });
  },
  // send C, "Sonar launch": one ping with a run of echoes receding into the distance. The
  // audition builds the echo per play; here it is built once per context, like `sonarEcho`.
  send(c, out, t) {
    const far = sharedFx(c, "launch", (cc, o) => echo(cc, o, 0.12, 0.5, 0.5));
    tone(c, out, t, { freq: 1180, peak: 0.1, attack: 0.003, release: 0.15 });
    tone(c, far, t, { freq: 1180, peak: 0.08, attack: 0.003, release: 0.12 });
  },
  // stream C, "Morse": a short soft beep per chunk, like a signal keyed in.
  stream(c, out, t) {
    tone(c, out, t, {
      freq: 700,
      peak: 0.035,
      attack: 0.003,
      hold: 0.02,
      release: 0.01,
    });
  },
  // done C, "Ice bell": one high ice bell ringing out in the room.
  done(c, out, t) {
    bell(c, out, t, {
      freq: 2093,
      ratios: [1, 2.76, 5.4],
      peak: 0.05,
      decay: 1.2,
    });
    bell(c, space(c), t, {
      freq: 2093,
      ratios: [1, 2.76],
      peak: 0.04,
      decay: 1.2,
    });
  },
  // loading B, "Scan sweep": a band of noise sweeping up, a scanner passing over.
  loading(c, out, t) {
    noise(c, out, t, {
      freq: 500,
      to: 4000,
      q: 2,
      peak: 0.07,
      attack: 0.08,
      decay: 0.4,
    });
  },
  // ready A, "Lock-in": a detent click and a soft high ping: locked on.
  ready(c, out, t) {
    tone(c, out, t, {
      freq: 1500,
      to: 1100,
      peak: 0.07,
      attack: 0.002,
      release: 0.014,
    });
    tone(c, out, t, {
      freq: 240,
      to: 150,
      peak: 0.18,
      attack: 0.003,
      release: 0.05,
    });
    tone(c, out, t + 0.05, {
      freq: 1568,
      peak: 0.04,
      attack: 0.004,
      release: 0.25,
    });
  },
  // locate A, "Sonar lock": two soft pings a fifth apart with the sonar echo, the sonar finding
  // its target. A place or a zone chosen on the globe; its pin ripples a ring for every ping and
  // echo heard (sonar-lock.ts).
  locate(c, out, t) {
    LOCK_PINGS.freqs.forEach((freq, i) => {
      const at = t + i * LOCK_PINGS.gap;
      tone(c, out, at, {
        freq,
        peak: LOCK_PINGS.peak,
        attack: 0.004,
        release: 0.2,
      });
      tone(c, sonarEcho(c), at, {
        freq,
        peak: LOCK_PINGS.echoPeak,
        attack: 0.004,
        release: 0.16,
      });
    });
  },
  zoomIn: lensServo(1),
  zoomOut: lensServo(-1),
  // appear E, "Steel horizon": a low steel tube breathing in, its ring rising an octave as the
  // globe arrives, over a soft sub: the Steel breath, slowed and lowered.
  appearGlobe(c, out, t) {
    steelBreath(c, out, t, {
      from: 1 / 110,
      to: 1 / 220,
      band: 700,
      peak: 0.012,
      attack: 1.2,
      release: 2.2,
      feedback: 0.85,
      lowpass: 2200,
      wet: 0.4,
    });
    tone(c, out, t + 0.2, {
      freq: 110,
      peak: 0.04,
      attack: 1.0,
      release: 2.5,
    });
  },
  // appear D, "Sonar dawn": a dark tide of air swelling up, and at its crest one deep, slow sonar
  // ping with its echo: the sonar waking to the map.
  appearMap(c, out, t) {
    noise(c, out, t, {
      type: "lowpass",
      freq: 250,
      to: 1400,
      q: 0.7,
      peak: 0.035,
      attack: 1.2,
      decay: 1.8,
    });
    tone(c, out, t, {
      freq: 110,
      peak: 0.035,
      attack: 1.0,
      release: 2.4,
    });
    tone(c, out, t + 0.9, {
      freq: 440,
      peak: 0.05,
      attack: 0.01,
      release: 1.2,
    });
    tone(c, sonarEcho(c), t + 0.9, {
      freq: 440,
      peak: 0.035,
      attack: 0.01,
      release: 0.9,
    });
  },
  // error B, "Low double buzz": two short, muffled low buzzes.
  error(c, out, t) {
    for (const at of [0, 0.11]) {
      tone(c, out, t + at, {
        type: "square",
        freq: 110,
        peak: 0.07,
        attack: 0.004,
        hold: 0.05,
        release: 0.03,
        filter: ["lowpass", 600],
      });
    }
  },
};

export const LOOPS: Record<LoopName, Loop | null> = {
  aura: null,
  // thinking B, "Hum pulse": a low, quiet hum swelling about once a second: a machine at work.
  // The body is the audition's; `fadedLoop` puts it behind a bus that swells in over 0.3 s and
  // dims over 0.15 s before it stops.
  thinking: fadedLoop(
    (c, bus) => {
      const parts = [
        [110, 0.05],
        [165, 0.025],
      ].map(([freq, peak]) => {
        const o = c.createOscillator();
        o.frequency.value = freq;
        const g = c.createGain();
        g.gain.value = peak;
        const lfo = c.createOscillator();
        lfo.frequency.value = 1.1;
        const d = c.createGain();
        d.gain.value = peak * 0.8;
        lfo.connect(d).connect(g.gain);
        o.connect(biquad(c, "lowpass", 400))
          .connect(g)
          .connect(bus);
        o.start();
        lfo.start();
        return [o, lfo];
      });
      return () => {
        for (const pair of parts)
          for (const n of pair) n.stop(c.currentTime + 0.6);
      };
    },
    0.3,
    0.15,
  ),
};
