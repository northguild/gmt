/**
 * The "Your browser" card and the "Test your own servers" card of a dated tz-change checker: the
 * verdict, one row per place with the right offset beside the browser's, and the Node command for
 * the reader's own servers. Plain DOM, no React, no library: the check is `Intl` only.
 *
 * Each checker passes its own `ProbeConfig` (its id prefix, zones, instant and wording); nothing
 * here knows which checker it serves.
 */
import {
  MARK_BAD,
  MARK_OK,
  NO_SIGNAL,
  SERVERS_TITLE,
  cityOf,
  offsetFromIntl,
  signedOffset,
} from "./clock-change-common";
import { codeFrameHtml } from "./code-frame";
import { escapeAttr, escapeHtml, zoneIdHtml } from "./widget-ui";

/** One instant a browser is asked about. `verdict` decides the verdict; `blind` is shown only. */
export interface ProbeInstant {
  iso: string;
  epochMs: number;
  role: "verdict" | "blind";
}

/**
 * The offset a zone must give, per instant role. `verdict` is the offset at the verdict instant;
 * `blind` is the offset at the blind instant and is needed only when the probe has one.
 */
export interface ExpectedOffsets {
  verdict: string;
  blind?: string;
}

/** A zone the browser column fills, with the offset it must give at each of the probe's instants. */
export interface ProbeZone {
  zone: string;
  expected: ExpectedOffsets;
}

/** The offset a zone must give at an instant of this role. A blind instant with none stated is a config error. */
export function expectedAt(
  fact: ProbeZone,
  role: ProbeInstant["role"],
): string {
  const offset = fact.expected[role];
  if (offset === undefined)
    throw new Error(
      `${fact.zone} has no expected offset for the ${role} instant.`,
    );
  return offset;
}

export interface ProbeConfig {
  /** Namespaces the ids: the card is `#<idPrefix>-browser`. */
  idPrefix: string;
  /** The rows the browser column fills. */
  zones: readonly ProbeZone[];
  /** Canada: one, role `verdict`. */
  instants: readonly ProbeInstant[];
}

/** The words of the card, per checker. The HTML fields are written by the checker, never by a reader. */
export interface VerdictText {
  /** The card's heading. */
  title: string;
  /** Under the "Correct" and "Yours" column heads. */
  correctNote: string;
  yoursNote: string;
  /** The pending line, as HTML. */
  checking: string;
  /** What follows the tick when every place is right. */
  right: string;
  /** Around the chips of the wrong places: `wrongBefore`, the chips, `wrongAfter`. */
  wrongBefore: string;
  wrongAfter: string;
  /** The extra lines under a wrong verdict, each as HTML. */
  more: readonly string[];
  /** What follows NO SIGNAL when the browser cannot read the zones. */
  unknown: string;
  /**
   * The line under the table when the probe has a `blind` instant: why that row is shown but never
   * judged. Plain text.
   */
  blindNote?: string;
}

export type BrowserReading =
  | { kind: "offset"; offset: string }
  | { kind: "unknown-zone" }
  | { kind: "unsupported" };

/** The instant the verdict is read at. */
export function verdictInstant(config: ProbeConfig): ProbeInstant {
  const instant = config.instants.find((item) => item.role === "verdict");
  if (instant === undefined)
    throw new Error("A probe needs one instant with the role verdict.");
  return instant;
}

/** The instants shown beside the verdict one, never judged. */
export function blindInstants(config: ProbeConfig): ProbeInstant[] {
  return config.instants.filter((item) => item.role === "blind");
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

/** "2026-11-02T12:00:00Z" as "2 Nov 2026", read from the text alone. */
export function dateLabel(iso: string): string {
  const [year = "", month = "1", day = "1"] = iso.slice(0, 10).split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ""} ${year}`;
}

/** The id prefix a rendered browser card carries: its `<prefix>-browser` id, less the suffix. */
export function idPrefixOf(root: ParentNode, fallback: string): string {
  const id = root.querySelector<HTMLElement>(".gmt-clockcheck-browser")?.id;
  return id?.endsWith("-browser") ? id.slice(0, -"-browser".length) : fallback;
}

/** City names as the page's code chips, joined "A, B and C". */
export function placesHtml(cities: readonly string[]): string {
  const chips = cities.map((city) => `<code>${escapeHtml(city)}</code>`);
  if (chips.length < 2) return chips.join("");
  return `${chips.slice(0, -1).join(", ")} and ${chips[chips.length - 1]}`;
}

/**
 * The verdict, as lines of plain words: what is wrong, what a reader does, and what a developer
 * does. The places are code chips. All correct is one line.
 */
export function verdictHtml(
  wrong: readonly string[],
  text: VerdictText,
): string {
  if (wrong.length === 0) {
    return `<p class="gmt-clockcheck-verdict-line">${MARK_OK} ${text.right}</p>`;
  }
  return (
    `<p class="gmt-clockcheck-verdict-line">${MARK_BAD} ${text.wrongBefore}<span data-role="wrong-places">${placesHtml(wrong)}</span>${text.wrongAfter}</p>` +
    text.more
      .map((line) => `<p class="gmt-clockcheck-verdict-more">${line}</p>`)
      .join("")
  );
}

/** The line the verdict shows when the browser cannot read the zones at all. */
export function unreadableHtml(text: VerdictText): string {
  return `<p class="gmt-clockcheck-verdict-line">${NO_SIGNAL} ${text.unknown}</p>`;
}

function probeRowHtml(fact: ProbeZone, when?: string): string {
  const zone = escapeAttr(fact.zone);
  return (
    `<tr role="row" data-zone="${zone}" data-state="stopped">` +
    `<th role="rowheader" scope="row" data-label="Place"><span class="gmt-clockcheck-city">${escapeHtml(cityOf(fact.zone))}</span><code class="gmt-clockcheck-zoneid">${zoneIdHtml(fact.zone)}</code>${when === undefined ? "" : `<small class="gmt-clockcheck-when">${escapeHtml(when)}</small>`}</th>` +
    `<td role="cell" data-label="Correct" class="gmt-clockcheck-num">${escapeHtml(signedOffset(fact.expected.verdict))}</td>` +
    `<td role="cell" data-label="Yours" class="gmt-clockcheck-num" data-role="browser">${NO_SIGNAL}</td>` +
    `</tr>`
  );
}

/**
 * A blind row: the same place at an instant that is shown and never judged, so both cells are
 * plain offsets. Its attribute is `data-blind-zone`, so a lookup of `tr[data-zone]` finds only the
 * verdict rows.
 */
function blindRowHtml(
  fact: ProbeZone,
  instant: ProbeInstant,
  expected: string,
): string {
  return (
    `<tr role="row" data-blind-zone="${escapeAttr(fact.zone)}" data-state="stopped">` +
    `<th role="rowheader" scope="row" data-label="Place"><span class="gmt-clockcheck-city">${escapeHtml(cityOf(fact.zone))}</span><code class="gmt-clockcheck-zoneid">${zoneIdHtml(fact.zone)}</code><small class="gmt-clockcheck-when">${escapeHtml(dateLabel(instant.iso))}</small></th>` +
    `<td role="cell" data-label="Correct" class="gmt-clockcheck-num">${escapeHtml(signedOffset(expected))}</td>` +
    `<td role="cell" data-label="Yours" class="gmt-clockcheck-num" data-role="browser-blind">${NO_SIGNAL}</td>` +
    `</tr>`
  );
}

/** The verdict's four finished variants, all server-rendered; `data-state` shows one (see the CSS). */
function verdictShellHtml(config: ProbeConfig, text: VerdictText): string {
  const cities = config.zones.map((fact) => cityOf(fact.zone));
  return (
    `<div class="gmt-clockcheck-verdict" data-role="verdict" data-state="pending" role="status">` +
    `<div class="gmt-clockcheck-variant" data-variant="pending"><p class="gmt-clockcheck-verdict-line">${text.checking}</p></div>` +
    `<div class="gmt-clockcheck-variant" data-variant="ok">${verdictHtml([], text)}</div>` +
    `<div class="gmt-clockcheck-variant" data-variant="bad">${verdictHtml(cities, text)}</div>` +
    `<div class="gmt-clockcheck-variant" data-variant="unreadable">${unreadableHtml(text)}</div>` +
    `</div>`
  );
}

/**
 * The rows: one per place at the verdict instant, then, when the probe has blind instants, one per
 * place at each of them. A probe with only a verdict instant renders exactly the plain rows.
 */
function tableRowsHtml(config: ProbeConfig): string {
  const blind = blindInstants(config);
  if (blind.length === 0)
    return config.zones.map((f) => probeRowHtml(f)).join("");
  const verdict = verdictInstant(config);
  return (
    config.zones.map((f) => probeRowHtml(f, dateLabel(verdict.iso))).join("") +
    blind
      .flatMap((instant) =>
        config.zones.map((f) =>
          blindRowHtml(f, instant, expectedAt(f, "blind")),
        ),
      )
      .join("")
  );
}

/**
 * "Your browser": the verdict, then one row per place with the right offset beside the browser's,
 * then the button that reads it again. One card, so the answer and its evidence sit together.
 */
export function browserCardHtml(
  config: ProbeConfig,
  text: VerdictText,
): string {
  const titleId = `${config.idPrefix}-probe-title`;
  return (
    `<section class="gmt-widget-section gmt-clockcheck-browser" id="${escapeAttr(config.idPrefix)}-browser" aria-labelledby="${titleId}">` +
    `<h4 id="${titleId}">${escapeHtml(text.title)}</h4>` +
    verdictShellHtml(config, text) +
    `<table class="gmt-clockcheck-table" role="table">` +
    `<thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Place</th><th role="columnheader" scope="col">Correct<small class="gmt-clockcheck-th-note">${escapeHtml(text.correctNote)}</small></th>` +
    `<th role="columnheader" scope="col">Yours<small class="gmt-clockcheck-th-note">${escapeHtml(text.yoursNote)}</small></th></tr></thead>` +
    `<tbody role="rowgroup">${tableRowsHtml(config)}</tbody></table>` +
    (blindInstants(config).length > 0 && text.blindNote
      ? `<p class="gmt-clockcheck-blind-note">${escapeHtml(text.blindNote)}</p>`
      : "") +
    `<div class="gmt-clockcheck-actions">` +
    `<button class="gmt-button gmt-button--pad" type="button" data-role="recheck">Check again</button>` +
    `<p class="gmt-clockcheck-status" data-role="status" role="status"></p>` +
    `</div>` +
    `</section>`
  );
}

/**
 * The offset this browser's own time zone data gives `zone` at `epochMs`. A `RangeError` for the
 * zone is "unknown to this browser"; an engine that cannot format `longOffset` at all is
 * `unsupported`, a different answer.
 */
export function readBrowserOffset(
  zone: string,
  epochMs: number,
): BrowserReading {
  try {
    new Intl.DateTimeFormat("en", {
      timeZone: "UTC",
      timeZoneName: "longOffset",
    });
  } catch {
    return { kind: "unsupported" };
  }
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: zone,
      timeZoneName: "longOffset",
    }).formatToParts(epochMs);
    const name =
      parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    const offset = offsetFromIntl(name);
    return offset === "" ? { kind: "unsupported" } : { kind: "offset", offset };
  } catch (error) {
    if (error instanceof RangeError) return { kind: "unknown-zone" };
    throw error;
  }
}

/**
 * The inline script of the "Your browser" card. The check is `Intl` only and needs no network, so
 * it runs while the page is parsed: it picks the finished verdict variant, fills the place chips
 * and the Yours cells, and sets `data-sig` (the readings) so the module knows the card is
 * already right and does not draw it again. Plain ES5, no imports: it is a string, so no bundler
 * touches it. Everything it needs comes from the config and the same marks as the module, passed
 * as JSON. It finds its card by id, `#<idPrefix>-browser`, so two checkers never fill each
 * other's. `clock-change-probe.test.ts` runs it against the module.
 */
export function probeInlineSource(config: ProbeConfig): string {
  const data = {
    id: `${config.idPrefix}-browser`,
    epoch: verdictInstant(config).epochMs,
    zones: config.zones.map((fact) => ({
      zone: fact.zone,
      city: cityOf(fact.zone),
      expected: fact.expected.verdict,
    })),
    ok: MARK_OK,
    bad: MARK_BAD,
    none: NO_SIGNAL,
    ...(blindInstants(config).length > 0
      ? { blind: blindInstants(config)[0]!.epochMs }
      : {}),
  };
  // Only a probe with a blind instant carries the extra lines; Canada's script is unchanged.
  const hasBlind = "blind" in data;
  return String.raw`(function (c) {
  function fill() {
  var card = document.getElementById(c.id);
  if (!card) return false;
  var v = card.querySelector('[data-role="verdict"]');
  if (!v || card.querySelectorAll("tr[data-zone]").length < c.zones.length) return false;
  function read(z${hasBlind ? ", e" : ""}) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: "UTC", timeZoneName: "longOffset" });
      var parts = new Intl.DateTimeFormat("en", { timeZone: z, timeZoneName: "longOffset" }).formatToParts(${hasBlind ? "e === undefined ? c.epoch : e" : "c.epoch"}), n = "";
      for (var i = 0; i < parts.length; i++) if (parts[i].type === "timeZoneName") { n = parts[i].value; break; }
      if (n === "GMT") return "+00:00";
      var m = /^GMT([+\-−])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(n);
      if (!m) return "";
      return (m[1] === "+" ? "+" : "-") + m[2] + ":" + m[3] + (m[4] === undefined ? "" : ":" + m[4]);
    } catch (e) { return ""; }
  }
  var wrong = [], unread = 0, sig = [];
  for (var k = 0; k < c.zones.length; k++) {
    var f = c.zones[k], o = read(f.zone), row = card.querySelector('tr[data-zone="' + f.zone + '"]');
    var cell = row && row.querySelector('[data-role="browser"]');
    sig.push(o === "" ? "?" : o);
    if (o === "") { unread++; if (cell) cell.innerHTML = c.none; continue; }
    if (o !== f.expected) wrong.push(f.city);
    if (cell) cell.innerHTML = (o === f.expected ? c.ok : c.bad) + " " + o.replace("-", "−");
  }
${
  hasBlind
    ? String.raw`  if (c.blind !== undefined) for (var b = 0; b < c.zones.length; b++) {
    var g = c.zones[b].zone, p = read(g, c.blind), brow = card.querySelector('tr[data-blind-zone="' + g + '"]');
    var bcell = brow && brow.querySelector('[data-role="browser-blind"]');
    sig.push(p === "" ? "?" : p);
    if (bcell) bcell.innerHTML = p === "" ? c.none : p.replace("-", "−");
  }
`
    : ""
}  var state = unread > 0 ? "unreadable" : wrong.length === 0 ? "ok" : "bad";
  if (state === "bad") {
    var chips = wrong.map(function (w) { return "<code>" + w + "</code>"; });
    var at = v.querySelector('[data-role="wrong-places"]');
    if (at) at.innerHTML = chips.length < 2 ? chips.join("") : chips.slice(0, -1).join(", ") + " and " + chips[chips.length - 1];
  }
  v.setAttribute("data-sig", sig.join(","));
  v.setAttribute("data-state", state);
  return true;
  }
  if (fill()) return;
  var mo = new MutationObserver(function () { if (fill()) mo.disconnect(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", function () { fill(); mo.disconnect(); });
})(${JSON.stringify(data).replace(/</g, "\\u003c")});`;
}

/**
 * Fills the card from this browser's readings: the Yours cells and the verdict. On the page the
 * inline script has already done it (`data-sig` holds its readings), and the same readings are not
 * drawn again.
 */
export function fillBrowserCard(
  root: ParentNode,
  config: ProbeConfig,
  text: VerdictText,
): void {
  const epochMs = verdictInstant(config).epochMs;
  const readings = new Map<string, BrowserReading>();
  const wrong: string[] = [];
  let unread = 0;
  const sig: string[] = [];
  for (const fact of config.zones) {
    const reading = readBrowserOffset(fact.zone, epochMs);
    readings.set(fact.zone, reading);
    if (reading.kind === "offset") {
      if (reading.offset !== fact.expected.verdict)
        wrong.push(cityOf(fact.zone));
    } else {
      unread += 1;
    }
    sig.push(reading.kind === "offset" ? reading.offset : "?");
  }
  const blind = blindInstants(config)[0];
  const blindReadings = new Map<string, BrowserReading>();
  if (blind !== undefined) {
    for (const fact of config.zones) {
      const reading = readBrowserOffset(fact.zone, blind.epochMs);
      blindReadings.set(fact.zone, reading);
      sig.push(reading.kind === "offset" ? reading.offset : "?");
    }
  }
  const verdict = root.querySelector<HTMLElement>('[data-role="verdict"]');
  if (!verdict || verdict.dataset.sig === sig.join(",")) return;
  for (const fact of config.zones) {
    const reading = readings.get(fact.zone)!;
    const cell = (
      root.querySelector<HTMLElement>(`tr[data-zone="${fact.zone}"]`) ?? root
    ).querySelector<HTMLElement>('[data-role="browser"]');
    if (!cell) continue;
    cell.innerHTML =
      reading.kind === "offset"
        ? `${reading.offset === fact.expected.verdict ? MARK_OK : MARK_BAD} ${escapeHtml(signedOffset(reading.offset))}`
        : NO_SIGNAL;
  }
  for (const [zone, reading] of blindReadings) {
    const cell = root
      .querySelector<HTMLElement>(`tr[data-blind-zone="${zone}"]`)
      ?.querySelector<HTMLElement>('[data-role="browser-blind"]');
    if (cell)
      cell.innerHTML =
        reading.kind === "offset"
          ? escapeHtml(signedOffset(reading.offset))
          : NO_SIGNAL;
  }
  verdict.innerHTML =
    unread > 0 ? unreadableHtml(text) : verdictHtml(wrong, text);
  verdict.dataset.state =
    unread > 0 ? "unreadable" : wrong.length === 0 ? "ok" : "bad";
  verdict.dataset.sig = sig.join(",");
}

export const INFO_ICON =
  `<svg class="gmt-clockcheck-info-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">` +
  `<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
  `<path d="M12 11v5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
  `<circle cx="12" cy="7.6" r="1.1" fill="currentColor"/></svg>`;

function nodeProbeFrame(command: string): string {
  return codeFrameHtml("node-probe")
    .replace(
      '<code data-role="call-node-probe"></code>',
      `<code data-role="call-node-probe">${escapeHtml(command)}</code>`,
    )
    .replace(
      'data-role="copy-node-probe"',
      `data-role="copy-node-probe" data-copy-text="${escapeAttr(command)}" aria-label="Copy the command"`,
    );
}

export interface ServersCardOptions {
  idPrefix: string;
  /** The Node command, from `nodeProbeCommand`. */
  command: string;
  /** What the command prints on a runtime with the new data: `[city, offset]` per row. */
  expected: readonly (readonly [string, string])[];
  /** Defaults to "Test your own servers". */
  title?: string;
  /** The one plain line under the title. */
  line: string;
}

/** The "Test your own servers" info card: the command, a keyboard copy button and the expected output. */
export function serversCardHtml(options: ServersCardOptions): string {
  const { idPrefix, command, line, title = SERVERS_TITLE } = options;
  const expected = options.expected
    .map(
      ([city, offset]) =>
        `<code>${escapeHtml(city)}</code> ${escapeHtml(offset)}`,
    )
    .join(" &middot; ");
  return (
    `<section class="gmt-clockcheck-servers" aria-labelledby="${idPrefix}-servers-title">` +
    INFO_ICON +
    `<div class="gmt-clockcheck-servers-body">` +
    `<h4 id="${idPrefix}-servers-title">${escapeHtml(title)}</h4>` +
    `<p>${escapeHtml(line)}</p>` +
    nodeProbeFrame(command) +
    `<p class="gmt-clockcheck-servers-expected">Expected: ${expected}</p>` +
    `<p class="gmt-clockcheck-sr" data-role="copy-status" role="status"></p>` +
    `</div></section>`
  );
}
