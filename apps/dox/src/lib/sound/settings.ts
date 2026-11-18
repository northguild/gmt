/**
 * The reader's sound choice: a level, a mute, the landing aura and its track.
 *
 * Sound is opt-in. Every visitor starts muted, whatever the system's settings, and only a reader's
 * own choice in the settings panel turns it on. Nothing else reads or writes this choice.
 *
 * It is one `localStorage` key, `dox:sound`, holding a versioned record (`SOUND_VERSION`).
 * `ThemeProvider.astro` reads the same key inline, before first paint, and sets `data-sound` on
 * `<html>` by the same rule, so the panel's speaker paints right on the first frame.
 *
 * What makes it hold up:
 * - Anything this build cannot read (no record, corrupt JSON, another version, a field of the
 *   wrong type) reads as muted. A bad record can never turn sound on.
 * - The key is written only on a reader's choice; nothing writes it at load.
 * - Storage can throw (private windows, blocked site data, a full quota). A choice it cannot keep
 *   still holds for the rest of the page, so an unmute is not undone by the next read.
 * - A change in another tab arrives through the `storage` event. A page restored from the
 *   back/forward cache missed those while frozen, so it reads the key again on `pageshow`.
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

/**
 * The record's version, saved as `v`. A record without it, or with another, reads as the default:
 * raise it when a field changes meaning, so an old record cannot carry a new meaning in.
 */
export const SOUND_VERSION = 1;

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 11;

/**
 * Where a change came from: this document's own write (a reader's gesture), or storage (another
 * tab's write, or the key read again on a return from the back/forward cache).
 */
export type SoundOrigin = "local" | "storage";

/** What a visitor gets before choosing anything: muted, level 5, the aura on playing Ice cavern. */
function defaultSound(): SoundSettings {
  return { level: 5, muted: true, aura: true, track: "ice" };
}

function clampLevel(value: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(value)));
}

/** The record `writeSound` saves. */
function soundRecord(settings: SoundSettings): string {
  return JSON.stringify({ v: SOUND_VERSION, ...settings });
}

/** The saved choice, field by field over the default; a bad record or field reads as the default. */
function storedSound(): SoundSettings {
  const settings = defaultSound();
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(SOUND_KEY) ?? "null",
    );
    if (typeof saved !== "object" || saved === null) return settings;
    const o = saved as Record<string, unknown>;
    if (o.v !== SOUND_VERSION) return settings;
    if (typeof o.level === "number" && Number.isFinite(o.level))
      settings.level = clampLevel(o.level);
    if (typeof o.muted === "boolean") settings.muted = o.muted;
    if (typeof o.aura === "boolean") settings.aura = o.aura;
    if (isTrack(o.track)) settings.track = o.track;
  } catch {
    // Unreadable or corrupt: the default stands.
  }
  return settings;
}

/** This page's last choice, while storage has not kept it. Cleared when a write lands. */
let unsaved: SoundSettings | null = null;

/** The choice in force: this page's unsaved one, or the saved one, or the default. */
export function readSound(): SoundSettings {
  return unsaved ? { ...unsaved } : storedSound();
}

type Listener = (settings: SoundSettings, origin: SoundOrigin) => void;
const listeners = new Set<Listener>();

/** Save a reader's choice and tell this document's listeners. Returns what is now in force. */
export function writeSound(patch: Partial<SoundSettings>): SoundSettings {
  const next = { ...readSound(), ...patch };
  next.level = clampLevel(next.level);
  try {
    localStorage.setItem(SOUND_KEY, soundRecord(next));
    unsaved = null;
  } catch {
    // Not remembered for the next page, but it holds for this one.
    unsaved = next;
  }
  for (const fn of listeners) fn({ ...next }, "local");
  return { ...next };
}

/**
 * Call `fn` on a change here, in another tab, or on a return from the back/forward cache.
 * Returns the way to stop.
 */
export function onSoundChange(fn: Listener): () => void {
  listeners.add(fn);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SOUND_KEY && event.key !== null) return;
    // Another tab's write landed, so it is newer than any choice this page could not save.
    unsaved = null;
    fn(readSound(), "storage");
  };
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) fn(readSound(), "storage");
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("pageshow", onPageShow);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pageshow", onPageShow);
  };
}
