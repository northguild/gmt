/**
 * The Journey Split widget (INT-14), mountable on its tool page and in the chat
 * rail.
 *
 * A multi-leg journey's hours, sorted two ways on one scale: "as it happens",
 * the legs in order with each wait where it falls, and "gathered", the same
 * segments pushed together with the moving time at the left and the waiting
 * time at the right. Three plates say the ETA, the moving time and the waiting
 * time. A table under the ribbons lists each hand-off, and a link opens the
 * same legs in the Delivery Scheduler, which draws the legs themselves.
 *
 * The mount never computes a time. Every instant comes from
 * `collectJourneyFacts`, every total from `multimodalETA`, and every wait from
 * `diffUtcAsDuration` (`readJourney`, journey-split.ts). The ribbons only place
 * what those calls returned.
 *
 * On screen the stated `dwellAfter` is "handling" and the time at a hand-off is
 * "waiting". The printed call keeps the library's keys.
 *
 * Built on the component kit: `renderJourneySplitTemplate` writes the markup
 * from builders only, with ids from `idScope(idPrefix)`, and `mount` finds its
 * parts by those ids and reads and writes element `value` properties. Every
 * listener is delegated on the widget with the mount's `signal`. There is no
 * drag handle: the tool is a form and presets, and the plates, the frame, the
 * ribbons and the table keep their boxes from one preset to the next.
 */
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  plates,
  section,
  select,
  setHtml,
  srOnly,
  toolLinks,
  widget,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/gnss/call-lines";
import {
  handoffEmpty,
  handoffRows,
  handoffTable,
} from "~/widgets/families/transport/handoff-table";
import {
  journeyLane,
  layer,
  noteChips,
  noteLeaders,
  pct,
  ribbonAxis,
  ribbonBadges,
  ribbonBars,
  ribbonBrackets,
  ribbonEmpty,
  ribbonLegend,
  type RibbonNote,
  type RibbonSegment,
} from "~/widgets/families/transport/journey-ribbons";
import {
  legFieldset,
  legHeader,
  setChoice,
  zoneChoices,
} from "~/widgets/families/transport/leg-fieldset";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { grow } from "~/widgets/primitives/grow/grow";
import styles from "~/widgets/tools/journey-split.module.css";
import { MAX_LEGS, type DeliveryState } from "./delivery-scheduler";
import { NO_RESULT_TITLE } from "./edi-widgets";
import {
  CUSTOM_PRESET_ID,
  JOURNEY_PRESETS,
  NO_HANDOFF_TEXT,
  NO_JOURNEY_TEXT,
  TABLE_COLUMNS,
  axisTicks,
  bracketTexts,
  clampChip,
  hopCells,
  isSeeded,
  journeyPlates,
  layoutRibbons,
  legSeries,
  matchPreset,
  nudgeBadges,
  permalinkOf,
  presetState,
  readArgs,
  readJourney,
  ribbonsAria,
  summaryText,
  waitChipText,
  type JourneyRead,
  type JourneySplitArgs,
  type Placed,
} from "./journey-split";
import { layoutWidth, onWidthChange, thinTickLabels } from "./label-fit";
import type { PlateSpec } from "./ledger-widgets";
import { loadJourneyLib, type JourneyLib } from "./transport-lib";
import { TRANSPORT_ZONES } from "./transport-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { encodeWidgetPermalink } from "./widget-permalink";

export type { JourneySplitArgs } from "./journey-split";

const WIDGET_NAME = "journey-split";

/** The number of hand-offs the table reserves: one fewer than the most legs. */
const TABLE_ROWS = MAX_LEGS - 1;

/** The width of a number badge, for the placer (px). It matches the badge's own size. */
const BADGE_PX = 24;

const LEG_NUMBERS = [1, 2, 3, 4] as const;

/** The widest values the plates show, so they keep their width from one preset to the next. */
const PLATE_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  "hero-eta": ["Wed 88 Mar 88:88"],
  "hero-moving": ["888 d 88 h"],
  "hero-waiting": ["888 d 88 h"],
};

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function plateList(specs: readonly PlateSpec[]): Plate[] {
  return specs.map((s) => {
    const samples = PLATE_SAMPLES[s.role];
    return {
      caption: s.caption,
      value: s.value,
      lines: s.lines,
      ...(s.series === undefined ? {} : { series: s.series }),
      ...(s.quiet === true ? { quiet: true } : {}),
      ...(s.captions === undefined ? {} : { captions: s.captions }),
      ...(samples === undefined ? {} : { samples }),
    };
  });
}

/** The Delivery Scheduler's address for these legs: the same flat leg keys under the other kind. */
function deliveryHref(state: DeliveryState): string {
  return encodeWidgetPermalink("delivery", permalinkOf(state));
}

function linksOf(state: DeliveryState): SafeHtml {
  return toolLinks({
    label: "Other tools",
    links: [
      {
        text: "Open these legs in the Delivery Scheduler",
        href: deliveryHref(state),
      },
    ],
  });
}

const toSegment = (s: Placed): RibbonSegment => ({
  kind: s.kind,
  leg: s.leg,
  series: legSeries(s.leg),
  fromMs: s.fromMs,
  toMs: s.toMs,
});

function reasonOf(read: JourneyRead): SafeHtml {
  if (read.journey !== null) return html``;
  return aside(
    {
      label: "Why there is no result",
      tone: "caution",
      title: NO_RESULT_TITLE,
    },
    html`<p>${read.failure ?? ""}</p>`,
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, the ribbons, the table and the
 * outputs are drawn by `mount`, because they come from the real library calls.
 */
export function renderJourneySplitTemplate(
  idPrefix: string,
  args: JourneySplitArgs = {},
): string {
  const id = idScope(idPrefix);
  const state: DeliveryState = isSeeded(args)
    ? readArgs(args)
    : presetState(JOURNEY_PRESETS[0]!);
  const count = Number.parseInt(state.legCount, 10) || 1;

  const legs = section(
    { id: id("legs"), heading: "1. Set the legs", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...JOURNEY_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${field({
        id: id("leg-count"),
        label: "Legs",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: String(count),
            options: LEG_NUMBERS.map((n) => ({
              value: String(n),
              label: String(n),
            })),
          }),
      })}${field({
        id: id("start-zone"),
        label: "Start zone (optional)",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.startTimeZone,
            options: zoneChoices(
              TRANSPORT_ZONES,
              state.startTimeZone,
              "(none)",
            ),
          }),
      })}`,
    )}
      <p class="${styles.note}">For a published local first departure with no offset or zone of its own.</p>
      <p class="${styles.note}">Durations are ISO 8601: PT46H is 46 hours, PT2H30M is two and a half hours, P11D is 11 days. Handling after is the time the cargo needs at the hand-off before the next leg may leave.</p>
      ${LEG_NUMBERS.map((n) =>
        legFieldset({
          id,
          n,
          leg: state.legs[n - 1]!,
          hidden: n > count,
          zones: TRANSPORT_ZONES,
        }),
      )}</div>`,
  );

  const split = section(
    { id: id("split"), heading: "2. Moving and waiting", level: 4 },
    html`<div class="${styles.frame}" data-gate="frame">
        <div id="${id("plates")}">${plates(plateList(journeyPlates(null)))}</div>
        ${journeyLane({
          id: id("track-happens"),
          label: "As it happens",
          name: `Moving and waiting: ${NO_JOURNEY_TEXT}`,
          variant: "happens",
          children: html`${layer("badges", id("badges"), "")}${layer("bars", id("bars-happens"), "")}${layer("leaders", id("leaders"), "")}${layer("notes", id("notes"), "")}${layer("empty", id("empty-happens"), "")}`,
        })}
        ${journeyLane({
          id: id("track-gathered"),
          label: "Gathered",
          name: `Moving and waiting: ${NO_JOURNEY_TEXT}`,
          variant: "gathered",
          children: html`${layer("bars", id("bars-gathered"), "")}${layer("brackets", id("brackets"), "")}${layer("empty", id("empty-gathered"), "")}`,
        })}
        <div id="${id("axis-slot")}">${ribbonAxis(id("axis"), [])}</div>
        ${ribbonLegend([
          { kind: "moving", text: "moving, one colour for each leg" },
          { kind: "handling", text: "handling" },
          { kind: "scheduled", text: "waiting for the scheduled departure" },
        ])}
      </div>
      <p role="status" aria-label="Journey summary" id="${id("summary")}">${srOnly("")}</p>
      ${handoffTable({
        caption: "Hand-offs",
        columns: TABLE_COLUMNS,
        rows: [],
        reserve: TABLE_ROWS,
        bodyId: id("table-body"),
        emptyId: id("table-empty"),
      })}
      <div id="${id("links")}">${linksOf(state)}</div>
      ${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const calls = section(
    {
      id: id("calls"),
      heading: "3. What multimodalETA returns",
      level: 4,
    },
    html`${grow(
      html`<div id="${id("calls-slot")}">${codeFrame({
        label: "Calls made",
        copyLabel: "Copy calls",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("output-slot")}">${callOutput({
        label: "What the calls returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Journey Split", scope: idPrefix },
    html`${legs}${split}${calls}`,
  ).toString();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): DeliveryState;
  apply(state: DeliveryState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: JourneyLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el, id } = findWidget(root, WIDGET_NAME);

  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const legCountEl = el<HTMLSelectElement>("leg-count");
  const startZoneEl = el<HTMLSelectElement>("start-zone");
  const legEls = LEG_NUMBERS.map((n) => ({
    fieldset: el<HTMLElement>(`leg-${n}`),
    legend: el<HTMLElement>(`leg-legend-${n}`),
    mode: el<HTMLSelectElement>(`mode-${n}`),
    duration: el<HTMLInputElement>(`duration-${n}`),
    zone: el<HTMLSelectElement>(`zone-${n}`),
    departure: el<HTMLInputElement>(`departure-${n}`),
    dwell: el<HTMLInputElement>(`dwell-${n}`),
  }));
  const typed: readonly EventTarget[] = legEls.flatMap((l) => [
    l.duration,
    l.departure,
    l.dwell,
  ]);
  const picked: readonly EventTarget[] = legEls.flatMap((l) => [
    l.zone,
    l.mode,
  ]);

  const legCount = (): number => Number.parseInt(legCountEl.value, 10) || 1;

  function readState(): DeliveryState {
    const legs = legEls.map((l) => ({
      departure: l.departure.value.trim(),
      duration: l.duration.value.trim(),
      timeZone: l.zone.value.trim(),
      dwellAfter: l.dwell.value.trim(),
      mode: l.mode.value.trim(),
    })) as DeliveryState["legs"];
    return {
      legCount: legCountEl.value,
      startTimeZone: startZoneEl.value,
      legs,
    };
  }

  function showFieldsets(count: number): void {
    legEls.forEach((l, i) => {
      l.fieldset.hidden = i + 1 > count;
    });
  }

  function refreshLegends(): void {
    legEls.forEach((l, i) => {
      setHtml(
        l.legend,
        legHeader(i + 1, {
          mode: l.mode.value,
          duration: l.duration.value,
          timeZone: l.zone.value,
        }),
      );
    });
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function drawRibbons(read: JourneyRead): void {
    const ribbons = layoutRibbons(read.segments);
    const drawn = read.journey !== null && ribbons.spanMs > 0;
    const span = Math.max(1, ribbons.spanMs);
    const happens = ribbons.happens.map(toSegment);
    const gathered = ribbons.gathered.map(toSegment);

    setHtml(el("bars-happens"), drawn ? ribbonBars(happens, span) : html``);
    setHtml(el("bars-gathered"), drawn ? ribbonBars(gathered, span) : html``);
    setHtml(el("badges"), drawn ? ribbonBadges(happens, span) : html``);

    // A chip under each wait, one row for each hand-off, with a leader up to the wait.
    const notes: RibbonNote[] = drawn
      ? read.hops.map((hop, row) => {
          const mid = ribbons.happens.filter(
            (s) => s.kind !== "moving" && s.leg === hop.after,
          );
          const from = Math.min(...mid.map((s) => s.fromMs));
          const to = Math.max(...mid.map((s) => s.toMs));
          return {
            hop: hop.after,
            center: pct((from + to) / 2, span),
            row,
            text: waitChipText(hop),
          };
        })
      : [];
    setHtml(el("leaders"), noteLeaders(notes));
    setHtml(el("notes"), noteChips(notes));

    // Two brackets under the gathered ribbon, with the totals as returned.
    if (drawn && read.journey !== null) {
      const movingEnd = Math.max(
        ...ribbons.gathered
          .filter((s) => s.kind === "moving")
          .map((s) => s.toMs),
      );
      const texts = bracketTexts(read.journey);
      setHtml(
        el("brackets"),
        ribbonBrackets({
          movingEnd: pct(movingEnd, span),
          movingText: texts.moving,
          waitingText: texts.waiting,
        }),
      );
    } else {
      setHtml(el("brackets"), html``);
    }

    // The scale: elapsed time from the first departure.
    setHtml(
      el("axis-slot"),
      ribbonAxis(
        id("axis"),
        drawn
          ? axisTicks(ribbons.spanMs).map((t) => ({
              at: pct(t.ms, span),
              label: t.label,
            }))
          : [],
      ),
    );

    const words = drawn ? "" : NO_JOURNEY_TEXT;
    setHtml(el("empty-happens"), ribbonEmpty(words));
    setHtml(el("empty-gathered"), ribbonEmpty(words));
    for (const track of ["track-happens", "track-gathered"]) {
      el(track).setAttribute("aria-label", ribbonsAria(read));
    }
  }

  function drawTable(read: JourneyRead): void {
    setHtml(
      el("table-body"),
      handoffRows(TABLE_COLUMNS, read.hops.map(hopCells), TABLE_ROWS),
    );
    setHtml(
      el("table-empty"),
      handoffEmpty(
        read.journey === null
          ? NO_JOURNEY_TEXT
          : read.hops.length === 0
            ? NO_HANDOFF_TEXT
            : "",
      ),
    );
  }

  /**
   * The passes that need layout: badges kept apart, chips kept inside the
   * track, and axis labels thinned. Jsdom and a hidden widget have no width,
   * so they keep the percentages the markup carries.
   */
  function fit(): void {
    const trackPx = layoutWidth(el("bars-happens"));
    if (trackPx > 0) {
      const badges = [
        ...el("badges").querySelectorAll<HTMLElement>("[data-center]"),
      ];
      const centers = badges.map(
        (b) => (Number(b.dataset["center"] ?? 0) / 100) * trackPx,
      );
      nudgeBadges(centers, BADGE_PX, trackPx).forEach((left, i) => {
        badges[i]!.style.insetInlineStart = `${left}px`;
      });
      for (const chip of el("notes").querySelectorAll<HTMLElement>(
        "[data-center]",
      )) {
        const center = (Number(chip.dataset["center"] ?? 0) / 100) * trackPx;
        chip.style.insetInlineStart = `${clampChip(center, layoutWidth(chip), trackPx)}px`;
        chip.style.translate = "none";
      }
    }
    thinTickLabels(el("axis"), "[data-tick]");
  }

  function render(): void {
    refreshLegends();
    const state = readState();
    const read = readJourney(state, lib);

    setHtml(el("plates"), plates(plateList(journeyPlates(read))));
    drawRibbons(read);
    drawTable(read);
    fit();

    // The calls made, and what they returned.
    const { code, plain } = callLines(read.calls);
    setHtml(
      el("calls-slot"),
      codeFrame({
        label: "Calls made",
        copyLabel: "Copy calls",
        copyText: plain,
        code,
        gate: "codeframe",
      }),
    );
    const out = outputOf(read.journey === null ? "sentinel" : "ok", read.calls);
    setHtml(
      el("output-slot"),
      callOutput({
        label: "What the calls returned",
        state: out.state,
        lines: out.lines,
      }),
    );

    setHtml(el("summary"), srOnly(summaryText(read)));
    setHtml(el("reason"), reasonOf(read));
    setHtml(el("links"), linksOf(state));
  }

  function apply(state: DeliveryState): void {
    const count = Number.parseInt(state.legCount, 10) || 1;
    legCountEl.value = String(count);
    setChoice(startZoneEl, state.startTimeZone);
    legEls.forEach((l, i) => {
      const leg = state.legs[i]!;
      l.departure.value = leg.departure;
      l.duration.value = leg.duration;
      setChoice(l.zone, leg.timeZone);
      l.dwell.value = leg.dwellAfter;
      setChoice(l.mode, leg.mode);
    });
    showFieldsets(count);
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target === null || !typed.includes(e.target)) return;
      syncPreset();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === presetEl) {
        const chosen = JOURNEY_PRESETS.find((p) => p.id === presetEl.value);
        if (!chosen) return;
        apply(presetState(chosen));
        syncPreset();
        render();
        return;
      }
      if (target === legCountEl) {
        showFieldsets(legCount());
        syncPreset();
        render();
        return;
      }
      if (
        target === startZoneEl ||
        (target !== null && picked.includes(target))
      ) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  // The fit passes read the track's measured width, so a width change
  // (rotation, the chat rail opening) fits the badges and chips again.
  const disposeWidth = onWidthChange(el("bars-happens"), fit);

  showFieldsets(legCount());
  syncPreset();
  render();

  return { readState, apply, render, syncPreset, release: disposeWidth };
}

export const mountJourneySplit: MountFn<JourneySplitArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: JourneyLib;
  try {
    lib = await loadJourneyLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    controller.apply(readArgs(args));
    controller.syncPreset();
    controller.render();
  }

  return onceDestroy(
    () => controller.release(),
    () => permalinkOf(controller.readState()),
  );
};
