import { Temporal } from "@js-temporal/polyfill";
import { resolveDurationRelativeTo } from "./resolveDurationRelativeTo";

describe("resolveDurationRelativeTo", () => {
  it("passes through undefined unchanged", () => {
    expect(resolveDurationRelativeTo(undefined)).toBeUndefined();
  });

  it("passes a plain ISO string through unchanged", () => {
    expect(resolveDurationRelativeTo("2024-02-10")).toBe("2024-02-10");
  });

  it("passes a Temporal.PlainDateTime object through unchanged", () => {
    const pdt = Temporal.PlainDateTime.from("2024-02-10T00:00:00");
    expect(resolveDurationRelativeTo(pdt)).toBe(pdt);
  });

  it("passes a non-calendar-annotated string through unchanged even if it superficially resembles one", () => {
    // Doesn't match the calendarDate grammar (no [u-ca=...] suffix) — untouched.
    expect(resolveDurationRelativeTo("2024-02-10T00:00:00")).toBe(
      "2024-02-10T00:00:00",
    );
  });

  it("converts a GMT calendar-annotated PlainDate string into the PlainDateTime it names", () => {
    const resolved = resolveDurationRelativeTo("5784-06-15[u-ca=hebrew]");
    expect(resolved).toBeInstanceOf(Temporal.PlainDateTime);
    const pdt = resolved as Temporal.PlainDateTime;
    expect(pdt.calendarId).toBe("hebrew");
    expect(pdt.toPlainDate().withCalendar("iso8601").toString()).toBe(
      "2024-02-24",
    );
  });

  it("produces a relativeTo that resolves duration totals identically to the equivalent Temporal-shape string", () => {
    // Regression golden (E5 issue #78): before the fix, "5784-06-15[u-ca=hebrew]" was silently
    // misread as ISO year 5784 and produced 354, not 385 — verified directly against
    // @js-temporal/polyfill during E5 research.
    const resolved = resolveDurationRelativeTo("5784-06-15[u-ca=hebrew]");
    expect(
      Temporal.Duration.from("P1Y").total({ unit: "days", relativeTo: resolved }),
    ).toBe(385);
  });

  it("throws for a malformed calendar-annotated string", () => {
    expect(() =>
      resolveDurationRelativeTo("5783-14-01[u-ca=hebrew]"),
    ).toThrow();
  });
});
