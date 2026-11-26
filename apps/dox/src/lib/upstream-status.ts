/**
 * The /upstream/ tables' column headers and a listing's status sentence. The tracker's badges are
 * in `upstream-badges.ts`. Kept out of the components so every branch is covered by
 * `upstream-status.test.ts`.
 */
import type { UpstreamListing } from "~/data/upstream-filings";

/** The tracker's column headers. A card is a header, the details and the activity line; each
 * cell names its own on `data-col` for the entries layout. */
export const UPSTREAM_COLUMNS = ["Filing", "Details", "Activity"] as const;

/** The listings table's column headers in its Markdown twin. */
export const LISTING_COLUMNS = [
  "Submission",
  "What it asks",
  "Status",
  "Replies",
  "Last activity",
] as const;

/**
 * Where a listing stands, for the Markdown twin. "Merged" says nothing about a release: a listing
 * is a pull request or an issue on another project, not a Temporal polyfill fix. An issue is only
 * open or closed.
 */
export function listingStatus(
  l: Pick<
    UpstreamListing,
    "kind" | "state" | "draft" | "reviewDecision" | "mergedAt"
  >,
): string {
  if (l.kind === "issue") return l.state === "closed" ? "Closed" : "Open";
  if (l.mergedAt) return "Merged";
  if (l.state === "closed") return "Closed without merging";
  if (l.draft) return "Draft";
  if (l.reviewDecision === "APPROVED") return "Approved";
  if (l.reviewDecision === "CHANGES_REQUESTED") return "Changes requested";
  return "Open, awaiting review";
}

/** "1 maintainer reply", "0 maintainer replies": a bare count next to an icon reads as no comments
 * at all, so the noun goes with it. */
export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The noun without its count, for the part of the label a narrow card drops from sight. */
export function countNoun(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
