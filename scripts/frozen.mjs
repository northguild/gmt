/**
 * Frozen files: text only the owner may change.
 *
 * `context/coding-standards/runtime-workarounds.md` holds the one approach GMT uses for runtime
 * workarounds. It is frozen: no agent, story or PR changes it. Three layers hold it in place.
 *
 * 1. `hook`: a Claude Code PreToolUse hook (`.claude/settings.json`) runs this script before every
 *    Edit, Write, MultiEdit, NotebookEdit and Bash call, and blocks any call that would write a
 *    frozen file, this script, or the settings that load the hook.
 * 2. `check`: `validate` and CI fail when a frozen file's text no longer matches its pinned
 *    SHA-256, or when the settings no longer load the hook.
 * 3. `pin`: the only way to move a pin. It runs in the owner's own terminal, after the owner has
 *    asked in plain words for a change to the named file, and refuses to run inside an agent.
 *
 * Usage: node scripts/frozen.mjs check | hook | pin
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SELF = "scripts/frozen.mjs";

/** Each frozen file and the SHA-256 of its text. Only `pin` changes a value here. */
export const PINS = {
  "context/coding-standards/runtime-workarounds.md":
    "ed12bd637923d19a91f6bac49a06c9f95325677a725d3c318b62f4fcaa27ba29",
};

/** The settings files that load the hook; the hook blocks writes to them as well. */
const SETTINGS = [".claude/settings.json", ".claude/settings.local.json"];

/** The tools whose input names one file to write. */
const FILE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

/** The tools the hook's matcher must name, so every way of writing a file passes through it. */
export const HOOKED_TOOLS = [
  "Edit",
  "Write",
  "MultiEdit",
  "NotebookEdit",
  "Bash",
];

/**
 * A shell segment that writes a file it names: a redirect into it, an in-place editor, a command
 * that moves, copies, deletes or rewrites files, a git command that rewrites the working tree, or
 * an inline script. Reading (cat, grep, git diff, git log) passes.
 */
const WRITES = [
  /\b(?:g?sed)\b.*\s(?:-[a-zA-Z]*i|--in-place)/,
  /\bperl\b.*\s-[a-zA-Z]*[ip]/,
  /\b(?:tee|mv|cp|rm|unlink|truncate|dd|ln|install|chmod|chflags|touch|rsync|patch)\b/,
  /\bgit\s+(?:checkout|restore|apply|reset|rm|mv|am|stash|cherry-pick|revert|update-index)\b/,
  /\b(?:node|bun|deno|python3?|ruby|perl|osascript|awk|gawk)\b.*\s(?:-[a-zA-Z]*[ecp]\b|--eval\b|-i\s+inplace)/,
];

/** The text a Bash command must contain to name each guarded file. */
const NEEDLES = [
  ...Object.keys(PINS).map((path) => path.split("/").at(-1)),
  "frozen.mjs",
  ...SETTINGS,
];

/** `path` as a repo-relative guarded path, or undefined when it is not one. */
export function guardedPath(path) {
  const unix = path.replaceAll("\\", "/");
  for (const rel of [...Object.keys(PINS), SELF]) {
    if (unix === rel || unix.endsWith(`/${rel}`)) return rel;
  }
  for (const rel of SETTINGS) {
    if (!(unix === rel || unix.endsWith(`/${rel}`))) continue;
    // Only the settings of a checkout that carries this script: never the user's own ~/.claude.
    const repo = unix.slice(0, unix.length - rel.length);
    if (existsSync(join(repo || ".", SELF))) return rel;
  }
  return undefined;
}

/** The real path of `path`, following symlinks as far as the file or its folder exists. */
function realPath(path) {
  try {
    return realpathSync(path);
  } catch {
    try {
      return join(
        realpathSync(dirname(path)),
        path.slice(dirname(path).length + 1),
      );
    } catch {
      return path;
    }
  }
}

/** The shell segments of `command`: split on `;`, `&&`, `||`, `|` and newlines. */
function segments(command) {
  return command.split(/\|\||&&|[;|\n]/);
}

/**
 * Why the tool call in `input` (the PreToolUse payload) must be blocked, or undefined when it may
 * run.
 */
export function blockReason(input) {
  const tool = input?.tool_name;
  const args = input?.tool_input ?? {};
  if (FILE_TOOLS.has(tool)) {
    const raw = args.file_path ?? args.notebook_path;
    if (typeof raw !== "string") return undefined;
    const path = realPath(resolve(input.cwd ?? process.cwd(), raw));
    const rel = guardedPath(path) ?? guardedPath(raw);
    return rel ? frozenMessage(rel) : undefined;
  }
  if (tool === "Bash") {
    const command = String(args.command ?? "");
    if (/\bfrozen\.mjs["']?\s+pin\b/.test(command))
      return "`frozen.mjs pin` moves a frozen file's pin. Only the owner runs it, in their own terminal.";
    for (const part of segments(command)) {
      const named = NEEDLES.find((needle) => part.includes(needle));
      if (!named) continue;
      const redirect = new RegExp(`>\\|?\\s*["']?[^\\s"']*${escape(named)}`);
      if (redirect.test(part) || WRITES.some((write) => write.test(part)))
        return frozenMessage(named);
    }
  }
  return undefined;
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function frozenMessage(name) {
  return [
    `BLOCKED: ${name} is frozen.`,
    "No agent, story or PR changes context/coding-standards/runtime-workarounds.md, the guard",
    "scripts/frozen.mjs, or the .claude settings that load the guard. Only the owner changes them,",
    "by an instruction in plain words naming the file. If your plan needs a change or an",
    "exception, stop and ask the owner. Reading the file (Read, cat, grep) is allowed.",
  ].join("\n");
}

/** SHA-256 of the file at `path`, or undefined when it is missing. */
function sha256(path) {
  if (!existsSync(path)) return undefined;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Whether `settings` loads the hook before every tool that can write a file, failing closed. */
export function hookProblems(settings) {
  const entries = settings?.hooks?.PreToolUse ?? [];
  const hooked = new Set();
  for (const entry of entries) {
    for (const hook of entry.hooks ?? []) {
      if (hook.type !== "command") continue;
      if (!/scripts\/frozen\.mjs"?\s+hook\b/.test(hook.command ?? "")) continue;
      if (hook.onFailure !== "block") continue;
      for (const tool of String(entry.matcher ?? "").split("|"))
        hooked.add(tool.trim());
    }
  }
  const missing = HOOKED_TOOLS.filter((tool) => !hooked.has(tool));
  return missing.length === 0
    ? []
    : [
        `.claude/settings.json does not run \`scripts/frozen.mjs hook\` with onFailure "block" before: ${missing.join(", ")}.`,
      ];
}

/** Every reason the repo at `root` breaks the freeze. */
export function findProblems(root = ROOT) {
  const problems = [];
  for (const [rel, pinned] of Object.entries(PINS)) {
    const actual = sha256(join(root, rel));
    if (actual === undefined) problems.push(`${rel} is missing. It is frozen.`);
    else if (actual !== pinned)
      problems.push(
        `${rel} is frozen and its text changed (sha256 ${actual}, pinned ${pinned}). Restore the pinned text. Only the owner changes this file, by asking in plain words, and then runs \`node scripts/frozen.mjs pin\` in their own terminal.`,
      );
  }
  const settingsPath = join(root, SETTINGS[0]);
  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch (error) {
    problems.push(`${SETTINGS[0]} cannot be read as JSON: ${error.message}`);
  }
  if (settings) problems.push(...hookProblems(settings));
  const localPath = join(root, SETTINGS[1]);
  if (existsSync(localPath)) {
    try {
      if (JSON.parse(readFileSync(localPath, "utf8")).disableAllHooks)
        problems.push(
          `${SETTINGS[1]} sets disableAllHooks, which turns the guard off.`,
        );
    } catch {
      problems.push(`${SETTINGS[1]} cannot be read as JSON.`);
    }
  }
  return problems;
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

async function hook() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    // Fail closed: a payload the guard cannot read is not let through.
    process.stderr.write(
      "BLOCKED: the frozen-file guard could not read the tool call.\n",
    );
    process.exit(2);
  }
  const reason = blockReason(input);
  if (reason) {
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }
}

function check() {
  const problems = findProblems();
  if (problems.length === 0) {
    console.log(
      `frozen: ${Object.keys(PINS).length} file(s) match their pins; the guard hook is loaded.`,
    );
    return;
  }
  for (const problem of problems) console.error(`frozen: ${problem}`);
  process.exit(1);
}

async function pin() {
  if (process.env.CLAUDECODE || !process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      "frozen: `pin` runs only in the owner's own terminal, never from an agent.",
    );
    process.exit(1);
  }
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let source = readFileSync(join(ROOT, SELF), "utf8");
  for (const [rel, pinned] of Object.entries(PINS)) {
    const actual = sha256(join(ROOT, rel));
    if (actual === undefined || actual === pinned) continue;
    const answer = await prompt.question(
      `${rel} changed. Did the owner ask for this change in words naming the file? Type the file path to pin it: `,
    );
    if (answer.trim() !== rel) {
      console.error(`frozen: ${rel} left unpinned.`);
      continue;
    }
    source = source.replace(pinned, actual);
    console.log(`frozen: pinned ${rel} at ${actual}.`);
  }
  prompt.close();
  writeFileSync(join(ROOT, SELF), source);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const mode = process.argv[2];
  if (mode === "check") check();
  else if (mode === "hook") await hook();
  else if (mode === "pin") await pin();
  else {
    console.error("Usage: node scripts/frozen.mjs check | hook | pin");
    process.exit(1);
  }
}
