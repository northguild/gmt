import { asSchema, type FlexibleSchema } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DOX_TOOL_INPUTS,
  ENABLED_TOOL_DOCS,
  ENABLED_TOOL_NAMES,
  type EnabledToolName,
} from "../src/lib/dox-tools";
import { buildWorkerTools } from "../worker/tools";
import { refinementMessages, toolSchemaFile } from "./export-tool-schemas";

const DRAFT_07 = "http://json-schema.org/draft-07/schema#";

/** Expected `rules` per tool, from the spec table; every other tool has none. */
const EXPECTED_RULES: Partial<Record<EnabledToolName, string[]>> = {
  showX12TimeReader: ["Send a date, a time or a DTP value."],
  showGnssWeekDecoder: [
    "broadcast needs counter, week, timeOfWeekSeconds and exactly one of rolloverEra and rolloverNotBefore; rinex needs system, week and timeOfWeekSeconds; utc needs utc.",
  ],
  showGnssRolloverChecker: [
    "Send exactly one of firmwareNotBefore and firmwareEra.",
  ],
  showLeapSecondTimeline: ["Send a date, a check, a from or a to."],
};

const SHOW_GLOBE_SCHEMA =
  '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"zone":{"type":"string","minLength":1,"maxLength":64,"pattern":"^[A-Za-z0-9_+-]+(\\\\/[A-Za-z0-9_+-]+){0,2}$"}},"required":["zone"],"additionalProperties":false}';

/** The slice of zod's public and `_zod` surface the walk reads. */
interface Node {
  _zod: {
    def: {
      type: string;
      shape?: Record<string, Node>;
      element?: Node;
      innerType?: Node;
      checks?: { _zod: { def: { check?: string; error?: unknown } } }[];
    };
    bag: { minimum?: number; maximum?: number; patterns?: Set<RegExp> };
  };
  minLength?: number | null;
  maxLength?: number | null;
  isInt?: boolean;
  minValue?: number | null;
  maxValue?: number | null;
  options?: string[];
}

type Json = Record<string, unknown>;

/** Walk a zod schema beside its JSON Schema; each mismatch names the tool and the path. */
function compare(node: Node, json: Json, path: string, out: string[]): void {
  const def = node._zod.def;
  switch (def.type) {
    case "optional":
      compare(def.innerType as Node, json, path, out);
      return;
    case "object": {
      const shape = def.shape ?? {};
      const props = (json.properties ?? {}) as Record<string, Json>;
      const keys = Object.keys(shape).sort();
      if (JSON.stringify(Object.keys(props).sort()) !== JSON.stringify(keys)) {
        out.push(`${path}: properties ${Object.keys(props)} != keys ${keys}`);
      }
      const required = Object.entries(shape)
        .filter(([, child]) => child._zod.def.type !== "optional")
        .map(([key]) => key)
        .sort();
      const actual = [
        ...((json.required as string[] | undefined) ?? []),
      ].sort();
      if (JSON.stringify(actual) !== JSON.stringify(required)) {
        out.push(`${path}: required ${actual} != ${required}`);
      }
      for (const [key, child] of Object.entries(shape)) {
        if (props[key]) compare(child, props[key], `${path}.${key}`, out);
      }
      return;
    }
    case "string": {
      if (json.type !== "string")
        out.push(`${path}: type ${json.type} != string`);
      if (json.minLength !== (node.minLength ?? undefined)) {
        out.push(`${path}: minLength ${json.minLength} != ${node.minLength}`);
      }
      if (json.maxLength !== (node.maxLength ?? undefined)) {
        out.push(`${path}: maxLength ${json.maxLength} != ${node.maxLength}`);
      }
      const patterns = [...(node._zod.bag.patterns ?? [])].map(
        (re) => re.source,
      );
      if (patterns.length > 1) out.push(`${path}: more than one pattern`);
      if (json.pattern !== patterns[0]) {
        out.push(`${path}: pattern ${json.pattern} != ${patterns[0]}`);
      }
      return;
    }
    case "number": {
      const type = node.isInt ? "integer" : "number";
      if (json.type !== type) out.push(`${path}: type ${json.type} != ${type}`);
      const min = Number.isFinite(node.minValue) ? node.minValue : undefined;
      const max = Number.isFinite(node.maxValue) ? node.maxValue : undefined;
      if (json.minimum !== (min ?? undefined)) {
        out.push(`${path}: minimum ${json.minimum} != ${min}`);
      }
      if (json.maximum !== (max ?? undefined)) {
        out.push(`${path}: maximum ${json.maximum} != ${max}`);
      }
      return;
    }
    case "enum":
      if (JSON.stringify(json.enum) !== JSON.stringify(node.options)) {
        out.push(
          `${path}: enum ${JSON.stringify(json.enum)} != ${JSON.stringify(node.options)}`,
        );
      }
      return;
    case "array": {
      if (json.type !== "array")
        out.push(`${path}: type ${json.type} != array`);
      const { minimum, maximum } = node._zod.bag;
      if (json.minItems !== minimum)
        out.push(`${path}: minItems ${json.minItems} != ${minimum}`);
      if (json.maxItems !== maximum)
        out.push(`${path}: maxItems ${json.maxItems} != ${maximum}`);
      compare(def.element as Node, json.items as Json, `${path}[]`, out);
      return;
    }
    default:
      out.push(`${path}: the walk does not know zod type "${def.type}"`);
  }
}

/** Every refinement in the schema, with its message (undefined when it has none). */
function customChecks(node: Node): (string | undefined)[] {
  const found: (string | undefined)[] = [];
  const def = node._zod.def;
  for (const check of def.checks ?? []) {
    if (check._zod.def.check !== "custom") continue;
    const error = check._zod.def.error;
    const message = typeof error === "function" ? error({}) : undefined;
    found.push(
      typeof message === "string" && message !== "" ? message : undefined,
    );
  }
  for (const child of Object.values(def.shape ?? {}))
    found.push(...customChecks(child));
  if (def.element) found.push(...customChecks(def.element));
  if (def.innerType) found.push(...customChecks(def.innerType));
  return found;
}

describe("tool-schemas.json", () => {
  it("matches what the Worker sends streamText, tool by tool", async () => {
    const { tools } = await toolSchemaFile();
    const worker = buildWorkerTools();
    for (const entry of tools) {
      const live = worker[entry.name] as unknown as {
        description: string;
        inputSchema: FlexibleSchema<unknown>;
      };
      expect(entry.description, entry.name).toBe(live.description);
      expect(entry.inputSchema, entry.name).toEqual(
        await asSchema(live.inputSchema).jsonSchema,
      );
    }
  });

  it("lists the offered tools in prompt order with the doc's when and args", async () => {
    const { tools } = await toolSchemaFile();
    expect(tools.map((t) => t.name)).toEqual(
      ENABLED_TOOL_DOCS.map((d) => d.name),
    );
    expect(tools).toHaveLength(ENABLED_TOOL_NAMES.length);
    tools.forEach((tool, i) => {
      expect(tool.description).toBe(ENABLED_TOOL_DOCS[i].purpose);
      expect(tool.when).toBe(ENABLED_TOOL_DOCS[i].when);
      expect(tool.args).toBe(ENABLED_TOOL_DOCS[i].args);
    });
  });

  it("loses no constraint of any zod schema in the conversion", async () => {
    const { tools } = await toolSchemaFile();
    const failures: string[] = [];
    for (const tool of tools) {
      compare(
        DOX_TOOL_INPUTS[tool.name] as unknown as Node,
        tool.inputSchema as Json,
        tool.name,
        failures,
      );
    }
    expect(failures).toEqual([]);
  });

  it("carries each cross-field rule as text, and no others", async () => {
    const { tools } = await toolSchemaFile();
    for (const tool of tools) {
      expect(tool.rules, tool.name).toEqual(EXPECTED_RULES[tool.name] ?? []);
    }
  });

  it.each([
    ["showX12TimeReader", {}],
    ["showLeapSecondTimeline", {}],
    ["showGnssRolloverChecker", { counter: "GPS-LNAV" }],
    ["showGnssWeekDecoder", { mode: "utc" }],
  ] as const)(
    "%s: an input that breaks only the rule fails with its message",
    (name, input) => {
      const result = DOX_TOOL_INPUTS[name].safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((i) => i.message)).toEqual(
          EXPECTED_RULES[name],
        );
      }
    },
  );

  it("refinementMessages reads a string message and throws on a bare refine", () => {
    const base = z.object({ a: z.string().optional() });
    expect(refinementMessages(base.refine(() => true, "text"))).toEqual([
      "text",
    ]);
    expect(
      refinementMessages(base.refine(() => true, { message: "obj" })),
    ).toEqual(["obj"]);
    expect(() => refinementMessages(base.refine(() => true))).toThrow(
      /no string message/,
    );
    expect(refinementMessages(base)).toEqual([]);
  });

  it("has no reference keywords and names draft-07 on every schema", async () => {
    const file = await toolSchemaFile();
    const text = JSON.stringify(file);
    for (const banned of ['"$ref"', '"definitions"', '"$defs"']) {
      expect(text).not.toContain(banned);
    }
    for (const tool of file.tools) {
      expect(tool.inputSchema.$schema, tool.name).toBe(DRAFT_07);
    }
  });

  it("showGlobe's inputSchema is the pinned literal", async () => {
    const { tools } = await toolSchemaFile();
    const globe = tools.find((t) => t.name === "showGlobe");
    expect(JSON.stringify(globe?.inputSchema)).toBe(SHOW_GLOBE_SCHEMA);
  });

  describe("every offered tool's refinements have a message", () => {
    it.each([...ENABLED_TOOL_NAMES])("%s", (name) => {
      const messages = customChecks(DOX_TOOL_INPUTS[name] as unknown as Node);
      for (const message of messages) {
        expect(
          message,
          `${name}: a .refine/.superRefine without a message`,
        ).toBeTruthy();
      }
    });
  });
});
