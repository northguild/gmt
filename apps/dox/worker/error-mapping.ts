import { APICallError, RetryError } from "ai";

export interface MappedError {
  status: number;
  body: { error: string; retryable: boolean };
}

/** `RetryError.lastError` is the final attempt's failure; `errors` holds every
 * attempt. Prefer the last, fall back to the newest in the list. */
function unwrapRetry(error: unknown): unknown {
  if (!RetryError.isInstance(error)) return error;
  return error.lastError ?? error.errors.at(-1) ?? error;
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
 * DOX-C3a (#139): `streamText` retries internally, so a failure that survives
 * every attempt arrives wrapped in a `RetryError`, NOT as a bare
 * `APICallError` — `APICallError.isInstance` returns false for it and every
 * branch below was being skipped. Observed live 2026-09-10: a genuine
 * 429 daily-quota exhaustion reached the reader as the generic
 * "Something went wrong answering that question." instead of the quota
 * message that would have told them what to actually do. Unwrap first.
 *
 * The daily-vs-per-minute 429 split below is a heuristic — but it is now a
 * **verified** one. A real quota-exhaustion body captured live 2026-09-10
 * carries:
 *
 *   "quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"
 *   "quotaValue": "20"
 *
 * so `/per\s*day/i` matches on "PerDay" and the daily branch is selected, which
 * is correct: the free tier's limit for `gemini-3.6-flash` is 20 requests per
 * DAY, not per minute. The accompanying "Please retry in 50s" is only the
 * backoff hint for one attempt, and telling a reader to wait a moment would be
 * actively wrong — the quota does not return for hours.
 */
export function mapUpstreamError(rawError: unknown): MappedError {
  const error = unwrapRetry(rawError);

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
