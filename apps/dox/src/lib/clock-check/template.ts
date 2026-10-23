/**
 * The markup every clock-change checker shares, as pure strings: the browser card with its
 * verdict, the inline probe, the transitions table, the live clocks, the info cards, the key
 * points and the saved-times section. The server renders each with its known rows, so the page
 * does not grow once the answer arrives. Every builder takes the checker's `CheckPage`; a
 * checker's own module composes them (and adds whatever else its page has, such as a map).
 */
import { codeFrameHtml } from "../code-frame";
import { withBase } from "../site";
import { escapeAttr, escapeHtml } from "../widget-ui";
import {
  STORED_MAX_BYTES,
  STORED_MAX_LINES,
  cityOf,
  expectedProbeOutput,
  nodeProbeCommand,
  probeEpochMs,
  signedOffset,
  type ClockCheckFacts,
  type ProbeFact,
  type ProbeRow,
  type ZoneNow,
} from "./facts";
import {
  HELP_HEADING,
  KEY_POINTS_HEADING,
  partsHtml,
  type HelpCard,
  type KeyCard,
} from "./key-points";
import { minimumsItemsHtml, type MinimumsCard } from "./minimums";
import type { SavedExample } from "./saved-example";
import { needsZonePicker } from "./stored-times";

/** The words a checker puts into the shared markup. */
export interface CheckCopy {
  /** The verdict when every place is right: plain text, after the mark. */
  verdictOk: string;
  /**
   * The verdict when some places are wrong, from the places as code chips (`placesHtml`): the
   * first line (HTML, after the mark) and the paragraphs under it (HTML).
   */
  verdictWrong(
    places: string,
    idPrefix: string,
  ): { line: string; more: readonly string[] };
  /** The `Correct` column's note, such as `tzdb 2026e`. */
  correctNote: string;
  /** The clocks' notice for a browser with old data (HTML). */
  clocksNotice: string;
  clocksHeading: string;
  clocksHint: string;
  changesHeading: string;
  changesHint: string;
  serversTitle: string;
  serversLine: string;
  /** The saved-times section's one plain line. */
  storedLead: string;
  /** The day the worked example is booked for, such as `15 Nov`. */
  savedDay: string;
}

/** What a page of one checker is: the single input of every builder in this module. */
export interface CheckPage {
  /** Shared with the Worker. */
  facts: ClockCheckFacts;
  /** Element ids and `#anchors`: a short lowercase word, such as `"demo"`. */
  idPrefix: string;
  /** The rows of the browser card. A zone in it is one that stops (or changes) its clocks. */
  table: readonly ProbeFact[];
  /** The Yours column's date, such as `2 Nov 2026`. */
  probeLabel: string;
  copy: CheckCopy;
  keyPoints: readonly KeyCard[];
  help: HelpCard;
  minimums: MinimumsCard;
  /** What the saved-times textarea holds on load and after "Reset example". */
  storedPreset: string;
  /** The worked example above the saved-times form. */
  saved: SavedExample;
  /** The zones of the transitions table. */
  transitionZones: readonly string[];
  /** The zone ids whose own tz data is older than the change, from an answer. */
  staleZones(answer: {
    probe: readonly ProbeRow[];
    zones: readonly ZoneNow[];
  }): string[];
}

export const NO_SIGNAL = `<span class="gmt-playground-sentinel">NO SIGNAL</span>`;
export const SIGNAL_LOST = "⟨ NO SIGNAL — invalid input ⟩";
/** The verdict's and the cells' marks. The glyph is the icon; the words beside it carry the meaning. */
export const MARK_OK = `<span class="gmt-check-mark gmt-check-mark--ok" aria-hidden="true">✓</span>`;
export const MARK_BAD = `<span class="gmt-check-mark gmt-check-mark--bad" aria-hidden="true">✗</span>`;
export const UNREADABLE_HTML = `<p class="gmt-check-verdict-line">${NO_SIGNAL} Your browser cannot read these zones.</p>`;
export const STORED_BYTES_TEXT = STORED_MAX_BYTES.toLocaleString("en-US");

/** City names as the page's code chips, joined "A, B and C". */
export function placesHtml(cities: readonly string[]): string {
  const chips = cities.map((city) => `<code>${escapeHtml(city)}</code>`);
  if (chips.length < 2) return chips.join("");
  return `${chips.slice(0, -1).join(", ")} and ${chips[chips.length - 1]}`;
}

/** The place names of the browser card's rows. */
export function tableCities(page: CheckPage): string[] {
  return page.table.map((fact) => cityOf(fact.zone));
}

/** The root and the stack every checker's page sits in: rows go inside. */
export function checkShellHtml(page: CheckPage, inner: string): string {
  return (
    `<div class="gmt-check gmt-${page.facts.id} gmt-widget not-content">` +
    `<div class="gmt-check-stack">${inner}</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// The browser card
// ---------------------------------------------------------------------------

function probeRowHtml(fact: ProbeFact): string {
  const zone = escapeAttr(fact.zone);
  return (
    `<tr data-zone="${zone}" data-state="stopped">` +
    `<th scope="row" data-label="Place"><span class="gmt-check-city">${escapeHtml(cityOf(fact.zone))}</span><code class="gmt-check-zoneid">${escapeHtml(fact.zone)}</code></th>` +
    `<td data-label="Correct" class="gmt-check-num">${escapeHtml(signedOffset(fact.offset))}</td>` +
    `<td data-label="Yours" class="gmt-check-num" data-role="browser">${NO_SIGNAL}</td>` +
    `</tr>`
  );
}

/**
 * The verdict, as lines of plain words: what is wrong, what a reader does, and what a developer
 * does. The places are code chips. All correct is one line.
 */
export function verdictHtml(page: CheckPage, wrong: readonly string[]): string {
  if (wrong.length === 0) {
    return `<p class="gmt-check-verdict-line">${MARK_OK} ${page.copy.verdictOk}</p>`;
  }
  const { line, more } = page.copy.verdictWrong(
    `<span data-role="wrong-places">${placesHtml(wrong)}</span>`,
    page.idPrefix,
  );
  return (
    `<p class="gmt-check-verdict-line">${MARK_BAD} ${line}</p>` +
    more.map((text) => `<p class="gmt-check-verdict-more">${text}</p>`).join("")
  );
}

/** The verdict's finished variants, all server-rendered; `data-state` shows one (see the CSS). */
function verdictShellHtml(page: CheckPage): string {
  return (
    `<div class="gmt-check-verdict" data-role="verdict" data-state="pending" role="status">` +
    `<div class="gmt-check-variant" data-variant="pending"><p class="gmt-check-verdict-line">Checking your browser&hellip;</p></div>` +
    `<div class="gmt-check-variant" data-variant="ok">${verdictHtml(page, [])}</div>` +
    `<div class="gmt-check-variant" data-variant="bad">${verdictHtml(page, tableCities(page))}</div>` +
    `<div class="gmt-check-variant" data-variant="unreadable">${UNREADABLE_HTML}</div>` +
    `</div>`
  );
}

/**
 * "Your browser": the verdict, then one row per place with the right offset beside the browser's,
 * then the button that reads it again. One card, so the answer and its evidence sit together.
 */
export function browserCardHtml(page: CheckPage, titleId: string): string {
  return (
    `<section class="gmt-widget-section gmt-check-browser" aria-labelledby="${titleId}">` +
    `<h4 id="${titleId}">Your browser</h4>` +
    verdictShellHtml(page) +
    `<table class="gmt-check-table">` +
    `<thead><tr><th scope="col">Place</th><th scope="col">Correct<small class="gmt-check-th-note">${escapeHtml(page.copy.correctNote)}</small></th>` +
    `<th scope="col">Yours<small class="gmt-check-th-note">${escapeHtml(page.probeLabel)}</small></th></tr></thead>` +
    `<tbody>${page.table.map(probeRowHtml).join("")}</tbody></table>` +
    `<div class="gmt-check-actions">` +
    `<button class="gmt-button gmt-button--pad" type="button" data-role="recheck">Check again</button>` +
    `<p class="gmt-check-status" data-role="status" role="status"></p>` +
    `</div>` +
    `</section>`
  );
}

/**
 * The inline script of the "Your browser" card. The check is `Intl` only and needs no network, so
 * it runs while the page is parsed: it picks the finished verdict variant, fills the place chips
 * and the Yours cells, and sets `data-sig` (the readings) so the module knows the card is
 * already right and does not draw it again. Plain ES5, no imports: it is a string, so no bundler
 * touches it. Everything it needs comes from the probe instant, the table and the same marks as
 * the module, passed as JSON.
 */
export function probeInlineSource(page: CheckPage): string {
  const config = {
    epoch: probeEpochMs(page.facts),
    zones: page.table.map((fact) => ({
      zone: fact.zone,
      city: cityOf(fact.zone),
      expected: fact.offset,
    })),
    ok: MARK_OK,
    bad: MARK_BAD,
    none: NO_SIGNAL,
  };
  return String.raw`(function (c) {
  function fill() {
  var card = document.querySelector(".gmt-check .gmt-check-browser");
  if (!card) return false;
  var v = card.querySelector('[data-role="verdict"]');
  if (!v || card.querySelectorAll("tr[data-zone]").length < c.zones.length) return false;
  function read(z) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: "UTC", timeZoneName: "longOffset" });
      var parts = new Intl.DateTimeFormat("en", { timeZone: z, timeZoneName: "longOffset" }).formatToParts(c.epoch), n = "";
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

// ---------------------------------------------------------------------------
// The clock changes and the clocks
// ---------------------------------------------------------------------------

function transitionGroupHtml(page: CheckPage, zone: string): string {
  return (
    `<li class="gmt-check-group" data-zone="${escapeAttr(zone)}">` +
    `<h5 class="gmt-check-group-title"><code>${escapeHtml(zone)}</code></h5>` +
    `<ul class="gmt-check-changes" data-role="changes">` +
    page.facts.transitionYears
      .map((year) => `<li data-year="${year}">${NO_SIGNAL}</li>`)
      .join("") +
    `</ul></li>`
  );
}

/** The clock changes of each transitions-table zone, one group per zone. */
export function changesSectionHtml(page: CheckPage, titleId: string): string {
  return (
    `<section class="gmt-widget-section" aria-labelledby="${titleId}">` +
    `<h4 id="${titleId}">${escapeHtml(page.copy.changesHeading)}</h4>` +
    `<p class="gmt-widget-hint">${escapeHtml(page.copy.changesHint)}</p>` +
    `<ul class="gmt-check-groups" data-role="transitions">${page.transitionZones.map((zone) => transitionGroupHtml(page, zone)).join("")}</ul>` +
    `</section>`
  );
}

function clockHtml(page: CheckPage, zone: string): string {
  const state = page.table.some((fact) => fact.zone === zone)
    ? "stopped"
    : "changes";
  return (
    `<li class="gmt-check-clock" data-zone="${escapeAttr(zone)}" data-state="${state}">` +
    `<div class="gmt-check-face" data-role="clock"></div>` +
    `<p class="gmt-check-clock-zone"><code>${escapeHtml(zone)}</code></p>` +
    `<p class="gmt-check-clock-time" data-role="clock-time">${NO_SIGNAL}</p>` +
    `</li>`
  );
}

/** The live clocks, one per `facts.clockZones`. */
export function clocksSectionHtml(page: CheckPage, titleId: string): string {
  return (
    `<section class="gmt-widget-section gmt-check-clocksec" aria-labelledby="${titleId}">` +
    `<h4 id="${titleId}">${escapeHtml(page.copy.clocksHeading)}</h4>` +
    `<p class="gmt-check-clocks-notice" data-role="clocks-notice" hidden>${page.copy.clocksNotice}</p>` +
    `<ul class="gmt-check-clocks" data-role="clocks">${page.facts.clockZones.map((zone) => clockHtml(page, zone)).join("")}</ul>` +
    `<p class="gmt-widget-hint gmt-check-clocks-hint">${escapeHtml(page.copy.clocksHint)}</p>` +
    `</section>`
  );
}

// ---------------------------------------------------------------------------
// The info cards
// ---------------------------------------------------------------------------

function nodeProbeFrame(page: CheckPage): string {
  const command = nodeProbeCommand(page.table, page.facts.probeInstant);
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

const INFO_ICON =
  `<svg class="gmt-check-info-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">` +
  `<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
  `<path d="M12 11v5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
  `<circle cx="12" cy="7.6" r="1.1" fill="currentColor"/></svg>`;

/** The "Test your own servers" info card: the command, a keyboard copy button and the expected output. */
export function serversCardHtml(page: CheckPage): string {
  const expected = expectedProbeOutput(page.table)
    .map(
      ([city, offset]) =>
        `<code>${escapeHtml(city)}</code> ${escapeHtml(offset)}`,
    )
    .join(" &middot; ");
  return (
    `<section class="gmt-check-servers" aria-labelledby="${page.idPrefix}-servers-title">` +
    INFO_ICON +
    `<div class="gmt-check-servers-body">` +
    `<h4 id="${page.idPrefix}-servers-title">${escapeHtml(page.copy.serversTitle)}</h4>` +
    `<p>${escapeHtml(page.copy.serversLine)}</p>` +
    nodeProbeFrame(page) +
    `<p class="gmt-check-servers-expected">Expected: ${expected}</p>` +
    `<p class="gmt-check-sr" data-role="copy-status" role="status"></p>` +
    `</div></section>`
  );
}

/** The "Upgrade to at least" card: the same info-card style as the servers card, full width. */
export function minimumsCardHtml(page: CheckPage): string {
  const card = page.minimums;
  return (
    `<section class="gmt-check-minimums" aria-labelledby="${page.idPrefix}-minimums-title">` +
    INFO_ICON +
    `<div class="gmt-check-servers-body">` +
    `<h4 id="${page.idPrefix}-minimums-title">${escapeHtml(card.heading)}</h4>` +
    `<p>${escapeHtml(card.intro)}</p>` +
    `<ul class="gmt-check-minimums-list">${minimumsItemsHtml(card.rows)}</ul>` +
    `<p>${escapeHtml(card.footer)}</p>` +
    `<p class="gmt-check-minimums-note">${escapeHtml(card.note)}</p>` +
    `</div></section>`
  );
}

/** The "How gmt helps" card: same panel as the other cards, no alert colour. */
export function helpCardHtml(page: CheckPage): string {
  const help = page.help;
  const href = (value: string): string =>
    value.startsWith("/") ? withBase(value) : value;
  const cases = help.cases
    .map(
      (item) =>
        `<li class="gmt-check-help-case">` +
        `<span class="gmt-check-help-tag">${escapeHtml(item.tag)}</span>` +
        `<div class="gmt-check-help-io">` +
        `<code class="gmt-check-help-in">${escapeHtml(item.input)}</code>` +
        `<span class="gmt-check-help-arrow" aria-hidden="true">→</span>` +
        `<code class="gmt-check-help-out">${escapeHtml(item.output)}</code>` +
        (item.outputNote
          ? `<span class="gmt-check-help-note">${escapeHtml(item.outputNote)}</span>`
          : "") +
        `</div>` +
        `<p class="gmt-check-help-why">${partsHtml(item.why, href)}</p>` +
        `</li>`,
    )
    .join("");
  return (
    `<section class="gmt-check-help" aria-labelledby="${page.idPrefix}-help-title">` +
    `<h4 id="${page.idPrefix}-help-title">${escapeHtml(HELP_HEADING)}</h4>` +
    `<p class="gmt-check-help-lede">${partsHtml(help.lede, href)}</p>` +
    `<p class="gmt-check-help-verified"><span class="gmt-check-help-badge"><span aria-hidden="true">✓</span> Verified</span> <span>${partsHtml(help.verified, href)}</span></p>` +
    `<p class="gmt-check-help-intro">${escapeHtml(help.intro)}</p>` +
    `<ul class="gmt-check-help-cases">${cases}</ul>` +
    `<p class="gmt-check-help-cta"><span>${escapeHtml(help.cta.lead)}</span> <a class="gmt-check-help-btn" href="${escapeAttr(href(help.cta.href))}">${escapeHtml(help.cta.link)} <span aria-hidden="true">↓</span></a></p>` +
    `</section>`
  );
}

/** The Key points: two cards, one for everyone and one for developers. */
export function keyPointsHtml(page: CheckPage): string {
  return (
    `<section class="gmt-keypoints" aria-labelledby="${page.idPrefix}-keypoints-title">` +
    `<h2 id="${page.idPrefix}-keypoints-title">${escapeHtml(KEY_POINTS_HEADING)}</h2>` +
    `<div class="gmt-keypoints-grid">` +
    page.keyPoints
      .map(
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
      )
      .join("") +
    `</div></section>`
  );
}

// ---------------------------------------------------------------------------
// Which saved events moved?
// ---------------------------------------------------------------------------

/**
 * The saved-times section. A title, one plain line and three steps say what it is for; then the
 * form and the answers. The form is plain controls (nothing is rebuilt from `div`s); the answers
 * are one compact table row per line, under a summary bar that holds the count, the stale-data
 * alert and the All / Only moved toggle. The textarea starts with the example and the check runs
 * once on load.
 */
function storedStepsHtml(page: CheckPage): string {
  const ex = page.saved;
  const chip = (text: string) => `<code>${escapeHtml(text)}</code>`;
  const at = (offset: string) => `${ex.wallHm} ${signedOffset(offset)}`;
  return (
    `<ol class="gmt-check-steps" aria-label="An example">` +
    `<li class="gmt-check-step"><span class="gmt-check-step-head">Booked before the change</span>` +
    `<span>${escapeHtml(`${Number(ex.wallHm.slice(0, 2))}:${ex.wallHm.slice(3)}, ${page.copy.savedDay}, ${ex.city}`)}, saved as ${chip(at(ex.savedOffset))}</span></li>` +
    `<li class="gmt-check-step gmt-check-step--rule"><span class="gmt-check-step-head">New rule</span>` +
    `<span>${escapeHtml(ex.city)} stays on ${chip(signedOffset(ex.newOffset))}</span></li>` +
    `<li class="gmt-check-step gmt-check-step--now"><span class="gmt-check-step-head">Result</span>` +
    `<span>The saved event shows as ${chip(ex.shownHm)}. ${MARK_BAD} Fix: store ${chip(at(ex.newOffset))}</span></li>` +
    `</ol>`
  );
}

export function storedSectionHtml(page: CheckPage, titleId: string): string {
  const ex = page.saved;
  return (
    `<section class="gmt-widget-section gmt-check-stored" aria-labelledby="${titleId}">` +
    `<h4 id="${titleId}">Did your saved events move?</h4>` +
    `<p class="gmt-check-stored-lead">${escapeHtml(page.copy.storedLead)}</p>` +
    storedStepsHtml(page) +
    `<div class="gmt-check-stored-body">` +
    `<form class="gmt-check-stored-form" data-role="stored-form" novalidate>` +
    `<label class="gmt-check-stored-label" for="${titleId}-lines">Saved events, one per line</label>` +
    `<textarea id="${titleId}-lines" class="gmt-input gmt-check-stored-lines" name="lines" data-role="stored-lines" rows="8" spellcheck="false" autocomplete="off" autocapitalize="off">${escapeHtml(page.storedPreset)}</textarea>` +
    `<p class="gmt-check-stored-help">Paste values like <code>${escapeHtml(ex.saved)}</code>. Up to ${STORED_MAX_LINES} lines.</p>` +
    `<details class="gmt-check-formats"><summary>Accepted formats</summary>` +
    `<p>Up to ${STORED_MAX_LINES} lines and ${STORED_BYTES_TEXT} bytes. Forms: <code>${escapeHtml(ex.saved)}</code>, <code>&lt;time&gt; &lt;zone&gt;</code>, or <code>&lt;time&gt;</code> with the zone picked below.</p></details>` +
    `<label class="gmt-check-stored-zone" data-role="stored-zone-row"${needsZonePicker(page.storedPreset) ? "" : " hidden"}><span>Lines without a zone use</span>` +
    `<select class="gmt-select" name="zone" data-role="stored-zone">` +
    page.facts.storedZones
      .map(
        (zone) =>
          `<option value="${escapeAttr(zone)}">${escapeHtml(zone)}</option>`,
      )
      .join("") +
    `</select></label>` +
    `<div class="gmt-check-stored-controls">` +
    `<button class="gmt-button gmt-button--pad gmt-check-btn--primary" type="submit" data-role="stored-check">Check</button>` +
    `<button class="gmt-button gmt-button--pad gmt-check-btn--ghost" type="button" data-role="stored-example">Reset example</button>` +
    `</div>` +
    `<p class="gmt-check-status" data-role="stored-status" role="status"></p>` +
    `</form>` +
    `<div class="gmt-check-stored-out">` +
    `<div class="gmt-check-stored-head">` +
    `<p class="gmt-check-stored-summary" data-role="stored-summary" role="status">Checking&hellip;</p>` +
    `<div class="gmt-check-seg" role="group" aria-label="Show">` +
    `<button type="button" class="gmt-check-seg-btn" data-role="stored-show-all" aria-pressed="true">All</button>` +
    `<button type="button" class="gmt-check-seg-btn" data-role="stored-show-moved" aria-pressed="false">Only moved</button>` +
    `</div>` +
    `<p class="gmt-check-alert" data-role="stored-stale" role="note" hidden></p>` +
    `</div>` +
    `<p class="gmt-check-status" data-role="stored-truncated"></p>` +
    `<div class="gmt-check-stored-results" data-role="stored-results">` +
    `<p class="gmt-widget-hint">Checking&hellip;</p></div>` +
    `</div>` +
    `</div>` +
    `</section>`
  );
}

/** The Markdown of the servers card, command included, for the `.md` twin and the llms files. */
export function serversMarkdownOf(page: CheckPage): string {
  return [
    "",
    `## ${page.copy.serversTitle}`,
    "",
    page.copy.serversLine,
    "",
    "```sh",
    nodeProbeCommand(page.table, page.facts.probeInstant),
    "```",
    "",
    `Expected: ${expectedProbeOutput(page.table)
      .map(([city, offset]) => `\`${city}\` ${offset}`)
      .join(" · ")}`,
  ].join("\n");
}
