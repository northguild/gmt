/**
 * The deck's lookup of one upstream filing by its key (`nodejs/node#67076`, `ICU-23609`), for
 * `FilingCard.astro`. An unknown key throws, so a filing renamed or removed from
 * `upstream-filings.json` fails the build instead of leaving a slide with a hole in it.
 */
import {
  filingGroup,
  filingKey,
  filingRef,
  filings,
  type UpstreamFiling,
} from "~/data/upstream-filings";

export function findFiling(
  key: string,
  list: readonly UpstreamFiling[] = filings,
): UpstreamFiling {
  const found = list.find((f) => filingKey(f) === key);
  if (!found) {
    throw new Error(
      `Slide filing "${key}" is not in src/data/upstream-filings.json: a filing was renamed or removed`,
    );
  }
  return found;
}

/** What a card prints for a filing, every part read from the data. */
export interface FilingFacts {
  key: string;
  ref: string;
  group: string;
  title: string;
  state: UpstreamFiling["state"];
  /** The state in words: `Open`, `Closed`, or `Merged` for a merged pull request. */
  stateLabel: string;
  url: string;
}

export function filingFacts(
  key: string,
  list: readonly UpstreamFiling[] = filings,
): FilingFacts {
  const f = findFiling(key, list);
  const merged = f.tracker === "github" && f.mergedAt !== null;
  return {
    key,
    ref: filingRef(f),
    group: filingGroup(f).name,
    title: f.title,
    state: f.state,
    stateLabel: merged ? "Merged" : f.state === "open" ? "Open" : "Closed",
    url: f.url,
  };
}
