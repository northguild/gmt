/**
 * The Connection Checker widget (TRAN-9), mountable on its tool page and in
 * the chat rail.
 *
 * One handoff: an arriving leg, a handling-time slider (the minimum connect
 * time) and a scheduled onward departure, checked by the real
 * `scheduleDelivery`. Made or missed is always the library's verdict; the
 * widget's one naive value, `naiveCheck`, is "the times as printed" — a
 * wall-clock addition that agrees when nothing moves the zone's offset
 * between the two ends and disagrees when a DST transition or a zone change
 * does.
 *
 * Built on the component kit: the template is builders only, with ids from
 * `idScope(idPrefix)`; the mount finds its parts by those ids, reads and writes
 * element `value` properties and listens once on the widget with its `signal`.
 * The regions that change height (the verdicts, the reason) sit in `grow()`.
 */
import { defineElements } from "~/widgets/define";
import {
  aside,
  badge,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  hint,
  html,
  idScope,
  lane,
  mark,
  raw,
  section,
  select,
  setHtml,
  textInput,
  verdict as verdictLine,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/connection-checker.module.css";
import {
  CONNECTION_PRESETS,
  CUSTOM_PRESET_ID,
  legsOf,
  matchPreset,
  naiveCheck,
  permalinkOf,
  readArgs,
  verdict,
  type ConnectionCheckerArgs,
  type ConnectionState,
  type Verdict,
} from "./connection-checker";
import { loadTransportLib } from "./transport-lib";
import {
  TRANSPORT_ZONES,
  diagnose,
  epochMs,
  formatSchedule,
  scheduleCallSource,
  scheduleNullText,
  type TransportLib,
} from "./transport-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { RANGE_EDGE_TEXT, codeSpan, isRangeError } from "./widget-ui";

export type { ConnectionCheckerArgs } from "./connection-checker";

const WIDGET_NAME = "connection-checker";
const NBSP = "\u00a0";
const HANDLING_LABEL = "Handling time (minimum connect time)";
const NAIVE_TITLE = "The times as printed";

/** The handling slider's chip and `aria-valuetext`: "1 minute", "45 minutes". */
function minutesText(n: number): string {
  return `${n} ${n === 1 ? "minute" : "minutes"}`;
}

const handlingOf = (text: string): number =>
  Math.min(240, Math.max(0, Number.parseInt(text, 10) || 0));

/** The zones a select offers: the curated list, and a seeded zone outside it. */
function zoneChoices(
  selected: string,
  none?: string,
): { value: string; label: string }[] {
  const list =
    selected === "" || TRANSPORT_ZONES.includes(selected)
      ? TRANSPORT_ZONES
      : [...TRANSPORT_ZONES, selected];
  return [
    ...(none === undefined ? [] : [{ value: "", label: none }]),
    ...list.map((z) => ({ value: z, label: z })),
  ];
}

/** A grid cell: `wide` takes the whole row. */
const box = (wide: boolean, children: SafeHtml): SafeHtml =>
  html`<div class="${styles.box}" data-wide="${String(wide)}">${children}</div>`;

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function verdictsOf(
  v: Verdict | null,
  naiveDetail: string,
  disagrees: boolean,
): SafeHtml {
  return html`<div class="${styles.verdicts}"
    ><div role="status" aria-label="Made or missed"
      >${verdictLine({
        tone: "neutral",
        title: v?.text ?? NBSP,
        detail:
          v?.readyLocal && v.departureLocal
            ? `Ready ${v.readyLocal} · onward departure ${v.departureLocal}`
            : NBSP,
      })}</div
    ><div class="${styles.naive}"
      >${verdictLine({
        tone: "neutral",
        title: NAIVE_TITLE,
        detail: naiveDetail === "" ? NBSP : naiveDetail,
      })}${disagrees ? badge({ text: "disagrees", tone: "purple" }) : ""}</div
    ></div
  >`;
}

/** The mini strip: the arrival, the handling to ready, and the departure, on a
 *  port-local axis from 90 min before arrival to 90 min after the later of ready
 *  and departure. The words are on each mark, so no colour is alone. */
function stripOf(
  v: Verdict,
  arrival: string,
  arrivalMs: number,
  readyMs: number,
  depMs: number,
): SafeHtml {
  const startMs = arrivalMs - 90 * 60_000;
  const endMs = Math.max(readyMs, depMs) + 90 * 60_000;
  const spanMs = Math.max(1, endMs - startMs);
  const at = (ms: number) => (ms - startMs) / spanMs;
  return lane(
    { label: "Handoff" },
    html`${mark({ label: `Arrives ${arrival}`, at: at(arrivalMs), series: 1 })}${mark(
      {
        label: `Handling until ready ${v.readyLocal ?? ""}`,
        at: at(arrivalMs),
        span: Math.max(0.005, at(readyMs) - at(arrivalMs)),
        series: 2,
      },
    )}${mark({
      label: `Onward departure ${v.departureLocal ?? ""}${v.kind === "missed" ? ", missed" : ""}`,
      at: at(depMs),
      series: v.kind === "missed" ? 4 : 3,
    })}`,
  );
}

const blankStrip = (): SafeHtml => lane({ label: "Handoff" }, html``);

/** The strip, or the signal-lost notice when a value is too near the limit of the time range. */
const rangeEdge = (): SafeHtml =>
  callOutput({
    label: "Handoff strip",
    state: "sentinel",
    lines: [{ text: RANGE_EDGE_TEXT, lost: true }],
  });

function reasonOf(text: string | null): SafeHtml {
  return text === null
    ? html``
    : aside(
        { label: "Why no verdict", tone: "caution", title: "Why no verdict" },
        html`<p>${text}</p>`,
      );
}

export function renderConnectionCheckerTemplate(
  idPrefix: string,
  args: ConnectionCheckerArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const seeded = args.inboundDeparture !== undefined;
  const state: ConnectionState = seeded
    ? readArgs(args)
    : { ...CONNECTION_PRESETS[0]!.state };
  const handling = handlingOf(state.handlingMinutes);

  const text = (
    local: string,
    label: string,
    value: string,
    wide = false,
  ): SafeHtml =>
    box(
      wide,
      field({
        id: id(local),
        label,
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value,
            autocomplete: "off",
            spellcheck: false,
          }),
      }),
    );

  const handoff = section(
    { id: id("handoff"), heading: "1. The handoff", level: 4 },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...CONNECTION_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${text(
        "inbound-departure",
        "Inbound departs",
        state.inboundDeparture,
        true,
      )}${text("inbound-duration", "Inbound duration", state.inboundDuration)}${box(
        false,
        field({
          id: id("port-zone"),
          label: "Arrives at the port in",
          control: ({ id: cid }) =>
            select({
              id: cid,
              options: zoneChoices(state.portZone),
              value: state.portZone,
            }),
        }),
      )}`,
    )}${range({
      id: id("handling"),
      label: HANDLING_LABEL,
      min: 0,
      max: 240,
      step: 1,
      value: handling,
      valueText: minutesText(handling),
      ends: ["0 min", "240 min"],
    })}${
      hint(
        id("run-note"),
        "The onward leg's run time does not change whether the connection is made.",
      ).html
    }${fieldGrid(
      html`${text(
        "onward-departure",
        "Onward departs",
        state.onwardDeparture,
        true,
      )}${text(
        "onward-duration",
        "Onward duration (optional)",
        state.onwardDuration,
      )}${box(
        false,
        field({
          id: id("onward-zone"),
          label: "Onward arrives in (optional)",
          control: ({ id: cid }) =>
            select({
              id: cid,
              options: zoneChoices(state.onwardZone, "(the port's zone)"),
              value: state.onwardZone,
            }),
        }),
      )}`,
    )}`,
  );

  const made = section(
    { id: id("made"), heading: "2. Made or missed", level: 4 },
    html`${grow(html`<div id="${id("verdicts")}">${verdictsOf(null, "", false)}</div>`)}<div
        id="${id("strip")}"
        >${blankStrip()}</div
      ><p class="${styles.summary}" id="${id("summary")}">${NBSP}</p
      >${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const calls = section(
    {
      id: id("calls"),
      heading: "3. What scheduleDelivery returns",
      level: 4,
    },
    html`${grow(
      html`<div id="${id("calls-slot")}">${codeFrame({
        label: "Call made",
        copyLabel: "Copy call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("output-slot")}">${callOutput({
        label: "What scheduleDelivery returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Connection Checker", scope: idPrefix },
    html`${handoff}${made}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** A select's value from a seed. A zone is an open list, so a zone outside the
 *  curated ones gets its own option; any other value the select lacks is refused. */
function setZone(el: HTMLSelectElement, value: string): void {
  if (value !== "" && ![...el.options].some((o) => o.value === value)) {
    el.append(new Option(value, value));
  }
  el.value = value;
}

interface Controller {
  readState(): ConnectionState;
  apply(state: ConnectionState): void;
  syncPreset(): void;
  render(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: TransportLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);

  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const handlingEl = widgetEl.querySelector<GmtRange>("gmt-range")!;
  handlingEl.formatValue = minutesText;
  const inboundDepartureEl = el<HTMLInputElement>("inbound-departure");
  const inboundDurationEl = el<HTMLInputElement>("inbound-duration");
  const portZoneEl = el<HTMLSelectElement>("port-zone");
  const onwardDepartureEl = el<HTMLInputElement>("onward-departure");
  const onwardDurationEl = el<HTMLInputElement>("onward-duration");
  const onwardZoneEl = el<HTMLSelectElement>("onward-zone");

  function readState(): ConnectionState {
    return {
      inboundDeparture: inboundDepartureEl.value.trim(),
      inboundDuration: inboundDurationEl.value.trim(),
      portZone: portZoneEl.value.trim(),
      handlingMinutes: String(handlingEl.value),
      onwardDeparture: onwardDepartureEl.value.trim(),
      onwardDuration: onwardDurationEl.value.trim(),
      onwardZone: onwardZoneEl.value.trim(),
    };
  }

  function apply(s: ConnectionState): void {
    inboundDepartureEl.value = s.inboundDeparture;
    inboundDurationEl.value = s.inboundDuration;
    setZone(portZoneEl, s.portZone);
    handlingEl.value = handlingOf(s.handlingMinutes);
    onwardDepartureEl.value = s.onwardDeparture;
    onwardDurationEl.value = s.onwardDuration;
    setZone(onwardZoneEl, s.onwardZone);
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function drawStrip(legs: ReturnType<typeof legsOf>, v: Verdict): SafeHtml {
    const arrival = legs[0]
      ? lib.scheduleDelivery([legs[0]])?.legTimes[0]?.arrival
      : undefined;
    if (!arrival || !v.readyLocal) return blankStrip();
    const arrivalMs = epochMs(arrival);
    const readyMs = epochMs(v.readyLocal);
    const depMs = v.departureLocal ? epochMs(v.departureLocal) : readyMs;
    return stripOf(v, arrival, arrivalMs, readyMs, depMs);
  }

  function render(): void {
    const s = readState();
    const legs = legsOf(s);
    const result = lib.scheduleDelivery(legs);

    const [callHtml, callPlain] = scheduleCallSource(legs);
    setHtml(
      el("calls-slot"),
      codeFrame({
        label: "Call made",
        copyLabel: "Copy call",
        copyText: `scheduleDelivery(${callPlain})`,
        code: raw(`${codeSpan("fn", "scheduleDelivery")}(${callHtml})`),
        gate: "codeframe",
      }),
    );
    setHtml(
      el("output-slot"),
      callOutput({
        label: "What scheduleDelivery returned",
        state: result === null ? "sentinel" : "live",
        lines: [
          result === null
            ? { text: "", lost: true }
            : { text: formatSchedule(result), lost: false },
        ],
      }),
    );

    const v = verdict(legs, lib);
    const naive = naiveCheck(s);
    const disagrees =
      naive !== null &&
      ((v.kind === "made") !== naive.made || v.kind === "no-verdict");
    setHtml(
      el("verdicts"),
      verdictsOf(
        v,
        naive
          ? `Lands ${naive.lands} · ready ${naive.ready} · leaves ${naive.leaves}: ${naive.made ? "made" : "missed"}`
          : "",
        disagrees,
      ),
    );

    let summary = naive
      ? `Arrival, then handling to ready ${v.readyLocal ?? ""}, then the onward departure ${v.departureLocal ?? ""}.`
      : NBSP;
    try {
      setHtml(el("strip"), drawStrip(legs, v));
    } catch (error) {
      if (!isRangeError(error)) throw error;
      setHtml(el("strip"), rangeEdge());
      summary = RANGE_EDGE_TEXT;
    }
    el("summary").textContent = summary;

    if (v.kind === "no-verdict") {
      const diag = diagnose(legs, undefined, lib);
      setHtml(
        el("reason"),
        reasonOf(
          diag
            ? scheduleNullText(diag.reason, diag.leg + 1)
            : "The connection could not be checked.",
        ),
      );
    } else {
      setHtml(el("reason"), reasonOf(null));
    }
  }

  const typed: readonly EventTarget[] = [
    inboundDepartureEl,
    inboundDurationEl,
    handlingEl,
    onwardDepartureEl,
    onwardDurationEl,
  ];

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
        const chosen = CONNECTION_PRESETS.find((p) => p.id === presetEl.value);
        if (!chosen) return;
        apply(chosen.state);
        syncPreset();
        render();
        return;
      }
      if (target === portZoneEl || target === onwardZoneEl) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  render();
  return { readState, apply, syncPreset, render };
}

export const mountConnectionChecker: MountFn<ConnectionCheckerArgs> = async (
  root,
  args = {},
  signal,
) => {
  defineElements();
  let lib: TransportLib;
  try {
    lib = await loadTransportLib();
  } catch (cause) {
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  if (args.inboundDeparture !== undefined) {
    controller.apply(readArgs(args));
    controller.syncPreset();
    controller.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};
