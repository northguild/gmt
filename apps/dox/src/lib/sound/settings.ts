/**
 * The reader's sound choice: a level, a mute, the landing aura and its track.
 *
 * It is one `localStorage` key, `dox:sound`, the same shape as `dox:earth` (src/lib/earth-look.ts).
 * `ThemeProvider.astro` reads the same key inline, before first paint, and sets `data-sound` on
 * `<html>` by the rule `defaultSound` states, so the header's chip paints right on the first frame.
 *
 * The key is written only on a reader's choice (mute, the fader, the Aura switch and track); nothing
 * writes it at load. Once written it wins over the reduced-motion default on every later visit.
 * Storage can throw (private windows, blocked site data): every access is guarded and the page
 * is correct without it.
 */

/** The landing aura's two tracks: "Ice cavern" and "Deep drone". */
export const AURA_TRACKS = ["ice", "deep"] as const;
export type AuraTrack = (typeof AURA_TRACKS)[number];

export const isTrack = (value: unknown): value is AuraTrack =>
  (AURA_TRACKS as readonly unknown[]).includes(value);

export interface SoundSettings {
  /** The volume notch, 1 to 11. */
  level: number;
  muted: boolean;
  /** The landing's ambient loop. */
  aura: boolean;
  /** Which track the aura plays; a choice made with the aura off holds for when it is on. */
  track: AuraTrack;
}

/** The `localStorage` key. `ThemeProvider.astro` reads the same key inline. */
export const SOUND_KEY = "dox:sound";

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 11;

/** Where the origin of a change was: this document's own write, or another tab's. */
export type SoundOrigin = "local" | "storage";

/**
 * What a visitor gets before choosing anything: level 5, the aura on playing Ice cavern, muted
 * only under reduced motion.
 */
export function defaultSound(): SoundSettings {
  let reduce = false;
  try {
    reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // No matchMedia: sound is on.
  }
  return { level: 5, muted: reduce, aura: true, track: "ice" };
}

function clampLevel(value: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(value)));
}

/** The saved choice, field by field over the default; a bad value reads as the default. */
export function readSound(): SoundSettings {
  const settings = defaultSound();
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(SOUND_KEY) ?? "null",
    );
    if (typeof saved === "object" && saved !== null) {
      const o = saved as Record<string, unknown>;
      if (typeof o.level === "number" && Number.isFinite(o.level))
        settings.level = clampLevel(o.level);
      if (typeof o.muted === "boolean") settings.muted = o.muted;
      if (typeof o.aura === "boolean") settings.aura = o.aura;
      if (isTrack(o.track)) settings.track = o.track;
    }
  } catch {
    // Unreadable or corrupt: the default stands.
  }
  return settings;
}

type Listener = (settings: SoundSettings, origin: SoundOrigin) => void;
const listeners = new Set<Listener>();

/** Save a reader's choice and tell this document's listeners. Returns what is now in force. */
export function writeSound(patch: Partial<SoundSettings>): SoundSettings {
  const next = { ...readSound(), ...patch };
  next.level = clampLevel(next.level);
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify(next));
  } catch {
    // The choice holds for this page; it is just not remembered.
  }
  for (const fn of listeners) fn(next, "local");
  return next;
}

/** Call `fn` on a change here or in another tab. Returns the way to stop. */
export function onSoundChange(fn: Listener): () => void {
  listeners.add(fn);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SOUND_KEY || event.key === null)
      fn(readSound(), "storage");
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}
