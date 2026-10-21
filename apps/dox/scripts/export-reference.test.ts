import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  EXPORT_FORMAT,
  exportReference,
  parseOutDir,
} from "./export-reference";
import { toolSchemaFile } from "./export-tool-schemas";

const generatedCorpus = join(
  import.meta.dirname,
  "../src/generated/reference/gmt-corpus.json",
);
const gmtPackage = join(
  import.meta.dirname,
  "../../../packages/gmt/package.json",
);

const REQUIRED_KEYS = [
  "url",
  "page",
  "name",
  "namespace",
  "module",
  "kind",
  "signature",
  "description",
  "sourcePath",
  "examples",
];
const OPTIONAL_KEYS = ["inlineOn", "members"];

const made: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "gmt-export-"));
  made.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of made.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("exportReference", () => {
  let out: string;
  let again: string;

  beforeAll(async () => {
    out = mkdtempSync(join(tmpdir(), "gmt-export-"));
    again = mkdtempSync(join(tmpdir(), "gmt-export-"));
    await exportReference(out);
    await exportReference(again);
  }, 120_000);

  afterAll(() => {
    rmSync(out, { recursive: true, force: true });
    rmSync(again, { recursive: true, force: true });
  });

  it("copies the generated corpus byte for byte", () => {
    expect(
      readFileSync(join(out, "gmt-corpus.json")).equals(
        readFileSync(generatedCorpus),
      ),
    ).toBe(true);
  });

  it("keeps every corpus entry inside the documented keys", () => {
    const entries = JSON.parse(
      readFileSync(join(out, "gmt-corpus.json"), "utf8"),
    ) as Record<string, unknown>[];
    expect(entries.length).toBeGreaterThan(0);
    const allowed = new Set([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);
    for (const entry of entries) {
      const keys = Object.keys(entry);
      expect(
        keys.filter((k) => !allowed.has(k)),
        `${String(entry.url)}: a key outside the format`,
      ).toEqual([]);
      expect(
        REQUIRED_KEYS.filter((k) => !keys.includes(k)),
        `${String(entry.url)}: a required key is missing`,
      ).toEqual([]);
    }
  });

  it("writes tool-schemas.json as the tool schema file plus one newline", async () => {
    const text = readFileSync(join(out, "tool-schemas.json"), "utf8");
    expect(JSON.parse(text)).toEqual(await toolSchemaFile());
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });

  it("writes the manifest", () => {
    const version = (
      JSON.parse(readFileSync(gmtPackage, "utf8")) as { version: string }
    ).version;
    expect(EXPORT_FORMAT).toBe(1);
    expect(
      JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")),
    ).toEqual({
      format: 1,
      gmtVersion: version,
      files: { corpus: "gmt-corpus.json", toolSchemas: "tool-schemas.json" },
    });
  });

  it("is deterministic: two exports are byte-equal", () => {
    for (const file of [
      "manifest.json",
      "gmt-corpus.json",
      "tool-schemas.json",
    ]) {
      expect(
        readFileSync(join(out, file)).equals(readFileSync(join(again, file))),
        file,
      ).toBe(true);
    }
  });

  it("leaves other files alone and overwrites its own", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "keep.txt"), "mine");
    writeFileSync(join(dir, "tool-schemas.json"), "stale");
    await exportReference(dir);
    expect(readFileSync(join(dir, "keep.txt"), "utf8")).toBe("mine");
    expect(
      JSON.parse(readFileSync(join(dir, "tool-schemas.json"), "utf8")),
    ).toEqual(await toolSchemaFile());
  });

  it("creates a nested directory that does not exist", async () => {
    const dir = join(tempDir(), "a", "b");
    await exportReference(dir);
    expect(readFileSync(join(dir, "manifest.json"), "utf8")).toContain(
      '"format": 1',
    );
  });
});

describe("parseOutDir", () => {
  it("reads an absolute path in both spellings", () => {
    expect(parseOutDir(["--out", "/abs/dir"])).toEqual({ outDir: "/abs/dir" });
    expect(parseOutDir(["--out=/abs/dir"])).toEqual({ outDir: "/abs/dir" });
  });

  it("drops one leading --", () => {
    expect(parseOutDir(["--", "--out", "/abs"])).toEqual({ outDir: "/abs" });
  });

  it("refuses a missing or empty --out", () => {
    const missing = parseOutDir([]);
    expect(missing).toHaveProperty("error");
    expect((missing as { error: string }).error).toContain("--out");
    const empty = parseOutDir(["--out", ""]);
    expect((empty as { error: string }).error).toContain("--out");
  });

  it("refuses a relative path", () => {
    const result = parseOutDir(["--out", "vendor/x"]);
    expect((result as { error: string }).error).toMatch(/absolute/);
  });

  it("refuses an unknown option", () => {
    expect(parseOutDir(["--bogus"])).toHaveProperty("error");
  });
});

describe("export-reference CLI", () => {
  it("exits 1 with a usage line when --out is missing", () => {
    const run = spawnSync(
      process.execPath,
      ["--import", "tsx", join(import.meta.dirname, "export-reference.ts")],
      { encoding: "utf8" },
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("usage:");
  });
});
