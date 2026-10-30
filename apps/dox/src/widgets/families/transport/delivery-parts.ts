/**
 * The Delivery Scheduler's drawn parts: the ETA summary card, the legend and the itinerary.
 *
 * Each builder lays out what `buildEtaSummary` and `buildItinerary` (`delivery-scheduler.ts`)
 * already worked out. Nothing here computes an arrival, a ready instant or a verdict. A leg's
 * colour comes from its number (`data-leg`), and is never the only mark: the leg's number and
 * the mode's name are text beside it.
 */
import type {
  EtaSummary,
  Itinerary,
  ItineraryEvent,
} from "~/lib/delivery-scheduler";
import { badge } from "../../builders/badge";
import { html, type SafeHtml } from "../../builders/html";
import { modeIcon } from "./transport-icon";
import styles from "./delivery-parts.module.css";

/** The headline of the card: the local ETA, or the leg that failed and why. */
export function etaHeadline(summary: EtaSummary): string {
  if (summary.status === "ok") return summary.etaLocal ?? "";
  const leg =
    summary.failureLeg === undefined ? "" : `Leg ${summary.failureLeg}: `;
  return `${leg}${summary.failureHeadline ?? "No ETA"}`;
}

/**
 * The answer first. `summary` is `null` while there is nothing to say (a bare form); the card
 * then keeps its box and says nothing. The ETA line is a polite live region, so a change of
 * answer is announced.
 */
export function etaSummaryCard(summary: EtaSummary | null): SafeHtml {
  if (summary === null) {
    return html`<div class="${styles.card}" data-state="empty"
      ><p class="${styles.headline}">&nbsp;</p
      ><p class="${styles.line}" role="status" aria-label="ETA"></p
    ></div>`;
  }
  const ok = summary.status === "ok";
  return html`<div class="${styles.card}" data-state="${summary.status}"
    ><p class="${styles.headline}">${etaHeadline(summary)}</p
    ><p class="${styles.line}" role="status" aria-label="ETA">${ok ? `ETA ${summary.etaIso ?? ""}` : "No ETA — see the reason below."}</p
    ><p class="${styles.duration}">${summary.doorToDoor ?? "—"}</p
    ><p class="${styles.legs}">${summary.legCount} leg${summary.legCount === 1 ? "" : "s"}</p
    >${
      summary.flags.length === 0
        ? ""
        : html`<ul class="${styles.flags}" aria-label="Flags"
          >${summary.flags.map((f) => html`<li>${badge({ text: f, tone: "neutral" })}</li>`)}</ul
        >`
    }</div
  >`;
}

/** The four marks the charts and the itinerary use, named beside a drawn sample of each. */
export function deliveryLegend(): SafeHtml {
  const item = (kind: string, text: string): SafeHtml =>
    html`<li class="${styles.legendItem}"><i class="${styles.swatch}" data-kind="${kind}" aria-hidden="true"></i>${text}</li>`;
  return html`<ul class="${styles.legend}" aria-label="Legend"
    >${item("stop", "departure / arrival")}${item("handoff", "handoff")}${item("missed", "missed connection")}${item("dst", "DST / Date Line note")}</ul
  >`;
}

function eventBody(ev: ItineraryEvent): SafeHtml {
  const leg = ev.legIndex === undefined ? "" : `Leg ${ev.legIndex + 1}`;
  switch (ev.kind) {
    case "departure":
      return html`${leg}${ev.mode ? `, ${ev.mode}` : ""} departs`;
    case "arrival": {
      const check = ev.offsetCheck;
      return html`${leg} arrives${ev.isEta ? html` ${badge({ text: "ETA", tone: "cyan" })}` : ""}${
        check === undefined
          ? ""
          : html` ${badge({ text: check.badge, tone: check.agrees ? "neutral" : "danger" })}${
              check.naiveTime
                ? html` <span class="${styles.naive}">offset table: ${check.naiveTime}</span>`
                : ""
            }`
      }`;
    }
    case "handoff": {
      const tail =
        ev.tail === "missed"
          ? (ev.missedText ?? "Missed connection.")
          : ev.tail === "waits"
            ? (ev.waitText ?? "")
            : "the next leg leaves now";
      return html`Ready after ${ev.dwell ?? "PT0S"} handling — ${tail}`;
    }
    case "dst":
      return html`${ev.note ?? ""}`;
  }
}

function eventItem(ev: ItineraryEvent): SafeHtml {
  if (ev.kind === "dst") {
    return html`<li class="${styles.event}" data-kind="dst"
      ><span class="${styles.dot}" aria-hidden="true"></span
      ><p class="${styles.text}">${eventBody(ev)}</p></li
    >`;
  }
  const missed = ev.tail === "missed";
  return html`<li class="${styles.event}" data-kind="${ev.kind}" data-missed="${String(missed)}" data-leg="${ev.legIndex === undefined ? "" : String(Math.min(4, ev.legIndex + 1))}"
    ><span class="${styles.dot}" aria-hidden="true"></span
    ><div class="${styles.body}"
      ><p class="${styles.text}">${modeIcon(ev.mode ?? "")}<strong>${ev.time}</strong> ${ev.city} <span class="${styles.offset}">(${ev.offset})</span> — ${eventBody(ev)}</p
      ><p class="${styles.iso}">${ev.isoText}</p
    ></div
  ></li>`;
}

/** The itinerary: every event grouped by the local date it happens on. Empty when there is none. */
export function itineraryList(
  label: string,
  itinerary: Itinerary | null,
): SafeHtml {
  const groups = itinerary?.groups ?? [];
  return html`<ol class="${styles.days}" aria-label="${label}"
    >${groups.map(
      (g) =>
        html`<li class="${styles.day}"
          ><h5 class="${styles.dayHeading}">${g.heading}</h5
          >${g.anomaly === null ? "" : html`<p class="${styles.anomaly}">${g.anomaly}</p>`}<ol class="${styles.events}">${g.events.map(eventItem)}</ol
        ></li>`,
    )}</ol
  >`;
}
