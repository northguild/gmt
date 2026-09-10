/// <reference types="vitest/globals" />
import type { CorpusEntry } from "~/reference-types";
import { buildFunctionChunks } from "./function-chunks";

const ENTRY: CorpusEntry = {
  url: "/reference/zoned/convert/convertZonedToZoned",
  name: "convertZonedToZoned",
  namespace: "zoned",
  module: "convert",
  kind: "function",
  signature:
    "convertZonedToZoned(value: string, from: string, to: string): string",
  description: "Convert a wall-clock time from one IANA zone to another.",
  sourcePath: "packages/gmt/src/zoned/convert/convertZonedToZoned.ts",
  examples: [
    {
      call: 'convertZonedToZoned("2026-03-08T09:00:00", "A", "B")',
      result: '"2026-03-08T23:00:00"',
    },
  ],
};

describe("buildFunctionChunks", () => {
  it("carries the entry's own URL and namespace", () => {
    const [chunk] = buildFunctionChunks([ENTRY]);
    expect(chunk.url).toBe(ENTRY.url);
    expect(chunk.namespace).toBe("zoned");
    expect(chunk.kind).toBe("function");
    expect(chunk.title).toBe("convertZonedToZoned");
  });

  it("includes the signature, description, and every example in the text", () => {
    const [chunk] = buildFunctionChunks([ENTRY]);
    expect(chunk.text).toContain(ENTRY.signature);
    expect(chunk.text).toContain(ENTRY.description);
    expect(chunk.text).toContain('convertZonedToZoned("2026-03-08T09:00:00"');
  });

  it("omits the signature line for non-function entries", () => {
    const typeEntry: CorpusEntry = {
      ...ENTRY,
      kind: "type",
      signature: "",
      name: "ZonedResult",
    };
    const [chunk] = buildFunctionChunks([typeEntry]);
    expect(chunk.text).not.toContain("convertZonedToZoned(value");
  });

  it("produces one chunk per entry, ids scoped by namespace/module/name", () => {
    const chunks = buildFunctionChunks([ENTRY, { ...ENTRY, name: "other" }]);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].id).toBe("zoned/convert/convertZonedToZoned");
    expect(new Set(chunks.map((c) => c.id)).size).toBe(2);
  });
});
