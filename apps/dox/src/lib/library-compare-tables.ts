/**
 * The tables on /compare, as data.
 *
 * Every number comes from `gmt-stats.json` (GMT) or `library-measurements.json` (the six other
 * libraries), through `library-comparison.ts`. The HTML component (`LibraryCompare.astro`) and
 * the Markdown renderer behind `.md`, `llms.txt` and the retrieval chunks (`mdx-jsx.ts`) both
 * read these builders, so the page and its text twin cannot state different figures.
 *
 * Kept free of Astro globals so vitest can import it directly.
 */
import { formatCount, gmtStats, runsPerTest } from "../data/gmt-stats";
import {
  combinedCompetitorExecutions,
  competitorComparisons,
  executionRatio,
  gmtLibraryComparison,
  type LibraryComparison,
} from "../data/library-comparison";

/** One table cell: plain text, optionally set in code or linked. */
export interface Cell {
  text: string;
  code?: boolean;
  href?: string;
  /** Never break inside the text (a date wraps after its hyphen otherwise). */
  nobreak?: boolean;
}

export interface CompareTable {
  head: string[];
  /** The first cell of every row is its row header. */
  rows: Cell[][];
}

export type CompareTableId = "overview" | "measured" | "differs" | "covers";

/** Tables whose first column is a sentence, not a short name, so it must wrap. */
export const PROSE_TABLES: readonly CompareTableId[] = ["covers", "differs"];

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * A string that marks inline code with backticks, as HTML: each `` `span` `` becomes
 * `<code>`, and everything else is escaped. The text surfaces keep the backticks, which are
 * Markdown there.
 */
export function inlineCodeHtml(text: string): string {
  return text
    .split(/(`[^`]*`)/)
    .map((part) =>
      part.length > 1 && part.startsWith("`") && part.endsWith("`")
        ? `<code>${escapeHtml(part.slice(1, -1))}</code>`
        : escapeHtml(part),
    )
    .join("");
}

/** One table cell as HTML. */
export function cellHtml(cell: Cell): string {
  const inner = cell.code
    ? `<code>${escapeHtml(cell.text)}</code>`
    : inlineCodeHtml(cell.text);
  const body = cell.nobreak
    ? `<span class="gmt-nobreak">${inner}</span>`
    : inner;
  return cell.href ? `<a href="${escapeHtml(cell.href)}">${body}</a>` : body;
}

const plain = (text: string): Cell => ({ text });
const code = (text: string): Cell => ({ text, code: true });
const NOT_RECORDED = "not recorded";
const NOT_MEASURED = "not measured";

const capitalize = (text: string): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** Full table: one row per library, GMT first. */
export function overviewTable(): CompareTable {
  const gmt = gmtLibraryComparison;
  const gmtRow: Cell[] = [
    plain(gmt.displayName),
    plain(formatCount(gmtStats.tests)),
    plain(formatCount(gmtStats.executions)),
    plain(`${gmtStats.nodes.length} (${gmtStats.nodes.join(", ")})`),
    plain(String(gmtStats.timezones)),
    plain(String(gmtStats.locales)),
    plain("0"),
    plain("TC39 Temporal"),
    plain(capitalize(gmt.timeResolution)),
  ];

  const rows = competitorComparisons.map((library): Cell[] => {
    const { stats } = library;
    return [
      plain(library.displayName),
      plain(formatCount(stats.tests)),
      plain(formatCount(stats.executions)),
      plain(String(stats.nodeVersions)),
      plain(String(stats.timezones)),
      plain(String(stats.locales)),
      plain(
        stats.knownFailures === undefined
          ? NOT_MEASURED
          : String(stats.knownFailures),
      ),
      plain(library.foundation ?? ""),
      plain(capitalize(library.timeResolution)),
    ];
  });

  return {
    head: [
      "Library",
      "Test cases",
      "CI test executions",
      "Node versions in CI",
      "Time zones",
      "Locales",
      "Known failing tests",
      "Built on",
      "Finest time unit",
    ],
    rows: [gmtRow, ...rows],
  };
}

/** Version, commit, date, command and CI configuration of each measurement. */
export function measuredTable(): CompareTable {
  const gmtRow: Cell[] = [
    plain(gmtLibraryComparison.displayName),
    plain("this repository"),
    plain("this repository"),
    plain("every change"),
    plain("collected from the suite by scripts/stats.mjs"),
    { text: ".github/workflows/ci.yml", code: true },
  ];

  const rows = competitorComparisons.map((library): Cell[] => {
    const m = library.measurement;
    if (!m) throw new Error(`${library.id} has no measurement`);
    return [
      plain(library.displayName),
      plain(
        m.version === m.publicApi.version
          ? m.version
          : `${m.version}; API counted at ${m.publicApi.version}`,
      ),
      m.commit ? code(`${m.repository}@${m.commit}`) : plain(m.repository),
      { text: m.measuredOn, nobreak: true },
      m.command ? code(m.command) : plain(NOT_RECORDED),
      {
        text: m.ciConfigUrl.replace("https://github.com/", ""),
        href: m.ciConfigUrl,
      },
    ];
  });

  return {
    head: [
      "Library",
      "Version tested",
      "Repository and commit",
      "Measured on",
      "Command",
      "CI configuration",
    ],
    rows: [gmtRow, ...rows],
  };
}

/** What the data shows about each library's time-zone testing. */
function timeZoneStatement(library: LibraryComparison): string {
  const m = library.measurement;
  if (!m) return "";
  if (m.partialZoneRuns) {
    const { testFiles, zones, unit } = m.partialZoneRuns;
    return `${library.displayName} re-runs ${testFiles} time-zone test ${unit} under ${zones} zones, not the full suite`;
  }
  if (m.timeZoneWorkflowScopeUnclear) {
    return `${library.displayName} has a dedicated time-zone workflow whose scope is unclear`;
  }
  if (m.timezones > 0) {
    return `${library.displayName} has ${m.timezones} time-zone test files, run once per Node version`;
  }
  return `${library.displayName} has no time-zone matrix in its CI`;
}

/** What the data shows about each library's locale tests. */
function localeStatement(library: LibraryComparison): string {
  const files = library.stats.locales;
  return files > 0
    ? `${library.displayName} has ${files} locale test files`
    : `${library.displayName} has no locale tests`;
}

const sentences = (parts: string[]): string => `${parts.join(". ")}.`;

/**
 * "Where GMT differs": each row states what GMT does and what each other library's measurement
 * shows. No row says "only GMT": a claim of that kind has to hold against all six, so a row
 * names each library instead.
 */
export function differsTable(): CompareTable {
  const combined = combinedCompetitorExecutions();
  const breakdown = competitorComparisons
    .map((l) => formatCount(l.stats.executions))
    .join(" + ");

  return {
    head: ["Topic", "GMT", "What each other library's measurement shows"],
    rows: [
      [
        plain("Time zones"),
        plain(
          `The whole suite runs in each of ${gmtStats.timezones} zones on each of ${gmtStats.nodes.length} Node versions: ${runsPerTest} full-suite runs`,
        ),
        plain(sentences(competitorComparisons.map(timeZoneStatement))),
      ],
      [
        plain("Locales"),
        plain(
          `${gmtStats.locales} locales, run inside the ${formatCount(gmtStats.tests)} tests so that every locale-aware function meets all of them`,
        ),
        plain(sentences(competitorComparisons.map(localeStatement))),
      ],
      [
        plain("What it is built on"),
        plain(
          "TC39 Temporal. Lint packages for ESLint, Oxlint and Biome ban Date in your own code",
        ),
        plain(
          sentences(
            competitorComparisons.map(
              (l) => `${l.displayName}: ${l.foundation}`,
            ),
          ),
        ),
      ],
      [
        plain("CI test executions"),
        plain(`${formatCount(gmtStats.executions)}`),
        plain(
          `All ${competitorComparisons.length} other libraries combined: ${breakdown} = ${formatCount(combined)}. GMT's figure is about ${executionRatio(combined)} times that`,
        ),
      ],
    ],
  };
}

/** What each library covers: the capability comparison with the four libraries checked. */
export function coversTable(): CompareTable {
  const row = (capability: string, also: string): Cell[] => [
    plain(capability),
    plain("Yes"),
    plain(also),
  ];
  return {
    head: ["Capability", "GMT", "Also has it"],
    rows: [
      row(
        "Duration type (ISO 8601 parse, format, arithmetic)",
        "Luxon `Duration`",
      ),
      row(
        "Interval and range math (contains, overlap, union, intersection, split, set operations)",
        "Luxon `Interval`, date-fns `areIntervalsOverlapping`",
      ),
      row(
        "DST disambiguation control on construction and on arithmetic",
        "None of the others exposes this on arithmetic",
      ),
      row(
        "Locale-aware calendar helpers (weekend, week start and end, day of week)",
        "`@internationalized/date`",
      ),
      row(
        "Business-day arithmetic with holiday calendars and roll conventions, clamp and closest, time rounding",
        "`temporal-kit` (arithmetic only)",
      ),
      row("Interval rounding-out (boundary count, from a duration)", "Luxon"),
      row("Locale calendar metadata (names, `hasDST`)", "Luxon `Info`"),
      row(
        "Overlap-day count, relative rounding, DST transitions, hours in a day",
        "date-fns, `@internationalized/date`",
      ),
      row(
        "Field setters, token-pattern parsing, named machine formats, calendar-style formatting",
        "Luxon `.set()`, `toRFC2822`, `toHTTP` and `toSQL`; Moment `.calendar()`",
      ),
      row(
        "Non-Gregorian calendar systems (conversion and calendar-aware interval and duration math)",
        "`@internationalized/date`'s `toCalendar`",
      ),
    ],
  };
}

/** The oldest and newest day any other library was measured, as ISO dates. */
export function measurementDateRange(): { oldest: string; newest: string } {
  const dates = competitorComparisons
    .map((l) => l.measurement?.measuredOn)
    .filter((d): d is string => d !== undefined)
    .sort();
  return { oldest: dates[0], newest: dates[dates.length - 1] };
}

export const compareTables: Record<CompareTableId, () => CompareTable> = {
  overview: overviewTable,
  measured: measuredTable,
  differs: differsTable,
  covers: coversTable,
};

/** The per-library notes under the measurement table. */
export function measurementNotes(): { name: string; note: string }[] {
  return competitorComparisons.map((library) => {
    if (!library.measurement)
      throw new Error(`${library.id} has no measurement`);
    return { name: library.displayName, note: library.measurement.note };
  });
}

// ---------------------------------------------------------------------------
// Markdown, for the text surfaces
// ---------------------------------------------------------------------------

const escapeCell = (text: string): string => text.replace(/\|/g, "\\|");

function cellMarkdown(cell: Cell): string {
  const text = cell.code ? `\`${cell.text}\`` : escapeCell(cell.text);
  return cell.href ? `[${text}](${cell.href})` : text;
}

/** A table as a Markdown pipe table. */
export function tableMarkdown(table: CompareTable): string {
  return [
    "",
    `| ${table.head.join(" | ")} |`,
    `| ${table.head.map(() => "---").join(" | ")} |`,
    ...table.rows.map((row) => `| ${row.map(cellMarkdown).join(" | ")} |`),
    "",
  ].join("\n");
}

/** The notes list as HTML list items. */
export function notesHtml(): string[] {
  return measurementNotes().map(
    ({ name, note }) =>
      `<strong>${escapeHtml(name)}.</strong> ${inlineCodeHtml(note)}`,
  );
}

export function notesMarkdown(): string {
  return [
    "",
    ...measurementNotes().map(({ name, note }) => `- **${name}.** ${note}`),
    "",
  ].join("\n");
}
