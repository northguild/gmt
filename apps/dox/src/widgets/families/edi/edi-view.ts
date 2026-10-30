/**
 * What the DTM Decoder and the X12 Time Reader draw the same way: the refusal aside, the
 * verdict, the strip's cells and the unlisted-zone-aware rebuild. The mounts own what is read;
 * this owns how it is drawn, from kit builders only.
 */
import { NO_RESULT_TITLE } from "~/lib/edi-widgets";
import { aside } from "../../builders/aside";
import { html, setHtml, type SafeHtml } from "../../builders/html";
import { srOnly } from "../../builders/sr-only";
import { verdict } from "../../builders/verdict";
import { hold } from "./edi-hold";
import { setStripCell } from "./edi-table";

const longest = (xs: readonly string[]): string =>
  xs.reduce((a, b) => (b.length > a.length ? b : a), "");

/** Why there is no result: one or more sentences under the shared title. */
function reasonAside(paragraphs: readonly string[]): SafeHtml {
  return aside(
    {
      label: "Why there is no result",
      tone: "caution",
      title: NO_RESULT_TITLE,
    },
    html`${paragraphs.map((p) => html`<p>${p}</p>`)}`,
  );
}

interface AsideHoldOptions {
  id: string;
  /** What is shown now, or nothing. */
  paragraphs: readonly string[];
  /** The longest sentence the aside can show, and how many of them at most. */
  reasons: readonly string[];
  count?: number;
}

/** A refusal aside in a hold that keeps the size of the longest one it can show. */
export function asideHold(o: AsideHoldOptions): SafeHtml {
  return hold({
    id: o.id,
    content: o.paragraphs.length === 0 ? html`` : reasonAside(o.paragraphs),
    ghosts: [
      reasonAside(
        Array.from({ length: o.count ?? 1 }, () => longest(o.reasons)),
      ),
    ],
  });
}

/** The aside's content for a mount write: nothing when there is no reason. */
export function asideContent(paragraphs: readonly string[]): SafeHtml {
  return paragraphs.length === 0 ? html`` : reasonAside(paragraphs);
}

interface VerdictHoldOptions {
  id: string;
  titles: readonly string[];
  details: readonly string[];
}

/** The verdict line: its title and its detail, in a hold sized by the longest of each. */
export function verdictHold(o: VerdictHoldOptions): SafeHtml {
  const title = longest(o.titles);
  const detail = longest(o.details);
  return hold({
    id: o.id,
    role: "status",
    label: "Verdict",
    content: html``,
    ghosts: [
      ...o.titles.map((t) => verdict({ tone: "neutral", title: t, detail })),
      ...o.details.map((d) => verdict({ tone: "neutral", title, detail: d })),
    ],
  });
}

/** What the mount writes into a verdict hold: nothing when the value has no verdict. */
export function verdictContent(title: string, detail: string): SafeHtml {
  return title === "" && detail === ""
    ? html``
    : verdict({ tone: "neutral", title, detail });
}

/** One strip row as the mounts read it. `third` is the third column's text. */
export interface StripRow {
  zone: string;
  instant: string;
  offset: string;
  third: string;
  reason: string;
}

/** Writes the strip's cells and enables or disables the zone choices. */
export function drawStripRows(
  part: <T extends HTMLElement = HTMLElement>(local: string) => T,
  rows: readonly StripRow[],
  applies: boolean,
): void {
  rows.forEach((row, i) => {
    const n = i + 1;
    part<HTMLSelectElement>(`zone-${n}`).disabled = !applies;
    const instant = part(`instant-${n}`);
    if (!applies) setStripCell(instant, "");
    else if (row.zone === "") setStripCell(instant, "no zone chosen");
    else if (row.instant === "") setStripCell(instant, "NO SIGNAL", true);
    else setStripCell(instant, row.instant);
    setStripCell(part(`offset-${n}`), applies ? row.offset : "");
    setStripCell(part(`third-${n}`), applies ? row.third : "");
  });
}

/** The strip's hidden spoken summary. */
export function stripSummary(
  rows: readonly StripRow[],
  gapText: string,
  thirdWord: string,
): string {
  return (
    rows
      .map((r, i) =>
        r.zone === ""
          ? `Zone ${i + 1}: no zone chosen.`
          : r.instant === ""
            ? `Zone ${i + 1}, ${r.zone}: no signal. ${r.reason}`
            : `Zone ${i + 1}, ${r.zone}: ${r.instant}, offset ${r.offset}${r.third === "" || thirdWord === "" ? "" : `, ${thirdWord} ${r.third}`}.`,
      )
      .join(" ") + (gapText === "" ? "" : ` ${gapText}.`)
  );
}

/** Writes a status line the reader hears (visually hidden). */
export function setSummary(el: HTMLElement, text: string): void {
  setHtml(el, srOnly(text));
}

/** The refused rows' reasons, one paragraph each, for the strip's aside. */
export function refusalParagraphs(rows: readonly StripRow[]): string[] {
  return rows
    .filter((r) => r.reason !== "")
    .map((r) => `${r.zone}: ${r.reason}`);
}
