/**
 * These assertions are checked against the real `isValidZonedDateTime`, not
 * against a remembered rule — the offset case in particular is unobvious, and
 * getting it wrong reintroduces the exact bug this module was written for.
 */
import { Temporal } from "@northguild/gmt";
import { GMT_MODULES } from "./gmt-modules";
import { normaliseZonedInput } from "./zoned-input";

let isValidZonedDateTime: (v: string) => boolean;

beforeAll(async () => {
  const mod = await GMT_MODULES["zoned/validate"]();
  isValidZonedDateTime = mod["isValidZonedDateTime"] as (v: string) => boolean;
});

describe("normaliseZonedInput", () => {
  it("repairs the exact value that produced the bug", () => {
    // Gemini's answer to "9am to 11am": a plain date-time, no zone.
    const repaired = normaliseZonedInput("2024-10-24T09:00:00");
    expect(repaired).toBe("2024-10-24T09:00:00+00:00[UTC]");
    expect(isValidZonedDateTime(repaired)).toBe(true);
  });

  it("satisfies Temporal.Instant.from as well as the validator", () => {
    /* The half-fix this guards against: a bare `[UTC]` passes
       `isValidZonedDateTime` and throws in `Instant.from`, which the widget uses
       to place its bars and classify the relationship. The result validated,
       computed correct answers, and drew a nonsense timeline while claiming an
       interval was reversed. */
    for (const plain of [
      "2024-10-24T09:00:00",
      "2024-10-24T09:00",
      "2024-10-24",
      "2024-10-24T09:00:00Z",
      "2024-10-24T09:00:00-04:00",
    ]) {
      const repaired = normaliseZonedInput(plain);
      expect(isValidZonedDateTime(repaired), `${plain} -> validator`).toBe(
        true,
      );
      expect(
        () => Temporal.Instant.from(repaired),
        `${plain} -> Instant.from (${repaired})`,
      ).not.toThrow();
    }
  });

  it("makes every plain shape the model plausibly emits valid", () => {
    for (const plain of [
      "2024-10-24T09:00:00",
      "2024-10-24T09:00",
      "2024-10-24",
      "2024-10-24T09:00:00Z",
    ]) {
      expect(isValidZonedDateTime(plain), `${plain} was already valid?`).toBe(
        false,
      );
      expect(
        isValidZonedDateTime(normaliseZonedInput(plain)),
        `${plain} not repaired`,
      ).toBe(true);
    }
  });

  it("gives a numeric offset its own bracket, never [UTC]", () => {
    // `2024-10-24T09:00:00-04:00[UTC]` is invalid — the offset and the zone
    // disagree. Appending the fallback blindly would look right and fail.
    const repaired = normaliseZonedInput("2024-10-24T09:00:00-04:00");
    expect(repaired).toBe("2024-10-24T09:00:00-04:00[-04:00]");
    expect(isValidZonedDateTime(repaired)).toBe(true);
    expect(isValidZonedDateTime("2024-10-24T09:00:00-04:00[UTC]")).toBe(false);
  });

  it("handles an offset written without a colon", () => {
    expect(
      isValidZonedDateTime(normaliseZonedInput("2024-10-24T09:00:00+0900")),
    ).toBe(true);
  });

  it("leaves an explicit zone alone", () => {
    for (const zoned of [
      "2024-10-24T09:00:00[UTC]",
      "2024-10-24T09:00:00-04:00[America/New_York]",
      "2024-01-01T00:00:00+00:00[UTC]",
    ]) {
      expect(normaliseZonedInput(zoned)).toBe(zoned);
    }
  });

  it("respects a caller's fallback zone", () => {
    expect(normaliseZonedInput("2024-10-24T09:00:00", "Asia/Tokyo")).toBe(
      "2024-10-24T09:00:00[Asia/Tokyo]",
    );
    // No offset is invented for a named zone — only UTC's is knowable here.
  });

  it("does not disguise input it cannot repair", () => {
    // The widget's own "Invalid input" state is the honest outcome here; a
    // guess would show the reader a confident answer to a question the model
    // never actually asked.
    expect(isValidZonedDateTime(normaliseZonedInput("9am"))).toBe(false);
    expect(normaliseZonedInput("")).toBe("");
  });

  it.each([
    // Monrovia ran at -00:44:30 until 1972; New York at -04:56:02 until 1883.
    ["1960-06-01T11:15:30-00:44:30", "1960-06-01T12:00:00+00:00[UTC]"],
    ["1960-06-01T11:15:30-004430", "1960-06-01T12:00:00+00:00[UTC]"],
    ["1880-01-01T12:00:00-04:56:02", "1880-01-01T16:56:02+00:00[UTC]"],
  ])("keeps the moment of %s, whose offset has seconds", (input, out) => {
    // An offset zone cannot hold seconds, so the moment moves to the fallback.
    const repaired = normaliseZonedInput(input);
    expect(repaired).toBe(out);
    expect(isValidZonedDateTime(repaired)).toBe(true);
    expect(Temporal.Instant.from(repaired).epochMilliseconds).toBe(
      Temporal.Instant.from(input.replace("-004430", "-00:44:30"))
        .epochMilliseconds,
    );
  });

  it("writes an offset with seconds in a named fallback zone", () => {
    const repaired = normaliseZonedInput(
      "1960-06-01T11:15:30-00:44:30",
      "Africa/Monrovia",
    );
    expect(repaired).toBe("1960-06-01T11:15:30-00:45[Africa/Monrovia]");
    expect(isValidZonedDateTime(repaired)).toBe(true);
  });
});
