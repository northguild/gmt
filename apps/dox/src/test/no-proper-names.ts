/**
 * A check that names nothing: it lists the capitalised words in some text that
 * are not a weekday, a month, or a word of the page's own vocabulary. A place
 * or a body slipping into a preset or a label shows up here without this file
 * (or any test) spelling out which words are forbidden.
 */
import { Temporal } from "@js-temporal/polyfill";

const weekdayAndMonthNames = (): string[] => {
  const out: string[] = [];
  for (const width of ["long", "short"] as const) {
    for (let i = 1; i <= 12; i++) {
      const date = Temporal.PlainDate.from({ year: 2021, month: i, day: 4 });
      out.push(date.toLocaleString("en", { month: width }));
      if (i <= 7) {
        const day = Temporal.PlainDate.from({
          year: 2021,
          month: 1,
          day: 3 + i,
        });
        out.push(day.toLocaleString("en", { weekday: width }));
      }
    }
  }
  return out;
};

/** Words the pages define for themselves (the sentinel and the feast rule). */
export const PAGE_VOCABULARY = [
  "NO",
  "SIGNAL",
  "UTC",
  "Easter",
  "Good",
  "Temporal",
];

export function unexpectedCapitalised(
  text: string,
  extra: readonly string[] = [],
): string[] {
  const allowed = new Set([
    ...weekdayAndMonthNames(),
    ...PAGE_VOCABULARY,
    ...extra,
  ]);
  const found = new Set<string>();
  // A capitalised word that opens a string or a sentence is just grammar.
  const body = text.replace(/(^|[.!?:;"“]\s+|\n|[>|])\s*[A-Z]\w*/gu, "$1 ");
  for (const word of body.match(/\b[A-Z][A-Za-z]*\b/gu) ?? []) {
    if (!allowed.has(word)) found.add(word);
  }
  return [...found];
}

/** The text of an element, one line per text node, so words never run together. */
export function textLines(root: Element): string {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const lines: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    lines.push(n.nodeValue ?? "");
  }
  return lines.join("\n");
}
