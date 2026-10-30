/**
 * The "Your browser" card and the "Test your own servers" card of a dated tz-change checker: the
 * verdict, one row per place with the right offset beside the browser's, and the Node command for
 * the reader's own servers. Plain DOM, no React, no library: the check is `Intl` only.
 *
 * Each checker passes its own `ProbeConfig` (its id prefix, zones, instant and wording); nothing
 * here knows which checker it serves.
 */
import { cityOf, offsetFromIntl } from "./clock-change-common";
import { markBad, markOk, noSignal } from "~/widgets/families/clockcheck/marks";

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
interface ExpectedOffsets {
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
/** Where a checker is drawn: its own page, or the chat rail, which has no Key points card. */
export type VerdictPlace = "page" | "chat";

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
 * it runs while the page is parsed: it shows the finished answer, fills the place chips and the
 * Yours cells, and sets `data-sig` (the readings) so the module knows the card is already right
 * and does not draw it again. Plain ES5, no imports: it is a string, so no bundler touches it.
 *
 * It writes only what `probeCard`/`fillProbe` write for the same readings: the marks come from the
 * same builders (`markOk`, `markBad`, `noSignal`, passed as JSON) and the part ids from
 * `PROBE_PARTS`. It finds the card by its scope, `<idPrefix>-browser`, so two checkers never fill
 * each other's. `canada-probe-inline.test.ts` runs it against the module.
 */
export function probeInlineSource(config: ProbeConfig): string {
  const blind = blindInstants(config).map((instant) => instant.epochMs);
  const data = {
    id: `${config.idPrefix}-browser`,
    epoch: verdictInstant(config).epochMs,
    zones: config.zones.map((fact) => ({
      zone: fact.zone,
      city: cityOf(fact.zone),
      expected: fact.expected.verdict,
    })),
    ok: markOk().value,
    bad: markBad().value,
    none: noSignal().value,
    blind,
  };
  return String.raw`(function (c) {
  var NAMES = ["pending", "ok", "bad", "unreadable"];
  function el(part) { return document.getElementById(c.id + "-" + part); }
  function fill() {
    var v = el("verdict");
    if (!v) return false;
    var n = c.zones.length;
    for (var k = 0; k < n * (1 + c.blind.length); k++)
      if (!el(k < n ? "yours-" + k : "blind-" + (k - n))) return false;
    function read(z, e) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: "UTC", timeZoneName: "longOffset" });
        var parts = new Intl.DateTimeFormat("en", { timeZone: z, timeZoneName: "longOffset" }).formatToParts(e), name = "";
        for (var i = 0; i < parts.length; i++) if (parts[i].type === "timeZoneName") { name = parts[i].value; break; }
        if (name === "GMT") return "+00:00";
        var m = /^GMT([+\-−])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(name);
        if (!m) return "";
        return (m[1] === "+" ? "+" : "-") + m[2] + ":" + m[3] + (m[4] === undefined ? "" : ":" + m[4]);
      } catch (error) { return ""; }
    }
    var wrong = [], unread = 0, sig = [];
    for (var z = 0; z < n; z++) {
      var f = c.zones[z], o = read(f.zone, c.epoch), cell = el("yours-" + z);
      sig.push(o === "" ? "?" : o);
      if (o === "") { unread++; cell.innerHTML = c.none; continue; }
      if (o !== f.expected) wrong.push(f.city);
      cell.innerHTML = (o === f.expected ? c.ok : c.bad) + " " + o.replace("-", "−");
    }
    for (var b = 0; b < c.blind.length; b++) for (var y = 0; y < n; y++) {
      var p = read(c.zones[y].zone, c.blind[b]), bcell = el("blind-" + (b * n + y));
      sig.push(p === "" ? "?" : p);
      bcell.innerHTML = p === "" ? c.none : p.replace("-", "−");
    }
    var state = unread > 0 ? "unreadable" : wrong.length === 0 ? "ok" : "bad";
    if (state === "bad") {
      var chips = wrong.map(function (w) { return "<code>" + w + "</code>"; });
      var at = el("wrong");
      if (at) at.innerHTML = chips.length < 2 ? chips.join("") : chips.slice(0, -1).join(", ") + " and " + chips[chips.length - 1];
    }
    for (var j = 0; j < NAMES.length; j++) { var node = el("variant-" + NAMES[j]); if (node) node.hidden = NAMES[j] !== state; }
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
