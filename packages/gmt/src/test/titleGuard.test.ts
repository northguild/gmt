import { findBlanks } from "./titleGuard";

/** The arguments a tagged template passes: its strings, then its values. */
function table(strings: TemplateStringsArray, ...values: unknown[]) {
  return [[...strings], values] as const;
}

describe("findBlanks", () => {
  it("names each row where an unquoted $key in a template table is empty", () => {
    const [cases, args] = table`
      value | expected
      ${""} | ${"a"}
      ${"b"} | ${""}
    `;
    expect(findBlanks("returns $expected for $value", cases, args)).toEqual([
      "row 1: $expected",
      "row 0: $value",
    ]);
  });

  it("passes a $key written in single quotes", () => {
    const [cases, args] = table`
      value | expected
      ${""} | ${""}
    `;
    expect(findBlanks("returns '$expected' for '$value'", cases, args)).toEqual(
      [],
    );
  });

  it("passes a $key in double quotes or backticks", () => {
    const cases = [{ value: "" }];
    expect(findBlanks('reads "$value"', cases)).toEqual([]);
    expect(findBlanks("reads `$value`", cases)).toEqual([]);
  });

  it("does not count one quote on one side as quoting", () => {
    expect(findBlanks("reads '$value", [{ value: "" }])).toEqual([
      "row 0: $value",
    ]);
  });

  it("reads object rows and nested keys", () => {
    const cases = [{ input: { text: "" } }, { input: { text: "x" } }];
    expect(findBlanks("parses $input.text", cases)).toEqual([
      "row 0: $input.text",
    ]);
  });

  it("reads array rows by index", () => {
    expect(findBlanks("maps $0 to $1", [["", "x"]])).toEqual(["row 0: $0"]);
  });

  it("names a %s that takes an empty string, counting earlier specifiers", () => {
    expect(findBlanks("%d gives %s", [[1, ""]])).toEqual(["row 0: %s"]);
    expect(findBlanks("%% then %s", [[""]])).toEqual(["row 0: %s"]);
    expect(findBlanks("%# is '%s'", [[""]])).toEqual([]);
  });

  it("ignores values that print something", () => {
    const cases = [{ value: null }, { value: 0 }, { value: " " }];
    expect(findBlanks("reads $value", cases)).toEqual([]);
  });
});
