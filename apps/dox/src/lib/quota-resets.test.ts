/// <reference types="vitest/globals" />

import { listResets, nextReset, type QuotaInfo } from "./quota-resets";

/** Pacific midnight (07:00Z) and the UTC midnight seven hours before it. */
const PACIFIC_MIDNIGHT = "2026-06-16T07:00:00.000Z";
const UTC_MIDNIGHT = "2026-06-16T00:00:00.000Z";

function info(overrides: {
  gemini?: number;
  workersAI?: number;
  visitorRemaining?: number | null;
  unlimited?: boolean;
  activeBrainId?: string | null;
  providers?: QuotaInfo["providers"];
}): QuotaInfo {
  return {
    brains: [
      { id: "gemini-a", provider: "google", remaining: overrides.gemini ?? 20 },
      {
        id: "cf-a",
        provider: "workers-ai",
        remaining: overrides.workersAI ?? 100,
      },
    ],
    providers: overrides.providers ?? [
      { id: "google", label: "Gemini", resetsAt: PACIFIC_MIDNIGHT },
      { id: "workers-ai", label: "Workers AI", resetsAt: UTC_MIDNIGHT },
    ],
    activeBrainId: overrides.activeBrainId ?? "gemini-a",
    visitor: {
      remaining:
        overrides.visitorRemaining === undefined
          ? 5
          : overrides.visitorRemaining,
      unlimited: overrides.unlimited ?? false,
      resetsAt: PACIFIC_MIDNIGHT,
    },
  };
}

describe("nextReset", () => {
  it("shows the reader's own allowance when nothing is spent", () => {
    expect(nextReset(info({}), null)?.id).toBe("visitor");
  });

  it("shows the reader's own reset when only their questions are gone", () => {
    expect(nextReset(info({ visitorRemaining: 0 }), null)?.id).toBe("visitor");
  });

  it("shows the soonest provider refill when every brain is spent", () => {
    // Workers AI comes back at UTC midnight, seven hours before Gemini.
    const reset = nextReset(info({ gemini: 0, workersAI: 0 }), null);
    expect(reset).toEqual({
      id: "workers-ai",
      label: "Workers AI",
      resetsAt: UTC_MIDNIGHT,
    });
  });

  it("orders by instant, not by the order the providers arrive in", () => {
    const reversed = info({
      gemini: 0,
      workersAI: 0,
      providers: [
        { id: "workers-ai", label: "Workers AI", resetsAt: PACIFIC_MIDNIGHT },
        { id: "google", label: "Gemini", resetsAt: UTC_MIDNIGHT },
      ],
    });
    expect(nextReset(reversed, null)?.id).toBe("google");
  });

  it("waits for the later of the two when the reader and the pool are both spent", () => {
    // Dox has a brain back at UTC midnight, but this reader cannot ask until
    // their own questions refill at Pacific midnight.
    const reset = nextReset(
      info({ gemini: 0, workersAI: 0, visitorRemaining: 0 }),
      null,
    );
    expect(reset?.id).toBe("visitor");
  });

  it("follows the picked brain's provider for a dev, who has no personal cap", () => {
    const dev = info({ unlimited: true, visitorRemaining: null });
    expect(nextReset(dev, "cf-a")?.id).toBe("workers-ai");
    expect(nextReset(dev, null)?.id).toBe("google");
  });

  it("is undefined when a dev's deployment reports no providers", () => {
    const empty = info({
      unlimited: true,
      visitorRemaining: null,
      providers: [],
    });
    expect(nextReset(empty, null)).toBeUndefined();
  });
});

describe("listResets", () => {
  it("lists the reader's own allowance first, then each provider", () => {
    expect(listResets(info({})).map((reset) => reset.id)).toEqual([
      "visitor",
      "google",
      "workers-ai",
    ]);
  });

  it("omits the visitor row for a dev", () => {
    expect(
      listResets(info({ unlimited: true, visitorRemaining: null })).map(
        (reset) => reset.id,
      ),
    ).toEqual(["google", "workers-ai"]);
  });
});
