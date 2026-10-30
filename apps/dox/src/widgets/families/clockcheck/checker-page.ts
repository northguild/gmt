/**
 * checkerPage: the page of a dated clock-change checker, shared by Canada and Morocco.
 *
 * The rows, top to bottom: the Key points beside the reader's own browser (the page has them, the
 * chat does not); the map, the zone list, the pin panel and the live clocks; the reader's servers
 * beside the minimum releases; the clock changes beside what the library does about them; an
 * optional full-width section; and the saved events. Each checker brings its words and its two
 * sections that differ (`changes`, `after`); nothing here knows which checker it serves.
 */
import type { TenseView } from "~/lib/clock-change-tense";
import type { ZoneMapConfig } from "~/lib/zone-map";
import { html, type SafeHtml } from "../../builders/html";
import { widget } from "../../builders/layout";
import { clocksCard } from "./clocks-card";
import { tenseSlot } from "./tense-slot";
import { legendCount, zoneLegend, zoneMap, ZONE_CLASSES } from "./zone-map";
import { row, stack } from "./stack";

/** The map's legend: a swatch, the class in the true tense, and the count the map fills in. */
export function classLegend(
  idPrefix: string,
  classText: ZoneMapConfig["classText"],
  view: TenseView,
): SafeHtml {
  return zoneLegend(
    idPrefix,
    ZONE_CLASSES.map((kind) => {
      const phrase = classText(kind, null, view);
      const count = html`(${legendCount(kind)})`;
      // The count sits inside each form of a two-form phrase, so it flows after the last word (a
      // slot is one atomic box, which would drop a count outside it onto its own line).
      const text =
        phrase.key === null || phrase.before === phrase.after
          ? html`${phrase.before} ${count}`
          : tenseSlot(
              phrase.key,
              html`${phrase.before} ${count}`,
              html`${phrase.after} ${count}`,
              view.tenseOf(phrase.key),
            );
      return { kind, text };
    }),
  );
}

interface CheckerMap {
  zones: readonly string[];
  listLabel: string;
  mapHeight: number;
  legend: SafeHtml;
  /** The zones of the live clocks, and the ones that stop changing. */
  clockZones: readonly string[];
  stopped: ReadonlySet<string>;
  /** What the clocks card says when the browser's data is stale. */
  clocksNotice: SafeHtml;
}

interface CheckerPageOptions {
  /** The widget's slug and accessible name. */
  name: string;
  label: string;
  idPrefix: string;
  /** The Key points: the page has them, the chat does not. */
  keyPoints?: SafeHtml;
  probe: SafeHtml;
  map: CheckerMap;
  servers: SafeHtml;
  minimums: SafeHtml;
  /** The section beside the help card: the clock changes, or the ones your data gets wrong. */
  changes: SafeHtml;
  help: SafeHtml;
  /** A full-width section between the help row and the saved events. */
  after?: SafeHtml;
  stored: SafeHtml;
}

export function checkerPage(o: CheckerPageOptions): SafeHtml {
  return widget(
    { name: o.name, label: o.label, scope: o.idPrefix },
    stack(
      html`${row(html`${o.keyPoints ?? ""}${o.probe}`, { top: true })}${zoneMap(
        {
          idPrefix: o.idPrefix,
          zones: o.map.zones,
          listLabel: o.map.listLabel,
          mapHeight: o.map.mapHeight,
          legend: o.map.legend,
          clocks: clocksCard({
            idPrefix: o.idPrefix,
            zones: o.map.clockZones,
            stopped: o.map.stopped,
            notice: o.map.clocksNotice,
          }),
        },
      )}${row(html`${o.servers}${o.minimums}`)}${row(html`${o.changes}${o.help}`)}${o.after ?? ""}${o.stored}`,
    ),
  );
}
