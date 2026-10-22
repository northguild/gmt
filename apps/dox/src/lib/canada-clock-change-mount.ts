/**
 * The Canada 2026 clock-change checker's page widget (CORE-88): whether a runtime has the 2026 tz
 * data, the clock changes in 2026 and 2027, and live clocks for five zones.
 *
 * Every value in the transitions and the clocks comes from one
 * `GET /gmt/api/canada-clock-change` answer, computed on the Worker with the library at request
 * time. The widget draws it. The only values it makes itself are the browser column, which is
 * the point of that column, and the wall time of each clock, which is the library reading the
 * client's now at the Worker's offset. No named zone reaches the browser's tz data for a clock.
 *
 * `renderCanadaClockChangeTemplate()` is pure markup, so the server renders every table with its
 * known rows and the page does not grow once the answer arrives.
 */
import type {
  CanadaCheck,
  MapZone,
  StoredCheck,
  StoredRow,
  TransitionRow,
} from "./canada-clock-change";
import {
  CLOCK_ZONES,
  NODE_PROBE_COMMAND,
  PROBE_EPOCH_MS,
  SERVERS_LINE,
  SERVERS_TITLE,
  expectedProbeOutput,
  STOPPED_ZONES,
  TABLE_ZONES,
  STORED_MAX_BYTES,
  STORED_MAX_LINES,
  STORED_ZONES,
  TRANSITION_ZONES,
  cityOf,
  mapKindLabel,
  offsetFromIntl,
  signedOffset,
  wallHms,
} from "./canada-clock-change";
import zoneIds from "./canada-zones.json";
import {
  staleZoneIds,
  mountCanadaMap,
  renderPinPanelHtml,
  zoneListItemHtml,
} from "./canada-map";
import {
  MINIMUMS_FOOTER,
  MINIMUMS_HEADING,
  MINIMUMS_INTRO,
  MINIMUMS_NOTE,
  minimumsItemsHtml,
} from "../data/canada-runtime-minimums";
import { SAVED_EXAMPLE } from "./canada-saved-example";
import {
  needsZonePicker,
  staleCheckText,
  storedAdvice,
  storedBadge,
  storedFix,
  storedZoneOf,
} from "./canada-stored-times";
import {
  HELP_HEADING,
  HELP,
  KEY_POINTS,
  KEY_POINTS_HEADING,
  partsHtml,
} from "../data/canada-key-points";
import { codeFrameHtml } from "./code-frame";
import { bindClockGlow, updateCrystalClock } from "./crystal-clock";
import { spokenOffset } from "./crossing-clock";
import { GMT_MODULES } from "./gmt-modules";
import { withBase } from "./site";
import {
  INERT_HANDLE,
  WidgetLoadError,
  onceDestroy,
  showUnavailable,
  type MountFn,
} from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  wireCopyButtons,
} from "./widget-ui";

const YEARS = [2026, 2027] as const;
const NO_SIGNAL = `<span class="gmt-playground-sentinel">NO SIGNAL</span>`;
const LEGEND = [
  ["stopped-2026", mapKindLabel("stopped-2026")],
  ["changes-2027", mapKindLabel("changes-2027")],
  ["none-2026-2027", mapKindLabel("none-2026-2027")],
] as const;
const SIGNAL_LOST = "⟨ NO SIGNAL — invalid input ⟩";
/** The verdict's and the cells' marks. The glyph is the icon; the words beside it carry the meaning. */
const MARK_OK = `<span class="gmt-canada-mark gmt-canada-mark--ok" aria-hidden="true">\u2713</span>`;
const MARK_BAD = `<span class="gmt-canada-mark gmt-canada-mark--bad" aria-hidden="true">\u2717</span>`;
/** City names as the page's code chips, joined "A, B and C". */
export function placesHtml(cities: readonly string[]): string {
  const chips = cities.map((city) => `<code>${escapeHtml(city)}</code>`);
  if (chips.length < 2) return chips.join("");
  return `${chips.slice(0, -1).join(", ")} and ${chips[chips.length - 1]}`;
}
const TABLE_CITIES = TABLE_ZONES.map((fact) => cityOf(fact.zone));
const UNREADABLE_HTML = `<p class="gmt-canada-verdict-line">${NO_SIGNAL} Your browser cannot read these zones.</p>`;
const CLOCKS_NOTICE = `This browser has old rules for ${placesHtml(TABLE_CITIES)}. From 1 November 2026 these clocks show them an hour off.`;

// ---------------------------------------------------------------------------
// The library
// ---------------------------------------------------------------------------

interface CanadaLib {
  convertUtcToPlainDateTime(
    value: string,
    options: { timeZone: string },
  ): string;
  getUtcNow(): string;
  isBeforeUtc(value1: string, value2: string): boolean;
}

function pick<T>(module: Record<string, unknown>, name: string): T {
  if (typeof module[name] !== "function") {
    throw new Error(`The library module has no ${name}.`);
  }
  return module[name] as T;
}

export async function loadCanadaLib(): Promise<CanadaLib> {
  try {
    const [convert, get, compare] = await Promise.all([
      GMT_MODULES["utc/convert"]!(),
      GMT_MODULES["utc/get"]!(),
      GMT_MODULES["utc/compare"]!(),
    ]);
    return {
      convertUtcToPlainDateTime: pick(convert, "convertUtcToPlainDateTime"),
      getUtcNow: pick(get, "getUtcNow"),
      isBeforeUtc: pick(compare, "isBeforeUtc"),
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

function probeRowHtml(fact: (typeof TABLE_ZONES)[number]): string {
  const zone = escapeAttr(fact.zone);
  return (
    `<tr data-zone="${zone}" data-state="stopped">` +
    `<th scope="row" data-label="Place"><span class="gmt-canada-city">${escapeHtml(cityOf(fact.zone))}</span><code class="gmt-canada-zoneid">${escapeHtml(fact.zone)}</code></th>` +
    `<td data-label="Correct" class="gmt-canada-num">${escapeHtml(signedOffset(fact.tzdb2026e))}</td>` +
    `<td data-label="Yours" class="gmt-canada-num" data-role="browser">${NO_SIGNAL}</td>` +
    `</tr>`
  );
}

function transitionGroupHtml(zone: string): string {
  return (
    `<li class="gmt-canada-group" data-zone="${escapeAttr(zone)}">` +
    `<h5 class="gmt-canada-group-title"><code>${escapeHtml(zone)}</code></h5>` +
    `<ul class="gmt-canada-changes" data-role="changes">` +
    YEARS.map((year) => `<li data-year="${year}">${NO_SIGNAL}</li>`).join("") +
    `</ul></li>`
  );
}

function clockHtml(zone: string): string {
  return (
    `<li class="gmt-canada-clock" data-zone="${escapeAttr(zone)}" data-state="${STOPPED_ZONES.has(zone) ? "stopped" : "changes"}">` +
    `<div class="gmt-canada-face" data-role="clock"></div>` +
    `<p class="gmt-canada-clock-zone"><code>${escapeHtml(zone)}</code></p>` +
    `<p class="gmt-canada-clock-time" data-role="clock-time">${NO_SIGNAL}</p>` +
    `</li>`
  );
}

function nodeProbeFrame(): string {
  const frame = codeFrameHtml("node-probe")
    .replace(
      '<code data-role="call-node-probe"></code>',
      `<code data-role="call-node-probe">${escapeHtml(NODE_PROBE_COMMAND)}</code>`,
    )
    .replace(
      'data-role="copy-node-probe"',
      `data-role="copy-node-probe" data-copy-text="${escapeAttr(NODE_PROBE_COMMAND)}" aria-label="Copy the command"`,
    );
  return frame;
}

const INFO_ICON =
  `<svg class="gmt-canada-info-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">` +
  `<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
  `<path d="M12 11v5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
  `<circle cx="12" cy="7.6" r="1.1" fill="currentColor"/></svg>`;

/** The "Test your own servers" info card: the command, a keyboard copy button and the expected output. */
function serversCardHtml(idPrefix: string): string {
  const expected = expectedProbeOutput()
    .map(
      ([city, offset]) =>
        `<code>${escapeHtml(city)}</code> ${escapeHtml(offset)}`,
    )
    .join(" &middot; ");
  return (
    `<section class="gmt-canada-servers" aria-labelledby="${idPrefix}-servers-title">` +
    INFO_ICON +
    `<div class="gmt-canada-servers-body">` +
    `<h4 id="${idPrefix}-servers-title">${SERVERS_TITLE}</h4>` +
    `<p>${escapeHtml(SERVERS_LINE)}</p>` +
    nodeProbeFrame() +
    `<p class="gmt-canada-servers-expected">Expected: ${expected}</p>` +
    `<p class="gmt-canada-sr" data-role="copy-status" role="status"></p>` +
    `</div></section>`
  );
}

/** The "Upgrade to at least" card: the same info-card style as the servers card, full width. */
function minimumsCardHtml(idPrefix: string): string {
  return (
    `<section class="gmt-canada-minimums" aria-labelledby="${idPrefix}-minimums-title">` +
    INFO_ICON +
    `<div class="gmt-canada-servers-body">` +
    `<h4 id="${idPrefix}-minimums-title">${escapeHtml(MINIMUMS_HEADING)}</h4>` +
    `<p>${escapeHtml(MINIMUMS_INTRO)}</p>` +
    `<ul class="gmt-canada-minimums-list">${minimumsItemsHtml()}</ul>` +
    `<p>${escapeHtml(MINIMUMS_FOOTER)}</p>` +
    `<p class="gmt-canada-minimums-note">${escapeHtml(MINIMUMS_NOTE)}</p>` +
    `</div></section>`
  );
}

/** The "How gmt helps" card: same panel as the other cards, no alert colour. */
function helpCardHtml(idPrefix: string): string {
  const href = (value: string): string => (value.startsWith("/") ? withBase(value) : value);
  const cases = HELP.cases
    .map(
      (item) =>
        `<li class="gmt-canada-help-case">` +
        `<span class="gmt-canada-help-tag">${escapeHtml(item.tag)}</span>` +
        `<div class="gmt-canada-help-io">` +
        `<code class="gmt-canada-help-in">${escapeHtml(item.input)}</code>` +
        `<span class="gmt-canada-help-arrow" aria-hidden="true">\u2192</span>` +
        `<code class="gmt-canada-help-out">${escapeHtml(item.output)}</code>` +
        (item.outputNote ? `<span class="gmt-canada-help-note">${escapeHtml(item.outputNote)}</span>` : "") +
        `</div>` +
        `<p class="gmt-canada-help-why">${partsHtml(item.why, href)}</p>` +
        `</li>`,
    )
    .join("");
  return (
    `<section class="gmt-canada-help" aria-labelledby="${idPrefix}-help-title">` +
    `<h4 id="${idPrefix}-help-title">${escapeHtml(HELP_HEADING)}</h4>` +
    `<p class="gmt-canada-help-lede">${partsHtml(HELP.lede, href)}</p>` +
    `<p class="gmt-canada-help-verified"><span class="gmt-canada-help-badge"><span aria-hidden="true">\u2713</span> Verified</span> <span>${partsHtml(HELP.verified, href)}</span></p>` +
    `<p class="gmt-canada-help-intro">${escapeHtml(HELP.intro)}</p>` +
    `<ul class="gmt-canada-help-cases">${cases}</ul>` +
    `<p class="gmt-canada-help-cta"><span>${escapeHtml(HELP.cta.lead)}</span> <a class="gmt-canada-help-btn" href="${escapeAttr(href(HELP.cta.href))}">${escapeHtml(HELP.cta.link)} <span aria-hidden="true">\u2193</span></a></p>` +
    `</section>`
  );
}

export interface CanadaTemplateOptions {
  /** Namespaces the heading ids, so the chat's copy cannot collide with a page's. */
  idPrefix?: string;
  /** Draws the Key points above the checker. The page does; the chat rail does not. */
  keyPoints?: boolean;
}

export function renderCanadaClockChangeTemplate({
  idPrefix = "canada",
  keyPoints = false,
}: CanadaTemplateOptions = {}): string {
  const probeId = `${idPrefix}-probe-title`;
  const changesId = `${idPrefix}-changes-title`;
  const clocksId = `${idPrefix}-clocks-title`;
  const mapId = `${idPrefix}-map-title`;
  const storedId = `${idPrefix}-stored-title`;
  const pickId = `${idPrefix}-pick-title`;
  return (
    `<div class="gmt-canada gmt-widget not-content">` +
    `<div class="gmt-canada-stack">` +
    // Row 1: the Key points on the left, the reader's own browser on the right.
    `<div class="gmt-canada-row gmt-canada-row--top">` +
    (keyPoints ? keyPointsHtml() : "") +
    browserCardHtml(probeId) +
    `</div>` +
    // Row 2: the map, the zone list with its pin panel, and the live clocks. The map is the taller card; the list
    //   takes the height it leaves.
    `<div class="gmt-canada-mapsec" data-role="map-section">` +
    `<div class="gmt-widget-section gmt-canada-stage">` +
    `<div class="gmt-canada-map-block" role="group" aria-labelledby="${mapId}">` +
    `<h4 id="${mapId}">Zones on the map</h4>` +
    // The map draws the sheet's boundaries; `canada-map.ts` puts the credits button in its corner
    // when it draws, under this id.
    `<div class="gmt-canada-map gmt-theme-dark" data-role="map" data-credits-id="${idPrefix}-data-credits"></div>` +
    `<ul class="gmt-canada-legend" aria-label="Map classes">` +
    LEGEND.map(
      ([kind, label]) =>
        `<li><span class="gmt-canada-swatch gmt-theme-dark" data-kind="${kind}" aria-hidden="true"></span><span>${escapeHtml(label)} (<span data-role="legend-count" data-kind="${kind}">&ndash;</span>)</span></li>`,
    ).join("") +
    `</ul>` +
    `</div>` +
    `</div>` +
    `<section class="gmt-widget-section gmt-canada-pickcard" aria-labelledby="${pickId}">` +
    `<h4 id="${pickId}">Pick a zone</h4>` +
    `<p class="gmt-widget-hint">Each zone is in one class. Press a zone, on the map or in the list, to pin its clock and its last and next change.</p>` +
    `<div class="gmt-canada-pick">` +
    `<div class="gmt-canada-zone-frame"><div class="gmt-canada-zone-scroll" data-role="zone-scroll" role="region" aria-label="Canada time zones, scrollable list" tabindex="0">` +
    `<ul class="gmt-canada-zone-list" data-role="zone-list" aria-label="Zones">${zoneIds.zones.map(zoneListItemHtml).join("")}</ul>` +
    `</div></div>` +
    `<div class="gmt-canada-pin" data-role="pin">${renderPinPanelHtml()}</div>` +
    `</div>` +
    `</section>` +
    `<section class="gmt-widget-section gmt-canada-clocksec" aria-labelledby="${clocksId}">` +
    `<h4 id="${clocksId}">Live clocks</h4>` +
    `<p class="gmt-canada-clocks-notice" data-role="clocks-notice" hidden>${CLOCKS_NOTICE}</p>` +
    `<ul class="gmt-canada-clocks" data-role="clocks">${CLOCK_ZONES.map(clockHtml).join("")}</ul>` +
    `<p class="gmt-widget-hint gmt-canada-clocks-hint">Your time, and the time in each zone.</p>` +
    `</section>` +
    `</div>` +
    // Row 3: the reader's servers beside the minimum releases. Both are info cards.
    `<div class="gmt-canada-row">` +
    serversCardHtml(idPrefix) +
    minimumsCardHtml(idPrefix) +
    `</div>` +
    // Row 4: the clock changes beside what the library does about them.
    `<div class="gmt-canada-row">` +
    `<section class="gmt-widget-section" aria-labelledby="${changesId}">` +
    `<h4 id="${changesId}">Clock changes in 2026 and 2027</h4>` +
    `<p class="gmt-widget-hint">tzdb also records an abbreviation change on 2026-11-01 for the four zones that stop changing their clocks, with no change of UTC offset, so it is not listed. Times are the clock as it read just before the change.</p>` +
    `<ul class="gmt-canada-groups" data-role="transitions">${TRANSITION_ZONES.map(transitionGroupHtml).join("")}</ul>` +
    `</section>` +
    helpCardHtml(idPrefix) +
    `</div>` +
    // Row 5: the saved events, the form on the left and the answers on the right.
    storedSectionHtml(storedId) +
    `</div>` +
    `</div>`
  );
}

/** The Key points: two cards, one for everyone and one for developers. */
function keyPointsHtml(): string {
  return (
    `<section class="gmt-keypoints" aria-labelledby="canada-keypoints-title">` +
    `<h2 id="canada-keypoints-title">${escapeHtml(KEY_POINTS_HEADING)}</h2>` +
    `<div class="gmt-keypoints-grid">` +
    KEY_POINTS.map(
      (card) =>
        `<div class="gmt-keypoints-card"${card.id ? ` id="${escapeAttr(card.id)}"` : ""}>` +
        `<h3>${escapeHtml(card.heading)}</h3>` +
        card.blocks
          .map((block) =>
            block.kind === "p"
              ? `<p>${partsHtml(block.parts)}</p>`
              : `<ol>${block.items.map((item) => `<li>${partsHtml(item)}</li>`).join("")}</ol>`,
          )
          .join("") +
        `</div>`,
    ).join("") +
    `</div></section>`
  );
}


/** The verdict's three finished variants, all server-rendered; `data-state` shows one (see the CSS). */
function verdictShellHtml(): string {
  return (
    `<div class="gmt-canada-verdict" data-role="verdict" data-state="pending" role="status">` +
    `<div class="gmt-canada-variant" data-variant="pending"><p class="gmt-canada-verdict-line">Checking your browser&hellip;</p></div>` +
    `<div class="gmt-canada-variant" data-variant="ok">${verdictHtml([])}</div>` +
    `<div class="gmt-canada-variant" data-variant="bad">${verdictHtml(TABLE_CITIES)}</div>` +
    `<div class="gmt-canada-variant" data-variant="unreadable">${UNREADABLE_HTML}</div>` +
    `</div>`
  );
}

/**
 * The inline script of the "Your browser" card. The check is `Intl` only and needs no network, so
 * it runs while the page is parsed: it picks the finished verdict variant, fills the place chips
 * and the Yours cells, and sets `data-sig` (the readings) so the module knows the card is
 * already right and does not draw it again. Plain ES5, no imports: it is a string, so no bundler
 * touches it. Everything it needs comes from `PROBE_EPOCH_MS`, `TABLE_ZONES` and the same marks
 * as the module, passed as JSON. `canada-probe-inline.test.ts` runs it against the module.
 */
export function probeInlineSource(): string {
  const config = {
    epoch: PROBE_EPOCH_MS,
    zones: TABLE_ZONES.map((fact) => ({
      zone: fact.zone,
      city: cityOf(fact.zone),
      expected: fact.tzdb2026e,
    })),
    ok: MARK_OK,
    bad: MARK_BAD,
    none: NO_SIGNAL,
  };
  return String.raw`(function (c) {
  function fill() {
  var card = document.querySelector(".gmt-canada .gmt-canada-browser");
  if (!card) return false;
  var v = card.querySelector('[data-role="verdict"]');
  if (!v || card.querySelectorAll("tr[data-zone]").length < c.zones.length) return false;
  function read(z) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: "UTC", timeZoneName: "longOffset" });
      var parts = new Intl.DateTimeFormat("en", { timeZone: z, timeZoneName: "longOffset" }).formatToParts(c.epoch), n = "";
      for (var i = 0; i < parts.length; i++) if (parts[i].type === "timeZoneName") { n = parts[i].value; break; }
      if (n === "GMT") return "+00:00";
      var m = /^GMT([+\-\u2212])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(n);
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
    if (cell) cell.innerHTML = (o === f.expected ? c.ok : c.bad) + " " + o.replace("-", "\u2212");
  }
  var state = unread > 0 ? "unreadable" : wrong.length === 0 ? "ok" : "bad";
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
})(${JSON.stringify(config).replace(/</g, "\\u003c")});`;
}

/**
 * "Your browser": the verdict, then one row per place with the right offset beside the browser's,
 * then the button that reads it again. One card, so the answer and its evidence sit together.
 */
function browserCardHtml(titleId: string): string {
  return (
    `<section class="gmt-widget-section gmt-canada-browser" aria-labelledby="${titleId}">` +
    `<h4 id="${titleId}">Your browser</h4>` +
    verdictShellHtml() +
    `<table class="gmt-canada-table">` +
    `<thead><tr><th scope="col">Place</th><th scope="col">Correct<small class="gmt-canada-th-note">tzdb 2026e</small></th>` +
    `<th scope="col">Yours<small class="gmt-canada-th-note">2 Nov 2026</small></th></tr></thead>` +
    `<tbody>${TABLE_ZONES.map(probeRowHtml).join("")}</tbody></table>` +
    `<div class="gmt-canada-actions">` +
    `<button class="gmt-button gmt-button--pad" type="button" data-role="recheck">Check again</button>` +
    `<p class="gmt-canada-status" data-role="status" role="status"></p>` +
    `</div>` +
    `</section>`
  );
}

// ---------------------------------------------------------------------------
// Which saved events moved?
// ---------------------------------------------------------------------------

const STORED_BYTES_TEXT = STORED_MAX_BYTES.toLocaleString("en-US");
/** What the textarea holds on load and after "Reset to example": one moved, three that are fine or moved by a different zone. */
export const STORED_EXAMPLE = [
  "2026-11-15T09:00:00-08:00[America/Vancouver]",
  "2026-11-15T09:00:00-07:00[America/Vancouver]",
  "2026-11-15T09:00:00-05:00[America/Toronto]",
  "2026-12-01T18:00:00-06:00[America/Winnipeg]",
].join("\n");
/**
 * The saved-times section. A title, one plain line and three steps say what it is for; then the
 * form and the answers. The form is plain controls (nothing is rebuilt from `div`s); the answers
 * are one compact table row per line, under a summary bar that holds the count, the stale-data
 * alert and the All / Only moved toggle. The textarea starts with the example and the check runs
 * once on load.
 */
function storedStepsHtml(): string {
  const ex = SAVED_EXAMPLE;
  const chip = (text: string) => `<code>${escapeHtml(text)}</code>`;
  const at = (offset: string) => `${ex.wallHm} ${signedOffset(offset)}`;
  return (
    `<ol class="gmt-canada-steps" aria-label="An example">` +
    `<li class="gmt-canada-step"><span class="gmt-canada-step-head">Booked before the change</span>` +
    `<span>${escapeHtml(`${Number(ex.wallHm.slice(0, 2))}:${ex.wallHm.slice(3)}, 15 Nov, ${ex.city}`)}, saved as ${chip(at(ex.savedOffset))}</span></li>` +
    `<li class="gmt-canada-step gmt-canada-step--rule"><span class="gmt-canada-step-head">New rule</span>` +
    `<span>${escapeHtml(ex.city)} stays on ${chip(signedOffset(ex.newOffset))}</span></li>` +
    `<li class="gmt-canada-step gmt-canada-step--now"><span class="gmt-canada-step-head">Result</span>` +
    `<span>The saved event shows as ${chip(ex.shownHm)}. ${MARK_BAD} Fix: store ${chip(at(ex.newOffset))}</span></li>` +
    `</ol>`
  );
}

function storedSectionHtml(titleId: string): string {
  return (
    `<section class="gmt-widget-section gmt-canada-stored" aria-labelledby="${titleId}">` +
    `<h4 id="${titleId}">Did your saved events move?</h4>` +
    `<p class="gmt-canada-stored-lead">Apps often save a future event with the UTC offset that applied when it was booked. Where the rules changed, that saved offset is wrong, and the app shows the event an hour off.</p>` +
    storedStepsHtml() +
    `<div class="gmt-canada-stored-body">` +
    `<form class="gmt-canada-stored-form" data-role="stored-form" novalidate>` +
    `<label class="gmt-canada-stored-label" for="${titleId}-lines">Saved events, one per line</label>` +
    `<textarea id="${titleId}-lines" class="gmt-input gmt-canada-stored-lines" name="lines" data-role="stored-lines" rows="8" spellcheck="false" autocomplete="off" autocapitalize="off">${escapeHtml(STORED_EXAMPLE)}</textarea>` +
    `<p class="gmt-canada-stored-help">Paste values like <code>${escapeHtml(SAVED_EXAMPLE.saved)}</code>. Up to ${STORED_MAX_LINES} lines.</p>` +
    `<details class="gmt-canada-formats"><summary>Accepted formats</summary>` +
    `<p>Up to ${STORED_MAX_LINES} lines and ${STORED_BYTES_TEXT} bytes. Forms: <code>${escapeHtml(SAVED_EXAMPLE.saved)}</code>, <code>&lt;time&gt; &lt;zone&gt;</code>, or <code>&lt;time&gt;</code> with the zone picked below.</p></details>` +
    `<label class="gmt-canada-stored-zone" data-role="stored-zone-row" hidden><span>Lines without a zone use</span>` +
    `<select class="gmt-select" name="zone" data-role="stored-zone">` +
    STORED_ZONES.map(
      (zone) =>
        `<option value="${escapeAttr(zone)}">${escapeHtml(zone)}</option>`,
    ).join("") +
    `</select></label>` +
    `<div class="gmt-canada-stored-controls">` +
    `<button class="gmt-button gmt-button--pad gmt-canada-btn--primary" type="submit" data-role="stored-check">Check</button>` +
    `<button class="gmt-button gmt-button--pad gmt-canada-btn--ghost" type="button" data-role="stored-example">Reset example</button>` +
    `</div>` +
    `<p class="gmt-canada-status" data-role="stored-status" role="status"></p>` +
    `</form>` +
    `<div class="gmt-canada-stored-out">` +
    `<div class="gmt-canada-stored-head">` +
    `<p class="gmt-canada-stored-summary" data-role="stored-summary" role="status">Checking&hellip;</p>` +
    `<div class="gmt-canada-seg" role="group" aria-label="Show">` +
    `<button type="button" class="gmt-canada-seg-btn" data-role="stored-show-all" aria-pressed="true">All</button>` +
    `<button type="button" class="gmt-canada-seg-btn" data-role="stored-show-moved" aria-pressed="false">Only moved</button>` +
    `</div>` +
    `<p class="gmt-canada-alert" data-role="stored-stale" role="note" hidden></p>` +
    `</div>` +
    `<p class="gmt-canada-status" data-role="stored-truncated"></p>` +
    `<div class="gmt-canada-stored-results" data-role="stored-results">` +
    `<p class="gmt-widget-hint">Checking&hellip;</p></div>` +
    `</div>` +
    `</div>` +
    `</section>`
  );
}

type AuditModule = typeof import("./stored-time-audit");

/** The readings are a pure helper; it loads on the first answer, not with the page. */
async function loadAuditWords(): Promise<AuditModule> {
  return import("./stored-time-audit");
}

function storedRowHtml(
  row: StoredRow,
  audit: AuditModule,
  staleZones: ReadonlySet<string>,
): string {
  const result = row.result;
  const zone = storedZoneOf(row.value);
  const stale = result !== null && zone !== null && staleZones.has(zone);
  const badge = storedBadge(result, stale);
  const advice = storedAdvice(row.value, result);
  const fix = stale ? null : storedFix(row.value, result);
  const pill =
    result === null
      ? NO_SIGNAL
      : `<span class="gmt-canada-badge" data-tone="${badge.tone}">${badge.mark === "" ? "" : `<span aria-hidden="true">${badge.mark}</span> `}${escapeHtml(badge.label)}</span>`;
  let todo: string;
  if (stale) {
    todo = `<p class="gmt-canada-alt">Try again after the update.</p>`;
  } else if (fix !== null) {
    todo =
      `<p class="gmt-canada-fix"><span>Keep ${escapeHtml(fix.localHm)} local: store <code>${escapeHtml(fix.keepLocal)}</code></span> ` +
      `<button type="button" class="gmt-button gmt-canada-copy" data-role="stored-copy" data-copy-text="${escapeAttr(fix.keepLocal)}" aria-label="Copy ${escapeAttr(fix.keepLocal)}">Copy</button></p>` +
      (fix.oldLocal === null
        ? ""
        : `<p class="gmt-canada-alt">Or keep the old instant (that is ${escapeHtml(fix.oldLocal)} local).</p>`);
  } else {
    todo = `<p>${escapeHtml(advice.todo)}</p>`;
  }
  const readings =
    result === null
      ? ""
      : `<details class="gmt-canada-readings"><summary>Readings</summary><dl>` +
        audit
          .readingsOf(result)
          .map(
            ({ name, value }) =>
              `<div><dt><code>${escapeHtml(name)}</code></dt><dd>${escapeHtml(value)}</dd></div>`,
          )
          .join("") +
        `</dl></details>`;
  const ok = result !== null && !stale && advice.ok;
  const state = result === null || stale ? "unknown" : String(ok);
  return (
    `<tr data-kind="${result?.kind ?? "none"}" data-ok="${state}">` +
    `<td class="gmt-canada-stored-result">${pill}</td>` +
    `<td class="gmt-canada-stored-input"><code title="${escapeAttr(row.input)}">${escapeHtml(row.input)}</code></td>` +
    `<td class="gmt-canada-stored-says">${todo}${stale ? "" : readings}</td>` +
    `</tr>`
  );
}

function storedTableHtml(
  rows: readonly StoredRow[],
  audit: AuditModule,
  staleZones: ReadonlySet<string>,
): string {
  return (
    `<table class="gmt-canada-stored-table"><thead><tr>` +
    `<th scope="col">Status</th><th scope="col">Saved event</th><th scope="col">What to do</th></tr></thead>` +
    `<tbody>${rows.map((row) => storedRowHtml(row, audit, staleZones)).join("")}</tbody></table>` +
    `<p class="gmt-widget-hint" data-role="stored-none" hidden>No line is left with this filter.</p>`
  );
}

/** The message under the filter when the Worker cut the input. */
export function storedTruncatedText(check: StoredCheck): string {
  const last = check.rows.at(-1);
  const base = `The input was over ${STORED_MAX_LINES} lines or ${STORED_BYTES_TEXT} bytes;`;
  return last === undefined
    ? `${base} no line was read.`
    : `${base} lines after line ${last.line} were not read.`;
}

type StoredAnswer =
  | { kind: "ok"; check: StoredCheck }
  | { kind: "rate-limited"; seconds: number | null }
  | { kind: "too-large" }
  | { kind: "failed" };

async function askStored(
  fetchFn: typeof fetch,
  form: FormData,
  signal: AbortSignal,
): Promise<StoredAnswer> {
  try {
    const response = await fetchFn(withBase("/api/canada-clock-change"), {
      method: "POST",
      body: form,
      signal,
    });
    if (response.status === 429) {
      const seconds = Number(response.headers.get("retry-after"));
      return {
        kind: "rate-limited",
        seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
      };
    }
    if (response.status === 413) return { kind: "too-large" };
    if (!response.ok) return { kind: "failed" };
    return { kind: "ok", check: (await response.json()) as StoredCheck };
  } catch {
    return { kind: "failed" };
  }
}

/**
 * The summary's words: how many of the lines this check can judge moved. A line in a zone the data
 * is stale for is counted apart, never as moved or as right.
 */
export function storedSummaryText(
  rows: readonly StoredRow[],
  staleZones: ReadonlySet<string> = new Set(),
): string {
  const readable = rows.filter((row) => row.result !== null);
  const unknown = readable.filter((row) => staleZones.has(storedZoneOf(row.value) ?? ""));
  const judged = readable.filter((row) => !unknown.includes(row));
  const moved = judged.filter((row) => !storedAdvice(row.value, row.result).ok);
  const tail = unknown.length === 0 ? "" : ` · ${unknown.length} can’t be checked yet`;
  if (judged.length === 0) {
    return unknown.length > 0 ? "No saved event can be checked yet" : "Nothing checked";
  }
  const movedText = moved.length === 0 ? "none moved" : `${moved.length} moved`;
  return `${judged.length} checked · ${movedText}${tail}`;
}

interface StoredHandle {
  /**
   * Says which zones this check's own time zone data has wrong. Lines in them get no verdict and
   * no advice. Until it is called, no answer is drawn.
   */
  setStaleZones(zones: readonly string[]): void;
  /** Settles when the first check, the one that runs on load, has drawn. */
  ready: Promise<void>;
}

/**
 * Wires the stored-times form. Only plain controls: Tab, Enter and Space do the rest. The
 * textarea starts with the example, and the check runs once now.
 */
function mountStoredTimes(
  root: HTMLElement,
  signal: AbortSignal,
  fetchFn: typeof fetch,
): StoredHandle {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector<T>(`[data-role="${role}"]`);
  const form = q<HTMLFormElement>("stored-form");
  const lines = q<HTMLTextAreaElement>("stored-lines");
  const zone = q<HTMLSelectElement>("stored-zone");
  const zoneRow = q<HTMLElement>("stored-zone-row");
  const check = q<HTMLButtonElement>("stored-check");
  const example = q<HTMLButtonElement>("stored-example");
  const showAll = q<HTMLButtonElement>("stored-show-all");
  const showMoved = q<HTMLButtonElement>("stored-show-moved");
  const status = q<HTMLElement>("stored-status");
  const truncated = q<HTMLElement>("stored-truncated");
  const results = q<HTMLElement>("stored-results");
  const stale = q<HTMLElement>("stored-stale");
  const summary = q<HTMLElement>("stored-summary");
  let staleZones: ReadonlySet<string> | null = null;
  let last: StoredCheck | null = null;
  let audit: AuditModule | null = null;
  const handle: StoredHandle = {
    ready: Promise.resolve(),
    setStaleZones(ids) {
      staleZones = new Set(ids);
      if (stale) {
        stale.hidden = ids.length === 0;
        stale.textContent =
          ids.length === 0
            ? ""
            : staleCheckText(ids.length === 1 ? ids[0]! : null, ids.map(cityOf));
      }
      draw();
    },
  };
  if (!form || !lines || !zone || !results) return handle;

  let busy = false;
  let onlyMoved = false;

  /** Hides the rows that are not moved when the toggle says so: filtering, not counting. */
  function applyFilter(): void {
    const rows = results!.querySelectorAll<HTMLElement>("tbody tr");
    let shown = 0;
    rows.forEach((row) => {
      const hide = onlyMoved && row.dataset.ok !== "false";
      row.hidden = hide;
      if (!hide) shown += 1;
    });
    const none = results!.querySelector<HTMLElement>(
      '[data-role="stored-none"]',
    );
    if (none) none.hidden = rows.length === 0 || shown > 0;
  }

  function setShow(moved: boolean): void {
    onlyMoved = moved;
    showAll?.setAttribute("aria-pressed", String(!moved));
    showMoved?.setAttribute("aria-pressed", String(moved));
    applyFilter();
  }
  showAll?.addEventListener("click", () => setShow(false), { signal });
  showMoved?.addEventListener("click", () => setShow(true), { signal });

  /** Draws the last answer. Waits for the stale-zone list, so no line is ever judged on data known to be old. */
  function draw(): void {
    if (last === null || staleZones === null || audit === null) return;
    const result = last;
    results!.innerHTML =
      result.rows.length === 0
        ? `<p class="gmt-widget-hint">${result.truncated ? "No line was read." : "Nothing to check. Paste a line, or press Reset example."}</p>`
        : storedTableHtml(result.rows, audit, staleZones);
    if (truncated) {
      truncated.textContent = result.truncated ? storedTruncatedText(result) : "";
    }
    if (summary) {
      summary.textContent = result.rows.length === 0 ? "" : storedSummaryText(result.rows, staleZones);
    }
    applyFilter();
  }

  // The Copy buttons in the rows: one handler for however many the answer draws.
  results.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-role="stored-copy"]');
      const text = button?.dataset.copyText;
      if (!button || !text || !navigator.clipboard) return;
      void navigator.clipboard.writeText(text).then(
        () => {
          button.textContent = "Copied";
          if (status) status.textContent = "Copied";
          setTimeout(() => {
            button.textContent = "Copy";
          }, 1500);
        },
        () => {},
      );
    },
    { signal },
  );

  // The zone picker is only needed when a line has no zone of its own.
  const syncZoneRow = (): void => {
    if (zoneRow) zoneRow.hidden = !needsZonePicker(lines.value);
  };
  lines.addEventListener("input", syncZoneRow, { signal });
  syncZoneRow();

  example?.addEventListener(
    "click",
    () => {
      lines.value = STORED_EXAMPLE;
      syncZoneRow();
      lines.focus();
      void run();
    },
    { signal },
  );

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      if (busy) return;
      void run();
    },
    { signal },
  );

  async function run(): Promise<void> {
    busy = true;
    check?.setAttribute("aria-busy", "true");
    if (status) status.textContent = "Checking…";
    const body = new FormData();
    body.set("lines", lines!.value);
    body.set("zone", zone!.value);
    const answer = await askStored(fetchFn, body, signal);
    let message = "";
    if (answer.kind === "ok") {
      try {
        audit = await loadAuditWords();
        if (signal.aborted) return;
        last = answer.check;
        draw();
      } catch {
        message = "The results could not be drawn. Reload the page.";
      }
    } else if (answer.kind === "rate-limited") {
      message =
        answer.seconds === null
          ? "Too many checks. Try again shortly."
          : `Try again in ${answer.seconds} s`;
    } else if (answer.kind === "too-large") {
      message = `That is too much text to read. Keep it to ${STORED_MAX_LINES} lines and ${STORED_BYTES_TEXT} bytes.`;
    } else {
      message = "The check could not finish.";
    }
    busy = false;
    check?.removeAttribute("aria-busy");
    if (signal.aborted) return;
    if (status) status.textContent = message;
  }

  handle.ready = run();
  return handle;
}

// ---------------------------------------------------------------------------
// The browser column
// ---------------------------------------------------------------------------

export type BrowserReading =
  | { kind: "offset"; offset: string }
  | { kind: "unknown-zone" }
  | { kind: "unsupported" };

/**
 * The offset this browser's own time zone data gives `zone` at `PROBE_INSTANT`. A `RangeError` for the
 * zone is "unknown to this browser"; an engine that cannot format `longOffset` at all is
 * `unsupported`, a different answer.
 */
export function readBrowserOffset(zone: string): BrowserReading {
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
    }).formatToParts(PROBE_EPOCH_MS);
    const name =
      parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    const offset = offsetFromIntl(name);
    return offset === "" ? { kind: "unsupported" } : { kind: "offset", offset };
  } catch (error) {
    if (error instanceof RangeError) return { kind: "unknown-zone" };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

export interface CanadaMountOptions {
  /** The fetch to call the Worker with. Tests pass a fake. */
  fetch?: typeof fetch;
  /** The client's now as a UTC instant. Defaults to the library's `getUtcNow`. */
  now?: () => string;
  /** A zone id to pin on the map once it is drawn. An id not on the map is ignored. */
  pinZone?: string;
  /** Where the map reads and writes `?zone=`. The chat passes inert ones: its URL is not the checker's. */
  location?: Pick<Location, "href">;
  history?: Pick<History, "replaceState">;
}

type Answer =
  | { kind: "ok"; check: CanadaCheck }
  | { kind: "rate-limited"; seconds: number | null }
  | { kind: "failed" };

async function ask(
  fetchFn: typeof fetch,
  signal: AbortSignal,
): Promise<Answer> {
  try {
    const response = await fetchFn(withBase("/api/canada-clock-change"), {
      signal,
    });
    if (response.status === 429) {
      const seconds = Number(response.headers.get("retry-after"));
      return {
        kind: "rate-limited",
        seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
      };
    }
    if (!response.ok) return { kind: "failed" };
    return { kind: "ok", check: (await response.json()) as CanadaCheck };
  } catch {
    return { kind: "failed" };
  }
}

/** Milliseconds from `now` to the next minute boundary, read from its seconds field. */
export function msToNextMinute(now: string): number {
  const match = /:(\d{2})(?:\.(\d+))?Z$/.exec(now);
  if (match === null) return 60_000;
  const seconds = Number(match[1]);
  const millis = match[2] === undefined ? 0 : Number(`0.${match[2]}`) * 1000;
  return Math.max(50, Math.ceil(60_000 - (seconds * 1000 + millis)));
}

/** Milliseconds from `now` to the next whole second, read from its fraction. */
export function msToNextSecond(now: string): number {
  const match = /:\d{2}\.(\d+)Z$/.exec(now);
  const millis = match === null ? 0 : Number(`0.${match[1]}`) * 1000;
  return Math.max(50, Math.ceil(1000 - millis));
}

function wallText(wallBefore: string): string {
  return wallBefore.replace("T", " ").slice(0, 16);
}

function changeRowHtml(row: TransitionRow): string {
  if (row.wallBefore === "") return `<li>${NO_SIGNAL}</li>`;
  return (
    `<li class="gmt-canada-change">` +
    `<span class="gmt-canada-when">${escapeHtml(wallText(row.wallBefore))}</span>` +
    `<span class="gmt-canada-shift">${escapeHtml(row.offsetBefore)} → ${escapeHtml(row.offsetAfter)}</span>` +
    `<span class="gmt-canada-utc">${escapeHtml(row.instant)}</span></li>`
  );
}

/**
 * The verdict, as lines of plain words: what is wrong, what a reader does, and what a developer
 * does. The places are code chips. All correct is one line.
 */
export function verdictHtml(wrong: readonly string[]): string {
  if (wrong.length === 0) {
    return `<p class="gmt-canada-verdict-line">${MARK_OK} Your browser has the new rules for all four places.</p>`;
  }
  return (
    `<p class="gmt-canada-verdict-line">${MARK_BAD} Your browser has old time zone data for <span data-role="wrong-places">${placesHtml(wrong)}</span>. From 1 November 2026 it shows their time an hour wrong.</p>` +
    `<p class="gmt-canada-verdict-more"><strong>For you:</strong> update your browser. If it is already up to date, its maker has not shipped the fix yet. Check again after the next update.</p>` +
    `<p class="gmt-canada-verdict-more"><strong>For developers:</strong> your users&rsquo; browsers can be the same. See step 2 under <a href="#canada-developers">For developers</a>.</p>`
  );
}

export async function mountCanadaClockChange(
  root: HTMLElement,
  signal: AbortSignal,
  options: CanadaMountOptions = {},
): Promise<void> {
  const q = <T extends HTMLElement>(
    selector: string,
    within: ParentNode = root,
  ) => within.querySelector<T>(selector);

  // The browser column needs no library and no answer: fill it first. On the page the inline
  // script has already done it (`data-sig` holds its readings); the same readings are not drawn again.
  const browserOffsets = new Map<string, BrowserReading>();
  const wrong: string[] = [];
  let unread = 0;
  const sig: string[] = [];
  for (const fact of TABLE_ZONES) {
    const reading = readBrowserOffset(fact.zone);
    browserOffsets.set(fact.zone, reading);
    if (reading.kind === "offset") {
      if (reading.offset !== fact.tzdb2026e) wrong.push(cityOf(fact.zone));
    } else {
      unread += 1;
    }
    sig.push(reading.kind === "offset" ? reading.offset : "?");
  }
  const verdict = q<HTMLElement>('[data-role="verdict"]');
  if (verdict && verdict.dataset.sig !== sig.join(",")) {
    for (const fact of TABLE_ZONES) {
      const reading = browserOffsets.get(fact.zone)!;
      const cell = q<HTMLElement>(
        '[data-role="browser"]',
        q<HTMLElement>(`tr[data-zone="${fact.zone}"]`) ?? root,
      );
      if (!cell) continue;
      cell.innerHTML =
        reading.kind === "offset"
          ? `${reading.offset === fact.tzdb2026e ? MARK_OK : MARK_BAD} ${escapeHtml(signedOffset(reading.offset))}`
          : NO_SIGNAL;
    }
    verdict.innerHTML = unread > 0 ? UNREADABLE_HTML : verdictHtml(wrong);
    verdict.dataset.state = unread > 0 ? "unreadable" : wrong.length === 0 ? "ok" : "bad";
    verdict.dataset.sig = sig.join(",");
  }

  let lib: CanadaLib;
  try {
    lib = await loadCanadaLib();
  } catch (error) {
    showUnavailable(root, error);
    return;
  }
  if (signal.aborted) return;

  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? lib.getUtcNow;
  const status = q<HTMLElement>('[data-role="status"]');
  const recheck = q<HTMLButtonElement>('[data-role="recheck"]');
  let check: CanadaCheck | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let busy = false;
  let mapMounted = false;
  let stored: StoredHandle | undefined;

  // --- the copy button announces -------------------------------------------
  wireCopyButtons(root);
  const copyStatus = q<HTMLElement>('[data-role="copy-status"]');
  q<HTMLElement>('[data-role="copy-node-probe"]')?.addEventListener(
    "click",
    () => {
      if (copyStatus) copyStatus.textContent = "Copied";
    },
    { signal },
  );
  bindClockGlow(root, signal);

  // --- the transitions -----------------------------------------------------
  function drawTransitions(answer: CanadaCheck): void {
    for (const zone of TRANSITION_ZONES) {
      const list = q<HTMLElement>(
        `.gmt-canada-group[data-zone="${zone}"] [data-role="changes"]`,
      );
      if (!list) continue;
      list.innerHTML = YEARS.map((year) => {
        const rows = answer.transitions.filter(
          (row) => row.zone === zone && row.year === year,
        );
        return rows.length === 0
          ? `<li class="gmt-canada-none">No clock change in ${year}</li>`
          : rows.map(changeRowHtml).join("");
      }).join("");
    }
  }

  // --- the clocks ----------------------------------------------------------
  function offsetAt(zone: MapZone, at: string): string {
    const next = zone.next;
    if (next !== null && !lib.isBeforeUtc(at, next.instant)) {
      return next.offsetAfter;
    }
    return zone.offset;
  }

  function drawClock(
    item: HTMLElement,
    zone: MapZone | undefined,
    at: string,
  ): void {
    const host = q<HTMLElement>('[data-role="clock"]', item)!;
    const readout = q<HTMLElement>('[data-role="clock-time"]', item)!;
    const id = item.dataset.zone ?? "";
    const offset = zone ? offsetAt(zone, at) : "";
    const wall =
      offset === ""
        ? ""
        : lib.convertUtcToPlainDateTime(at, { timeZone: offset });
    if (wall === "") {
      readout.innerHTML = NO_SIGNAL;
      readout.title = SIGNAL_LOST;
      return;
    }
    readout.removeAttribute("title");
    const hour = Number(wall.slice(11, 13));
    const minute = Number(wall.slice(14, 16));
    // Two spans for the readout's two voices: "HH:MM:SS" and the offset. The readout is plain text
    // (no live region), so the second ticking never reaches a screen reader.
    readout.innerHTML = `<span class="gmt-canada-clock-hm">${escapeHtml(wallHms(wall))}</span> <span class="gmt-canada-clock-off">${escapeHtml(offset)}</span>`;
    updateCrystalClock(host, {
      id: `canada-${id.replace(/[^A-Za-z0-9]/g, "-")}`,
      hour,
      minute,
      second: Number(wallHms(wall).slice(6, 8)),
      label: id,
      sublabel: `${wall.slice(11, 16)}, ${spokenOffset(offset)}`,
    });
  }

  function tick(): void {
    clearTimeout(timer);
    if (signal.aborted || check === null) return;
    const at = now();
    root.querySelectorAll<HTMLElement>(".gmt-canada-clock").forEach((item) => {
      const zone = check!.zones.find((z) => z.zone === item.dataset.zone);
      drawClock(item, zone, at);
    });
    timer = setTimeout(tick, msToNextSecond(at));
  }

  signal.addEventListener("abort", () => clearTimeout(timer), { once: true });

  // The clock of the zone picked in the list takes a full highlight; the other four stay as they are.
  const zoneList = root.querySelector<HTMLElement>('[data-role="zone-list"]');
  const markPicked = (): void => {
    const picked = zoneList?.querySelector<HTMLElement>('[aria-pressed="true"]')?.dataset.tzId;
    root.querySelectorAll<HTMLElement>(".gmt-canada-clock").forEach((item) => {
      if (picked !== undefined && item.dataset.zone === picked) item.dataset.picked = "true";
      else delete item.dataset.picked;
    });
  };
  if (zoneList) {
    const watcher = new MutationObserver(markPicked);
    watcher.observe(zoneList, { attributes: true, attributeFilter: ["aria-pressed"], subtree: true });
    signal.addEventListener("abort", () => watcher.disconnect(), { once: true });
    markPicked();
  }

  // --- the fetch -----------------------------------------------------------
  async function load(): Promise<void> {
    if (busy) return;
    busy = true;
    recheck?.setAttribute("aria-busy", "true");
    if (status) status.textContent = "Checking…";
    const answer = await ask(fetchFn, signal);
    busy = false;
    recheck?.removeAttribute("aria-busy");
    if (signal.aborted) return;
    if (answer.kind === "ok") {
      check = answer.check;
      stored?.setStaleZones(staleZoneIds(check.zones));
      if (status) status.textContent = "";
      drawTransitions(check);
      tick();
      if (!mapMounted) {
        mapMounted = true;
        const map = mountCanadaMap(root, check.zones, signal, {
          responseNow: check.now,
          now,
          wall: (at, offset) =>
            lib.convertUtcToPlainDateTime(at, { timeZone: offset }),
          isBefore: lib.isBeforeUtc,
          msToNextSecond,
          fetch: fetchFn,
          location: options.location,
          history: options.history,
        });
        if (options.pinZone !== undefined) map.pin(options.pinZone);
      }
    } else if (answer.kind === "rate-limited") {
      if (status) {
        status.textContent =
          answer.seconds === null
            ? "Too many checks. Try again shortly."
            : `Try again in ${answer.seconds} s`;
      }
    } else if (status) {
      status.textContent = "The check could not finish.";
    }
  }

  recheck?.addEventListener("click", () => void load(), { signal });
  stored = mountStoredTimes(root, signal, fetchFn);
  await load();
  await stored.ready;
}

// ---------------------------------------------------------------------------
// The chat widget
// ---------------------------------------------------------------------------

export interface CanadaClockChangeArgs {
  /** One zone id from `canada-zones.json` to pin on the map. */
  zone?: string;
}

const NO_LOCATION: Pick<Location, "href"> = { href: "https://dox.invalid/" };
const NO_HISTORY: Pick<History, "replaceState"> = { replaceState: () => {} };

/** The chat's markup: the page's sections, with ids namespaced by `idPrefix`. */
export function renderCanadaClockChangeWidgetTemplate(
  idPrefix: string,
): string {
  return renderCanadaClockChangeTemplate({ idPrefix });
}

/**
 * Mounts the checker in the chat rail. The rail is narrow, so the map's container query shows
 * the zone list; the list pins the same zone. The widget fetches the Worker's endpoint like the
 * page does and computes nothing itself. `?zone=` on the chat's URL is neither read nor written.
 *
 * The library load is awaited so a failed load rejects with `WidgetLoadError`, which the host
 * turns into its retry state. The answer is not awaited: the handle returns at once, and the
 * widget's own status line carries a slow or failed Worker.
 */
export const mountCanadaClockChangeWidget: MountFn<
  CanadaClockChangeArgs
> = async (root, args, signal) => {
  await loadCanadaLib();
  if (signal.aborted) return INERT_HANDLE;
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  mountCanadaClockChange(root, controller.signal, {
    pinZone: args.zone,
    location: NO_LOCATION,
    history: NO_HISTORY,
  }).catch((error) => {
    if (!controller.signal.aborted) showUnavailable(root, error);
  });
  return onceDestroy(
    () => {
      signal.removeEventListener("abort", stop);
      controller.abort();
    },
    () => {
      const zone = root.querySelector<HTMLElement>(
        '.gmt-canada-zone-btn[aria-pressed="true"]',
      )?.dataset.tzId;
      return zone ? { zone } : null;
    },
  );
};
