/**
 * What the `moment` slide ("Agents learned from Moment") shows: the maintainers' own words, quoted
 * verbatim from https://momentjs.com/news/, and npm's download counts per year from
 * `moment-downloads.json` (written by `scripts/zone-matrix/npm-downloads.mjs`). The slide judges
 * nothing in its own voice; the quotes and the counts carry it. Every count is read from the
 * record and rounded here.
 */
import record from "./moment-downloads.json";

export const NEWS_URL = "https://momentjs.com/news/";

interface MomentQuote {
  /** The maintainers' words, each one quoted verbatim. */
  quoted: readonly string[];
  /** Who said it and when. */
  by: string;
}

export const QUOTES: readonly MomentQuote[] = [
  {
    quoted: ["In most cases, you should not choose Moment for new projects."],
    by: "Moment.js maintainers, 2020",
  },
  {
    quoted: [
      "Weekly downloads have more than tripled since our previous update.",
      "we believe most of this new growth is connected to agentic use",
    ],
    by: "Moment.js maintainers, 17 August 2026",
  },
];

export const CLOSING =
  "Agents write the library its own maintainers call legacy, and it keeps a Date inside.";

interface YearRecord {
  year: number;
  from: string;
  to: string;
  partial: boolean;
  downloads: number;
}

interface DownloadBar {
  name: string;
  share: number;
  value: string;
  note?: string;
}

/** A count in words a person reads at a glance: whole millions, then billions to two places. */
export function roundedCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} billion`;
  return `${Math.round(n / 1e6)} million`;
}

/**
 * One bar per recorded year, each as long as its share of the largest year. Throws when the record
 * is not one calendar year after another with only the latest still running.
 */
export function downloadBars(
  years: readonly YearRecord[] = record.years,
): DownloadBar[] {
  if (years.length === 0) throw new Error("moment-downloads.json has no years");
  years.forEach((y, i) => {
    if (i > 0 && y.year !== years[i - 1]!.year + 1)
      throw new Error(
        `moment-downloads.json: ${y.year} does not follow ${years[i - 1]!.year}`,
      );
    if (y.partial !== (i === years.length - 1))
      throw new Error(
        `moment-downloads.json: only the last year is partial (${y.year})`,
      );
  });
  const most = Math.max(...years.map((y) => y.downloads));
  return years.map((y) => ({
    name: String(y.year),
    share: y.downloads / most,
    value: roundedCount(y.downloads),
    ...(y.partial ? { note: "so far" } : {}),
  }));
}

export const DOWNLOADS = {
  source: record.source,
  capturedOn: record.capturedOn,
  package: record.package,
};
