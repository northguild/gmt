import { describe, expect, it } from "vitest";
import { localTimeFacts } from "./local-time-facts";

describe("localTimeFacts", () => {
  it("names the spring change that skips a Helsinki time", () => {
    const result = localTimeFacts("2027-03-28T03:30:00", "Europe/Helsinki");
    expect(result?.kind).toBe("nonexistent");
    expect(result?.facts).toContain(
      "On 2027-03-28 the clocks in Europe/Helsinki change from +02:00 to +03:00: when the clock reads 03:00 it moves to 04:00.",
    );
  });

  it("finds a change listed under the next year, for a time skipped on 31 December", () => {
    // The library lists this change under 1901; the skipped minutes are on 1900-12-31.
    const result = localTimeFacts("1900-12-31T23:50:00", "Africa/Ceuta");
    expect(result?.kind).toBe("nonexistent");
    expect(result?.facts).toContain(
      "On 1900-12-31 the clocks in Africa/Ceuta change from -00:21:16 to +00:00: when the clock reads 1900-12-31 23:38:44 it moves to 1901-01-01 00:00.",
    );
  });

  it("dates both readings when a whole day is skipped", () => {
    const result = localTimeFacts("2011-12-30T12:00:00", "Pacific/Apia");
    expect(result?.kind).toBe("nonexistent");
    expect(result?.facts).toContain(
      "On 2011-12-30 the clocks in Pacific/Apia change from -10:00 to +14:00: when the clock reads 2011-12-30 00:00 it moves to 2011-12-31 00:00.",
    );
  });

  it("names the autumn change and both instants of a repeated time", () => {
    const result = localTimeFacts("2027-10-31T03:30:00", "Europe/Helsinki");
    expect(result?.kind).toBe("ambiguous");
    expect(result?.facts.join(" ")).toContain(
      "when the clock reads 04:00 it moves to 03:00",
    );
  });

  it("gives null for a zone the library cannot read", () => {
    expect(localTimeFacts("2027-03-28T03:30:00", "Mars/Olympus")).toBeNull();
  });
});
