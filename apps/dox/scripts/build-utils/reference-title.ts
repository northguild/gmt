/**
 * The `<title>` of a reference page, written from its name and the first clause of its
 * description: `addZoned(): add a temporal amount`.
 *
 * Pure. `build-reference.ts` writes the result into each page's frontmatter as `headTitle`; the
 * route middleware (`src/route-data.ts`) adds the site suffix, which counts toward the length.
 */
import { TITLE_SUFFIX } from "../../src/lib/head-tags";

/** The longest full `<title>`, suffix included, in characters. */
export const MAX = 70;

/**
 * Words a cut may be made before. A cut drops the word and what follows it. `and` and `or` are not
 * among them: they join two names, and a cut between them leaves one (`in ascending`).
 */
const CUT_WORDS = new Set([
  "to",
  "for",
  "in",
  "using",
  "with",
  "from",
  "at",
  "by",
  "into",
  "as",
  "that",
  "which",
  "when",
  "where",
  "between",
  "under",
  "on",
  "after",
  "before",
  "across",
  "per",
  "than",
  "while",
  "without",
  "since",
  "until",
  "within",
  "back",
]);

/** Words a cut title does not end on: the sentence they belong to goes on after them. */
const DANGLING_WORDS = new Set([
  "is",
  "are",
  "falls",
  "fall",
  "lies",
  "starts",
  "ends",
  "sits",
  "occurs",
  "a",
  "an",
  "the",
  "of",
  "its",
  "their",
  "according",
  "depending",
  "relative",
  "based",
  "each",
  "every",
  "both",
  "any",
  "all",
  "not",
  "no",
  "share",
  "runs",
  "start",
  "end",
  "begin",
  "and",
  "or",
  "by",
  "to",
  "for",
  "with",
  "in",
  "on",
  "at",
  "from",
  "that",
  "which",
  "where",
  "when",
  "as",
  "than",
  "into",
  "onto",
  "per",
  "via",
  "back",
  "out",
  "up",
  "down",
  "off",
  "over",
  "away",
  "can",
  "will",
  "must",
  "may",
  "does",
  "has",
  "have",
  "given",
  "such",
  "written",
]);

/** Words that open a relative clause: a cut after one leaves the clause without its verb. */
const RELATIVE_WORDS = new Set(["that", "which", "who", "whose", "whom"]);

/** Words that open a question clause, which a cut would leave without its verb. */
const QUESTION_WORDS = new Set([
  "how",
  "what",
  "why",
  "which",
  "who",
  "where",
  "when",
]);

/** Verbs a `whether` clause may keep: a cut that leaves none of them leaves the question unasked. */
const WHETHER_VERBS = new Set([
  "is",
  "are",
  "has",
  "have",
  "falls",
  "fall",
  "lies",
  "can",
  "does",
  "do",
  "contains",
  "overlaps",
  "equals",
  "matches",
  "names",
]);

/** Whether a `whether` in the words is followed by a verb. */
function whetherHasVerb(words: string[]): boolean {
  const at = words.indexOf("whether");
  return at === -1 || words.slice(at + 1).some((word) => WHETHER_VERBS.has(word));
}

/** The fields of a documented symbol the title reads. */
export type TitleDoc = {
  name: string;
  kind: "function" | "type" | "regex";
  namespace: string;
  module: string;
  description: string;
};

/** Text with its Markdown taken out: a link is its text, emphasis and code marks are gone. */
export function plainText(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** The text with its parenthetical asides taken out: `the latest (maximum) of` is `the latest of`. */
function withoutParentheses(text: string): string {
  return text.replace(/ ?\([^()]*\)/g, "");
}

/** The text up to the first sentence or clause break. */
function firstClause(text: string): string {
  const breaks =
    /(?<!\b(?:e\.g|i\.e|vs|etc))(?:[.!?] |: | — | – |; | \(| and returns? )/;
  const at = text.search(breaks);
  const clause = at === -1 ? text : text.slice(0, at);
  return clause.replace(/[\s.,;:!?\-–—]+$/, "");
}

/** `Returns true when X` is `whether X`; a leading `Return` or `Returns` is dropped. */
function withoutReturn(clause: string): string {
  return clause
    .replace(/^Returns? (?:true )?(?:when|if) /, "whether ")
    .replace(/^Returns? whether /, "whether ")
    .replace(/^Returns? /, "");
}

/** The first word in lower case, unless it is a name, an acronym or a proper noun. */
function lowerFirstWord(clause: string): string {
  const [first = "", second = ""] = clause.split(" ");
  if (/^(A|An|The|Per)$/.test(first)) {
    return first.toLowerCase() + clause.slice(first.length);
  }
  if (!/^[A-Z][a-z]+$/.test(first)) return clause;
  if (/^[A-Z]/.test(second)) return clause;
  return first.toLowerCase() + clause.slice(first.length);
}

function isBalanced(text: string): boolean {
  let depth = 0;
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  for (const char of text) {
    if ("([{".includes(char)) stack.push(char);
    else if (char in pairs && stack.pop() !== pairs[char]) return false;
    depth += char === '"' ? 1 : 0;
  }
  return stack.length === 0 && depth % 2 === 0;
}

function endsOnDanglingWord(text: string): boolean {
  const last = text.split(" ").at(-1) ?? "";
  // `either` promises an `or`; a cut between them leaves the choice half stated.
  if (/\beither\b/.test(text) && !/\bor\b/.test(text)) return true;
  return DANGLING_WORDS.has(last) || /(?:ly|ed)$/.test(last);
}

const label = (doc: TitleDoc): string =>
  doc.kind === "function" ? `${doc.name}()` : doc.name;

/** The last-resort title: the name and where it lives. */
function fallback(doc: TitleDoc, room: number): string {
  const where =
    doc.kind === "type" && doc.namespace === "types"
      ? "types"
      : `${doc.namespace}/${doc.module}`;
  for (const place of [where, doc.namespace]) {
    const text = `${label(doc)} in ${place}`;
    if (text.length <= room) return text;
  }
  return label(doc);
}

/**
 * The page's `headTitle`, without the site suffix. The whole `<title>` (this and the suffix) is at
 * most `MAX` characters.
 *
 * The first clause of the description follows the name. A clause that is too long is cut before its
 * last linking word that leaves a title that fits, has at least three words, closes its brackets
 * and quotes and does not end on a word that needs more after it. A cut never ends a relative
 * clause early or a `whether` clause before its verb, and a clause that opens with a question word
 * (`how`, `where`) is never cut. When no cut works, the title is the name and where it lives.
 */
export function referenceHeadTitle(doc: TitleDoc): string {
  const room = MAX - TITLE_SUFFIX.length;
  const phrase = lowerFirstWord(
    withoutReturn(firstClause(withoutParentheses(plainText(doc.description)))),
  );
  if (phrase === "") return fallback(doc, room);

  const prefix = `${label(doc)}: `;
  const whole = prefix + phrase;
  if (whole.length <= room && isBalanced(whole)) return whole;

  const words = phrase.split(" ");
  if (QUESTION_WORDS.has(words[0].toLowerCase())) return fallback(doc, room);
  for (let at = words.length - 1; at >= 3; at--) {
    if (!CUT_WORDS.has(words[at])) continue;
    const kept = words.slice(0, at);
    // A relative clause cut before its end.
    if (kept.some((word) => RELATIVE_WORDS.has(word))) continue;
    if (!whetherHasVerb(kept)) continue;
    const cut = prefix + kept.join(" ").replace(/[,;:]+$/, "");
    if (cut.length <= room && isBalanced(cut) && !endsOnDanglingWord(cut)) {
      return cut;
    }
  }
  return fallback(doc, room);
}
