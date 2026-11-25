/**
 * zoneTooltip: the body of the globe's hover card for one zone, in three groups: where (its id,
 * and whether the sun is up), when (the local time, large, and the date with a day-shift word
 * when the day differs from the viewer's) and the rule (the offset and the DST wording). A reading that failed shows the signal-lost line, not a
 * blank card. The caller works out every word; this only lays them out.
 */
import { html, raw, type HtmlValue, type SafeHtml } from "~/widgets/builders";
import styles from "./zone-tooltip.module.css";

interface ZoneTooltipClock {
  /** The local time, `HH:MM:SS`. */
  time: string;
  /** The local date, `YYYY-MM-DD`. */
  date: string;
  /** A day-shift word such as `Tomorrow`; omitted on the viewer's own day. */
  shift?: string;
  /** Whether the sun is up there, with the icon's inner SVG paths. */
  sky?: { label: string; icon: string };
  /** The offset after `UTC`, such as `+01:00`. */
  offset: string;
  /** The DST wording, such as `in DST`. */
  dst: string;
  /** Whether the zone is on summer time now; the wording is tinted when it is. */
  onDst: boolean;
}

interface ZoneTooltipOptions {
  /** The zone id, such as `Asia/Tokyo`. */
  zone: string;
  /** Absent when the reading failed. */
  clock?: ZoneTooltipClock;
}

/** The id with a break point after every slash, so a long one wraps at a segment, not mid-word. */
function breakable(zone: string): HtmlValue {
  return zone
    .split("/")
    .flatMap((part, i) => (i === 0 ? [part] : ["/", raw("<wbr>"), part]));
}

export function zoneTooltip(o: ZoneTooltipOptions): SafeHtml {
  const c = o.clock;
  const where = (sky?: SafeHtml) =>
    html`<span class="${styles.where}"
      ><span class="${styles.zone}">${breakable(o.zone)}</span>${sky}</span
    >`;
  if (!c)
    return html`<span class="${styles.root}"
      >${where()}<span class="${styles.lost}"
        >⟨ NO SIGNAL — zone unavailable ⟩</span
      ></span
    >`;
  const date = c.shift
    ? html`<span class="${styles.shift}">${c.shift}</span> · ${c.date}`
    : html`${c.date}`;
  const sky = c.sky
    ? html`<span class="${styles.sky}"
        ><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          ${raw(c.sky.icon)}</svg
        ><span>${c.sky.label}</span></span
      >`
    : undefined;
  return html`<span class="${styles.root}"
    >${where(sky)}<span class="${styles.when}"
      ><span class="${styles.time}" data-gate="live">${c.time}</span
      ><span class="${styles.date}" data-gate="live">${date}</span></span
    ><span class="${styles.rule}"
      ><span class="${styles.offset}">UTC${c.offset}</span
      ><span class="${c.onDst ? styles.dstOn : styles.dst}">${c.dst}</span></span
    ></span
  >`;
}
