/**
 * The two per-filing labels the /upstream/ tracker (`UpstreamTracker.astro`)
 * derives from a filing's synced and hand-written fields. Kept out of the
 * component so every branch is covered by `upstream-status.test.ts`.
 */
import type { UpstreamFiling, UpstreamListing } from "~/data/upstream-filings";

type StatusFields = Pick<
  UpstreamFiling,
  "kind" | "state" | "draft" | "reviewDecision" | "mergedAt"
>;
type InGmtFields = Pick<
  UpstreamFiling,
  "kind" | "gmtGuard" | "gmtNote" | "pairsWith"
>;

/** The tracker's column headers; each cell names its own on `data-col` for the entries layout. */
export const UPSTREAM_COLUMNS = [
  "Filing",
  "In GMT",
  "The problem",
  "Kind",
  "Upstream status",
  "Replies",
  "Last activity",
] as const;

/** Where a filing stands on GitHub, most decisive state first. */
export function filingStatus(f: StatusFields): string {
  if (f.mergedAt) return "Merged, not yet in a published release";
  if (f.state === "closed") return "Closed";
  if (f.draft) return "Draft";
  if (f.reviewDecision === "APPROVED") return "Approved";
  if (f.reviewDecision === "CHANGES_REQUESTED") return "Changes requested";
  return f.kind === "pr" ? "Open, awaiting review" : "Open";
}

/** What a GMT user gets today. A filing with a `gmtGuard` names the GMT
 * workaround that already returns the correct answer on every polyfill
 * version; one without is fixed upstream only. */
export function filingInGmt(f: InGmtFields): {
  label: string;
  handled: boolean;
} {
  if (f.gmtGuard) return { label: "Already handled", handled: true };
  if (f.gmtNote) return { label: "Doesn't affect GMT", handled: true };
  const fixFiled = f.kind === "pr" || f.pairsWith.length > 0;
  return {
    label: fixFiled ? "Fix filed upstream" : "Reported upstream",
    handled: false,
  };
}

/** The listings table's column headers; each cell names its own on `data-col`. */
export const LISTING_COLUMNS = [
  "Pull request",
  "What it asks",
  "Status",
  "Replies",
  "Last activity",
] as const;

/**
 * Where a listing's pull request stands. Not `filingStatus`: that one says "Merged, not yet in a
 * published release", which is about the Temporal polyfill's releases and is false here.
 */
export function listingStatus(
  l: Pick<UpstreamListing, "state" | "draft" | "reviewDecision" | "mergedAt">,
): string {
  if (l.mergedAt) return "Merged";
  if (l.state === "closed") return "Closed without merging";
  if (l.draft) return "Draft";
  if (l.reviewDecision === "APPROVED") return "Approved";
  if (l.reviewDecision === "CHANGES_REQUESTED") return "Changes requested";
  return "Open, awaiting review";
}
