/**
 * The Morocco 2026 clock-change checker's page widget: whether a runtime has tz data 2026c, the
 * clock changes in 2026 and 2027, and live clocks for the two zones tzdb 2026c changes.
 *
 * Every value in the transitions and the clocks comes from one
 * `GET /gmt/api/morocco-clock-change` answer, computed on the Worker with the library at request
 * time. The widget draws it. The only values it makes itself are the browser column, which is
 * the point of that column, the wall time of each clock, which is the library reading the
 * client's now at the Worker's offset, and the wall time of each change in `NO_LONGER`, which is
 * the library reading its instant at the offset before it.
 *
 * The parts every checker shares (the browser card, the transitions, the clocks, the saved-times
 * form) are in `clock-check/template.ts` and `clock-check/mount.ts`. This module is Morocco's page:
 * its words, its data and the order of its rows. It has no map: there is no boundary data to
 * credit. `renderMoroccoClockChangeTemplate()` is pure markup, so the server renders every table
 * with its known rows and the page does not grow once the answer arrives.
 */
import { MOROCCO_HELP, MOROCCO_KEY_POINTS } from "../data/morocco-key-points";
import {
  MOROCCO_MINIMUMS,
  moroccoMinimumsMarkdown,
} from "../data/morocco-runtime-minimums";
import { helpMarkdown, keyPointsMarkdown } from "./clock-check/key-points";
import {
  MOROCCO_FACTS,
  MOROCCO_PROBE,
  MOROCCO_STORED_PRESET,
  MOROCCO_ZONES,
  NO_LONGER,
  type MoroccoCheck,
} from "./morocco-clock-change";
import {
  ask,
  drawTransitions,
  failureText,
  fillBrowserColumn,
  loadCheckLib,
  mountClocks,
  mountStoredTimes,
  readBrowserOffset as readOffset,
  wireCopyAnnounce,
  type CheckLib,
  type StoredHandle,
} from "./clock-check/mount";
import { cityOf } from "./clock-check/facts";
import { savedExample } from "./clock-check/saved-example";
import {
  NO_SIGNAL,
  browserCardHtml,
  changesSectionHtml,
  checkShellHtml,
  clocksSectionHtml,
  helpCardHtml,
  keyPointsHtml,
  minimumsCardHtml,
  placesHtml,
  probeInlineSource as probeInlineSourceOf,
  serversCardHtml,
  serversMarkdownOf,
  storedSectionHtml,
  verdictHtml as verdictHtmlOf,
  type CheckPage,
} from "./clock-check/template";
import {
  INERT_HANDLE,
  onceDestroy,
  showUnavailable,
  type MountFn,
} from "./widget-mount";
import { escapeAttr, escapeHtml } from "./widget-ui";

export { placesHtml };
export {
  storedSummaryText,
  storedTruncatedText,
  msToNextMinute,
  msToNextSecond,
  type BrowserReading,
} from "./clock-check/mount";

const SERVERS_TITLE = "Test your own servers";
const SERVERS_LINE =
  "Run this wherever your code runs (servers, containers, CI). It must print the Correct offsets below. If it doesn't, update the runtime or the OS tzdata package and rebuild images.";

const SAVED_ZONE = "Africa/Casablanca";
const casablanca = MOROCCO_PROBE.find((fact) => fact.zone === SAVED_ZONE);
if (casablanca === undefined) {
  throw new Error(`No reference fact for ${SAVED_ZONE}.`);
}

/** The worked example above the saved-times form: a 9:00 booking in Casablanca on 1 June 2027. */
const MOROCCO_SAVED = savedExample(casablanca, "2027-06-01T09:00:00");

/** Morocco's page: the shared builders read this, and nothing else, for its words and data. */
export const MOROCCO_PAGE: CheckPage = {
  facts: MOROCCO_FACTS,
  idPrefix: "morocco",
  table: MOROCCO_PROBE,
  probeLabel: "1 Jun 2027",
  copy: {
    verdictOk: "Your browser has the new rules for both places.",
    verdictWrong: (places) => ({
      line: `Your browser has old time zone data for ${places}. From 20 September 2026 it shows their time an hour ahead, and it applies Ramadan clock changes in 2027 that no longer happen.`,
      more: [
        `<strong>For you:</strong> update your browser. If it is already up to date, its maker has not shipped the fix yet. Check again after the next update.`,
        `<strong>For developers:</strong> your users&rsquo; browsers can be the same. See step 2 under <a href="#morocco-developers">What to do</a>.`,
      ],
    }),
    correctNote: "tzdb 2026c or later",
    clocksNotice: `This browser has old rules for ${placesHtml(MOROCCO_PROBE.map((fact) => cityOf(fact.zone)))}. Its own clocks show them an hour ahead.`,
    clocksHeading: "Live clocks",
    clocksHint: "Your time, and the time in each zone.",
    changesHeading: "Clock changes in 2026 and 2027",
    changesHint:
      "Times are the clock as it read just before the change. A year with no change in the list has none.",
    serversTitle: SERVERS_TITLE,
    serversLine: SERVERS_LINE,
    storedLead:
      "Apps often save a future event with the UTC offset that applied when it was booked. Where the rules changed, that saved offset is wrong, and the app shows the event an hour off.",
    savedDay: "1 Jun",
  },
  keyPoints: MOROCCO_KEY_POINTS,
  help: MOROCCO_HELP,
  minimums: MOROCCO_MINIMUMS,
  storedPreset: MOROCCO_STORED_PRESET,
  saved: MOROCCO_SAVED,
  transitionZones: MOROCCO_ZONES,
  staleZones: (answer) =>
    answer.probe
      .filter(
        (row) =>
          row.offset !==
          MOROCCO_PROBE.find((fact) => fact.zone === row.zone)?.offset,
      )
      .map((row) => row.zone),
};

// ---------------------------------------------------------------------------
// Wrappers bound to Morocco's page
// ---------------------------------------------------------------------------

export const loadMoroccoLib = loadCheckLib;

/** The Morocco page's inline probe: see `clock-check/template.ts`. */
export function probeInlineSource(): string {
  return probeInlineSourceOf(MOROCCO_PAGE);
}

export function verdictHtml(wrong: readonly string[]): string {
  return verdictHtmlOf(MOROCCO_PAGE, wrong);
}

export function readBrowserOffset(zone: string) {
  return readOffset(MOROCCO_FACTS, zone);
}

/** The Key points as Markdown for the `.md` twin and the llms files. */
export const moroccoKeyPointsMarkdown = (): string =>
  keyPointsMarkdown(MOROCCO_KEY_POINTS);

/** The servers card, the minimum releases and what the library does, as Markdown. */
export function moroccoServersMarkdown(): string {
  return [
    serversMarkdownOf(MOROCCO_PAGE),
    moroccoMinimumsMarkdown(),
    helpMarkdown(MOROCCO_HELP),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// The changes that no longer happen
// ---------------------------------------------------------------------------

/** One zone's changes of `NO_LONGER`, each with its wall time unread until the library loads. */
function noLongerGroupHtml(zone: string): string {
  return (
    `<li class="gmt-morocco-nl-zone" data-zone="${escapeAttr(zone)}">` +
    `<h5 class="gmt-check-group-title"><code>${escapeHtml(zone)}</code></h5>` +
    `<ul class="gmt-check-changes" data-role="no-longer-changes">` +
    NO_LONGER.map(
      (change) =>
        `<li class="gmt-check-change" data-instant="${escapeAttr(change.instant)}">` +
        `<span class="gmt-check-when" data-role="no-longer-wall">${NO_SIGNAL}</span>` +
        `<span class="gmt-check-shift">${escapeHtml(change.offsetBefore)} → ${escapeHtml(change.offsetAfter)}</span>` +
        `<span class="gmt-check-utc">${escapeHtml(change.instant)}</span></li>`,
    ).join("") +
    `</ul></li>`
  );
}

/** The "No longer happen" list and the one line that says what old data does with it. */
export function noLongerHtml(): string {
  return (
    `<div class="gmt-morocco-nolonger" data-role="no-longer">` +
    `<h5 class="gmt-morocco-nolonger-title">No longer happen</h5>` +
    `<p class="gmt-widget-hint">tz data older than 2026c still makes these two changes in both zones.</p>` +
    `<ul class="gmt-check-groups">${MOROCCO_ZONES.map(noLongerGroupHtml).join("")}</ul>` +
    `</div>`
  );
}

/** Fills each change's wall time: its instant read at the offset before it. */
function drawNoLonger(root: HTMLElement, lib: CheckLib): void {
  for (const change of NO_LONGER) {
    const wall = lib.convertUtcToPlainDateTime(change.instant, {
      timeZone: change.offsetBefore,
    });
    root
      .querySelectorAll<HTMLElement>(
        `.gmt-morocco-nl-zone [data-role="no-longer-changes"] li[data-instant="${change.instant}"] [data-role="no-longer-wall"]`,
      )
      .forEach((cell) => {
        cell.innerHTML =
          wall === ""
            ? NO_SIGNAL
            : escapeHtml(wall.replace("T", " ").slice(0, 16));
      });
  }
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export interface MoroccoTemplateOptions {
  /** Namespaces the heading ids, so the chat's copy cannot collide with a page's. */
  idPrefix?: string;
  /** Draws the Key points above the checker. The page does; the chat rail does not. */
  keyPoints?: boolean;
}

export function renderMoroccoClockChangeTemplate({
  idPrefix = "morocco",
  keyPoints = false,
}: MoroccoTemplateOptions = {}): string {
  const page: CheckPage = { ...MOROCCO_PAGE, idPrefix };
  const changes = changesSectionHtml(page, `${idPrefix}-changes-title`).replace(
    /<\/section>$/,
    `${noLongerHtml()}</section>`,
  );
  return checkShellHtml(
    page,
    // Row 1: the Key points on the left, the reader's own browser on the right.
    `<div class="gmt-check-row gmt-check-row--top">` +
      (keyPoints ? keyPointsHtml(MOROCCO_PAGE) : "") +
      browserCardHtml(page, `${idPrefix}-probe-title`) +
      `</div>` +
      // Row 2: the reader's servers beside the minimum releases. Both are info cards.
      `<div class="gmt-check-row">` +
      serversCardHtml(page) +
      minimumsCardHtml(page) +
      `</div>` +
      // Row 3: what the library does about it beside the clock changes.
      `<div class="gmt-check-row">` +
      helpCardHtml(page) +
      changes +
      `</div>` +
      // Row 4: the live clocks, then the saved events, the form on the left and the answers on the right.
      clocksSectionHtml(page, `${idPrefix}-clocks-title`) +
      storedSectionHtml(page, `${idPrefix}-stored-title`),
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

export interface MoroccoMountOptions {
  /** The fetch to call the Worker with. Tests pass a fake. */
  fetch?: typeof fetch;
  /** The client's now as a UTC instant. Defaults to the library's `getUtcNow`. */
  now?: () => string;
  /** The zone the saved-events form completes a line with. A zone outside `MOROCCO_ZONES` is ignored. */
  zone?: string;
}

export async function mountMoroccoClockChange(
  root: HTMLElement,
  signal: AbortSignal,
  options: MoroccoMountOptions = {},
): Promise<void> {
  const q = <T extends HTMLElement>(selector: string) =>
    root.querySelector<T>(selector);

  // The browser column needs no library and no answer: fill it first.
  fillBrowserColumn(MOROCCO_PAGE, root);

  let lib: CheckLib;
  try {
    lib = await loadCheckLib();
  } catch (error) {
    showUnavailable(root, error);
    return;
  }
  if (signal.aborted) return;

  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? lib.getUtcNow;
  const status = q<HTMLElement>('[data-role="status"]');
  const recheck = q<HTMLButtonElement>('[data-role="recheck"]');
  let busy = false;
  let stored: StoredHandle | undefined;

  wireCopyAnnounce(root, signal);
  drawNoLonger(root, lib);
  const clocks = mountClocks(MOROCCO_FACTS, root, signal, lib, now);

  // The form runs once as it mounts, so its zone is set first.
  const picker = q<HTMLSelectElement>('[data-role="stored-zone"]');
  if (
    picker &&
    options.zone !== undefined &&
    (MOROCCO_ZONES as readonly string[]).includes(options.zone)
  ) {
    picker.value = options.zone;
  }

  // --- the fetch -----------------------------------------------------------
  async function load(): Promise<void> {
    if (busy) return;
    busy = true;
    recheck?.setAttribute("aria-busy", "true");
    if (status) status.textContent = "Checking…";
    const answer = await ask<MoroccoCheck>(MOROCCO_FACTS, fetchFn, signal);
    busy = false;
    recheck?.removeAttribute("aria-busy");
    if (signal.aborted) return;
    if (answer.kind === "ok") {
      const check = answer.check;
      stored?.setStaleZones(MOROCCO_PAGE.staleZones(check));
      if (status) status.textContent = "";
      drawTransitions(MOROCCO_PAGE, root, check.transitions);
      clocks.start(check.zones);
    } else {
      stored?.browserUnchecked();
      if (status) status.textContent = failureText(answer);
    }
  }

  recheck?.addEventListener("click", () => void load(), { signal });
  stored = mountStoredTimes(MOROCCO_PAGE, root, signal, fetchFn);
  await load();
  await stored.ready;
}

// ---------------------------------------------------------------------------
// The chat widget
// ---------------------------------------------------------------------------

export interface MoroccoClockChangeArgs {
  /** One zone id from `MOROCCO_ZONES` for the saved-events form. */
  zone?: string;
}

/** The chat's markup: the page's sections, with ids namespaced by `idPrefix`. */
export function renderMoroccoClockChangeWidgetTemplate(
  idPrefix: string,
): string {
  return renderMoroccoClockChangeTemplate({ idPrefix });
}

/**
 * Mounts the checker in the chat rail. The widget fetches the Worker's endpoint like the page
 * does and computes nothing itself.
 *
 * The library load is awaited so a failed load rejects with `WidgetLoadError`, which the host
 * turns into its retry state. The answer is not awaited: the handle returns at once, and the
 * widget's own status line carries a slow or failed Worker.
 */
export const mountMoroccoClockChangeWidget: MountFn<
  MoroccoClockChangeArgs
> = async (root, args, signal) => {
  await loadCheckLib();
  if (signal.aborted) return INERT_HANDLE;
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  mountMoroccoClockChange(root, controller.signal, { zone: args.zone }).catch(
    (error) => {
      if (!controller.signal.aborted) showUnavailable(root, error);
    },
  );
  return onceDestroy(
    () => {
      signal.removeEventListener("abort", stop);
      controller.abort();
    },
    () => {
      const zone = root.querySelector<HTMLSelectElement>(
        '[data-role="stored-zone"]',
      )?.value;
      return zone ? { zone } : null;
    },
  );
};
