/**
 * The Morocco 2026 clock-change checker's page widget (CORE-89): whether a runtime has tzdb
 * 2026c or later, the clock changes your data gets wrong, the clock changes in 2026 and 2027, and
 * two live clocks.
 *
 * Every value in the changes, the transitions and the clocks comes from one
 * `GET /gmt/api/morocco-clock-change` answer, computed on the Worker with the library at request
 * time. The widget draws it. The only values it makes itself are the browser column, which is the
 * point of that column, and the wall time of each clock and each stated change, which is the
 * library reading an instant at an offset. No named zone reaches the browser's tz data for a clock.
 *
 * The cards a dated checker shares with the others are in `clock-change-*.ts` and `zone-map.ts`;
 * this file is Morocco's page: its template, its words and its wiring.
 *
 * `renderMoroccoClockChangeTemplate()` is pure markup, so the server renders every table with its
 * known rows and the page does not grow once the answer arrives.
 */
import { MOROCCO_HELP, moroccoKeyPoints } from "../data/morocco-key-points";
import { MOROCCO_MINIMUMS } from "../data/morocco-runtime-minimums";
import { wireClocks } from "./clock-change-clocks";
import {
  SERVERS_LINE,
  cityOf,
  msToNextSecond,
  signedOffset,
} from "./clock-change-common";
import { defineElements } from "~/widgets/define";
import {
  findWidget,
  html,
  idScope,
  setHtml,
  type SafeHtml,
} from "~/widgets/builders";
import {
  changeEntries,
  changeGroups,
  changeListPart,
  listSection,
} from "~/widgets/families/clockcheck/change-list";
import {
  checkerPage,
  classLegend,
} from "~/widgets/families/clockcheck/checker-page";
import { helpCard } from "~/widgets/families/clockcheck/help-card";
import {
  minimumsCard,
  serversCard,
} from "~/widgets/families/clockcheck/info-card";
import { keyPoints } from "~/widgets/families/clockcheck/key-points";
import {
  fillProbe,
  placesChips,
  probeCard,
} from "~/widgets/families/clockcheck/probe-card";
import { PROBE_PARTS } from "~/widgets/families/clockcheck/probe-ids";
import { storedSection } from "~/widgets/families/clockcheck/stored-section";
import {
  wrongList,
  wrongPresentPart,
} from "~/widgets/families/clockcheck/wrong-list";
import { wireStoredTimes } from "./clock-change-stored";
import type { StoredHandle } from "./clock-change-stored";
import {
  MOROCCO_CHANGES,
  MOROCCO_MOMENTS,
  MOROCCO_STOP_YEAR,
  MOROCCO_STOPPED,
  moroccoVerdict,
  MOROCCO_ZONES,
  NODE_PROBE_COMMAND,
  expectedProbeOutput,
  localBefore,
  moroccoClassText,
  moroccoProbe,
  presentText,
  recordedByText,
} from "./morocco-clock-change";
import type { MoroccoCheck } from "./morocco-clock-change";
import { MOROCCO_MAP } from "./morocco-map";
import zoneIds from "./morocco-region-zones.json";
import { MOROCCO_STORED } from "./morocco-saved-example";
import {
  ask,
  clockChangeWidget,
  loadClockLib,
  loadTenseView,
  wallText,
  yearsOf,
} from "./clock-change-mount";
import type { ClockChangeChatArgs, ClockLib } from "./clock-change-mount";
import { withBase } from "./site";
import { regionWhen, tenseView } from "./clock-change-tense";
import type { TenseView } from "./clock-change-tense";
import { bindClockGlow } from "./crystal-clock";
import { showUnavailable } from "./widget-mount";
import { staleZoneIds, wireZoneMap } from "./zone-map";

const NAME = "morocco-clock-change";
const YEARS = yearsOf(MOROCCO_STOP_YEAR);
const CITIES = MOROCCO_ZONES.map((zone) => cityOf(zone));
const CLOCKS_NOTICE = (): SafeHtml =>
  html`The server behind this page has old rules for ${placesChips(CITIES)}, so these clocks show them an hour ahead for most of the year.`;

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export interface MoroccoTemplateOptions {
  /** Namespaces the heading ids, so the chat's copy cannot collide with a page's. */
  idPrefix?: string;
  /** Draws the Key points above the checker. The page does; the chat rail does not. */
  keyPoints?: boolean;
  /** The change in words, written by the library: the page's server render and the chat read it. */
  tense: TenseView;
}

/** Reads the words of the Morocco change from the library. */
export const loadMoroccoTense = (): Promise<TenseView> =>
  loadTenseView(MOROCCO_MOMENTS);

export function renderMoroccoClockChangeTemplate({
  idPrefix = "morocco",
  keyPoints: withKeyPoints = false,
  tense,
}: MoroccoTemplateOptions): SafeHtml {
  const id = idScope(idPrefix);
  return checkerPage({
    name: NAME,
    label: "Morocco 2026 clock-change checker",
    idPrefix,
    keyPoints: withKeyPoints
      ? keyPoints(idPrefix, moroccoKeyPoints(regionWhen(tense)), tense)
      : undefined,
    probe: probeCard(
      moroccoProbe(idPrefix),
      moroccoVerdict(withKeyPoints ? "page" : "chat"),
    ),
    map: {
      zones: zoneIds.zones,
      listLabel: "Morocco and neighbouring time zones, scrollable list",
      mapHeight: MOROCCO_MAP.height,
      legend: classLegend(idPrefix, moroccoClassText, tense),
      clockZones: MOROCCO_ZONES,
      stopped: MOROCCO_STOPPED,
      clocksNotice: CLOCKS_NOTICE(),
    },
    servers: serversCard({
      idPrefix,
      command: NODE_PROBE_COMMAND,
      expected: expectedProbeOutput(),
      line: SERVERS_LINE,
    }),
    minimums: minimumsCard(idPrefix, MOROCCO_MINIMUMS),
    changes: listSection(
      {
        id: id("changes"),
        heading: "Clock changes your data gets wrong",
        gate: "changes",
        note: "Each row is a clock change that the old data and the new data disagree about. Times are the clock as it read just before the change.",
      },
      wrongList(
        idPrefix,
        MOROCCO_ZONES.flatMap((zone) =>
          MOROCCO_CHANGES.map((change) => ({
            zone,
            at: change.at,
            when: `${localBefore(change)} local`,
            shift: `${signedOffset(change.from)} → ${signedOffset(change.to)}`,
            by: recordedByText(change),
          })),
        ),
      ),
    ),
    help: helpCard(idPrefix, MOROCCO_HELP),
    after: listSection(
      {
        id: id("transitions"),
        heading: "Clock changes in 2026 and 2027",
        gate: "transitions",
      },
      changeGroups(idPrefix, MOROCCO_ZONES, YEARS),
    ),
    stored: storedSection({ ...MOROCCO_STORED, idPrefix }),
  });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

export interface MoroccoMountOptions {
  /** The fetch to call the Worker with. Tests pass a fake. */
  fetch?: typeof fetch;
  /** The client's now as a UTC instant. Defaults to the library's `getUtcNow`. */
  now?: () => string;
  /** A zone id to pin on the map once it is drawn. An id not on the map is ignored. */
  pinZone?: string;
  /** Where the map reads and writes `?zone=`. The chat passes inert ones: its URL is not the checker's. */
  location?: Pick<Location, "href">;
  history?: Pick<History, "replaceState">;
}

export async function mountMoroccoClockChange(
  root: HTMLElement,
  signal: AbortSignal,
  options: MoroccoMountOptions = {},
): Promise<void> {
  defineElements();
  const w = findWidget(root, NAME);

  // Every id this mount makes (the clocks' clipPath, gradient and filter ids, the pin clock, the
  // credits button) comes from the scope the template was rendered with, so a page and a chat
  // widget, or two widgets, never share one.
  const idPrefix = w.el.dataset["scope"] ?? "morocco";

  // The browser column needs no library and no answer: fill it first.
  fillProbe(w, moroccoProbe(idPrefix));

  let lib: ClockLib;
  try {
    lib = await loadClockLib();
  } catch (error) {
    showUnavailable(root, error);
    return;
  }
  if (signal.aborted) return;

  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? lib.getUtcNow;
  const status = w.part(PROBE_PARTS.status);
  const recheck = w.part<HTMLButtonElement>(PROBE_PARTS.recheck);
  let check: MoroccoCheck | null = null;
  let busy = false;
  let mapMounted = false;
  let stored: StoredHandle | undefined;

  // --- the words: the change is past, so its date and time are written once, with no tense to follow ---
  const tense = tenseView(lib, MOROCCO_MOMENTS, now());

  bindClockGlow(w.el, signal);

  // --- the changes your data gets wrong -------------------------------------
  function drawWrong(answer: MoroccoCheck): void {
    for (const row of answer.changes) {
      w.part(wrongPresentPart(row.zone, row.at)).textContent = presentText(row);
    }
  }

  // --- the transitions -----------------------------------------------------
  function drawTransitions(answer: MoroccoCheck): void {
    for (const zone of MOROCCO_ZONES) {
      setHtml(
        w.part(changeListPart(zone)),
        changeEntries(
          YEARS.map((year) => ({
            year,
            lines: (
              answer.transitions.find(
                (item) => item.zone === zone && item.year === year,
              )?.changes ?? []
            ).map((change) => {
              const wall = lib.convertUtcToPlainDateTime(change.instant, {
                timeZone: change.offsetBefore,
              });
              return {
                when: wall === "" ? "" : wallText(wall),
                shift: `${signedOffset(change.offsetBefore)} → ${signedOffset(change.offsetAfter)}`,
                utc: change.instant,
              };
            }),
          })),
        ),
      );
    }
  }

  // --- the clocks ----------------------------------------------------------
  const clocks = wireClocks(w, {
    idPrefix,
    lib,
    now,
    signal,
    read: () => check?.zones ?? null,
    zones: MOROCCO_ZONES,
    zoneList: w.part<HTMLElement>("zone-list"),
  });

  // --- the fetch -----------------------------------------------------------
  async function load(): Promise<void> {
    if (busy) return;
    busy = true;
    recheck.setAttribute("aria-busy", "true");
    status.textContent = "Checking\u2026";
    const answer = await ask<MoroccoCheck>(
      withBase("/api/morocco-clock-change"),
      fetchFn,
      signal,
    );
    busy = false;
    recheck.removeAttribute("aria-busy");
    if (signal.aborted) return;
    if (answer.kind === "ok") {
      check = answer.check;
      stored?.setStaleZones(staleZoneIds(MOROCCO_STOPPED, check.zones));
      status.textContent = "";
      drawWrong(check);
      drawTransitions(check);
      clocks.tick();
      // The ready signal for the browser checks: the answer is drawn and the clocks have ticked.
      w.el.dataset["state"] = "ready";
      if (!mapMounted) {
        mapMounted = true;
        const map = wireZoneMap(
          w,
          check.zones,
          signal,
          {
            tense: () => tense,
            responseNow: check.now,
            now,
            wall: (at, offset) =>
              lib.convertUtcToPlainDateTime(at, { timeZone: offset }),
            isBefore: lib.isBeforeUtc,
            msToNextSecond,
            fetch: fetchFn,
            location: options.location,
            history: options.history,
          },
          { ...MOROCCO_MAP, idPrefix },
        );
        if (options.pinZone !== undefined) map.pin(options.pinZone);
      }
    } else if (answer.kind === "rate-limited") {
      stored?.browserUnchecked();
      w.el.dataset["state"] = "error";
      status.textContent =
        answer.seconds === null
          ? "Too many checks. Try again shortly."
          : `Try again in ${answer.seconds} s`;
    } else {
      stored?.browserUnchecked();
      w.el.dataset["state"] = "error";
      status.textContent = "The check could not finish.";
    }
  }

  recheck.addEventListener("click", () => void load(), { signal });
  stored = wireStoredTimes(w, { ...MOROCCO_STORED, idPrefix }, signal, fetchFn);
  await load();
  await stored.ready;
}

// ---------------------------------------------------------------------------
// The chat widget
// ---------------------------------------------------------------------------

/** The chat's markup: the page's sections, with ids namespaced by `idPrefix`. */
export function renderMoroccoClockChangeWidgetTemplate(
  idPrefix: string,
  tense: TenseView,
): SafeHtml {
  return renderMoroccoClockChangeTemplate({ idPrefix, tense });
}

/** Mounts the checker in the chat rail; the wrapper is shared (`clock-change-mount.ts`). */
export type MoroccoClockChangeArgs = ClockChangeChatArgs;

export const mountMoroccoClockChangeWidget = clockChangeWidget(
  mountMoroccoClockChange,
);
