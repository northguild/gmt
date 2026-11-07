/**
 * The badges an /upstream/ card shows, worked out from a filing's own fields. Nothing here is a
 * hand-kept status: the state badge reads `kind`, `state`, `draft` and `mergedAt`, the review chip
 * reads `reviewDecision`, and the In GMT chip reads `gmtGuard` and `gmtNote`. A badge always
 * carries a word that names the state, so its colour and icon are never the only signal.
 *
 * The state badge follows GitHub's own states and icons, in the site's tones: green for open,
 * purple for merged and for a closed issue, grey for a draft and for a pull request closed
 * without merging. Kept out of the components so every branch is covered by
 * `upstream-badges.test.ts`.
 */
import { stateLine, type CompatGroup } from "~/data/temporal-compat";
import type { UpstreamFiling } from "~/data/upstream-filings";
import { badge } from "../widgets/builders/badge";
import type { SafeHtml } from "../widgets/builders/html";
import type { OcticonName } from "./octicons";

type Tone = "neutral" | "spring" | "purple";

export interface BadgeSpec {
  text: string;
  tone: Tone;
  icon?: OcticonName;
  /** The quiet outline style, for a secondary chip. */
  dim?: boolean;
}

type StateFields = Pick<
  UpstreamFiling,
  "kind" | "state" | "draft" | "mergedAt"
>;
type ReviewFields = Pick<
  UpstreamFiling,
  "kind" | "state" | "draft" | "reviewDecision"
>;
type InGmtFields = Pick<
  UpstreamFiling,
  "gmtGuard" | "gmtNote" | "kind" | "pairsWith"
>;

/** Where a filing stands on GitHub, with the icon GitHub draws for that state. */
export function stateBadge(f: StateFields): BadgeSpec & { icon: OcticonName } {
  if (f.kind === "issue") {
    return f.state === "closed"
      ? { text: "Closed", tone: "purple", icon: "issue-closed" }
      : { text: "Open", tone: "spring", icon: "issue-opened" };
  }
  if (f.mergedAt) return { text: "Merged", tone: "purple", icon: "git-merge" };
  if (f.state === "closed") {
    return { text: "Closed", tone: "neutral", icon: "git-pull-request-closed" };
  }
  if (f.draft) {
    return { text: "Draft", tone: "neutral", icon: "git-pull-request-draft" };
  }
  return { text: "Open", tone: "spring", icon: "git-pull-request" };
}

/**
 * The part of a filing's state that GitHub's one word loses. A merged pull request is not yet
 * in a published polyfill release, which is the fact that decides whether a user has the fix.
 */
export function stateNote(f: Pick<UpstreamFiling, "mergedAt">): string | null {
  return f.mergedAt ? "Merged, not yet in a published release" : null;
}

/**
 * The reviewer's verdict, when there is one that still applies. An open pull request with no
 * verdict, ready for review, is awaiting one: most upstream repositories require no review, so
 * GitHub leaves `reviewDecision` empty until somebody reviews.
 */
export function reviewBadge(f: ReviewFields): BadgeSpec | null {
  if (f.reviewDecision === "APPROVED") {
    return { text: "Approved", tone: "spring", icon: "check", dim: true };
  }
  // Only an open pull request is still waiting on a review.
  if (f.state !== "open") return null;
  if (f.reviewDecision === "CHANGES_REQUESTED") {
    return { text: "Changes requested", tone: "neutral", dim: true };
  }
  if (f.reviewDecision === "REVIEW_REQUIRED") {
    return { text: "Review required", tone: "neutral", dim: true };
  }
  if (f.kind === "pr" && !f.draft) {
    return { text: "Awaiting review", tone: "neutral", dim: true };
  }
  return null;
}

const WORK = {
  port: "Port",
  fix: "Fix",
  report: "Report",
  release: "Release request",
} as const;

/** What the filing was for: a port, a fix, a report or a release request. */
export function workBadge(work: UpstreamFiling["work"]): BadgeSpec | null {
  return work ? { text: WORK[work], tone: "neutral", dim: true } : null;
}

/** What a GMT user gets today. A guard names the GMT workaround that already returns the
 * correct answer on every polyfill version; one with neither is fixed upstream only. */
export function gmtBadge(f: InGmtFields): BadgeSpec {
  if (f.gmtGuard) {
    return { text: `Guarded · ${f.gmtGuard}`, tone: "purple", icon: "shield" };
  }
  if (f.gmtNote) return { text: "Not affected", tone: "spring", icon: "check" };
  const fixFiled = f.kind === "pr" || f.pairsWith.length > 0;
  return {
    text: fixFiled ? "Fix filed upstream" : "Reported upstream",
    tone: "neutral",
    dim: true,
  };
}

/** A filing someone else opened: our part was the evidence, not the fix. */
export function roleBadge(f: Pick<UpstreamFiling, "role">): BadgeSpec | null {
  return f.role === "contributor"
    ? { text: "Theirs", tone: "neutral", dim: true }
    : null;
}

const DEFECT_TONE: Readonly<Record<CompatGroup["state"], Tone>> = {
  // The workaround is still earning its place: the defect is open.
  "still-needed": "neutral",
  // Nothing left to work around.
  removable: "spring",
  // Every check passes only because the installed polyfill cannot show the bug yet.
  guard: "purple",
  // The defect is real but outside what GMT supports.
  "out-of-scope": "spring",
};

/**
 * The "Still needed?" chip of a canary group. Its word is `stateLine`'s, the same one the text
 * twin prints; a leading `✓ ` becomes the check icon rather than a glyph.
 */
export function defectBadge(group: CompatGroup): BadgeSpec {
  const { badge } = stateLine(group);
  const checked = badge.startsWith("✓ ");
  return {
    text: checked ? badge.slice(2) : badge,
    tone: DEFECT_TONE[group.state],
    ...(checked ? { icon: "check" as const } : {}),
  };
}

/** A spec as the kit chip; `fill` is the state badge's solid pill, `wrap` for a narrow column. */
export function chip(
  spec: BadgeSpec,
  opts: { fill?: boolean; wrap?: boolean } = {},
): SafeHtml {
  return badge({
    text: spec.text,
    tone: spec.tone,
    ...(spec.icon ? { icon: spec.icon } : {}),
    ...(spec.dim ? { dim: true } : {}),
    ...(opts.fill ? { fill: true } : {}),
    ...(opts.wrap ? { wrap: true } : {}),
  });
}
