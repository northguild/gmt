/**
 * probeCard: the "Your browser" card of a dated clock-change checker.
 *
 * The verdict, then one row per place with the right offset beside the browser's, then the button
 * that reads it again. One card, so the answer and its evidence sit together. The table is the
 * kit's `table()`; the verdict is a status region that holds all four finished answers, one of
 * them shown, so the page's inline script (`probeInlineSource`) only picks one and fills the
 * "Yours" cells before first paint, and the module (`fillProbe`) does the same with the same marks.
 *
 * Each checker passes its own `ProbeConfig` and `VerdictText`; nothing here knows which one it
 * serves.
 */
import {
  blindInstants,
  dateLabel,
  expectedAt,
  readBrowserOffset,
  verdictInstant,
  type BrowserReading,
  type ProbeConfig,
  type ProbeZone,
  type VerdictText,
} from "~/lib/clock-change-probe";
import { cityOf, signedOffset } from "~/lib/clock-change-common";
import { button } from "../../builders/button";
import { html, raw, setHtml, type SafeHtml } from "../../builders/html";
import { idScope } from "../../builders/ids";
import { section } from "../../builders/layout";
import { table } from "../../builders/table";
import type { FoundWidget } from "../../root";
import { markBad, markOk, noSignal, zoneId } from "./marks";
import { PROBE_PARTS, VARIANTS, type VariantName } from "./probe-ids";
import styles from "./probe-card.module.css";

/** City names as code chips, joined "A, B and C". */
export function placesChips(cities: readonly string[]): SafeHtml {
  const chips = cities.map((city) => html`<code>${city}</code>`);
  if (chips.length < 2) return html`${chips}`;
  return html`${chips.slice(0, -1).flatMap((chip, i) => (i === 0 ? [chip] : [", ", chip]))} and ${chips[chips.length - 1]}`;
}

function okLines(text: VerdictText): SafeHtml {
  return html`<p class="${styles.line}">${markOk()} ${raw(text.right)}</p>`;
}

function badLines(
  places: SafeHtml,
  text: VerdictText,
  wrongId: string,
): SafeHtml {
  return html`<p class="${styles.line}">${markBad()} ${raw(text.wrongBefore)}<span id="${wrongId}">${places}</span>${raw(text.wrongAfter)}</p>${text.more.map(
    (line) => html`<p class="${styles.more}">${raw(line)}</p>`,
  )}`;
}

function unreadableLines(text: VerdictText): SafeHtml {
  return html`<p class="${styles.line}">${noSignal()} ${raw(text.unknown)}</p>`;
}

/** The four finished answers, all server-rendered; `hidden` keeps all but the pending one out of sight. */
function verdictShell(
  config: ProbeConfig,
  text: VerdictText,
  id: (local: string) => string,
): SafeHtml {
  const cities = config.zones.map((fact) => cityOf(fact.zone));
  const bodies: Record<VariantName, SafeHtml> = {
    pending: html`<p class="${styles.line}">${raw(text.checking)}</p>`,
    ok: okLines(text),
    bad: badLines(placesChips(cities), text, id(PROBE_PARTS.wrong)),
    unreadable: unreadableLines(text),
  };
  return html`<div
    class="${styles.verdict}"
    id="${id(PROBE_PARTS.verdict)}"
    data-state="pending"
    role="status"
    aria-label="Verdict"
  >${VARIANTS.map(
    (name) =>
      html`<div
        class="${styles.variant}"
        id="${id(PROBE_PARTS.variant(name))}"
        ${name === "pending" ? "" : "hidden"}
      >${bodies[name]}</div>`,
  )}</div>`;
}

function placeCell(zone: string, when?: string): SafeHtml {
  return html`<span class="${styles.city}">${cityOf(zone)}</span><code class="${styles.zoneid}">${zoneId(zone)}</code>${when === undefined ? null : html`<small class="${styles.when}">${when}</small>`}`;
}

function yoursCell(id: string): SafeHtml {
  return html`<span id="${id}">${noSignal()}</span>`;
}

/**
 * "Your browser": the verdict, the table of places and the button that reads it again. The
 * `idPrefix` is the widget's scope.
 */
export function probeCard(config: ProbeConfig, text: VerdictText): SafeHtml {
  const id = idScope(config.idPrefix);
  const blind = blindInstants(config);
  const when =
    blind.length === 0 ? undefined : dateLabel(verdictInstant(config).iso);
  const rows = [
    ...config.zones.map((fact: ProbeZone, k) => ({
      place: placeCell(fact.zone, when),
      correct: signedOffset(fact.expected.verdict),
      yours: yoursCell(id(PROBE_PARTS.yours(k))),
    })),
    ...blind.flatMap((instant, b) =>
      config.zones.map((fact, k) => ({
        place: placeCell(fact.zone, dateLabel(instant.iso)),
        correct: signedOffset(expectedAt(fact, "blind")),
        yours: yoursCell(id(PROBE_PARTS.blind(b * config.zones.length + k))),
      })),
    ),
  ];
  return section(
    {
      id: id("browser"),
      heading: text.title,
      level: 4,
      gate: "browser",
    },
    html`${verdictShell(config, text, id)}<div class="${styles.probe}">${table({
      caption: `${text.title}: offsets by place`,
      gate: "probe-table",
      columns: [
        { key: "place", header: "Place", align: "start", numeric: false },
        {
          key: "correct",
          header: `Correct (${text.correctNote})`,
          align: "end",
          numeric: true,
        },
        {
          key: "yours",
          header: `Yours (${text.yoursNote})`,
          align: "end",
          numeric: true,
        },
      ],
      rowHeader: "place",
      rows,
    })}</div>${blind.length > 0 && text.blindNote ? html`<p class="${styles.blindNote}">${text.blindNote}</p>` : null}<div class="${styles.actions}">${button(
      {
        id: id(PROBE_PARTS.recheck),
        label: "Check again",
        gate: "recheck",
      },
    )}<p
      class="${styles.status}"
      id="${id(PROBE_PARTS.status)}"
      role="status"
      aria-label="Check status"
    ></p></div>`,
  );
}

function readingCell(
  reading: BrowserReading,
  expected: string | undefined,
): SafeHtml {
  if (reading.kind !== "offset") return noSignal();
  const offset = signedOffset(reading.offset);
  if (expected === undefined) return html`${offset}`;
  return html`${reading.offset === expected ? markOk() : markBad()} ${offset}`;
}

const signatureOf = (readings: readonly BrowserReading[]): string =>
  readings
    .map((reading) => (reading.kind === "offset" ? reading.offset : "?"))
    .join(",");

/**
 * Fills the card from this browser's readings: the Yours cells, the shown answer and the places it
 * names. On the page the inline script has already done it (`data-sig` holds its readings), and
 * the same readings are not drawn again.
 */
export function fillProbe(widget: FoundWidget, config: ProbeConfig): void {
  const verdict = widget.part(PROBE_PARTS.verdict);
  const at = verdictInstant(config).epochMs;
  const own = config.zones.map((fact) => readBrowserOffset(fact.zone, at));
  const blindReadings = blindInstants(config).flatMap((instant) =>
    config.zones.map((fact) => readBrowserOffset(fact.zone, instant.epochMs)),
  );
  const signature = signatureOf([...own, ...blindReadings]);
  if (verdict.dataset["sig"] === signature) return;
  const wrong: string[] = [];
  let unread = 0;
  config.zones.forEach((fact, k) => {
    const reading = own[k]!;
    if (reading.kind !== "offset") unread += 1;
    else if (reading.offset !== fact.expected.verdict)
      wrong.push(cityOf(fact.zone));
    setHtml(
      widget.part(PROBE_PARTS.yours(k)),
      readingCell(reading, fact.expected.verdict),
    );
  });
  blindReadings.forEach((reading, k) => {
    setHtml(widget.part(PROBE_PARTS.blind(k)), readingCell(reading, undefined));
  });
  const state: VariantName =
    unread > 0 ? "unreadable" : wrong.length === 0 ? "ok" : "bad";
  if (state === "bad")
    setHtml(widget.part(PROBE_PARTS.wrong), placesChips(wrong));
  for (const name of VARIANTS)
    widget.part(PROBE_PARTS.variant(name)).hidden = name !== state;
  verdict.dataset["state"] = state;
  verdict.dataset["sig"] = signature;
}
