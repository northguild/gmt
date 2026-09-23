/**
 * The sentences the `/upstream/` tracker opens and closes with.
 *
 * Built here, not written into `upstream.mdx`: the raw-text `.md` / `llms-full.txt` / retrieval
 * chunk pipeline (`page-markdown.ts`'s `stripMdx`) never evaluates JSX expressions, so keeping
 * this arithmetic in the MDX body shipped a literal `{totalFilings}` and a `{coversAll ? … : …}`
 * ternary into those surfaces. Astro evaluates it at build time either way, so the rendered page
 * is unaffected and the text surfaces get real numbers.
 */
import {
  checked,
  contributions,
  dataSource,
  handledInGmt,
  totalFilings,
  unaffectingGmt,
} from "../data/upstream-filings";
// The package root, not `@northguild/gmt/utc`: `astro.config.mjs` aliases `@northguild/gmt` to the
// `dist` directory, and a Vite string alias matches as a prefix, so a subpath import becomes a bare
// directory path that the dev server cannot resolve. The root entry re-exports these.
import { parseDateFromUtc, parseTimeFromUtc } from "@northguild/gmt";

/** Filings whose defect cannot reach a GMT user, either handled or irrelevant. */
const covered = handledInGmt + unaffectingGmt;

/** "…, and added the evidence to N more the maintainers had already written", or nothing. */
export const contributionClause: string =
  contributions === 0
    ? ""
    : `, and added the evidence to ${contributions === 1 ? "one" : contributions} more the maintainers had already written`;

export const coverageClause: string =
  covered === totalFilings
    ? "GMT already gives you the correct answer for every one of them"
    : `GMT already gives you the correct answer for ${covered} of them`;

/** "" unless the live refresh failed and the page fell back to the committed snapshot. */
export const sourceClause: string =
  dataSource === "committed" ? ", from the saved copy" : "";

/**
 * When the filings were last read from GitHub.
 *
 * GMT's own parsers, not `new Date(...).toISOString()`: this is the documentation site for a date
 * library whose whole argument is that you should not be reaching for `Date`. Both return "" on
 * input they cannot read, so a malformed stamp degrades to the raw string rather than the string
 * "Invalid Date".
 */
const checkedDate = parseDateFromUtc(checked);
const checkedTime = parseTimeFromUtc(checked).slice(0, 5);
export const checkedOn: string = checkedDate
  ? `${checkedDate} ${checkedTime}`
  : checked;

/** An ISO stamp as the calendar day the table shows, or the raw value if it cannot be read. */
export const asDate = (iso: string): string => parseDateFromUtc(iso) || iso;
