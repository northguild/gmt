/**
 * The parts of a dated clock-change checker's page widget that no region owns (CORE-89): the
 * library loader, the request to the Worker and the chat widget wrapper. `canada-clock-change-mount.ts` and `morocco-clock-change-mount.ts` are the
 * regions' templates, words and wiring; each calls these.
 */
import { tenseView } from "./clock-change-tense";
import type { Moment, TenseLib, TenseView } from "./clock-change-tense";
import { GMT_MODULES } from "./gmt-modules";
import {
  INERT_HANDLE,
  WidgetLoadError,
  onceDestroy,
  showUnavailable,
  type MountFn,
} from "./widget-mount";

/** The two years a checker lists: the year its zones stop changing clocks, and the year after. */
export function yearsOf(stopYear: number): readonly [number, number] {
  return [stopYear, stopYear + 1];
}

/** The library functions a checker's page calls: its clock, its comparisons and its dates in words. */
export interface ClockLib extends TenseLib {
  getUtcNow(): string;
  isBeforeUtc(value1: string, value2: string): boolean;
}

function pick<T>(module: Record<string, unknown>, name: string): T {
  if (typeof module[name] !== "function") {
    throw new Error(`The library module has no ${name}.`);
  }
  return module[name] as T;
}

export async function loadClockLib(): Promise<ClockLib> {
  try {
    const [convert, get, compare, unixCompare, zonedFormat, utcFormat] =
      await Promise.all([
        GMT_MODULES["utc/convert"]!(),
        GMT_MODULES["utc/get"]!(),
        GMT_MODULES["utc/compare"]!(),
        GMT_MODULES["unix/compare"]!(),
        GMT_MODULES["zoned/format"]!(),
        GMT_MODULES["utc/format"]!(),
      ]);
    return {
      convertUtcToPlainDateTime: pick(convert, "convertUtcToPlainDateTime"),
      convertUtcToUnix: pick(convert, "convertUtcToUnix"),
      getUtcNow: pick(get, "getUtcNow"),
      isBeforeUtc: pick(compare, "isBeforeUtc"),
      isBeforeUnix: pick(unixCompare, "isBeforeUnix"),
      formatZonedDateTime: pick(zonedFormat, "formatZonedDateTime"),
      formatUtc: pick(utcFormat, "formatUtc"),
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}

/**
 * Loads the library and reads the tense of a region's moments at `now`, the library's clock when
 * omitted. The page's
 * server render and the chat's load both call it, so the markup they build says what is true now.
 */
export async function loadTenseView(
  moments: Readonly<Record<string, Moment>>,
  now?: string,
): Promise<TenseView> {
  const lib = await loadClockLib();
  return tenseView(lib, moments, now ?? lib.getUtcNow());
}

type Answer<T> =
  | { kind: "ok"; check: T }
  | { kind: "rate-limited"; seconds: number | null }
  | { kind: "failed" };

/**
 * One GET of a region's endpoint, as a value: a 429 and a failure are answers, not throws. `url`
 * is the full site path, already through `withBase`, so the dist guard sees the base at the call.
 */
export async function ask<T>(
  url: string,
  fetchFn: typeof fetch,
  signal: AbortSignal,
): Promise<Answer<T>> {
  try {
    const response = await fetchFn(url, { signal });
    if (response.status === 429) {
      const seconds = Number(response.headers.get("retry-after"));
      return {
        kind: "rate-limited",
        seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
      };
    }
    if (!response.ok) return { kind: "failed" };
    return { kind: "ok", check: (await response.json()) as T };
  } catch {
    return { kind: "failed" };
  }
}

/** The wall time of a change, `YYYY-MM-DD HH:mm`. */
export function wallText(wall: string): string {
  return wall.replace("T", " ").slice(0, 16);
}

const NO_LOCATION: Pick<Location, "href"> = { href: "https://dox.invalid/" };
const NO_HISTORY: Pick<History, "replaceState"> = { replaceState: () => {} };

export interface ClockChangeChatArgs {
  /** One zone id from the region's list to pin on the map. */
  zone?: string;
}

/** What the page's mount function takes in the chat rail: a pin and inert URL handles. */
interface ChatMountOptions {
  pinZone?: string;
  location: Pick<Location, "href">;
  history: Pick<History, "replaceState">;
}

/**
 * Mounts a checker in the chat rail. The rail is narrow, so the map's container query shows the
 * zone list; the list pins the same zone. The widget fetches the Worker's endpoint like the page
 * does and computes nothing itself. `?zone=` on the chat's URL is neither read nor written.
 *
 * The library load is awaited so a failed load rejects with `WidgetLoadError`, which the host
 * turns into its retry state. The answer is not awaited: the handle returns at once, and the
 * widget's own status line carries a slow or failed Worker.
 */
export function clockChangeWidget(
  mountPage: (
    root: HTMLElement,
    signal: AbortSignal,
    options: ChatMountOptions,
  ) => Promise<void>,
): MountFn<ClockChangeChatArgs> {
  return async (root, args, signal) => {
    await loadClockLib();
    if (signal.aborted) return INERT_HANDLE;
    const controller = new AbortController();
    const stop = () => controller.abort();
    signal.addEventListener("abort", stop, { once: true });
    mountPage(root, controller.signal, {
      pinZone: args.zone,
      location: NO_LOCATION,
      history: NO_HISTORY,
    }).catch((error) => {
      if (!controller.signal.aborted) showUnavailable(root, error);
    });
    return onceDestroy(
      () => {
        signal.removeEventListener("abort", stop);
        controller.abort();
      },
      () => {
        const zone = root.querySelector<HTMLElement>(
          'button[data-tz-id][aria-pressed="true"]',
        )?.dataset.tzId;
        return zone ? { zone } : null;
      },
    );
  };
}
