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
 * Follows the Free Time Ledger's split: every listener is delegated on the
 * root, so the host dropping the subtree is a complete teardown.
 */
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
} from "./connection-checker";
import { codeFrameHtml } from "./code-frame";
import { loadTransportLib } from "./transport-lib";
import {
  TRANSPORT_ZONES,
  diagnose,
  epochMs,
  formatSchedule,
  scheduleCallSource,
  scheduleNullText,
  zoneOptionsHtml,
  type TransportLib,
} from "./transport-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  wireCopyButtons,
} from "./widget-ui";

export type { ConnectionCheckerArgs } from "./connection-checker";

function presetOptions(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    CONNECTION_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

export function renderConnectionCheckerTemplate(
  args: ConnectionCheckerArgs = {},
): string {
  const seeded = args.inboundDeparture !== undefined;
  const state: ConnectionState = seeded
    ? readArgs(args)
    : { ...CONNECTION_PRESETS[0]!.state };
  const presetId = matchPreset(state);
  const preset = CONNECTION_PRESETS.find((p) => p.id === presetId);
  const handling = Number.parseInt(state.handlingMinutes, 10) || 0;

  const text = (role: string, label: string, value: string) =>
    `<label class="gmt-label"><span>${escapeHtml(label)}</span>` +
    `<input class="gmt-input" data-role="${role}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(value)}"></label>`;

  return (
    `<div class="gmt-connection gmt-widget">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. The handoff</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Preset</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="preset">${presetOptions(presetId)}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description">${escapeHtml(preset?.description ?? "")}</p>` +
    `<div class="gmt-widget-controls gmt-connection-fields">` +
    text("inbound-departure", "Inbound departs", state.inboundDeparture) +
    text("inbound-duration", "Inbound duration", state.inboundDuration) +
    `<label class="gmt-label"><span>Arrives at the port in</span>` +
    `<select class="gmt-select" data-role="port-zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.portZone)}</select></label>` +
    `</div>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Handling time (minimum connect time)</span>` +
    `<input class="gmt-range" data-role="handling" type="range" min="0" max="240" step="1" value="${handling}">` +
    `<output data-role="handling-value"></output></label>` +
    `</div>` +
    `<p class="gmt-widget-hint">The onward leg's run time does not change whether the connection is made.</p>` +
    `<div class="gmt-widget-controls gmt-connection-fields">` +
    text("onward-departure", "Onward departs", state.onwardDeparture) +
    text(
      "onward-duration",
      "Onward duration (optional)",
      state.onwardDuration,
    ) +
    `<label class="gmt-label"><span>Onward arrives in (optional)</span>` +
    `<select class="gmt-select" data-role="onward-zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.onwardZone, "(the port's zone)")}</select></label>` +
    `</div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. Made or missed</h4>` +
    `<div class="gmt-connection-verdicts">` +
    `<div><p class="gmt-transport-verdict" data-role="verdict" aria-live="polite"></p>` +
    `<p class="gmt-transport-verdict-detail" data-role="verdict-detail"></p></div>` +
    `<div><p class="gmt-transport-verdict" data-role="naive-verdict">The times as printed</p>` +
    `<p class="gmt-transport-verdict-detail" data-role="naive-detail"></p></div>` +
    `</div>` +
    `<div data-role="handoff-strip" role="img" aria-labelledby="connection-handoff-summary"></div>` +
    `<p class="gmt-widget-hint" id="connection-handoff-summary" data-role="handoff-summary"></p>` +
    `<div class="gmt-transport-reason" data-role="reason-aside"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What <code>scheduleDelivery</code> returns</h4>` +
    codeFrameHtml("connection") +
    `<output class="gmt-widget-output" data-role="connection-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(root: HTMLElement, lib: TransportLib): void {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const inboundDepartureEl = q<HTMLInputElement>("inbound-departure");
  const inboundDurationEl = q<HTMLInputElement>("inbound-duration");
  const portZoneEl = q<HTMLSelectElement>("port-zone");
  const handlingEl = q<HTMLInputElement>("handling");
  const onwardDepartureEl = q<HTMLInputElement>("onward-departure");
  const onwardDurationEl = q<HTMLInputElement>("onward-duration");
  const onwardZoneEl = q<HTMLSelectElement>("onward-zone");
  if (
    !presetEl ||
    !inboundDepartureEl ||
    !inboundDurationEl ||
    !portZoneEl ||
    !handlingEl ||
    !onwardDepartureEl ||
    !onwardDurationEl ||
    !onwardZoneEl
  ) {
    return;
  }

  function state(): ConnectionState {
    return {
      inboundDeparture: inboundDepartureEl!.value.trim(),
      inboundDuration: inboundDurationEl!.value.trim(),
      portZone: portZoneEl!.value.trim(),
      handlingMinutes: handlingEl!.value.trim(),
      onwardDeparture: onwardDepartureEl!.value.trim(),
      onwardDuration: onwardDurationEl!.value.trim(),
      onwardZone: onwardZoneEl!.value.trim(),
    };
  }

  function syncPreset(): void {
    presetEl!.value = matchPreset(state());
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        CONNECTION_PRESETS.find((p) => p.id === presetEl!.value)?.description ??
        "";
    }
  }

  function render(): void {
    const s = state();
    const legs = legsOf(s);
    const result = lib.scheduleDelivery(legs);
    const handlingMinutes = Number.parseInt(s.handlingMinutes, 10) || 0;

    const handlingValue = q("handling-value");
    if (handlingValue) {
      handlingValue.textContent = `PT${handlingMinutes}M (${handlingMinutes} min)`;
    }

    const [callHtml, callPlain] = scheduleCallSource(legs);
    renderCallLine(
      q("call-connection"),
      "scheduleDelivery",
      callHtml,
      callPlain,
    );

    const out = q("connection-output");
    if (out) {
      if (result === null) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(out, formatSchedule(result), "live");
    }

    const v = verdict(legs, lib);
    const verdictEl = q("verdict");
    if (verdictEl) verdictEl.textContent = v.text;
    const verdictDetail = q("verdict-detail");
    if (verdictDetail) {
      verdictDetail.textContent =
        v.readyLocal && v.departureLocal
          ? `Ready ${v.readyLocal} · onward departure ${v.departureLocal}`
          : "";
    }

    const naive = naiveCheck(s);
    const naiveDetail = q("naive-detail");
    let disagrees = false;
    if (naiveDetail) {
      if (naive) {
        naiveDetail.textContent = `Lands ${naive.lands} · ready ${naive.ready} · leaves ${naive.leaves}: ${naive.made ? "made" : "missed"}`;
        disagrees =
          (v.kind === "made") !== naive.made || v.kind === "no-verdict";
      } else {
        naiveDetail.textContent = "";
      }
    }
    const naiveVerdictEl = q("naive-verdict");
    if (naiveVerdictEl) {
      const existing = naiveVerdictEl.querySelector(".gmt-transport-badge");
      if (existing) existing.remove();
      if (disagrees) {
        naiveVerdictEl.insertAdjacentHTML(
          "beforeend",
          ` <span class="gmt-transport-badge gmt-transport-badge--disagrees" data-role="disagrees">disagrees</span>`,
        );
      }
    }

    const strip = q("handoff-strip");
    const summary = q("handoff-summary");
    if (strip) renderStrip(strip, legs, v, lib);
    if (summary) {
      summary.textContent = naive
        ? `Arrival, then handling to ready ${v.readyLocal ?? ""}, then the onward departure ${v.departureLocal ?? ""}.`
        : "";
    }

    const aside = q("reason-aside");
    if (aside) {
      if (v.kind === "no-verdict") {
        const diag = diagnose(legs, undefined, lib);
        const text = diag
          ? scheduleNullText(diag.reason, diag.leg + 1)
          : "The connection could not be checked.";
        renderAside(
          aside,
          "caution",
          "Why no verdict",
          `<p>${escapeHtml(text)}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }
  }

  function applyPreset(): void {
    const preset = CONNECTION_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    inboundDepartureEl!.value = preset.state.inboundDeparture;
    inboundDurationEl!.value = preset.state.inboundDuration;
    portZoneEl!.value = preset.state.portZone;
    handlingEl!.value = preset.state.handlingMinutes;
    onwardDepartureEl!.value = preset.state.onwardDeparture;
    onwardDurationEl!.value = preset.state.onwardDuration;
    onwardZoneEl!.value = preset.state.onwardZone;
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (
      target === inboundDepartureEl ||
      target === inboundDurationEl ||
      target === handlingEl ||
      target === onwardDepartureEl ||
      target === onwardDurationEl
    ) {
      syncPreset();
      render();
    }
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) {
      applyPreset();
      return;
    }
    if (target === portZoneEl || target === onwardZoneEl) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);
  render();
}

/** A mini strip: the arrival, a hatched handling bar to ready, and the
 *  departure marker, on a port-local axis from 90 min before arrival to
 *  90 min after the later of ready and departure. */
function renderStrip(
  el: HTMLElement,
  legs: ReturnType<typeof legsOf>,
  v: ReturnType<typeof verdict>,
  lib: TransportLib,
): void {
  const arrival = legs[0]
    ? lib.scheduleDelivery([legs[0]!])?.legTimes[0]?.arrival
    : undefined;
  if (!arrival || !v.readyLocal) {
    el.innerHTML = "";
    return;
  }
  const arrivalMs = epochMs(arrival);
  const readyMs = v.readyLocal ? epochMs(v.readyLocal) : arrivalMs;
  const depMs = v.departureLocal ? epochMs(v.departureLocal) : readyMs;
  const laterMs = Math.max(readyMs, depMs);
  const startMs = arrivalMs - 90 * 60_000;
  const endMs = laterMs + 90 * 60_000;
  const span = Math.max(1, endMs - startMs);
  const pct = (ms: number) => ((ms - startMs) / span) * 100;

  el.innerHTML =
    `<div class="gmt-connection-strip">` +
    `<span class="gmt-connection-mark gmt-connection-mark--arrival" style="left:${pct(arrivalMs)}%"></span>` +
    `<span class="gmt-connection-bar" style="left:${pct(arrivalMs)}%;width:${Math.max(0.5, pct(readyMs) - pct(arrivalMs))}%"></span>` +
    `<span class="gmt-connection-mark gmt-connection-mark--departure${v.kind === "missed" ? " gmt-connection-mark--missed" : ""}" style="left:${pct(depMs)}%"></span>` +
    `</div>`;
}

function applyArgs(root: HTMLElement, args: ConnectionCheckerArgs): void {
  if (args.inboundDeparture === undefined) return;
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const s = readArgs(args);
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement | HTMLSelectElement>(role);
    if (el) el.value = value;
  };
  set("inbound-departure", s.inboundDeparture);
  set("inbound-duration", s.inboundDuration);
  set("port-zone", s.portZone);
  set("handling", s.handlingMinutes);
  set("onward-departure", s.onwardDeparture);
  set("onward-duration", s.onwardDuration);
  set("onward-zone", s.onwardZone);
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl) {
    presetEl.value = matchPreset(s);
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        CONNECTION_PRESETS.find((p) => p.id === presetEl.value)?.description ??
        "";
    }
  }
}

export const mountConnectionChecker: MountFn<ConnectionCheckerArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: TransportLib;
  try {
    lib = await loadTransportLib();
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  applyArgs(root, args);
  setupWidget(root, lib);

  return onceDestroy(
    () => {},
    () => {
      const q = <T extends HTMLElement>(role: string) =>
        root.querySelector(`[data-role="${role}"]`) as T | null;
      const inboundDepartureEl = q<HTMLInputElement>("inbound-departure");
      if (!inboundDepartureEl) return null;
      const state: ConnectionState = {
        inboundDeparture: inboundDepartureEl.value,
        inboundDuration: q<HTMLInputElement>("inbound-duration")?.value ?? "",
        portZone: q<HTMLSelectElement>("port-zone")?.value ?? "",
        handlingMinutes: q<HTMLInputElement>("handling")?.value ?? "",
        onwardDeparture: q<HTMLInputElement>("onward-departure")?.value ?? "",
        onwardDuration: q<HTMLInputElement>("onward-duration")?.value ?? "",
        onwardZone: q<HTMLSelectElement>("onward-zone")?.value ?? "",
      };
      return permalinkOf(state);
    },
  );
};
