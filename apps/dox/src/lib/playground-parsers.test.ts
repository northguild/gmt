import { describe, expect, it } from "vitest";
import { buildCall, formatArg, type CallField } from "./playground-parsers";

const digits = (value: string): CallField => ({
  name: "fractionalSecondDigits",
  kind: "enum",
  value,
  numeric: ["0", "1", "3", "6", "9"],
  optional: true,
});

describe("an enum that mixes number and string literals", () => {
  it("writes a numeric choice as a number", () => {
    expect(formatArg(digits("6"))).toBe("6");
  });

  it("writes a string choice as a string", () => {
    expect(formatArg(digits("auto"))).toBe('"auto"');
  });

  it("keeps a plain enum quoted even when its text is a digit", () => {
    expect(formatArg({ name: "x", kind: "enum", value: "6" })).toBe('"6"');
  });

  it("builds a call with the number the library expects", () => {
    const iso: CallField = { name: "value", kind: "string", value: "2024" };
    expect(buildCall("formatCcsdsAsciiB", [iso, digits("3")])).toBe(
      'formatCcsdsAsciiB("2024", 3)',
    );
  });

  it("drops the optional field when the reader clears it", () => {
    const iso: CallField = { name: "value", kind: "string", value: "2024" };
    expect(buildCall("formatCcsdsAsciiB", [iso, digits("")])).toBe(
      'formatCcsdsAsciiB("2024")',
    );
  });
});
