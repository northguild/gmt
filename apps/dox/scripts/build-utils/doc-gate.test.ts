import { describe, expect, it } from "vitest";
import {
  countOptionDeclarations,
  findGaps,
  formatGapReport,
  type Gap,
  type GateFunction,
  type GateInput,
  type GateType,
  optionNamesIn,
} from "./doc-gate";
import type { PropertyDoc } from "./render-table";

const FILE = "packages/gmt/src/plain/calculate/addDate.ts";

/** A fully documented optional property; each test removes what its rule looks for. */
function prop(over: Partial<PropertyDoc> = {}): PropertyDoc {
  return {
    name: "overflow",
    optional: true,
    type: "string",
    typeRefs: [],
    description: "How an out-of-range day is resolved.",
    defaultValue: '`"constrain"`',
    fromLib: false,
    source: { file: FILE, line: 30 },
    ...over,
  };
}

function fn(over: Partial<GateFunction> = {}): GateFunction {
  return {
    name: "addDate",
    namespace: "plain",
    file: FILE,
    line: 40,
    declaredParams: ["value", "options"],
    documentedParams: [
      { name: "value", line: 20 },
      { name: "options", line: 21 },
    ],
    options: [],
    ...over,
  };
}

function type(over: Partial<GateType> = {}): GateType {
  return {
    name: "Dwell",
    namespace: "transport",
    file: "packages/gmt/src/transport/calculate/dwellTime.ts",
    line: 12,
    description: "The time between an arrival and a departure.",
    members: [],
    input: false,
    orphan: false,
    ...over,
  };
}

const gapsOf = (input: Partial<GateInput>): Gap[] =>
  findGaps({ functions: [], types: [], ...input });
const rulesOf = (input: Partial<GateInput>): string[] =>
  gapsOf(input).map((g) => g.rule);

const withOption = (row: PropertyDoc): Partial<GateInput> => ({
  functions: [fn({ options: [{ param: "options", rows: [row] }] })],
});

describe("findGaps", () => {
  it("reports nothing for fully documented input", () => {
    expect(
      gapsOf({
        functions: [fn({ options: [{ param: "options", rows: [prop()] }] })],
        types: [
          type({
            members: [
              prop({
                name: "duration",
                optional: false,
                defaultValue: undefined,
                source: { file: type().file, line: 14 },
              }),
            ],
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("type-description: a public type with an empty description", () => {
    expect(gapsOf({ types: [type({ description: " " })] })).toEqual([
      {
        rule: "type-description",
        file: "packages/gmt/src/transport/calculate/dwellTime.ts",
        line: 12,
        subject: "Dwell",
        namespace: "transport",
        reason: "public type has no description",
      },
    ]);
    expect(rulesOf({ types: [type()] })).toEqual([]);
  });

  it("member-description: a member of a public type with no description", () => {
    const member = prop({ name: "duration", optional: false, description: "" });
    const gaps = gapsOf({ types: [type({ members: [member] })] });
    expect(gaps.map((g) => [g.rule, g.subject, g.line])).toEqual([
      ["member-description", "Dwell.duration", 30],
    ]);
    expect(
      rulesOf({
        types: [type({ members: [prop({ name: "d", optional: false })] })],
      }),
    ).toEqual([]);
  });

  it("option-description: an option property with no description", () => {
    const gaps = gapsOf(withOption(prop({ description: "" })));
    expect(gaps.map((g) => [g.rule, g.subject])).toEqual([
      ["option-description", "addDate.options.overflow"],
    ]);
    expect(rulesOf(withOption(prop()))).toEqual([]);
  });

  it("default-value: an optional option with no @defaultValue", () => {
    expect(rulesOf(withOption(prop({ defaultValue: undefined })))).toEqual([
      "default-value",
    ]);
    // A required option has nothing to default to.
    expect(
      rulesOf(withOption(prop({ optional: false, defaultValue: undefined }))),
    ).toEqual([]);
  });

  it("default-value: an optional member of an input type, but not of a return-only type", () => {
    const member = prop({ defaultValue: undefined });
    expect(
      rulesOf({ types: [type({ input: true, members: [member] })] }),
    ).toEqual(["default-value"]);
    expect(
      rulesOf({ types: [type({ input: false, members: [member] })] }),
    ).toEqual([]);
  });

  it("default-tag: @default used instead of @defaultValue, reported once", () => {
    expect(
      rulesOf(
        withOption(prop({ defaultValue: undefined, usesDefaultTag: true })),
      ),
    ).toEqual(["default-tag"]);
    expect(rulesOf(withOption(prop()))).toEqual([]);
  });

  it("list-in-description: a property description that holds a list", () => {
    expect(rulesOf(withOption(prop({ hasList: true })))).toEqual([
      "list-in-description",
    ]);
  });

  it("param-name: a @param that names no parameter", () => {
    const gaps = gapsOf({
      functions: [
        fn({
          declaredParams: ["valueInput", "optionsArg"],
          documentedParams: [
            { name: "value", line: 20 },
            { name: "options", line: 21 },
            { name: "options.unit", line: 22 },
            { name: "optionsArg", line: 23 },
          ],
        }),
      ],
    });
    expect(gaps.map((g) => [g.rule, g.line, g.subject, g.reason])).toEqual([
      [
        "param-name",
        20,
        "addDate(@param value)",
        "@param value documents the parameter declared valueInput",
      ],
      [
        "param-name",
        21,
        "addDate(@param options)",
        "@param options names no parameter (valueInput, optionsArg)",
      ],
      [
        "param-name",
        22,
        "addDate(@param options.unit)",
        "@param options.unit is a dotted name; document the property on its declaration",
      ],
    ]);
    expect(rulesOf({ functions: [fn()] })).toEqual([]);
  });

  it("param-name: a named member of a rest tuple is a parameter", () => {
    expect(
      rulesOf({
        functions: [
          fn({
            declaredParams: ["stepDays", "options"],
            documentedParams: [
              { name: "stepDays", line: 20 },
              { name: "options", line: 21 },
            ],
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("orphan-type: a public type no public function reaches", () => {
    expect(rulesOf({ types: [type({ orphan: true })] })).toEqual([
      "orphan-type",
    ]);
  });

  it("checks a property once per declaration, however many functions and types expose it", () => {
    const shared = prop({ description: "", defaultValue: undefined });
    const input: GateInput = {
      types: [
        type({ name: "RoundingOptions", input: true, members: [shared] }),
      ],
      functions: [
        fn({
          name: "roundDate",
          options: [{ param: "options", rows: [shared] }],
        }),
        fn({
          name: "roundTime",
          options: [{ param: "options", rows: [shared] }],
        }),
      ],
    };
    // Reported under the type that declares it, with both of its gaps, once.
    expect(findGaps(input).map((g) => [g.rule, g.subject])).toEqual([
      ["default-value", "RoundingOptions.overflow"],
      ["member-description", "RoundingOptions.overflow"],
    ]);
    expect(countOptionDeclarations(input)).toBe(1);
  });

  it("counts an option a return-only type declares as an input once a function takes it", () => {
    const shared = prop({ defaultValue: undefined });
    expect(
      rulesOf({
        types: [type({ input: false, members: [shared] })],
        functions: [fn({ options: [{ param: "options", rows: [shared] }] })],
      }),
    ).toEqual(["default-value"]);
  });

  it("never checks a property a TypeScript lib file declares", () => {
    const lib = prop({
      name: "weekday",
      description: "",
      defaultValue: undefined,
      fromLib: true,
      source: { file: "node_modules/typescript/lib/lib.es5.d.ts", line: 4400 },
    });
    const input = withOption(lib);
    expect(gapsOf(input)).toEqual([]);
    expect(
      countOptionDeclarations({ functions: [], types: [], ...input }),
    ).toBe(0);
    expect(rulesOf({ types: [type({ input: true, members: [lib] })] })).toEqual(
      [],
    );
  });

  it("files a property under the namespace of the file that declares it", () => {
    const declaredInTypes = prop({
      description: "",
      source: { file: "packages/gmt/src/types/rounding-options.ts", line: 9 },
    });
    expect(gapsOf(withOption(declaredInTypes))[0].namespace).toBe("types");
  });
});

describe("formatGapReport", () => {
  it("lists gaps by file then line, then the total and the counts by rule and namespace", () => {
    const gaps: Gap[] = [
      {
        rule: "option-description",
        file: "packages/gmt/src/zoned/a.ts",
        line: 9,
        subject: "f.options.unit",
        namespace: "zoned",
        reason: "option has no description",
      },
      {
        rule: "default-value",
        file: "packages/gmt/src/plain/b.ts",
        line: 40,
        subject: "g.options.zone",
        namespace: "plain",
        reason: "optional input property has no @defaultValue",
      },
      {
        rule: "option-description",
        file: "packages/gmt/src/plain/b.ts",
        line: 7,
        subject: "g.options.unit",
        namespace: "plain",
        reason: "option has no description",
      },
    ];
    expect(formatGapReport(gaps).split("\n")).toEqual([
      "packages/gmt/src/plain/b.ts:7  g.options.unit  option has no description",
      "packages/gmt/src/plain/b.ts:40  g.options.zone  optional input property has no @defaultValue",
      "packages/gmt/src/zoned/a.ts:9  f.options.unit  option has no description",
      "",
      "3 gaps",
      "",
      "By rule:",
      "  default-value  1",
      "  option-description  2",
      "",
      "By namespace:",
      "  plain  2",
      "  zoned  1",
    ]);
  });

  it("reports an empty list as zero gaps", () => {
    expect(formatGapReport([])).toBe("0 gaps");
  });
});

describe("nested option members", () => {
  const child = (over: Partial<PropertyDoc> = {}): PropertyDoc =>
    prop({
      name: "allowEqual",
      source: { file: FILE, line: 32 },
      ...over,
    });
  const parent = (children: PropertyDoc[]): PropertyDoc =>
    prop({
      name: "options",
      type: "object",
      source: { file: FILE, line: 28 },
      children,
    });

  it("checks a nested member by the option rules, under a dotted subject", () => {
    const gaps = gapsOf(
      withOption(parent([child({ description: "", defaultValue: undefined })])),
    );
    expect(gaps.map((g) => `${g.rule} ${g.subject} :${g.line}`)).toEqual([
      "default-value addDate.options.options.allowEqual :32",
      "option-description addDate.options.options.allowEqual :32",
    ]);
  });

  it("reports nothing for a documented nested member", () => {
    expect(gapsOf(withOption(parent([child()])))).toEqual([]);
  });

  it("counts a nested member as an option declaration", () => {
    expect(
      countOptionDeclarations({
        functions: [
          fn({
            options: [{ param: "props", rows: [parent([child()])] }],
          }),
        ],
        types: [],
      }),
    ).toBe(2);
  });
});

describe("members of an inline return literal", () => {
  const member = (over: Partial<PropertyDoc> = {}): PropertyDoc =>
    prop({
      name: "quarter",
      optional: false,
      defaultValue: undefined,
      source: { file: FILE, line: 49 },
      ...over,
    });

  it("requires a description and no @defaultValue", () => {
    const gaps = gapsOf({
      functions: [
        fn({
          returnMembers: [
            member(),
            member({ name: "year", description: "" }),
            member({ name: "opt", optional: true, description: "Some." }),
          ],
        }),
      ],
    });
    expect(gaps.map((g) => `${g.rule} ${g.subject} :${g.line}`)).toEqual([
      "return-description addDate.returns.year :49",
    ]);
  });

  it("names an array's members returns[]", () => {
    const gaps = gapsOf({
      functions: [
        fn({
          returnsItems: true,
          returnMembers: [member({ name: "type", description: "" })],
        }),
      ],
    });
    expect(gaps.map((g) => g.subject)).toEqual(["addDate.returns[].type"]);
  });
});

describe("optionNamesIn", () => {
  const names = ["round", "unit", "increment", "allowEqual"];

  it("matches a name in a code span, whole word only", () => {
    expect(optionNamesIn("Pass `round` to change it", names)).toEqual([
      "round",
    ]);
    expect(optionNamesIn("Pass `{ allowEqual }` to change it", names)).toEqual([
      "allowEqual",
    ]);
    expect(optionNamesIn("Pass `rounded` to change it", names)).toEqual([]);
  });

  it("matches two or more names in a list", () => {
    expect(optionNamesIn("Sets unit, increment and round.", names)).toEqual([
      "round",
      "unit",
      "increment",
    ]);
    expect(optionNamesIn("unit / increment", names)).toEqual([
      "unit",
      "increment",
    ]);
  });

  it("leaves ordinary prose alone, one name included", () => {
    expect(optionNamesIn("How the result is rounded", names)).toEqual([]);
    expect(optionNamesIn("Round the result to a unit", names)).toEqual([]);
    expect(optionNamesIn("The unit and a precision", names)).toEqual([]);
    expect(optionNamesIn("", names)).toEqual([]);
  });

  it("is reported by findGaps against the @param tag's line", () => {
    const gaps = gapsOf({
      functions: [
        fn({
          options: [
            {
              param: "options",
              lead: "The `overflow` setting",
              rows: [prop()],
            },
          ],
        }),
      ],
    });
    expect(gaps.map((g) => `${g.rule} ${g.subject} :${g.line}`)).toEqual([
      "param-lists-options addDate(@param options) :21",
    ]);
  });
});
