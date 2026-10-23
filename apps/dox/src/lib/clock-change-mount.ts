/**
 * The parts of a dated clock-change checker's page widget that no region owns (CORE-89): the
 * library loader, the request to the Worker, the Key points list, the copy-button wiring and the
 * chat widget wrapper. `canada-clock-change-mount.ts` and `morocco-clock-change-mount.ts` are the
 * regions' templates, words and wiring; each calls these.
 */
import { KEY_POINTS_HEADING, partsHtml } from "../data/clock-change-text";
import type { KeyCard } from "../data/clock-change-text";
import { NO_SIGNAL } from "./clock-change-common";
import { GMT_MODULES } from "./gmt-modules";
import { withBase } from "./site";
import {
  INERT_HANDLE,
  WidgetLoadError,
  onceDestroy,
  showUnavailable,
  type MountFn,
} from "./widget-mount";
import { escapeAttr, escapeHtml, wireCopyButtons } from "./widget-ui";

/** The two years a checker lists: the year its zones stop changing clocks, and the year after. */
export function yearsOf(stopYear: number): readonly [number, number] {
  return [stopYear, stopYear + 1];
}

/** The three library functions a checker's page calls. */
export interface ClockLib {
  convertUtcToPlainDateTime(
    value: string,
    options: { timeZone: string },
  ): string;
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
    const [convert, get, compare] = await Promise.all([
      GMT_MODULES["utc/convert"]!(),
      GMT_MODULES["utc/get"]!(),
      GMT_MODULES["utc/compare"]!(),
    ]);
    return {
      convertUtcToPlainDateTime: pick(convert, "convertUtcToPlainDateTime"),
      getUtcNow: pick(get, "getUtcNow"),
      isBeforeUtc: pick(compare, "isBeforeUtc"),
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}

export type Answer<T> =
  | { kind: "ok"; check: T }
  | { kind: "rate-limited"; seconds: number | null }
  | { kind: "failed" };

/** One GET of a region's endpoint, as a value: a 429 and a failure are answers, not throws. */
export async function ask<T>(
  endpoint: string,
  fetchFn: typeof fetch,
  signal: AbortSignal,
): Promise<Answer<T>> {
  try {
    const response = await fetchFn(withBase(endpoint), { signal });
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

/** One zone's card in the clock-changes list, holding NO SIGNAL for each year until the answer. */
export function transitionGroupHtml(
  zone: string,
  years: readonly number[],
): string {
  return (
    `<li class="gmt-clockcheck-group" data-zone="${escapeAttr(zone)}">` +
    `<h5 class="gmt-clockcheck-group-title"><code>${escapeHtml(zone)}</code></h5>` +
    `<ul class="gmt-clockcheck-changes" data-role="changes">` +
    years.map((year) => `<li data-year="${year}">${NO_SIGNAL}</li>`).join("") +
    `</ul></li>`
  );
}

/** The Key points: a heading and a card for each entry of the region's list. */
export function keyPointsHtml(
  idPrefix: string,
  cards: readonly KeyCard[],
): string {
  return (
    `<section class="gmt-keypoints" aria-labelledby="${idPrefix}-keypoints-title">` +
    `<h2 id="${idPrefix}-keypoints-title">${escapeHtml(KEY_POINTS_HEADING)}</h2>` +
    `<div class="gmt-keypoints-grid">` +
    cards
      .map(
        (card) =>
          `<div class="gmt-keypoints-card"${card.id ? ` id="${escapeAttr(card.id)}"` : ""}>` +
          `<h3>${escapeHtml(card.heading)}</h3>` +
          card.blocks
            .map((block) =>
              block.kind === "p"
                ? `<p>${partsHtml(block.parts)}</p>`
                : `<ol>${block.items.map((item) => `<li>${partsHtml(item)}</li>`).join("")}</ol>`,
            )
            .join("") +
          `</div>`,
      )
      .join("") +
    `</div></section>`
  );
}

/** Wires the copy buttons and the "Copied" announcement of the Node probe command. */
export function wireCopy(root: HTMLElement, signal: AbortSignal): void {
  wireCopyButtons(root);
  const copyStatus = root.querySelector<HTMLElement>(
    '[data-role="copy-status"]',
  );
  root
    .querySelector<HTMLElement>('[data-role="copy-node-probe"]')
    ?.addEventListener(
      "click",
      () => {
        if (copyStatus) copyStatus.textContent = "Copied";
      },
      { signal },
    );
}

const NO_LOCATION: Pick<Location, "href"> = { href: "https://dox.invalid/" };
const NO_HISTORY: Pick<History, "replaceState"> = { replaceState: () => {} };

export interface ClockChangeChatArgs {
  /** One zone id from the region's list to pin on the map. */
  zone?: string;
}

/** What the page's mount function takes in the chat rail: a pin and inert URL handles. */
export interface ChatMountOptions {
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
          '.gmt-zonemap-zone-btn[aria-pressed="true"]',
        )?.dataset.tzId;
        return zone ? { zone } : null;
      },
    );
  };
}
