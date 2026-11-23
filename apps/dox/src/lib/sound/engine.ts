/**
 * The audio engine: owns the master gain and plays the voices. Loaded by `cue.ts` on idle or on
 * the first gesture, never on the first-paint path.
 *
 * It is handed an `AudioContext` that a gesture or an in-site arrival has created and resumed
 * (`attach`), and only then listens for `gmt:cue`: a cue before that is unheard, which drops it.
 * A cue while the context is suspended is dropped too, unless a gesture is starting it (`live`).
 * Every schedule, gap and fade is on `ctx.currentTime`.
 */
import {
  CUE_EVENT,
  LOOP_EVENT,
  type CueDetail,
  type CueName,
  type LoopDetail,
  type LoopName,
} from "./cue";
import type { Aura } from "./aura";
import { watchCodeCopy } from "./code-copy";
import { ceiling, setMaster } from "./kit";
import { watchNativePanels } from "./native-panels";
import { onSoundChange, readSound, type SoundSettings } from "./settings";
import { watchTyping } from "./typing";
import { LOOPS, VOICES } from "./voices";

/**
 * The landing's aura: fades in over 3 s on the first gesture, over 1.5 s on a return, and a change
 * of track crossfades over the same 1.5 s.
 */
const AURA_FIRST_FADE = 3;
const AURA_RETURN_FADE = 1.5;
const AURA_OUT_FADE = 0.6;
/**
 * How long a hidden tab keeps sounding before its context sleeps, in ms: the aura's fade-out
 * ends, and so does a press's Distant sonar, which rings on in its space for about a second. A link
 * that opens a new tab hides this one at once, and its ping is heard to the end; a tail cut short
 * would play its rest on the way back.
 */
export const HIDE_TAIL_MS = 1200;

const MAX_GAIN = 0.6;
const MUTE_RAMP = 0.05;
/**
 * Seconds ahead of "now" a cue starts, so its attack is not clipped. A cue that reads the clock
 * less than this after the one before starts with it: the clock moves in audio blocks of about
 * 2.7 ms, so two cues of one press (a key's blip and the send it makes) can read it either side of
 * a block. Their shared start is still ahead of the clock.
 */
const LEAD = 0.005;
const DEFAULT_GAP = 0.03;
/**
 * The shortest gap between two steps of a run: an answer's chunks, and a zoom's steps, which a
 * trackpad sends as a stream of wheel events. The Lens servo's burst is 58 ms, so two never
 * overlap; a step inside the gap is silent.
 */
const STEP_GAP = 0.06;
/** Both appear voices swell for 1.2 s: two arrivals inside one swell are heard as one. */
const APPEAR_GAP = 1.2;
/** Cues that repeat faster than the default gap allows keep their own. */
const GAPS: Partial<Record<CueName, number>> = {
  stream: STEP_GAP,
  key: 0.025,
  ready: 0.4,
  zoomIn: STEP_GAP,
  appearGlobe: APPEAR_GAP,
};
/**
 * Cues that share one gap with another, keyed by the one whose gap they use: a zoom or a list step
 * that turns round is still one run of steps, and a globe and a map arriving together are one
 * arrival.
 */
const GAP_KEY: Partial<Record<CueName, CueName>> = {
  zoomOut: "zoomIn",
  listPrev: "listNext",
  appearMap: "appearGlobe",
};

export interface Engine {
  attach(ctx: AudioContext): void;
  destroy(): void;
}

type ActivationNavigator = Navigator & {
  userActivation?: { isActive: boolean };
};

/**
 * Whether a sound may be scheduled now. On a running context, yes. A suspended context's clock
 * is stopped (an arrival the browser did not let start, a hidden tab), and everything scheduled on
 * it would play at once when it starts: the landing's paints and glints on the reader's first
 * press, or a background answer's cues on their return. So a suspended context takes a sound only
 * inside a reader's gesture, which is starting it: WebKit runs a context a moment after the press
 * that resumed it, and that press's own cue belongs to it. A browser with no `userActivation`
 * cannot tell a press from the rest, so it drops them all until the context runs: a lost first
 * click is better than a burst of late ones.
 */
function live(c: AudioContext): boolean {
  if (c.state === "running") return true;
  // WebKit reports "interrupted" for the moment a press is starting a context, as it does a call.
  if (c.state !== "suspended" && c.state !== "interrupted") return false;
  return (navigator as ActivationNavigator).userActivation?.isActive ?? false;
}

const levelGain = (s: SoundSettings): number =>
  s.muted ? 0 : (s.level / 11) * MAX_GAIN;

export function createEngine(): Engine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let settings = readSound();
  let hidden = false;
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const lastPlayed = new Map<CueName, number>();
  /** The clock reading the latest cues start from, shared by every cue less than LEAD after it. */
  let together = -Infinity;
  const loops = new Map<LoopName, () => void>();
  let aura: Aura | null = null;
  let auraLoading = false;
  let dead = false;
  let stopWaiting: (() => void) | undefined;

  const fade = (to: number, over: number) => {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(to, now + over);
  };

  /** The landing sets `data-aura` on `<html>`; no other page does. */
  const wantsAura = () =>
    !!ctx &&
    !hidden &&
    !settings.muted &&
    settings.aura &&
    document.documentElement.hasAttribute("data-aura");

  const stopAura = (over: number) => {
    aura?.stop(over);
    aura = null;
  };

  /** Start or stop the aura to match what the page and the reader ask for. */
  const syncAura = (fadeIn = AURA_RETURN_FADE) => {
    if (!wantsAura()) return stopAura(AURA_OUT_FADE);
    if (aura || auraLoading) return;
    auraLoading = true;
    void import("./aura").then(
      (mod) => {
        auraLoading = false;
        if (dead || !ctx || !master || aura || !wantsAura()) return;
        aura = mod.startAura(ctx, master, fadeIn, settings.track);
      },
      () => {
        auraLoading = false;
      },
    );
  };

  const stopLoops = () => {
    for (const stop of loops.values()) stop();
    loops.clear();
  };

  const apply = (next: SoundSettings) => {
    const was = settings;
    settings = next;
    if (!ctx || !master) return;
    clearTimeout(suspendTimer);
    suspendTimer = undefined;
    if (next.muted) {
      stopLoops();
      fade(0, MUTE_RAMP);
      suspendTimer = setTimeout(
        () => {
          suspendTimer = undefined;
          if (ctx && settings.muted) void ctx.suspend().catch(() => {});
        },
        MUTE_RAMP * 1000 + 10,
      );
    } else if (was.muted) {
      if (!hidden) void ctx.resume().catch(() => {});
      fade(levelGain(next), MUTE_RAMP);
    } else {
      master.gain.setTargetAtTime(levelGain(next), ctx.currentTime, 0.015);
    }
    if (next.muted !== was.muted || next.aura !== was.aura) syncAura();
    if (next.track !== was.track) aura?.switchTo(next.track, AURA_RETURN_FADE);
  };

  const onCue = (event: Event) => {
    if (!ctx || !master || settings.muted) return;
    const detail = (event as CustomEvent<CueDetail>).detail;
    const name = detail?.name;
    const voice = VOICES[name];
    if (!voice) return;
    if (!live(ctx)) return;
    const now = ctx.currentTime;
    const key = GAP_KEY[name] ?? name;
    const last = lastPlayed.get(key);
    if (last !== undefined && now - last < (GAPS[key] ?? DEFAULT_GAP)) return;
    lastPlayed.set(key, now);
    if (!(now - together < LEAD)) together = now;
    voice(ctx, master, together + LEAD, detail.rank ?? 0);
    detail.heard = true;
  };

  const onLoop = (event: Event) => {
    if (!ctx || !master || settings.muted) return;
    const { name, on } = (event as CustomEvent<LoopDetail>).detail;
    if (name === "aura") return syncAura();
    if (on) {
      const start = LOOPS[name];
      if (start && !loops.has(name) && live(ctx))
        loops.set(name, start(ctx, master));
    } else {
      loops.get(name)?.();
      loops.delete(name);
    }
  };

  const onVisibility = () => {
    if (!ctx) return;
    hidden = document.visibilityState === "hidden";
    clearTimeout(hideTimer);
    hideTimer = undefined;
    if (hidden) {
      stopAura(AURA_OUT_FADE);
      // What is sounding finishes first: the aura's fade, the ping of the link that hid the tab.
      hideTimer = setTimeout(() => {
        hideTimer = undefined;
        if (ctx && hidden) void ctx.suspend().catch(() => {});
      }, HIDE_TAIL_MS);
    } else if (!settings.muted) {
      void ctx
        .resume()
        .catch(() => {})
        .then(() => syncAura());
    }
  };

  /** The back/forward cache froze the page: the aura goes, the context sleeps. */
  const onPageHide = () => {
    stopAura(0);
    if (ctx) void ctx.suspend().catch(() => {});
  };

  /** Restored from the cache: resume at once if the browser lets it, else on the next gesture. */
  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted || !ctx || settings.muted) return;
    const c = ctx;
    const revive = () => {
      void c
        .resume()
        .catch(() => {})
        .then(() => {
          if (c.state === "running") syncAura();
        });
    };
    revive();
    if (c.state === "running") return;
    stopWaiting?.();
    const drop = () => {
      window.removeEventListener("pointerdown", again, true);
      window.removeEventListener("keydown", again, true);
      stopWaiting = undefined;
    };
    const again = () => {
      drop();
      revive();
    };
    window.addEventListener("pointerdown", again, true);
    window.addEventListener("keydown", again, true);
    stopWaiting = drop;
  };

  const unsubscribe = onSoundChange(apply);
  const stopNativePanels = watchNativePanels();
  const stopCodeCopy = watchCodeCopy();
  const stopTyping = watchTyping();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);

  return {
    attach(next) {
      if (ctx === next) return;
      ctx = next;
      settings = readSound();
      master = next.createGain();
      master.gain.value = levelGain(settings);
      // Nothing reaches the speakers over the ceiling, whatever a voice does.
      master.connect(ceiling(next)).connect(next.destination);
      setMaster(next, master);
      // Honour the phone's silent switch where the browser lets a page say so.
      const session = (
        navigator as Navigator & { audioSession?: { type: string } }
      ).audioSession;
      if (session) session.type = "ambient";
      document.addEventListener(CUE_EVENT, onCue);
      document.addEventListener(LOOP_EVENT, onLoop);
      syncAura(AURA_FIRST_FADE);
    },
    destroy() {
      unsubscribe();
      stopNativePanels();
      stopCodeCopy();
      stopTyping();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      stopWaiting?.();
      dead = true;
      stopAura(0);
      document.removeEventListener(CUE_EVENT, onCue);
      document.removeEventListener(LOOP_EVENT, onLoop);
      clearTimeout(suspendTimer);
      clearTimeout(hideTimer);
      stopLoops();
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
      ctx = null;
      master = null;
    },
  };
}
