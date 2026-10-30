/**
 * The Cut-off Ruler widget (TRAN-10), mountable on its tool page and in the chat rail.
 *
 * One departure's "N days before" read three ways by `cutoffAt` (calendar days, exact hours, a
 * pinned local time) on one axis, with any DST change between them marked. Every reading, every
 * hours-before figure and the transition marker come from `cutoffAt`, `timeToCutoff` and the
 * polyfill's `getTimeZoneTransition` alone.
 *
 * Built on the component kit: `renderCutoffRulerTemplate` writes the markup from builders only,
 * with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids. The drawn parts
 * are placed by `--gmt-at` fractions, so nothing is measured and nothing observes a resize.
 */
import { Temporal } from "@js-temporal/polyfill";
import { defineElements } from "~/widgets/define";
import {
  aside,
  badge,
  card,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  lane,
  mark,
  section,
  select,
  setHtml,
  swatch,
  textInput,
  widget,
  type SafeHtml,
  type TimelineSeries,
} from "~/widgets/builders";
import {
  cutoffBands,
  cutoffScale,
  type Band,
  type ScaleTick,
} from "~/widgets/families/cutoff/bands";
import {
  cutoffGate,
  cutoffTransitionLine,
} from "~/widgets/families/cutoff/gate";
import { paintCalls } from "~/widgets/families/cutoff/paint-calls";
import { paintOutput } from "~/widgets/families/cutoff/paint-output";
import {
  setSelectValue,
  zoneChoices,
} from "~/widgets/families/cutoff/zone-choices";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/cutoff-ruler.module.css";
import {
  CUSTOM_PRESET_ID,
  RULER_PRESETS,
  collectRulerFacts,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readingsOf,
  rulerNullReason,
  rulerNullText,
  transitionBetween,
  transitionKind,
  transitionLabel,
  transitionShiftMinutes,
  type CutoffRulerArgs,
  type RulerFacts,
  type RulerReading,
  type RulerState,
} from "./cutoff-ruler";
import { loadCutoffLib } from "./cutoff-lib";
import {
  dayTickLabel,
  durationText,
  epochMs,
  hourTickLabel,
  isDayBoundary,
  localLabel,
  walkTicks,
  type CutoffLib,
} from "./cutoff-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { CutoffRulerArgs } from "./cutoff-ruler";

const WIDGET_NAME = "cutoff-ruler";
const NBSP = "\u00a0";
const HOUR_MS = 3_600_000;

/** The series each reading is drawn in, in the lane, the close-up and its card: calendar 1,
 *  exact 2, pinned 3. Names a reading, computes nothing. */
const READING_SERIES: Record<string, TimelineSeries> = {
  calendar: 1,
  exact: 2,
  pinned: 3,
};

const seriesOf = (r: RulerReading): TimelineSeries =>
  READING_SERIES[r.key] ?? 1;

const GLOSS: Record<string, string> = {
  calendar: "keeps the departure's time of day",
  exact: "elapsed time, whatever the clock does",
  pinned: "keeps the local time you pin, and lets the elapsed time move",
};

const READING_KEYS = ["calendar", "exact", "pinned"] as const;

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** The word a drawn surface shows when there is nothing to draw. */
function noSignal(): SafeHtml {
  return html`<p class="${styles.lost}">NO SIGNAL</p>`;
}

function daysChoices(days: number): { value: string; label: string }[] {
  const list =
    days >= 1 && days <= 7
      ? [1, 2, 3, 4, 5, 6, 7]
      : [1, 2, 3, 4, 5, 6, 7, days];
  return list.map((n) => ({ value: String(n), label: String(n) }));
}

function headingText(days: string): string {
  return `Three readings of "${days} days before"`;
}

export function renderCutoffRulerTemplate(
  idPrefix: string,
  args: CutoffRulerArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const seeded = args.anchor !== undefined || args.days !== undefined;
  const state: RulerState = seeded
    ? readArgs(args)
    : presetState(RULER_PRESETS[0]!);
  const presetId = matchPreset(state);
  const days = Number.parseInt(state.days, 10) || 1;

  const pick = section(
    { id: id("pick"), heading: "1. The departure and the rule", level: 4 },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...RULER_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${field({
        id: id("anchor"),
        label: "Departs",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.anchor,
            autocomplete: "off",
            spellcheck: false,
          }),
      })}${field({
        id: id("zone"),
        label: "Terminal clock",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.timeZone,
            options: zoneChoices(state.timeZone),
          }),
      })}${field({
        id: id("days"),
        label: "Days before",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: String(days),
            options: daysChoices(days),
          }),
      })}${field({
        id: id("at"),
        label: "At local time",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.atLocalTime,
            autocomplete: "off",
            spellcheck: false,
          }),
      })}`,
    )}`,
  );

  const read = section(
    { id: id("read"), heading: headingText(String(days)), level: 4 },
    html`${grow(html`<div id="${id("overview")}"></div>`)}${grow(
      html`<div id="${id("closeup")}"></div>`,
    )}${grow(html`<p class="${styles.summary}" id="${id("summary")}">${NBSP}</p>`)}${grow(
      html`<ol class="${styles.readings}" id="${id("readings")}"></ol>`,
    )}${grow(html`<p class="${styles.summary}" id="${id("caption")}">${NBSP}</p>`)}${grow(
      html`<div id="${id("reason")}"></div>`,
    )}`,
  );

  const frames = READING_KEYS.map(
    (key) =>
      html`${grow(
        html`<div id="${id(`call-${key}`)}">${codeFrame({
          label: `cutoffAt call, ${key}`,
          copyLabel: `Copy cutoffAt call, ${key}`,
          copyText: "",
          gate: "codeframe",
        })}</div>`,
      )}${grow(
        html`<div id="${id(`out-${key}`)}">${callOutput({
          label: `cutoffAt returned, ${key}`,
          state: "empty",
          lines: [],
        })}</div>`,
      )}`,
  );
  const calls = section(
    { id: id("calls"), heading: "3. What cutoffAt returns", level: 4 },
    html`${frames}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Cut-off Ruler", scope: idPrefix },
    html`${pick}${read}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function localMidnightBefore(ms: number, zone: string): number {
  try {
    return Temporal.Instant.fromEpochMilliseconds(ms)
      .toZonedDateTimeISO(zone)
      .startOfDay().epochMilliseconds;
  } catch {
    return ms;
  }
}

function readingMarkLabel(r: RulerReading): string {
  return `${r.label}: ${localLabel(r.at)}, ${durationText(r.hoursBefore)} before departure`;
}

/** Thin the ticks to the ones a narrow axis keeps: dates and every second hour. */
function scaleOf(
  ticks: { ms: number; label: string }[],
  pct: (ms: number) => number,
): ScaleTick[] {
  return ticks.map((t, i) => ({
    at: pct(t.ms),
    label: t.label,
    rank: isDayBoundary(t.label) || i % 2 === 0 ? 0 : 1,
    day: isDayBoundary(t.label),
  }));
}

function overviewOf(state: RulerState, facts: RulerFacts): SafeHtml {
  if (!facts.departure) return noSignal();
  const timeZone = state.timeZone.trim();
  const departureMs = epochMs(facts.departure);
  const resolvedMs = facts.readings
    .filter((r) => r.at !== "")
    .map((r) => epochMs(r.at));
  const earliestMs =
    resolvedMs.length > 0 ? Math.min(...resolvedMs) : departureMs;
  const startMs = localMidnightBefore(earliestMs, timeZone);
  const span = Math.max(1, departureMs - startMs);
  const pct = (ms: number) => (ms - startMs) / span;

  const transition = transitionBetween(state, facts);
  const kind = transition ? transitionKind(transition) : null;
  const text = transition ? transitionLabel(transition, timeZone) : "";
  const transitionAt = transition ? pct(epochMs(transition.instant)) : 0;
  const bands: Band[] =
    transition && kind === "overlap"
      ? [
          {
            kind: "overlap",
            from: transitionAt,
            to:
              transitionAt +
              (Math.abs(transitionShiftMinutes(transition)) * 60_000) / span,
          },
        ]
      : [];
  const gate = cutoffGate({
    label: `departure ${localLabel(facts.departure)}`,
    at: 1,
  });
  const lanes = facts.readings.map((r) =>
    r.at === ""
      ? lane({ label: r.label }, noSignal())
      : lane(
          { label: r.label },
          html`${cutoffBands(bands)}${
            transition && kind
              ? cutoffTransitionLine({ label: text, at: transitionAt, kind })
              : ""
          }${mark({
            label: readingMarkLabel(r),
            at: pct(epochMs(r.at)),
            series: seriesOf(r),
          })}${gate}`,
        ),
  );
  const ticks = walkTicks(startMs, departureMs, timeZone, "hours", 6, (z) =>
    z.hour === 0 ? dayTickLabel(z) : hourTickLabel(z),
  );
  return html`<div class="${styles.legend}">${transition ? badge({ text, tone: "neutral" }) : ""}${badge(
    { text: `Departs ${localLabel(facts.departure)}`, tone: "cyan" },
  )}</div>${lanes}<div class="${styles.scaleRow}">${cutoffScale(scaleOf(ticks, pct))}</div>`;
}

/** An hour ruler from 2 h before the earliest resolved reading to 2 h after the latest, with
 *  every local hour labelled: this is where "an hour apart" has to be seen. */
function closeupOf(state: RulerState, facts: RulerFacts): SafeHtml {
  const resolved = facts.readings.filter((r) => r.at !== "");
  if (resolved.length === 0) return html``;
  const timeZone = state.timeZone.trim();
  const ms = resolved.map((r) => epochMs(r.at));
  const startMs = Math.min(...ms) - 2 * HOUR_MS;
  const endMs = Math.max(...ms) + 2 * HOUR_MS;
  const span = Math.max(1, endMs - startMs);
  const pct = (v: number) => (v - startMs) / span;
  const ticks = walkTicks(startMs, endMs, timeZone, "hours", 1, hourTickLabel);
  const bands: Band[] = ticks.slice(0, -1).map((t, i) => ({
    kind: "hour",
    from: pct(t.ms),
    to: pct(ticks[i + 1]!.ms),
    tint: i % 2 === 1,
  }));
  const rows = resolved.map((r) =>
    lane(
      { label: r.label },
      html`${cutoffBands(bands)}${mark({
        label: readingMarkLabel(r),
        at: pct(epochMs(r.at)),
        series: seriesOf(r),
      })}`,
    ),
  );
  return html`${rows}<div class="${styles.scaleRow}">${cutoffScale(scaleOf(ticks, pct))}</div>`;
}

/** `localLabel`'s text in two no-wrap spans (date, time), so a narrow card can only wrap
 *  between them. */
function readingTime(label: string): SafeHtml {
  const i = label.lastIndexOf(" ");
  if (i < 0) return html`${label}`;
  return html`<span class="${styles.nowrap}">${label.slice(0, i)}</span> <span class="${styles.nowrap}">${label.slice(i + 1)}</span>`;
}

function readingsOf_(facts: RulerFacts): SafeHtml {
  return html`${facts.readings.map(
    (r, i) =>
      html`<li class="${styles.item}">${card(
        html`<p class="${styles.head}">${swatch({ series: seriesOf(r) })}<span>${r.label}</span></p>${
          r.at === ""
            ? noSignal()
            : html`<p class="${styles.time}">${readingTime(localLabel(r.at))}</p><p class="${styles.meta}">${r.at} · ${durationText(r.hoursBefore)} before departure · (${r.hoursBefore})</p>`
        }<p class="${styles.gloss}">${GLOSS[r.key] ?? ""}</p>`,
        { enter: i },
      )}</li>`,
  )}`;
}

function summaryText(facts: RulerFacts): string {
  return facts.readings
    .map((r) =>
      r.at === ""
        ? `${r.label} is NO SIGNAL.`
        : `${r.label} is ${localLabel(r.at)}, ${durationText(r.hoursBefore)} before departure.`,
    )
    .join(" ");
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(
  root: HTMLElement,
  lib: CutoffLib,
  signal: AbortSignal,
): {
  readState(): RulerState;
  apply(args: CutoffRulerArgs): void;
  start(): void;
} {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const anchorEl = el<HTMLInputElement>("anchor");
  const zoneEl = el<HTMLSelectElement>("zone");
  const daysEl = el<HTMLSelectElement>("days");
  const atEl = el<HTMLInputElement>("at");

  function readState(): RulerState {
    return {
      anchor: anchorEl.value.trim(),
      timeZone: zoneEl.value.trim(),
      days: daysEl.value.trim(),
      atLocalTime: atEl.value.trim(),
    };
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function draw(slot: HTMLElement, make: () => SafeHtml): void {
    try {
      setHtml(slot, make());
    } catch {
      // An instant at the edge of the supported range cannot be placed on an axis.
      setHtml(slot, noSignal());
    }
  }

  function render(): void {
    const s = readState();
    el("read-heading").textContent = headingText(s.days);

    const facts = collectRulerFacts(s, lib);
    for (const spec of readingsOf(s)) {
      paintCalls(el(`call-${spec.key}`), [
        {
          fn: "cutoffAt",
          args: [s.anchor, spec.offset, spec.options],
          result: facts.readings.find((r) => r.key === spec.key)!.at,
        },
      ]);
      const reading = facts.readings.find((r) => r.key === spec.key)!;
      paintOutput(el(`out-${spec.key}`), {
        label: `cutoffAt returned, ${spec.key}`,
        state: reading.at === "" ? "sentinel" : "live",
        lines:
          reading.at === ""
            ? [{ text: "NO SIGNAL", lost: true }]
            : [{ text: reading.at, lost: false }],
      });
    }

    draw(el("overview"), () => overviewOf(s, facts));
    draw(el("closeup"), () => closeupOf(s, facts));
    el("summary").textContent = summaryText(facts);
    setHtml(el("readings"), readingsOf_(facts));
    el("caption").textContent =
      `Date arithmetic that subtracts ${s.days.trim() || "N"} × 86,400,000 ms is the exact-hours row.`;

    const failing = facts.readings.find((r) => r.at === "");
    setHtml(
      el("reason"),
      failing
        ? aside(
            {
              label: "Why NO SIGNAL",
              tone: "caution",
              title: "Why NO SIGNAL",
            },
            html`<p>${(() => {
              const reason = rulerNullReason(failing, s, lib);
              return reason
                ? rulerNullText(reason)
                : "This reading could not be computed.";
            })()}</p>`,
          )
        : html``,
    );
  }

  function applyPreset(): void {
    const chosen = RULER_PRESETS.find((p) => p.id === presetEl.value);
    if (!chosen) return;
    anchorEl.value = chosen.anchor;
    setSelectValue(zoneEl, chosen.timeZone);
    setSelectValue(daysEl, chosen.days);
    atEl.value = chosen.atLocalTime;
    syncPreset();
    render();
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target === presetEl) return;
      syncPreset();
      render();
    },
    { signal },
  );
  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target === presetEl) {
        applyPreset();
        return;
      }
      syncPreset();
      render();
    },
    { signal },
  );

  return {
    readState,
    apply(args) {
      if (args.anchor === undefined && args.days === undefined) return;
      const s = readArgs(args);
      anchorEl.value = s.anchor;
      setSelectValue(zoneEl, s.timeZone);
      setSelectValue(daysEl, s.days);
      atEl.value = s.atLocalTime;
      syncPreset();
    },
    start: render,
  };
}

export const mountCutoffRuler: MountFn<CutoffRulerArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: CutoffLib;
  try {
    lib = await loadCutoffLib();
  } catch (cause) {
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  controller.apply(args);
  controller.start();

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};
