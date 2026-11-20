import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  blockReason,
  findProblems,
  hookProblems,
  HOOKED_TOOLS,
  PINS,
} from "../../../scripts/frozen.mjs";

const ROOT = new URL("../../../", import.meta.url).pathname;
const RULE = "context/coding-standards/runtime-workarounds.md";

const settings = (onFailure = "block", matcher = HOOKED_TOOLS.join("|")) => ({
  hooks: {
    PreToolUse: [
      {
        matcher,
        hooks: [
          {
            type: "command",
            command: 'node "$CLAUDE_PROJECT_DIR/scripts/frozen.mjs" hook',
            onFailure,
          },
        ],
      },
    ],
  },
});

/** A checkout holding the pinned rule text, this script and the given settings. */
function repo(rule: string, json: unknown = settings()): string {
  const root = mkdtempSync(join(tmpdir(), "gmt-frozen-"));
  const files: Record<string, string> = {
    [RULE]: rule,
    "scripts/frozen.mjs": "",
    ".claude/settings.json": JSON.stringify(json),
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const pinned = readFileSync(join(ROOT, RULE), "utf8");
const edit = (file_path: string, cwd = ROOT) => ({
  tool_name: "Edit",
  cwd,
  tool_input: { file_path },
});
const bash = (command: string) => ({
  tool_name: "Bash",
  cwd: ROOT,
  tool_input: { command },
});

describe("frozen check", () => {
  it("pins the rule file", () => {
    expect(Object.keys(PINS)).toEqual([RULE]);
  });

  it("passes the repo as committed", () => {
    expect(findProblems(ROOT)).toEqual([]);
  });

  it("fails when the rule text changes by one character", () => {
    const problems = findProblems(repo(`${pinned} `));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`${RULE} is frozen and its text changed`);
  });

  it("fails when the rule file is missing", () => {
    const gone = mkdtempSync(join(tmpdir(), "gmt-frozen-"));
    mkdirSync(join(gone, ".claude"));
    writeFileSync(
      join(gone, ".claude/settings.json"),
      JSON.stringify(settings()),
    );
    expect(findProblems(gone)).toEqual([`${RULE} is missing. It is frozen.`]);
  });

  it.each([
    ["the hook may fail open", settings("ignore")],
    [
      "the matcher leaves out Bash",
      settings("block", "Edit|Write|MultiEdit|NotebookEdit"),
    ],
    ["there is no hook", {}],
  ])("fails when %s", (_, json) => {
    expect(hookProblems(json)).toHaveLength(1);
    expect(findProblems(repo(pinned, json))).toHaveLength(1);
  });

  it("fails when the local settings turn every hook off", () => {
    const root = repo(pinned);
    writeFileSync(
      join(root, ".claude/settings.local.json"),
      JSON.stringify({ disableAllHooks: true }),
    );
    expect(findProblems(root)).toEqual([
      ".claude/settings.local.json sets disableAllHooks, which turns the guard off.",
    ]);
  });
});

describe("frozen hook", () => {
  it.each([
    join(ROOT, RULE),
    RULE,
    "scripts/frozen.mjs",
    ".claude/settings.json",
    ".claude/settings.local.json",
  ])("blocks a file tool writing %s", (path) => {
    expect(blockReason(edit(path))).toMatch(/^BLOCKED: /);
    expect(blockReason({ ...edit(path), tool_name: "Write" })).toMatch(
      /^BLOCKED: /,
    );
  });

  it("blocks a write through a symlink to the rule file", () => {
    const dir = mkdtempSync(join(tmpdir(), "gmt-frozen-link-"));
    symlinkSync(join(ROOT, RULE), join(dir, "link.md"));
    expect(blockReason(edit(join(dir, "link.md")))).toMatch(/^BLOCKED: /);
  });

  it.each([
    "AGENTS.md",
    "packages/gmt/src/internal/temporalCompat/README.md",
    join(tmpdir(), ".claude/settings.json"),
  ])("lets a file tool write %s", (path) => {
    expect(blockReason(edit(path))).toBeUndefined();
  });

  it.each([
    `sed -i '' 's/a/b/' ${RULE}`,
    `echo x >> ${RULE}`,
    `printf x > ./${RULE}`,
    `git checkout origin/main -- ${RULE}`,
    `git restore ${RULE}`,
    `rm ${RULE}`,
    `cp /tmp/x ${RULE}`,
    `python3 -c "open('${RULE}','w')"`,
    `node -e "require('fs').writeFileSync('${RULE}','')"`,
    `perl -pi -e 's/a/b/' ${RULE}`,
    "sed -i '' 's/a/b/' scripts/frozen.mjs",
    "echo {} > .claude/settings.json",
    "node scripts/frozen.mjs pin",
  ])("blocks the command %s", (command) => {
    expect(blockReason(bash(command))).toMatch(/BLOCKED: |frozen\.mjs pin/);
  });

  it.each([
    `cat ${RULE}`,
    `grep -n probe ${RULE} > /tmp/out`,
    `cat ${RULE} | tee /tmp/copy`,
    `git diff origin/main -- ${RULE}`,
    "node scripts/frozen.mjs check",
    "sed -i '' 's/a/b/' AGENTS.md",
  ])("lets the command %s run", (command) => {
    expect(blockReason(bash(command))).toBeUndefined();
  });

  it("lets other tools through", () => {
    expect(
      blockReason({ tool_name: "Read", tool_input: { file_path: RULE } }),
    ).toBeUndefined();
  });
});
