import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findLicenceProblems } from "../../../scripts/licences.mjs";

const MIT = "MIT License\n\nCopyright (c) 2026 NorthGuild\n";
const RESERVED = "Copyright (c) 2026 NorthGuild. All rights reserved.\n";
const NOTICE =
  "Copyright (c) 2026 NorthGuild. All rights reserved under [`.agents/LICENSE`](.agents/LICENSE); the root MIT licence does not apply to this file.\n";

/** A repository with the licence layout the check expects; `files` overrides or adds files. */
function repo(files: Record<string, string> = {}): {
  root: string;
  paths: string[];
} {
  const root = mkdtempSync(join(tmpdir(), "gmt-licences-"));
  const all: Record<string, string> = {
    LICENSE: MIT,
    "AGENTS.md": `# Agent guide\n\n${NOTICE}`,
    "CLAUDE.md": `# Entry point\n\n${NOTICE}`,
    ".agents/LICENSE": RESERVED,
    "packages/gmt/LICENSE": MIT,
    ...files,
  };
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return { root, paths: Object.keys(all) };
}

describe("licences check", () => {
  it("passes the expected layout", () => {
    const { root, paths } = repo();
    expect(findLicenceProblems(root, paths)).toEqual([]);
  });

  it.each(["AGENTS.md", "CLAUDE.md"])(
    "fails when the root %s lacks its reserved notice",
    (file) => {
      const { root, paths } = repo({ [file]: "# Title\n\nNo notice.\n" });
      expect(findLicenceProblems(root, paths)).toEqual([
        `${file}: the agent entry point must carry the all-rights-reserved notice for .agents/LICENSE`,
      ]);
    },
  );

  it("fails a reserved folder without its LICENSE", () => {
    const { root, paths } = repo({ "context/notes.md": "x\n" });
    expect(findLicenceProblems(root, paths)).toEqual([
      "context/LICENSE: a folder outside packages/ must reserve all rights",
    ]);
  });
});
