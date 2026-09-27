/**
 * TanStack Charts definitions for the Delivery Scheduler's two views (TRAN-9,
 * second re-evaluation): the Route view (a schematic metro line, equal
 * station spacing) and the To-scale view (a Gantt-style lane per leg on a
 * real time axis). Both are built from `ChartData` (`delivery-scheduler.ts`)
 * — nothing chart-library-specific lives there, mirroring how
 * `why-gmt-charts.ts` sits beside its own plain data module.
 *
 * Colours are `var(--gmt-*)` strings passed straight into mark options —
 * the same pattern `why-gmt-charts.ts` already uses (`stroke: "var(--gmt-
 * border-strong)"`), which resolves live in the rendered SVG's own DOM and
 * needs no `getComputedStyle` read or re-render on theme change: a CSS
 * custom property inside an SVG presentation attribute re-resolves with the
 * cascade exactly like it would in a stylesheet.
 *
 * Every leg gets its own colour AND its own number badge (`①②③④`) so colour
 * is never the only cue — the same four house tokens (and their
 * contrast-checked "ink" text variants) the leg-card form and the itinerary
 * rail use, never amber, which stays the sentinel's alone.
 */
import { Temporal } from "@js-temporal/polyfill";
import type { ChartDefinition } from "@tanstack/charts";
import { defineChart, dot, link, ruleX, text } from "@tanstack/charts";
import { barX } from "@tanstack/charts/bar";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import type {
  ChartTooltipContent,
  ChartTooltipExtension,
  ChartTooltipRow,
} from "@tanstack/charts/tooltip";
import {
  visibleBarEndMs,
  type ChartConflict,
  type ChartData,
  type ChartLeg,
  type ChartStation,
  type ChartTransition,
} from "./delivery-scheduler";

/** The floor every chart text mark is held to — `--gmt-text-xs` (11.2px)
 *  reads too small; a mark's `fontSize` is a plain number, so it is set
 *  directly here rather than through a token that might not have landed
 *  yet. */
const CHART_FONT_SIZE = 12;

const LEG_COLORS = [
  "var(--gmt-cyan)",
  "var(--gmt-spring)",
  "var(--gmt-dst-purple)",
  "var(--gmt-severity-high)",
] as const;
const LEG_INKS = [
  "var(--gmt-cyan-ink)",
  "var(--gmt-spring-ink)",
  "var(--gmt-purple-ink)",
  "var(--gmt-severity-high-ink)",
] as const;
export const LEG_NUMERALS = ["①", "②", "③", "④"] as const;

export function legColor(index: number): string {
  return LEG_COLORS[index % LEG_COLORS.length]!;
}
export function legInk(index: number): string {
  return LEG_INKS[index % LEG_INKS.length]!;
}
function legNumeral(index: number): string {
  return LEG_NUMERALS[index % LEG_NUMERALS.length]!;
}

const MUTED = "var(--gmt-ice-dim)";
const PRIMARY = "var(--gmt-ice)";
const CONFLICT = "var(--gmt-dst-purple-ink)";

type Tooltip = ChartTooltipExtension | undefined;

function withTooltip<TDatum>(
  tooltip: Tooltip,
  content: (datum: TDatum | undefined) => ChartTooltipContent,
) {
  if (!tooltip) return {};
  return {
    tooltip: {
      use: tooltip,
      content: (points: readonly { datum: unknown }[]) =>
        content(points[0]?.datum as TDatum | undefined),
    },
  };
}

function badgeRows(station: ChartStation): ChartTooltipRow[] {
  return station.badges.map((b) => ({ label: b.kind, value: b.text }));
}

export function stationTooltip(
  station: ChartStation | undefined,
): ChartTooltipContent {
  if (!station) return { rows: [] };
  return {
    title: `${station.city} — ${station.time} (${station.offset})`,
    color: legColor(station.legColorIndex),
    rows: [
      { label: "Local", value: `${station.time} ${station.date}` },
      { label: "Zone", value: station.zone },
      ...badgeRows(station),
    ],
  };
}

export function legTooltip(leg: ChartLeg | undefined): ChartTooltipContent {
  if (!leg) return { rows: [] };
  return {
    title: `${legNumeral(leg.legIndex)} ${leg.mode ?? "Leg"}`,
    color: legColor(leg.legIndex),
    rows: [
      { label: "Duration", value: leg.durationText },
      { label: "ISO duration", value: leg.durationIso },
      ...(leg.missed ? [{ label: "Status", value: "Missed connection" }] : []),
    ],
  };
}

export function transitionTooltip(
  t: ChartTransition | undefined,
): ChartTooltipContent {
  if (!t) return { rows: [] };
  return {
    title: t.kind === "dst" ? "DST transition" : "Date Line",
    color: CONFLICT,
    rows: [{ label: t.zone, value: t.note }],
  };
}

// ---------------------------------------------------------------------------
// Route view: schematic metro line, equal station spacing (a point scale on
// station index). Time never sets a segment's length — only its own
// duration text says how long the leg took.
// ---------------------------------------------------------------------------

export interface RouteChartOptions {
  tooltip?: ChartTooltipExtension;
  /** Narrow container: drop city/date/badge text, keep the time and the
   *  segment's own duration — the rest is in the tooltip, on focus or
   *  hover, per Fitts-scale text at 390px never being reliably readable. */
  compact?: boolean;
}

export function buildRouteChartDefinition(
  data: ChartData,
  options: RouteChartOptions = {},
): ChartDefinition {
  const { tooltip, compact = false } = options;
  const marks: import("@tanstack/charts").ChartMark<
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >[] = [];

  for (const leg of data.legs) {
    marks.push(
      link([leg], {
        x1: "fromStation",
        y1: () => 0,
        x2: "toStation",
        y2: () => 0,
        xScale: "x",
        yScale: "y",
        stroke: legColor(leg.legIndex),
        strokeWidth: 6,
        strokeDasharray: leg.missed ? "2 6" : undefined,
        lineCap: "round",
        ...withTooltip<ChartLeg>(tooltip, legTooltip),
      }),
    );
    const midpoint = (leg.fromStation + leg.toStation) / 2;
    marks.push(
      text([leg], {
        x: () => midpoint,
        y: () => 0,
        xScale: "x",
        yScale: "y",
        text: () => `${legNumeral(leg.legIndex)} ${leg.durationText}`,
        dy: -16,
        anchor: "middle",
        fontSize: CHART_FONT_SIZE,
        fontWeight: 700,
        fill: legInk(leg.legIndex),
      }),
    );
  }

  // One marker per LEG, not per transition — a leg can carry two (its
  // departure zone's and its arrival zone's own spring-forward, say), and
  // two text marks at the same leg's midpoint would sit exactly on top of
  // each other. The tooltip is the first transition found for that leg;
  // the ETA card's own "DST ×N" flag is where the full count lives.
  const transitionsByLeg = new Map<number, ChartTransition[]>();
  for (const t of data.transitions) {
    const list = transitionsByLeg.get(t.legIndex) ?? [];
    list.push(t);
    transitionsByLeg.set(t.legIndex, list);
  }
  for (const [legIndex, legTransitions] of transitionsByLeg) {
    const leg = data.legs.find((l) => l.legIndex === legIndex);
    const first = legTransitions[0];
    if (!leg || !first) continue;
    const midpoint = (leg.fromStation + leg.toStation) / 2;
    marks.push(
      text([first], {
        x: () => midpoint,
        y: () => 0,
        xScale: "x",
        yScale: "y",
        text: () => (first.kind === "dst" ? "DST" : "DL"),
        dy: -36,
        anchor: "middle",
        fontSize: CHART_FONT_SIZE,
        fontWeight: 700,
        fill: CONFLICT,
        ...withTooltip<ChartTransition>(tooltip, transitionTooltip),
      }),
    );
  }

  for (const station of data.stations) {
    marks.push(
      dot([station], {
        x: "index",
        y: () => 0,
        xScale: "x",
        yScale: "y",
        r: 8,
        fill: legColor(station.legColorIndex),
        stroke: "var(--gmt-void)",
        strokeWidth: 2,
        ...withTooltip<ChartStation>(tooltip, stationTooltip),
      }),
    );
    marks.push(
      text([station], {
        x: "index",
        y: () => 0,
        xScale: "x",
        yScale: "y",
        text: () => station.time,
        dy: 22,
        anchor: "middle",
        fontSize: CHART_FONT_SIZE,
        fontWeight: 700,
        fill: PRIMARY,
        ...withTooltip<ChartStation>(tooltip, stationTooltip),
      }),
    );
    if (station.isEta) {
      marks.push(
        text([station], {
          x: "index",
          y: () => 0,
          xScale: "x",
          yScale: "y",
          text: () => "ETA",
          dy: 36,
          anchor: "middle",
          fontSize: CHART_FONT_SIZE,
          fontWeight: 700,
          fill: "var(--gmt-cyan-ink)",
        }),
      );
    }
    if (!compact) {
      const cityRow = station.isEta ? 50 : 36;
      marks.push(
        text([station], {
          x: "index",
          y: () => 0,
          xScale: "x",
          yScale: "y",
          text: () => station.city,
          dy: cityRow,
          anchor: "middle",
          fontSize: CHART_FONT_SIZE,
          fill: MUTED,
        }),
        text([station], {
          x: "index",
          y: () => 0,
          xScale: "x",
          yScale: "y",
          text: () => station.date,
          dy: cityRow + 14,
          anchor: "middle",
          fontSize: CHART_FONT_SIZE,
          fill: MUTED,
        }),
      );
      let dy = cityRow + 30;
      for (const badge of station.badges) {
        const isMissed = badge.kind === "missed";
        marks.push(
          text([station], {
            x: "index",
            y: () => 0,
            xScale: "x",
            yScale: "y",
            text: () => badge.text,
            dy,
            anchor: "middle",
            fontSize: CHART_FONT_SIZE,
            fill: isMissed ? CONFLICT : MUTED,
          }),
        );
        dy += 15;
      }
    }
  }

  return defineChart({
    marks,
    // `x` is a continuous linear scale, deliberately — NOT `scalePoint`. A
    // point scale treats every distinct channel value as its own category,
    // so a segment label's fractional midpoint (0.5, 1.5, …) was landing as
    // a brand-new rank appended after the four station integers, not
    // between them — every label shifted a full station to the right, off
    // the end of the line entirely for the last leg. A linear scale places
    // 0.5 at the true proportional point between 1 and 2's positions,
    // because it treats the domain as one continuous range, not a set.
    // `margin` reserves room for the first and last station's centred text
    // (anchor: "middle" overhangs both edges) and the segment labels' `dy`
    // rise above the line — real inset in the chart's own definition, not
    // hand CSS, so the alignment (and the "nothing clips" guarantee) holds
    // by construction.
    scales: {
      x: { scale: scaleLinear, nice: false, axis: false },
      y: { scale: scalePoint, axis: false },
    },
    margin: { top: 46, right: 56, bottom: 118, left: 56 },
  });
}

// ---------------------------------------------------------------------------
// To-scale view: Gantt lanes, one per leg, on a real time axis. Every leg
// stays visible, even a 2.5h rail run beside 11 days at sea —
// `visibleBarEndMs` (delivery-scheduler.ts) stretches a bar's drawn end to a
// minimum fraction of the journey's span; the tooltip always gives the real
// duration.
// ---------------------------------------------------------------------------

export interface ScaleChartOptions {
  tooltip?: ChartTooltipExtension;
  /** The zone the x-axis's own tick labels are read in — always named in
   *  the axis label too, since the axis runs on exact instants and no
   *  single zone is "the" journey's own. */
  axisZone: string;
  /** The chart's own current rendered width in CSS pixels
   *  (`root.clientWidth`) — decides whether a bar is wide enough to hold
   *  its own duration label. Falls back to a roomy desktop guess for a
   *  pure-data caller with no live DOM to measure. */
  plotWidthPx?: number;
}

/** One lane's own height, and the bar's thickness within it — content
 *  drives the To-scale view's total height (`laneChartHeight`), never an
 *  aspect ratio guess. Every measurement below is real: one row of the
 *  12px text this widget's charts are held to (§ font-size floor), plus
 *  its own padding — not a round-number guess, so the total never runs
 *  short of what the axis and the annotation row actually paint. */
export const LANE_HEIGHT = 36;
export const BAR_THICKNESS = 16;
/** The shared DST / Date Line annotation row, one line of 12px text plus
 *  the padding between it and the plot below. */
export const SCALE_CHART_TOP = 28;
/** Below the plot: the tick marks (6px) + a gap (4px) + one line of 12px
 *  tick-label text + a gap (4px) + one line of 12px axis-label text + a
 *  bottom pad (6px). */
export const SCALE_CHART_BOTTOM = 6 + 4 + 12 + 4 + 12 + 6;

export function laneChartHeight(legCount: number): number {
  return SCALE_CHART_TOP + legCount * LANE_HEIGHT + SCALE_CHART_BOTTOM;
}

/** `right` is generous on purpose: a short leg's duration label (e.g.
 *  "2 h 30 min") lands just past its own bar, and when that bar is the
 *  journey's last leg there is no bar to its right to absorb an overflow —
 *  only this fixed margin. `left` is the y-axis's own lane labels
 *  ("① Truck", …). */
export const CHART_MARGIN_LEFT = 88;
export const CHART_MARGIN_RIGHT = 110;

/** A leg's own y-axis lane label. `extraText`, when given (a bar with room
 *  for its duration label on neither side), folds that duration straight
 *  into the label itself, so the reader still gets it somewhere. */
function laneLabel(
  legIndex: number,
  mode: string | undefined,
  extraText?: string,
): string {
  const base = `${legNumeral(legIndex)} ${mode ? mode[0]!.toUpperCase() + mode.slice(1) : "Leg"}`;
  return extraText ? `${base} · ${extraText}` : base;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** A tick's own label, read through Temporal on the exact millisecond
 *  value the linear scale hands back — never a native `Date`. Below a
 *  two-day span a tick needs the time too, or every tick would print the
 *  same date. */
function formatAxisTick(
  ms: number,
  zone: string,
  journeySpanMs: number,
): string {
  const z = Temporal.Instant.fromEpochMilliseconds(
    Math.round(ms),
  ).toZonedDateTimeISO(zone);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (journeySpanMs < 2 * 24 * 60 * 60 * 1000) {
    return `${WEEKDAYS[z.dayOfWeek - 1]} ${pad(z.hour)}:${pad(z.minute)}`;
  }
  return `${z.day} ${MONTHS[z.month - 1]}`;
}

/** A transition's own rule line: one per real, exact instant — never merged
 *  away, since that instant (and its zone's exact wall-clock jump) is what
 *  the tooltip reports. */
interface TransitionRule {
  atMs: number;
  kind: "dst" | "date-line";
  zoneLabel: string;
  note: string;
}

/** One shared annotation-row label, covering one or more nearby rules. */
interface TransitionLabelGroup {
  rules: readonly TransitionRule[];
  /** The label's own x: the covered rules' mean instant. */
  labelMs: number;
  label: string;
}

/** How close two transitions need to be, as a fraction of the plotted
 *  span, before their labels would visually collide and must merge into
 *  one ("DST: Chicago, Los Angeles") — roughly one label-width's worth of
 *  the axis. */
const TRANSITION_MERGE_FRACTION = 0.05;

/**
 * Every DST / Date Line transition as its own rule line (so two zones'
 * genuinely different instants — Chicago's spring-forward and Los
 * Angeles's, two hours apart — still get two exact vertical lines,
 * tooltip-able independently) grouped for LABELLING: instants closer
 * together than `TRANSITION_MERGE_FRACTION` of the plotted span share one
 * label, centred on their mean, so two rules a few pixels apart never
 * print two overlapping strings. Every remaining label group sits on the
 * same shared row, same y, same baseline — never staggered.
 */
function groupTransitionsForDisplay(
  transitions: readonly ChartTransition[],
  domainSpan: number,
): TransitionLabelGroup[] {
  const rules: TransitionRule[] = transitions.map((t) => ({
    atMs: t.atMs,
    kind: t.kind,
    zoneLabel: t.zone.split("/").pop()?.replace(/_/g, " ") ?? t.zone,
    note: t.note,
  }));
  rules.sort((a, b) => a.atMs - b.atMs);

  const groups: TransitionRule[][] = [];
  const mergeGapMs = domainSpan * TRANSITION_MERGE_FRACTION;
  for (const rule of rules) {
    const current = groups[groups.length - 1];
    const prev = current?.[current.length - 1];
    if (prev && rule.atMs - prev.atMs <= mergeGapMs) {
      current!.push(rule);
    } else {
      groups.push([rule]);
    }
  }

  return groups.map((groupRules) => {
    const zones: string[] = [];
    for (const r of groupRules)
      if (!zones.includes(r.zoneLabel)) zones.push(r.zoneLabel);
    const kind = groupRules[0]!.kind;
    const labelMs =
      groupRules.reduce((sum, r) => sum + r.atMs, 0) / groupRules.length;
    return {
      rules: groupRules,
      labelMs,
      label: `${kind === "dst" ? "DST" : "Date Line"}: ${zones.join(", ")}`,
    };
  });
}

/**
 * The To-scale view: one Gantt lane per leg on a real time axis. At most
 * one text mark per lane (the leg's own duration, inside the bar when it
 * fits, otherwise just past its end) — everything else a reader might want
 * (handoff, dwell, exact station times) is in the tooltip, on focus or
 * hover, never a second text mark competing for the same few pixels. DST
 * and Date Line transitions collapse into one shared, de-duplicated
 * annotation row above the lanes, staggered when two land close together.
 */
export function buildScaleChartDefinition(
  data: ChartData,
  options: ScaleChartOptions,
): ChartDefinition {
  const { tooltip, axisZone } = options;
  const marks: import("@tanstack/charts").ChartMark<
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >[] = [];

  const domainStart = Math.min(...data.legs.map((l) => l.departureMs));
  const domainEnd = Math.max(
    ...data.legs.map((l) =>
      visibleBarEndMs(l.departureMs, l.arrivalMs, data.journeySpanMs),
    ),
    ...(data.conflict
      ? [data.conflict.scheduledMs, data.conflict.readyMs]
      : []),
  );
  const domainSpan = Math.max(1, domainEnd - domainStart);
  // A label's placement is decided in real pixels, not a fixed fraction of
  // the domain — a fraction "wide enough" at 1440px can still be a 30px
  // sliver of room at 390px, since the plot area itself shrinks with the
  // container. `plotWidthPx` is the mount's own best estimate of the
  // chart's actual rendered width right now (`root.clientWidth`); falling
  // back to a roomy desktop guess keeps this pure-data-safe for a caller
  // with no live DOM (e.g. a test).
  const plotWidthPx = Math.max(
    120,
    (options.plotWidthPx ?? 700) - CHART_MARGIN_RIGHT - CHART_MARGIN_LEFT,
  );
  // Monospace at 12px: a safe per-character width estimate, plus a small
  // gap between the label and the bar it names.
  const CHAR_WIDTH_PX = 7.2;
  const LABEL_GAP_PX = 6;
  const pxAt = (ms: number) => ((ms - domainStart) / domainSpan) * plotWidthPx;

  // A bar's own duration label never sits inside the bar — it always reads
  // against the card background, never against a leg colour, so contrast
  // never depends on which leg it is. In order: just to the right of the
  // bar; if there's no room there (the last leg's bar often ends near the
  // plot's own edge), just to the left, right-aligned; if there's no room
  // on EITHER side, the duration folds into that lane's own y-axis label
  // ("① Truck · 1 d 22 h") and the bar draws no text of its own.
  type Placement = "right" | "left" | "axis";
  const placements = new Map<number, Placement>();
  for (const leg of data.legs) {
    if (leg.missed) continue;
    const visibleEnd = visibleBarEndMs(
      leg.departureMs,
      leg.arrivalMs,
      data.journeySpanMs,
    );
    const labelPx = leg.durationText.length * CHAR_WIDTH_PX + LABEL_GAP_PX;
    const roomRight = plotWidthPx - pxAt(visibleEnd);
    const roomLeft = pxAt(leg.departureMs);
    if (roomRight >= labelPx) placements.set(leg.legIndex, "right");
    else if (roomLeft >= labelPx) placements.set(leg.legIndex, "left");
    else placements.set(leg.legIndex, "axis");
  }

  const lanes = data.legs.map((l) =>
    placements.get(l.legIndex) === "axis"
      ? laneLabel(l.legIndex, l.mode, l.durationText)
      : laneLabel(l.legIndex, l.mode),
  );
  const laneFor = (legIndex: number): string =>
    lanes[data.legs.findIndex((l) => l.legIndex === legIndex)] ?? "";

  // The y-axis's own left margin has to fit its LONGEST lane label — and a
  // lane whose duration folded in because neither side of its bar had room
  // ("② Ship · 11 d") is longer than the plain "① Truck" the fixed minimum
  // was sized for. Computed from the actual label text, never guessed, so
  // it never clips regardless of how many legs folded in.
  const leftMargin = Math.max(
    CHART_MARGIN_LEFT,
    ...lanes.map((l) => l.length * CHAR_WIDTH_PX + LABEL_GAP_PX * 3),
  );

  for (const leg of data.legs) {
    if (leg.missed) continue; // drawn as a conflict marker, below — not a bar.
    const visibleEnd = visibleBarEndMs(
      leg.departureMs,
      leg.arrivalMs,
      data.journeySpanMs,
    );
    const lane = laneFor(leg.legIndex);
    const placement = placements.get(leg.legIndex)!;
    marks.push(
      barX([{ ...leg, visibleEnd }], {
        x1: "departureMs",
        x2: () => visibleEnd,
        y: () => lane,
        xScale: "x",
        yScale: "y",
        fill: legColor(leg.legIndex),
        stroke: "var(--gmt-border-strong)",
        strokeWidth: 1,
        radius: 2,
        maxThickness: BAR_THICKNESS,
        ...withTooltip<ChartLeg>(tooltip, legTooltip),
      }),
    );
    if (placement !== "axis") {
      marks.push(
        text([{ ...leg, visibleEnd }], {
          x: placement === "right" ? () => visibleEnd : "departureMs",
          y: () => lane,
          xScale: "x",
          yScale: "y",
          text: () => leg.durationText,
          anchor: placement === "right" ? "start" : "end",
          dx: placement === "right" ? LABEL_GAP_PX : -LABEL_GAP_PX,
          fontSize: CHART_FONT_SIZE,
          fontWeight: 600,
          fill: PRIMARY,
        }),
      );
    }
  }

  // Handoff / dwell intervals: a lighter, outlined bar in the lane of the
  // leg that just arrived — never colour alone (lower opacity plus a
  // dashed outline) — and no text mark of its own; the tooltip carries the
  // handling time and the wait, if any.
  for (let i = 0; i < data.legs.length - 1; i++) {
    const leg = data.legs[i]!;
    const next = data.legs[i + 1];
    if (!next || leg.missed || next.missed) continue;
    if (next.departureMs <= leg.arrivalMs) continue;
    const handoffStation = data.stations.find((s) => s.index === leg.toStation);
    marks.push(
      barX(
        [
          {
            x1: leg.arrivalMs,
            x2: next.departureMs,
            lane: laneFor(leg.legIndex),
          },
        ],
        {
          x1: "x1",
          x2: "x2",
          y: "lane",
          xScale: "x",
          yScale: "y",
          fill: legColor(leg.legIndex),
          fillOpacity: 0.25,
          stroke: legColor(leg.legIndex),
          strokeDasharray: "3 3",
          strokeWidth: 1,
          radius: 2,
          maxThickness: BAR_THICKNESS,
          ...(handoffStation
            ? withTooltip<ChartStation>(tooltip, () =>
                stationTooltip(handoffStation),
              )
            : {}),
        },
      ),
    );
  }

  // Every transition's own exact instant gets a rule line — the tooltip's
  // job — even when its label merges with a neighbour's on the shared row.
  for (const t of data.transitions) {
    marks.push(
      ruleX([t], {
        x: "atMs",
        xScale: "x",
        stroke: CONFLICT,
        strokeDasharray: "2 3",
        strokeWidth: 1,
        ...withTooltip<ChartTransition>(tooltip, transitionTooltip),
      }),
    );
  }
  // One shared annotation row: nearby rules merge into one label instead
  // of stacking or overlapping, and every remaining label sits at the same
  // y — never staggered.
  for (const group of groupTransitionsForDisplay(
    data.transitions,
    domainSpan,
  )) {
    marks.push(
      text([group], {
        x: "labelMs",
        y: () => lanes[0] ?? "",
        xScale: "x",
        yScale: "y",
        text: () => group.label,
        dy: -18,
        anchor: "middle",
        fontSize: CHART_FONT_SIZE,
        fontWeight: 700,
        fill: CONFLICT,
      }),
    );
  }

  for (const station of data.stations) {
    marks.push(
      dot([station], {
        x: "instantMs",
        y: () => laneFor(station.legColorIndex) || lanes[0] || "",
        xScale: "x",
        yScale: "y",
        r: 6,
        fill: legColor(station.legColorIndex),
        stroke: "var(--gmt-void)",
        strokeWidth: 2,
        ...withTooltip<ChartStation>(tooltip, stationTooltip),
      }),
    );
  }

  if (data.conflict) {
    const c = data.conflict;
    const lane = laneFor(c.legIndex);
    marks.push(
      link([c], {
        x1: "readyMs",
        y1: () => lane,
        x2: "scheduledMs",
        y2: () => lane,
        xScale: "x",
        yScale: "y",
        stroke: CONFLICT,
        strokeWidth: 3,
        strokeDasharray: "2 4",
        lineCap: "round",
        ...withTooltip<ChartConflict>(tooltip, (conflict) =>
          conflict
            ? {
                title: "Missed connection",
                color: CONFLICT,
                rows: [
                  {
                    label: "Ready",
                    value: Temporal.Instant.fromEpochMilliseconds(
                      conflict.readyMs,
                    ).toString(),
                  },
                  {
                    label: "Scheduled",
                    value: Temporal.Instant.fromEpochMilliseconds(
                      conflict.scheduledMs,
                    ).toString(),
                  },
                ],
              }
            : { rows: [] },
        ),
      }),
      dot([{ ...c, ms: c.readyMs }], {
        x: "ms",
        y: () => lane,
        xScale: "x",
        yScale: "y",
        r: 5,
        fill: "var(--gmt-void)",
        stroke: CONFLICT,
        strokeWidth: 2,
      }),
      dot([{ ...c, ms: c.scheduledMs }], {
        x: "ms",
        y: () => lane,
        xScale: "x",
        yScale: "y",
        r: 5,
        fill: CONFLICT,
        stroke: CONFLICT,
        strokeWidth: 2,
      }),
      text([c], {
        x: "scheduledMs",
        y: () => lane,
        xScale: "x",
        yScale: "y",
        text: () => "missed",
        dy: -12,
        anchor: "middle",
        fontSize: CHART_FONT_SIZE,
        fontWeight: 700,
        fill: CONFLICT,
      }),
    );
  }

  return defineChart({
    marks,
    scales: {
      x: {
        scale: scaleLinear,
        nice: false,
        grid: true,
        axis: {
          ticks: {
            format: (v) =>
              formatAxisTick(v as number, axisZone, data.journeySpanMs),
          },
          tickLabels: { fontSize: CHART_FONT_SIZE },
          label: `Time in ${axisZone.split("/").pop()?.replace(/_/g, " ") ?? axisZone}`,
        },
      },
      y: {
        scale: scaleBand,
        padding: 0.4,
        axis: { tickLabels: { fontSize: CHART_FONT_SIZE } },
      },
    },
    margin: {
      top: SCALE_CHART_TOP,
      right: CHART_MARGIN_RIGHT,
      bottom: SCALE_CHART_BOTTOM,
      left: leftMargin,
    },
  });
}

export { scaleBand, scaleLinear, scalePoint };
