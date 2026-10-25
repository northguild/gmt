import { findTitleFaults } from "./titleGuard";

/** The arguments a tagged template passes: its strings, then its values. */
function table(strings: TemplateStringsArray, ...values: unknown[]) {
  return [[...strings], values] as const;
}

describe("findTitleFaults", () => {
  it("names each row where an unquoted $key in a template table is empty", () => {
    const [cases, args] = table`
      value | expected
      ${""} | ${"a"}
      ${"b"} | ${""}
    `;
    expect(
      findTitleFaults("returns $expected for $value", cases, args),
    ).toEqual([
      "row 0: $value prints a blank",
      "row 1: $expected prints a blank",
    ]);
  });

  it("passes a $key written in single quotes", () => {
    const [cases, args] = table`
      value | expected
      ${""} | ${""}
    `;
    expect(
      findTitleFaults("returns '$expected' for '$value'", cases, args),
    ).toEqual([]);
  });

  it("passes a $key in double quotes or backticks", () => {
    const cases = [{ value: "" }];
    expect(findTitleFaults('reads "$value"', cases)).toEqual([]);
    expect(findTitleFaults("reads `$value`", cases)).toEqual([]);
  });

  it("does not count one quote on one side as quoting", () => {
    expect(findTitleFaults("reads '$value", [{ value: "" }])).toEqual([
      "row 0: $value prints a blank",
    ]);
  });

  it("reads object rows and nested keys", () => {
    const cases = [{ input: { text: "" } }, { input: { text: "x" } }];
    expect(findTitleFaults("parses $input.text", cases)).toEqual([
      "row 0: $input.text prints a blank",
    ]);
  });

  it("reads array rows by index", () => {
    expect(findTitleFaults("maps $0 to $1", [["", "x"]])).toEqual([
      "row 0: $0 prints a blank",
    ]);
  });

  it("leaves a $key that Vitest prints as text alone", () => {
    expect(findTitleFaults("reads '$value'", [[null]])).toEqual([]);
  });

  it("names a quoted $key whose value is not a string", () => {
    const [cases, args] = table`
      duration
      ${"PT15M"}
      ${null}
      ${1}
      ${["day"]}
    `;
    expect(
      findTitleFaults("returns null for '$duration'", cases, args),
    ).toEqual([
      "row 1: $duration quotes a non-string (null)",
      "row 2: $duration quotes a non-string (number)",
      "row 3: $duration quotes a non-string (object)",
    ]);
  });

  it("gives every printf match the next item, as Vitest 5 does", () => {
    // `%%` takes "" and prints `% ` before `%s` takes "b": `A: 100%  of b`.
    expect(findTitleFaults("A: 100%% of %s", [["", "b"]])).toEqual([
      "row 0: %% prints a blank",
    ]);
    // `%%` takes "a" and `%s` takes "": `B: 100% a of `.
    expect(findTitleFaults("B: 100%% of %s", [["a", ""]])).toEqual([
      "row 0: %s prints a blank",
    ]);
    // `%c` takes 1 and prints nothing; `%s` takes "": `C: `.
    expect(findTitleFaults("C: %c%s", [[1, ""]])).toEqual([
      "row 0: %s prints a blank",
    ]);
    expect(findTitleFaults("%d gives %s", [[1, ""]])).toEqual([
      "row 0: %s prints a blank",
    ]);
  });

  it("counts %# and %$ as the row number, not as items", () => {
    expect(findTitleFaults("%# is '%s'", [[""]])).toEqual([]);
    expect(findTitleFaults("%$ is %s", [[""]])).toEqual([
      "row 0: %s prints a blank",
    ]);
  });

  it("names a quoted %s whose value is not a string", () => {
    expect(findTitleFaults("reads '%s'", [[null], ["x"]])).toEqual([
      "row 0: %s quotes a non-string (null)",
    ]);
  });

  it("ignores values that print something", () => {
    const cases = [{ value: null }, { value: 0 }, { value: " " }];
    expect(findTitleFaults("reads $value", cases)).toEqual([]);
  });
});
