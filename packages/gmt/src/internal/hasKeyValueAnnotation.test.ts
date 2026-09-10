import { hasCalendarAnnotation } from "./hasCalendarAnnotation";
import { hasKeyValueAnnotation } from "./hasKeyValueAnnotation";

describe("hasKeyValueAnnotation", () => {
  it.each`
    value                                                         | description
    ${"2024-07-15T12:00:00-04:00[u-ca=hebrew]"}                   | ${"a calendar annotation"}
    ${"2024-07-15T12:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"a calendar annotation after a zone"}
    ${"2024-07-15T12:00:00-04:00[foo=bar]"}                       | ${"an unknown annotation"}
    ${"2024-07-15T12:00:00-04:00[!foo=bar]"}                      | ${"a critical unknown annotation"}
    ${"2024-07-15T12:00:00-04:00[America/New_York][foo=bar]"}     | ${"an unknown annotation after a zone"}
    ${"2024-07-15T12:00:00-04:00[x-provenance=estimated]"}        | ${"an extension annotation"}
    ${"2024-07-15T12:00:00-04:00[u-ca=hebrew;era=heisei]"}        | ${"GMT's own multi-key annotation"}
  `("returns true for $description", ({ value }) => {
    expect(hasKeyValueAnnotation(value)).toBe(true);
  });

  it.each`
    value                                             | description
    ${"2024-07-15T12:00:00-04:00[America/New_York]"}  | ${"a bracketed IANA zone"}
    ${"2024-07-15T12:00:00-04:00[!America/New_York]"} | ${"a critical bracketed zone"}
    ${"2024-07-15T12:00:00-04:00[-04:00]"}            | ${"a bracketed offset time zone"}
    ${"2024-07-15T12:00:00-04:00[EST5EDT]"}           | ${"a slash-less zone identifier"}
    ${"2024-07-15T12:00:00-04:00"}                    | ${"no annotation at all"}
    ${"2024-07-15T12:00:00Z"}                         | ${"a bare instant"}
    ${"2024-07-15"}                                   | ${"a bare date"}
    ${"a=b"}                                          | ${"an equals sign outside any bracket"}
    ${""}                                             | ${"an empty string"}
  `("returns false for $description", ({ value }) => {
    expect(hasKeyValueAnnotation(value)).toBe(false);
  });

  it.each`
    input        | description
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${123}       | ${"number"}
    ${true}      | ${"boolean"}
    ${[]}        | ${"array"}
    ${{}}        | ${"object"}
  `("returns false when value is $description", ({ input }) => {
    expect(hasKeyValueAnnotation(input as never)).toBe(false);
  });

  it.each`
    value                                            | description
    ${"2024-07-15T12:00:00-04:00[u-ca=hebrew]"}      | ${"a calendar annotation, which both predicates catch"}
    ${"2024-07-15T12:00:00-04:00[America/New_York]"} | ${"a plain zone, which neither catches"}
  `("agrees with hasCalendarAnnotation on $description", ({ value }) => {
    expect(hasKeyValueAnnotation(value)).toBe(hasCalendarAnnotation(value));
  });

  it("is the wider of the two — an unknown annotation is a key-value one but not a calendar one", () => {
    const value = "2024-07-15T12:00:00-04:00[foo=bar]";

    expect(hasKeyValueAnnotation(value)).toBe(true);
    expect(hasCalendarAnnotation(value)).toBe(false);
  });
});
