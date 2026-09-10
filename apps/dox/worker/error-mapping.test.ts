/// <reference types="vitest/globals" />
import { APICallError } from "ai";
import { mapUpstreamError } from "./error-mapping";

function apiError(statusCode: number, responseBody = ""): APICallError {
  return new APICallError({
    message: "upstream failure",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash",
    requestBodyValues: {},
    statusCode,
    responseBody,
  });
}

describe("mapUpstreamError", () => {
  it("maps a 401/403 to a generic 500 without exposing auth details", () => {
    const mapped = mapUpstreamError(apiError(401, "invalid API key"));
    expect(mapped.status).toBe(500);
    expect(mapped.body.error).not.toMatch(/key|401|invalid API/i);
    expect(mapped.body.retryable).toBe(false);
  });

  it("maps a per-minute 429 to a retryable 'wait a moment' message", () => {
    const mapped = mapUpstreamError(
      apiError(429, "RESOURCE_EXHAUSTED: GenerateRequestsPerMinute exceeded"),
    );
    expect(mapped.status).toBe(429);
    expect(mapped.body.retryable).toBe(true);
    expect(mapped.body.error).toMatch(/wait a moment/i);
  });

  it("maps a daily-quota 429 to a distinct 'come back tomorrow' message", () => {
    const mapped = mapUpstreamError(
      apiError(429, "RESOURCE_EXHAUSTED: GenerateRequestsPerDay exceeded"),
    );
    expect(mapped.status).toBe(429);
    expect(mapped.body.retryable).toBe(true);
    expect(mapped.body.error).toMatch(/tomorrow/i);
    expect(mapped.body.error).not.toMatch(/wait a moment/i);
  });

  it("maps an unrecognized upstream status to a generic retryable 502", () => {
    const mapped = mapUpstreamError(apiError(503, "backend overloaded"));
    expect(mapped.status).toBe(502);
    expect(mapped.body.retryable).toBe(true);
    expect(mapped.body.error).not.toContain("backend overloaded");
  });

  it("never forwards the raw responseBody to the client", () => {
    const secretLooking = "sk-super-secret-upstream-detail-12345";
    const mapped = mapUpstreamError(apiError(500, secretLooking));
    expect(JSON.stringify(mapped.body)).not.toContain(secretLooking);
  });

  it("maps a non-APICallError (unexpected throw) to a generic 500", () => {
    const mapped = mapUpstreamError(new Error("something exploded internally"));
    expect(mapped.status).toBe(500);
    expect(mapped.body.retryable).toBe(false);
    expect(mapped.body.error).not.toContain("something exploded internally");
  });
});
