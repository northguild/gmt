/// <reference types="vitest/globals" />

import { APICallError, RetryError } from "ai";
import { mapUpstreamError } from "./error-mapping";

/** A real captured quota body, trimmed. The `quotaId` is what the daily-vs-
 * per-minute heuristic keys on, so the test uses the genuine string rather than
 * an invented one. */
const DAILY_QUOTA_BODY = JSON.stringify({
  error: {
    code: 429,
    message: "You exceeded your current quota",
    status: "RESOURCE_EXHAUSTED",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [
          {
            quotaMetric:
              "generativelanguage.googleapis.com/generate_content_free_tier_requests",
            quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
            quotaValue: "20",
          },
        ],
      },
    ],
  },
});

function apiCallError(statusCode: number, responseBody: string): APICallError {
  return new APICallError({
    message: "upstream failed",
    url: "https://generativelanguage.googleapis.com/v1beta/models/x",
    requestBodyValues: {},
    statusCode,
    responseBody,
  });
}

describe("mapUpstreamError", () => {
  it("unwraps a RetryError to the failure underneath", () => {
    // `streamText` retries internally, so anything that survives every attempt
    // arrives wrapped. `APICallError.isInstance` is false for the wrapper, so
    // before unwrapping every branch was skipped and a real 429 reached the
    // reader as a generic "something went wrong" — observed live 2026-09-10.
    const inner = apiCallError(429, DAILY_QUOTA_BODY);
    const wrapped = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [inner, inner],
    });

    const result = mapUpstreamError(wrapped);
    expect(result.status).toBe(429);
    expect(result.body.error).toMatch(/daily usage limit/);
  });

  it("reads a real daily-quota body as daily, not as a momentary spike", () => {
    // The free tier's limit is 20 requests per DAY; the accompanying
    // "retry in 50s" is only one attempt's backoff. "Wait a moment" would be
    // actively wrong.
    const result = mapUpstreamError(apiCallError(429, DAILY_QUOTA_BODY));
    expect(result.body.error).toMatch(/daily usage limit/);
    expect(result.body.error).not.toMatch(/wait a moment/i);
  });

  it("still reports a per-minute 429 as a momentary spike", () => {
    const body = JSON.stringify({
      error: {
        details: [{ violations: [{ quotaId: "PerMinutePerProject" }] }],
      },
    });
    expect(mapUpstreamError(apiCallError(429, body)).body.error).toMatch(
      /wait a moment/i,
    );
  });

  it("hides an auth failure behind a generic message", () => {
    const result = mapUpstreamError(apiCallError(401, "bad key"));
    expect(result.status).toBe(500);
    expect(result.body.error).not.toMatch(/key/i);
    expect(result.body.retryable).toBe(false);
  });

  it("never forwards the raw upstream body to the reader", () => {
    const result = mapUpstreamError(
      apiCallError(500, "INTERNAL: secret trace"),
    );
    expect(JSON.stringify(result)).not.toContain("secret trace");
  });

  it("falls back to a generic message for a non-API error", () => {
    const result = mapUpstreamError(
      new Error("TypeError: x is not a function"),
    );
    expect(result.status).toBe(500);
    expect(result.body.error).toBe(
      "Something went wrong answering that question.",
    );
  });
});
