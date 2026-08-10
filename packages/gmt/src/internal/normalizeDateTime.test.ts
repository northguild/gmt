import { normalizeDateTime } from "./normalizeDateTime";

describe("normalizeDateTime", () => {
  it.each`
    input                                                              | expected
    ${"  hello  "}                                                     | ${"hello"}
    ${"\uFEFFhello\uFEFF"}                                             | ${"hello"}
    ${"GMT\u200E+2\u200F"}                                             | ${"GMT+2"}
    ${"10:00\u2009AM\u2013\u200912:00\u2009PM"}                        | ${"10:00 AM - 12:00 PM"}
    ${"2/29/2024, 10:00:00\u00A0AM\u2009\u2013\u200912:00:00\u00A0PM"} | ${"2/29/2024, 10:00:00 AM - 12:00:00 PM"}
    ${"A\u00A0\u202FB"}                                                | ${"A B"}
    ${"1\u20132"}                                                      | ${"1-2"}
    ${"1\u20442"}                                                      | ${"1/2"}
    ${"A\t \u00A0B"}                                                   | ${"A B"}
    ${"\u200E\u200F\u200B\uFEFF\u200E"}                                | ${""}
    ${"2024\u201302\u201303"}                                          | ${"2024-02-03"}
    ${"2024\u201402\u201403"}                                          | ${"2024-02-03"}
    ${"2024\u221202\u221203"}                                          | ${"2024-02-03"}
    ${"2024\u201002\u201003"}                                          | ${"2024-02-03"}
    ${"2024\u201102\u201103"}                                          | ${"2024-02-03"}
    ${"2024\u201202\u201203"}                                          | ${"2024-02-03"}
    ${"2024\u201502\u201503"}                                          | ${"2024-02-03"}
    ${"AM\u2013PM"}                                                    | ${"AM - PM"}
    ${"AM\u2014PM"}                                                    | ${"AM - PM"}
    ${"AM\u2212PM"}                                                    | ${"AM - PM"}
    ${"A\u2009B"}                                                      | ${"A B"}
    ${"A\u2002B"}                                                      | ${"A B"}
    ${"A\u2003B"}                                                      | ${"A B"}
    ${"A\u2004B"}                                                      | ${"A B"}
    ${"A\u2005B"}                                                      | ${"A B"}
    ${"A\u2006B"}                                                      | ${"A B"}
    ${"A\u2007B"}                                                      | ${"A B"}
    ${"A\u2008B"}                                                      | ${"A B"}
    ${"A\u200AB"}                                                      | ${"A B"}
    ${"  \u00A0  \u202F  \u2009  "}                                    | ${""}
    ${"a\u030Ab"}                                                      | ${"\u00E5b"}
    ${"cafe\u0301"}                                                    | ${"caf\u00E9"}
    ${"hello\u200Dworld"}                                              | ${"helloworld"}
    ${"\u2066hello\u2067"}                                             | ${"hello"}
    ${"\u2068hello\u2069"}                                             | ${"hello"}
    ${"\u200D\u200C\u2066\u2067\u2068\u2069"}                          | ${""}
    ${"GMT+02:00"}                                                     | ${"GMT+02:00"}
    ${"  GMT+02:00  "}                                                 | ${"GMT+02:00"}
    ${"\tGMT+02:00\t"}                                                 | ${"GMT+02:00"}
    ${"2024-02-29T10:00:00"}                                           | ${"2024-02-29T10:00:00"}
    ${"2024-02-29T10:00:00.123"}                                       | ${"2024-02-29T10:00:00.123"}
    ${"2024-02-29T10:00:00.123456"}                                    | ${"2024-02-29T10:00:00.123456"}
    ${"2024-02-29T10:00:00Z"}                                          | ${"2024-02-29T10:00:00Z"}
    ${"2024-02-29T10:00:00+02:00"}                                     | ${"2024-02-29T10:00:00+02:00"}
  `("normalizes $input -> $expected", ({ input, expected }) => {
    expect(normalizeDateTime(input)).toBe(expected);
  });

  it("applies lowercase when requested", () => {
    expect(normalizeDateTime("Hello WORLD", { lower: true })).toBe(
      "hello world",
    );
  });

  it("applies lowercase with custom locale", () => {
    expect(normalizeDateTime("HELLO", { lower: true, locale: "en-US" })).toBe(
      "hello",
    );
    expect(normalizeDateTime("HELLO", { lower: true, locale: "tr-TR" })).toBe(
      "hello",
    );
  });

  it.each`
    input       | locale     | expected
    ${"HELLO"}  | ${"en-US"} | ${"hello"}
    ${"WORLD"}  | ${"en-GB"} | ${"world"}
    ${"TEST"}   | ${"de-DE"} | ${"test"}
    ${"DATA"}   | ${"fr-FR"} | ${"data"}
    ${"INFO"}   | ${"es-ES"} | ${"info"}
    ${"TIME"}   | ${"it-IT"} | ${"time"}
    ${"DATE"}   | ${"pt-PT"} | ${"date"}
    ${"GMT"}    | ${"sv-SE"} | ${"gmt"}
    ${"UTC"}    | ${"is-IS"} | ${"utc"}
    ${"测试"}   | ${"zh-CN"} | ${"测试"}
    ${"測試"}   | ${"zh-TW"} | ${"測試"}
    ${"テスト"} | ${"ja-JP"} | ${"テスト"}
    ${"테스트"} | ${"ko-KR"} | ${"테스트"}
    ${"اختبار"} | ${"ar-SA"} | ${"اختبار"}
    ${"בדיקה"}  | ${"he-IL"} | ${"בדיקה"}
    ${"ТЕСТ"}   | ${"ru-RU"} | ${"тест"}
    ${"TEST"}   | ${"tr-TR"} | ${"test"}
  `(
    "applies lowercase for locale $locale: $input -> $expected",
    ({ input, locale, expected }) => {
      expect(normalizeDateTime(input, { lower: true, locale })).toBe(expected);
    },
  );

  it("does not lowercase by default", () => {
    expect(normalizeDateTime("Hello WORLD")).toBe("Hello WORLD");
  });

  it.each`
    input
    ${null}
    ${undefined}
    ${123}
    ${-123}
    ${0}
    ${{}}
    ${[]}
    ${true}
    ${false}
    ${() => {}}
    ${Symbol("test")}
  `("returns empty string for non-string input: $input", ({ input }) => {
    expect(normalizeDateTime(input as unknown as string)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeDateTime("")).toBe("");
  });

  it("returns single space input as empty after trim", () => {
    expect(normalizeDateTime(" ")).toBe("");
  });

  it("handles strings with only format characters", () => {
    expect(normalizeDateTime("\u200E\u200F\u200B")).toBe("");
  });

  it("preserves ASCII characters unchanged", () => {
    expect(normalizeDateTime("Hello World 123")).toBe("Hello World 123");
  });

  it("handles multiple consecutive spaces", () => {
    expect(normalizeDateTime("a    b")).toBe("a b");
  });

  it("handles mixed whitespace types", () => {
    expect(normalizeDateTime("a\t\n\r b")).toBe("a b");
  });
});
