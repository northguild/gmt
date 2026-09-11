/**
 * Which reset matters to the reader right now.
 *
 * Since DOX-C4 there is no single "Dox resets at midnight" to show. The
 * visitor's own questions and the Gemini brains refill at midnight Pacific; the
 * Workers AI pool refills at 00:00 UTC. `/api/brains` sends every one of those
 * instants, and this module picks between them — pure, so the rules are tested
 * without rendering anything.
 */
import { convertUtcToUnix } from "@northguild/gmt";
import type { BrainProvider } from "./chat-constants";

export interface QuotaReset {
  id: "visitor" | BrainProvider;
  label: string;
  /** ISO instant the allowance refills. */
  resetsAt: string;
}

/** The subset of `/api/brains` this module reads. `BrainsInfo` satisfies it;
 * declared here so a `lib` module does not import from `components`. */
export interface QuotaInfo {
  brains: readonly { id: string; provider: BrainProvider; remaining: number }[];
  providers: readonly { id: BrainProvider; label: string; resetsAt: string }[];
  activeBrainId: string | null;
  visitor: {
    remaining: number | null;
    unlimited: boolean;
    resetsAt: string;
  };
}

/** Sort key for an instant; an unparseable one sorts last rather than first. */
function epochOf(reset: QuotaReset): number {
  return convertUtcToUnix(reset.resetsAt) ?? Number.POSITIVE_INFINITY;
}

function visitorReset(info: QuotaInfo): QuotaReset {
  return {
    id: "visitor",
    label: "Your questions",
    resetsAt: info.visitor.resetsAt,
  };
}

function providerReset(provider: QuotaInfo["providers"][number]): QuotaReset {
  return {
    id: provider.id,
    label: provider.label,
    resetsAt: provider.resetsAt,
  };
}

/**
 * Every reset the reader can be waiting on: their own allowance first (the
 * number they can act on), then each provider in preference order.
 *
 * A dev has no personal cap, so no visitor row.
 */
export function listResets(info: QuotaInfo): QuotaReset[] {
  const providers = info.providers.map(providerReset);
  return info.visitor.unlimited
    ? providers
    : [visitorReset(info), ...providers];
}

/**
 * The one reset worth putting in the composer — whatever refills next that
 * would actually let the reader ask again.
 *
 * - **Pool spent** (every brain at zero): the soonest provider refill, since
 *   Dox answers again as soon as any one of them comes back. If the reader's
 *   own questions are *also* gone, the later of that and their own reset.
 * - **Only their questions spent:** their own reset.
 * - **A dev**, who has no personal cap: the provider of the brain they picked,
 *   or of the one Dox would choose.
 * - **Otherwise:** their own allowance, the number beside it in the badge.
 */
export function nextReset(
  info: QuotaInfo,
  selectedBrainId: string | null,
): QuotaReset | undefined {
  const providers = info.providers.map(providerReset);
  const visitorSpent =
    !info.visitor.unlimited && (info.visitor.remaining ?? 1) <= 0;
  const poolSpent =
    info.brains.length > 0 &&
    info.brains.every((brain) => brain.remaining <= 0);

  if (poolSpent) {
    const soonest = [...providers].sort((a, b) => epochOf(a) - epochOf(b))[0];
    if (!visitorSpent) return soonest;
    const own = visitorReset(info);
    return !soonest || epochOf(own) >= epochOf(soonest) ? own : soonest;
  }

  if (visitorSpent) return visitorReset(info);

  if (info.visitor.unlimited) {
    const brainId = selectedBrainId ?? info.activeBrainId;
    const brain =
      info.brains.find((candidate) => candidate.id === brainId) ??
      info.brains[0];
    return (
      providers.find((provider) => provider.id === brain?.provider) ??
      providers[0]
    );
  }

  return visitorReset(info);
}
