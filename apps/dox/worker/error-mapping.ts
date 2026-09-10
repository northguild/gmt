import { APICallError } from "ai";

export interface MappedError {
  status: number;
  body: { error: string; retryable: boolean };
}

/**
 * DOX-C2 (#138) — never forward a raw upstream payload (DoD line). Every
 * branch here is deliberately generic on the user-facing `error` string;
 * the only thing that varies with real information is `status` and
 * `retryable`, which are safe to expose.
 *
 * Verified against `@ai-sdk/provider`'s actual `APICallError` shape
 * (`statusCode`, `responseBody`, `isRetryable`) rather than a guessed
 * error interface — see `node_modules/@ai-sdk/provider`'s type
 * declarations, checked during this story.
 *
 * The daily-vs-per-minute 429 split below is a **heuristic**, not a
 * verified contract: Google's quota-exceeded responses typically name the
 * exceeded quota inside the error body (e.g. a `quotaId` containing
 * "PerDay" or "PerMinute"), so this does a best-effort substring scan
 * rather than parsing a specific JSON shape that could change. Re-verify
 * against a real captured 429 during this story's manual live-key check
 * (DOX-C2 step 14) and tighten if the heuristic misses.
 */
export function mapUpstreamError(error: unknown): MappedError {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? 502;

    if (status === 401 || status === 403) {
      return {
        status: 500,
        body: {
          error: "The assistant is temporarily unavailable.",
          retryable: false,
        },
      };
    }

    if (status === 429) {
      const body = error.responseBody ?? "";
      const isDailyQuota = /per\s*day/i.test(body);
      return {
        status: 429,
        body: {
          error: isDailyQuota
            ? "The assistant has reached its daily usage limit. Please come back tomorrow."
            : "The assistant is receiving too many requests right now. Please wait a moment and try again.",
          retryable: true,
        },
      };
    }

    return {
      status: 502,
      body: {
        error: "The assistant's upstream model is unavailable right now.",
        retryable: true,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "Something went wrong answering that question.",
      retryable: false,
    },
  };
}
