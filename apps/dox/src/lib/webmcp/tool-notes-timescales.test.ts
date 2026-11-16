/**
 * Three sentences the tools say and the pages never show: what a call that gives the tool nothing
 * to read, a `digits` with no instant, or half a span is told.
 */
import { describe, expect, it } from "vitest";
import ccsds, {
  DIGITS_NEED_AN_INSTANT,
  NEEDS_A_FIELD,
} from "./tools/ccsds-time-code-decoder";
import leap, { BOTH_ENDS } from "./tools/leap-second-timeline";

describe("the notes a tool adds beyond its page", () => {
  it("asks for a code or an instant when the ccsds call has neither", async () => {
    const result = await ccsds.execute({}, {});
    expect(result.ok && result.notes).toContain(NEEDS_A_FIELD);
  });

  it("says digits apply only to an instant when a code comes with digits", async () => {
    const result = await ccsds.execute(
      { code: "2024-001T00:00:00Z", digits: "3" },
      {},
    );
    expect(result.ok && result.notes).toContain(DIGITS_NEED_AN_INSTANT);
  });

  it("asks for both ends when the span has only one", async () => {
    const result = await leap.execute(
      { date: "2016-01-01T00:00:00Z", from: "2000-01-01T00:00:00Z" },
      {},
    );
    expect(result.ok && result.notes).toContain(BOTH_ENDS);
  });
});
