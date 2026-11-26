/**
 * The markup of `/pulse/`, built from the kit and nothing else: a summary row of plates, one card
 * per workflow (or unscheduled source), a strip of the last eight runs, and the life of each check.
 * Pure strings, no DOM, so the Astro page server-renders it and the text twin shares its words.
 *
 * Three spots are filled by `lib/pulse-mount.ts` after first paint and nothing else changes: the
 * "Next run" value, the "read … ago" value and a strip that has grown too old. Each holds the room
 * of its longest text from the first paint, so filling it moves nothing.
 */
import {
  checkById,
  cards,
  cardsIn,
  areas,
  countWorkarounds,
  filingsWaitedOn,
  groupsClaimed,
  lifeStep,
  runsFor,
  runsRead,
  summary,
  type PulseCard,
  type PulseCheck,
  type PulseLife,
} from "~/data/pulse";
import { groupLabel, groupSummary, stateLine } from "~/data/temporal-compat";
import { filingRef } from "~/data/upstream-filings";
import {
  beatLabel,
  beats,
  beatsCaption,
  cadenceText,
  noSignal,
  RESULT_PATTERN,
  stampOf,
  type Beat,
} from "~/lib/pulse-view";
import { badge } from "../../builders/badge";
import { disclosure } from "../../builders/disclosure";
import { html, raw, type SafeHtml } from "../../builders/html";
import { section } from "../../builders/layout";
import { plates } from "../../builders/plates";
import { srOnly } from "../../builders/sr-only";
import { table } from "../../builders/table";
import { lane, mark } from "../../builders/timeline";
import styles from "./pulse.module.css";
import { link } from "~/widgets/builders/link";

/** Where a workflow's runs are listed. */
const workflowUrl = (file: string): string =>
  `https://github.com/northguild/gmt/actions/workflows/${file}`;

/** The longest next-run and age phrases, so the slots reserve their room. */
export const NEXT_RUN_SAMPLES = ["in 23 hours", "in 7 days"] as const;
export const READ_AGO_SAMPLES = ["23 hours ago", "8 days ago"] as const;

/** A value that is filled later: a visible slot, plus the widest texts it may hold, hidden. */
function slot(
  attr: string,
  value: string,
  samples: readonly string[],
): SafeHtml {
  return html`<span class="${styles.slot}"
    ><span class="${styles.shown}" ${raw(attr)}="${value}"></span
    >${samples.map((s) => html`<span class="${styles.ghost}" aria-hidden="true">${s}</span>`)}</span
  >`;
}

/** The four readouts. `not-content` keeps Starlight's prose margins and `dd` indent off the plates. */
export function renderSummary(): SafeHtml {
  const w = summary.workarounds;
  return html`<div class="not-content">${plates([
    {
      caption: "Checks running",
      value: String(summary.checks),
      lines: ["each one watches something"],
      unbroken: true,
    },
    {
      caption: "On a schedule",
      value: String(summary.scheduled),
      lines: ["workflows that start themselves"],
      unbroken: true,
      series: 2,
    },
    {
      caption: "Workarounds still needed",
      value: String(w.stillNeeded),
      lines: [`of ${w.total} that GMT keeps`],
      unbroken: true,
      series: 3,
    },
    {
      caption: "Upstream filings open",
      value: String(summary.filingsOpen),
      lines: ["fixes we are waiting on"],
      unbroken: true,
      series: 4,
    },
  ])}</div>`;
}

/** The line under the summary: when the run history was read, and how long ago. */
export function renderRead(): SafeHtml {
  if (runsRead === null) {
    return html`<p class="${styles.read}">Run history was not read in this build.</p>`;
  }
  return html`<p class="${styles.read}" data-pulse-read="${runsRead}"
    >Run history read ${stampOf(runsRead)} · read ${slot("data-pulse-read-ago", "", READ_AGO_SAMPLES)}</p
  >`;
}

/** One beat, as a pattern-and-word mark. The result is in its name, never in its colour. */
function beatMark(b: Beat, i: number, count: number): SafeHtml {
  return mark({
    label: beatLabel(b),
    at: i / count,
    span: 1 / count - 0.012,
    series: 1,
    pattern: RESULT_PATTERN[b.result],
  });
}

/** The strip of the last eight runs, or NO SIGNAL when there is no history to show. */
export function renderBeats(card: PulseCard, id: string): SafeHtml {
  const runs = runsFor(card);
  const cron = card.crons[0];
  const lost = noSignal(runs, runsRead);
  const list =
    lost === null && cron !== undefined && runs !== null && runsRead !== null
      ? beats(cron, runs, runsRead)
      : [];
  const caption = list.length > 0 ? beatsCaption(list) : "";
  return html`<div class="${styles.strip}" data-pulse-strip data-signal="${lost === null ? "ok" : "lost"}" ${runsRead === null ? "" : html`data-pulse-strip-read="${runsRead}"`}
    ><div class="${styles.beats}" data-pulse-beats ${lost === null ? "" : html`hidden`}
      >${lane(
        { label: `Last ${list.length || 8} runs` },
        list.map((b, i) => beatMark(b, i, list.length)),
      )}<p class="${styles.caption}" id="${id}-caption">${caption}</p></div
    ><p class="${styles.signal}" data-pulse-signal ${lost === null ? html`hidden` : ""}
      >⟨ NO SIGNAL — <span data-pulse-signal-text>${lost?.text ?? ""}</span> ⟩</p
    ></div
  >`;
}

/** Watching, Fixed upstream, Retired: the check's step is marked by its word and its fill. */
export function renderLife(life: PulseLife): SafeHtml {
  const step = lifeStep(life);
  if (step === "permanent") {
    return html`<p class="${styles.lifeLine}">${badge({ text: "Stays", tone: "neutral" })} ${(life as { why: string }).why}</p>`;
  }
  const steps = [
    { id: "watching", word: "Watching" },
    { id: "fixed", word: "Fixed upstream" },
    { id: "retired", word: "Retired" },
  ] as const;
  return html`<ol class="${styles.steps}" aria-label="Where this check is on its way out"
    >${steps.map((s) =>
      s.id === step
        ? html`<li aria-current="step">${badge({ text: s.word, tone: "cyan", fill: true, icon: "check" })}${srOnly(", now")}</li>`
        : html`<li>${badge({ text: s.word, tone: "neutral", dim: true })}</li>`,
    )}</ol
  >`;
}

/** The sentence that says what retires the check, from the data the page joins. */
function lifeSentence(life: PulseLife): SafeHtml {
  switch (life.kind) {
    case "permanent":
      return html``;
    case "workarounds": {
      const claimed = groupsClaimed(life);
      if (claimed.length === 0) {
        return html`Retires with its workarounds, which are not in the compatibility snapshot yet.`;
      }
      const c = countWorkarounds(claimed);
      const parts = [
        `${c.stillNeeded} still needed`,
        `${c.removable} removable`,
      ];
      if (c.other > 0) parts.push(`${c.other} only on some engines`);
      return html`Retires with its workarounds: ${parts.join(", ")}.`;
    }
    case "condition": {
      const waited = filingsWaitedOn(life);
      return html`Retires when ${life.until}.${
        waited.length === 0
          ? ""
          : html` Waiting on ${waited.map(
              (f, i) =>
                html`${i === 0 ? "" : " "}${link({ href: f.url, body: filingRef(f) })}`,
            )}.`
      }`;
    }
  }
}

/** The closed list of the workarounds a check retires with. */
function workaroundList(check: PulseCheck, id: string): SafeHtml {
  if (check.life.kind !== "workarounds") return html``;
  const claimed = groupsClaimed(check.life);
  if (claimed.length === 0) return html``;
  return disclosure({
    id,
    label: `${claimed.length} ${claimed.length === 1 ? "workaround" : "workarounds"}`,
    flow: true,
    children: table({
      caption: `Workarounds that ${check.name} retires with`,
      columns: [
        { key: "group", header: "Defect", align: "start", numeric: false },
        {
          key: "what",
          header: "What it covers",
          align: "start",
          numeric: false,
        },
        {
          key: "needed",
          header: "Still needed?",
          align: "start",
          numeric: false,
        },
      ],
      rowHeader: "group",
      rows: claimed.map((g) => ({
        group: groupLabel(g),
        what: groupSummary(g),
        needed: stateLine(g).badge,
      })),
    }),
  });
}

function renderCheck(check: PulseCheck, cardId: string): SafeHtml {
  const id = `${cardId}-${check.id}`;
  return html`<div class="${styles.check}"
    ><h4 class="${styles.checkName}">${check.name}</h4
    ><p class="${styles.text}">${check.watches}</p
    ><p class="${styles.text}">${check.finds}</p
    >${renderLife(check.life)}
    <p class="${styles.lifeLine}">${lifeSentence(check.life)}</p
    >${workaroundList(check, `${id}-list`)}</div
  >`;
}

/** The sentence under a card's name: when it runs. */
function cadenceLine(card: PulseCard): SafeHtml {
  if (card.crons.length === 0) {
    return html`<p class="${styles.cadence}">Runs with the Dox tests, never on a schedule.</p>`;
  }
  return html`<p class="${styles.cadence}">${card.crons.map(cadenceText).join(" and ")}</p
    ><p class="${styles.next}"
      ><span class="${styles.dot}" aria-hidden="true"></span
      ><span class="${styles.nextLabel}">Next run</span> ${slot("data-pulse-next", card.crons[0] ?? "", NEXT_RUN_SAMPLES)}</p
    >`;
}

export function renderCard(card: PulseCard): SafeHtml {
  const id = `pulse-${card.file.replace(/\.[^.]+$/, "")}`;
  const scheduled = card.crons.length > 0;
  return html`<article class="${styles.card}" data-pulse-card aria-labelledby="${id}-title"
    ><div class="${styles.head}"
      ><h3 class="${styles.title}" id="${id}-title">${card.name}</h3
      ><span class="${styles.file}">${card.file}</span></div
    >${cadenceLine(card)}${scheduled ? renderBeats(card, id) : ""}<div class="${styles.checks}"
      >${card.checkIds.map((cid) => renderCheck(checkById(cid), id))}</div
    >${
      scheduled
        ? html`<p class="${styles.more}">${link({ href: workflowUrl(card.file), body: "All runs on GitHub ↗" })}</p>`
        : ""
    }</article
  >`;
}

/** The three area sections, each holding its cards. */
export function renderAreas(): SafeHtml {
  return html`${areas.map((area) =>
    section(
      { id: `pulse-${area.id}`, heading: area.heading, level: 2 },
      html`<p class="${styles.blurb}">${area.blurb}</p
        ><div class="${styles.cards}">${cardsIn(area.id).map(renderCard)}</div>`,
    ),
  )}`;
}

/** How a check retires: the three steps, in words. */
export function renderRetire(): SafeHtml {
  return html`<ol class="${styles.steps}" aria-label="The steps of a check's life"
    ><li>${badge({ text: "Watching", tone: "cyan", fill: true })}</li
    ><li>${badge({ text: "Fixed upstream", tone: "neutral", dim: true })}</li
    ><li>${badge({ text: "Retired", tone: "neutral", dim: true })}</li></ol
  >`;
}

/** Every card, for a caller that wants them in list order. */
export const allCards = cards;
