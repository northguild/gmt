/**
 * How Dox displays dates, app-wide — one store every surface reads.
 *
 * Today its writers are the reset clock's popover (format and zone) and its
 * readers are that clock and the header clock in the `/dox` strip. App-level
 * date controls will write here later, and every date on the site can follow.
 *
 * ## Why TanStack Store
 *
 * Framework-agnostic: a module-level store is shared by every Astro island on a
 * page with no provider, and the plain-TypeScript widgets (the globe, the zone
 * scrubber) can subscribe without React. The app already uses TanStack
 * (`@tanstack/charts`, `@tanstack/virtual-core`).
 *
 * ## Hydration
 *
 * The store starts on the defaults everywhere, the server included. Stored
 * picks are applied by `hydrateDateDisplay()`, which every consumer calls from
 * an effect — so nothing that depends on them can reach server-rendered
 * markup and hydrate against a different value (#418). Consumers already
 * render no date until mount, because the reader's zone is not the server's.
 */
import { createStore } from "@tanstack/store";
import {
  DEFAULT_RESET_FORMAT_ID,
  isResetFormatId,
  type ResetFormatId,
} from "./reset-formats";

export interface DateDisplayState {
  /** Which gmt-backed preset to render dates with. */
  formatId: ResetFormatId;
  /** IANA zone for zoned presets, or `null` for the reader's own. */
  zone: string | null;
}

/** The storage surface this module touches — `localStorage` in the browser,
 * an in-memory stand-in in tests. */
export type DateDisplayStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

const FORMAT_KEY = "dox:date-format";
const ZONE_KEY = "dox:date-zone";

export const DEFAULT_DATE_DISPLAY: DateDisplayState = {
  formatId: DEFAULT_RESET_FORMAT_ID,
  zone: null,
};

export const dateDisplayStore =
  createStore<DateDisplayState>(DEFAULT_DATE_DISPLAY);

export function setDateFormat(formatId: ResetFormatId): void {
  dateDisplayStore.setState((state) => ({ ...state, formatId }));
}

export function setDateZone(zone: string | null): void {
  dateDisplayStore.setState((state) => ({ ...state, zone }));
}

/** `localStorage`, or nothing: it throws in some private modes and when site
 * data is blocked, and does not exist on the server. */
function browserStorage(): DateDisplayStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function read(storage: DateDisplayStorage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(
  storage: DateDisplayStorage | undefined,
  key: string,
  value: string | null,
): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // Not persisted; the pick still holds for this session.
  }
}

let unsubscribe: (() => void) | null = null;

/**
 * Apply the reader's stored picks and start saving changes. Idempotent — every
 * consumer calls it on mount, and only the first call does anything.
 *
 * A stored format this build does not know (renamed, removed) is ignored. A
 * stored zone is kept as-is; checking it against the zone list is the
 * consumer's job, since only it holds that list.
 */
export function hydrateDateDisplay(
  storage: DateDisplayStorage | undefined = browserStorage(),
): void {
  if (unsubscribe) return;

  const storedFormat = read(storage, FORMAT_KEY);
  const storedZone = read(storage, ZONE_KEY);
  dateDisplayStore.setState(() => ({
    formatId: isResetFormatId(storedFormat)
      ? storedFormat
      : DEFAULT_RESET_FORMAT_ID,
    zone: storedZone || null,
  }));

  ({ unsubscribe } = dateDisplayStore.subscribe(() => {
    const { formatId, zone } = dateDisplayStore.state;
    write(storage, FORMAT_KEY, formatId);
    write(storage, ZONE_KEY, zone);
  }));
}

/** Back to the defaults, not hydrated. For tests — the same seam as
 * `resetRateLimitState` in worker/rate-limit.ts. */
export function resetDateDisplay(): void {
  unsubscribe?.();
  unsubscribe = null;
  dateDisplayStore.setState(() => DEFAULT_DATE_DISPLAY);
}
