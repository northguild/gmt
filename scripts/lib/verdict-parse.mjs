/**
 * Pure parsers for `scripts/verdict.mjs`: a step's log text in, its failures out.
 *
 * Nothing here reads a file or spawns a process. The first parser that recognises the log and finds
 * at least one failure wins; a log no parser knows falls back to its last 15 non-empty lines, so a
 * failed step never shows an empty FAIL row.
 *
 * A failure is `{ head, lines }`: `head` names where it happened, `lines` carry what went wrong.
 */

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g; // oxlint-disable-line no-control-regex

/** The `pnpm -r` prefix `<dir> <script>: ` on a line, or on an empty line `<dir> <script>:`. */
const PNPM_PREFIX =
  /^([A-Za-z0-9@_.-]+\/[A-Za-z0-9@_./-]*) ([A-Za-z0-9:_.-]+):(?: |$)/;

export const TAIL_LINES = 15;
export const MAX_FAILURES = 5;
const MAX_LINE = 140;

export function stripAnsi(text) {
  return text.replace(ANSI, "");
}

/**
 * The log as lines with ANSI codes and any `pnpm -r` prefix removed. `dirs[i]` is the package
 * directory the prefix named on line `i`, or null.
 */
export function normalizeLines(text) {
  const lines = [];
  const dirs = [];
  for (const raw of stripAnsi(text).split(/\r?\n/)) {
    const match = PNPM_PREFIX.exec(raw);
    lines.push(match ? raw.slice(match[0].length) : raw);
    dirs.push(match ? match[1] : null);
  }
  return { lines, dirs };
}

function inDir(dir, file) {
  return dir && !file.startsWith("/") ? `${dir}/${file}` : file;
}

function parseVitest({ lines }) {
  if (!lines.some((line) => /^\s*Test Files\s/.test(line))) return [];
  const failures = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^\s*FAIL\s+(?:\|([^|]+)\|\s+)?(\S.*?)\s*$/.exec(lines[i]);
    if (!match) continue;
    const [, project, name] = match;
    const head = project ? `${project}  ${name}` : name;
    if (seen.has(head)) continue;
    seen.add(head);
    let end = i + 1;
    while (end < lines.length && !/^\s*FAIL\s/.test(lines[end])) end += 1;
    const body = lines.slice(i + 1, end);
    const message = body.find((line) => line.trim() !== "");
    const location = body.find((line) => /^\s*❯\s+\S+:\d+:\d+/.test(line));
    failures.push({
      head,
      lines: [message?.trim(), location?.trim()].filter(Boolean),
    });
  }
  return failures;
}

function parseTsc({ lines, dirs }) {
  const failures = [];
  lines.forEach((line, i) => {
    const match = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/.exec(line);
    if (!match) return;
    failures.push({
      head: `${inDir(dirs[i], match[1])}:${match[2]}`,
      lines: [`${match[3]} ${match[4]}`],
    });
  });
  return failures;
}

function parseAstroCheck({ lines, dirs }) {
  if (
    !lines.some((line) => line.startsWith("Result (")) &&
    !lines.some((l) => /- error ts\(/.test(l))
  ) {
    return [];
  }
  const failures = [];
  lines.forEach((line, i) => {
    const match = /^(.+?):(\d+):\d+ - error ts\(\d+\): (.*)$/.exec(line);
    if (!match) return;
    failures.push({
      head: `${inDir(dirs[i], match[1])}:${match[2]}`,
      lines: [match[3]],
    });
  });
  return failures;
}

function parseOxlint({ lines, dirs }) {
  const failures = [];
  lines.forEach((line, i) => {
    // The one-line format oxlint picks when an agent runs it:
    // `file:line:col: error rule(name): message help: ...`.
    const flat = /^(.+?):(\d+):\d+: error (\S+): (.*?)(?: help: .*)?$/.exec(
      line,
    );
    if (flat) {
      failures.push({
        head: `${inDir(dirs[i], flat[1])}:${flat[2]}`,
        lines: [`${flat[3]}: ${flat[4]}`],
      });
      return;
    }
    // The graphical format: `  x rule(name): message`, then `   ,-[file:line:col]`.
    const frame = /^\s*,-\[(.+?):(\d+):\d+\]\s*$/.exec(line);
    if (!frame) return;
    for (let back = i - 1; back >= 0 && back >= i - 8; back -= 1) {
      const header = /^\s*([x!×])\s+(\S+?): (.*)$/.exec(lines[back]);
      if (!header) continue;
      if (header[1] !== "!") {
        failures.push({
          head: `${inDir(dirs[i], frame[1])}:${frame[2]}`,
          lines: [`${header[2]}: ${header[3]}`],
        });
      }
      break;
    }
  });
  return failures;
}

const PARSERS = [
  ["vitest", parseVitest],
  ["tsc", parseTsc],
  ["astro-check", parseAstroCheck],
  ["oxlint", parseOxlint],
];

/**
 * @typedef {{ head: string, lines: string[] }} Failure
 * @typedef {{ tool: string, failures: Failure[], tail: string[] }} Parsed
 */

/**
 * `{ tool, failures, tail }`. `tail` is only set when no parser found a failure.
 * @param {string} text
 * @returns {Parsed}
 */
export function parseLog(text) {
  const normalized = normalizeLines(text);
  for (const [tool, parse] of PARSERS) {
    const failures = parse(normalized);
    if (failures.length > 0) return { tool, failures, tail: [] };
  }
  const tail = normalized.lines
    .filter((line) => line.trim() !== "")
    .slice(-TAIL_LINES);
  return { tool: "generic", failures: [], tail };
}

/** Passed tests summed over every vitest `Tests  N passed` line in the log, or 0. */
export function countPassedTests(text) {
  let total = 0;
  for (const line of normalizeLines(text).lines) {
    const row = /^\s*Tests\s+(.*)$/.exec(line);
    const passed = row && /(\d+) passed/.exec(row[1]);
    if (passed) total += Number(passed[1]);
  }
  return total;
}

/** 36412 -> "36,412". */
export function formatCount(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function clip(line) {
  return line.length > MAX_LINE ? `${line.slice(0, MAX_LINE - 1)}…` : line;
}

/**
 * The indented detail lines for a failed step's row: at most `max` failures, then
 * `N more in <logPath>`. A log nothing parsed shows its tail instead.
 */
/**
 * @param {Parsed} parsed
 * @param {{ max?: number, logPath?: string }} [options]
 * @returns {string[]}
 */
export function failureLines(parsed, { max = MAX_FAILURES, logPath } = {}) {
  if (parsed.failures.length === 0)
    return parsed.tail.map((line) => clip(line.trimEnd()));
  const out = [];
  for (const failure of parsed.failures.slice(0, max)) {
    out.push(clip(failure.head));
    for (const line of failure.lines) out.push(clip(`  ${line}`));
  }
  const more = parsed.failures.length - max;
  if (more > 0) out.push(`${more} more in ${logPath}`);
  return out;
}

/**
 * Why a pnpm run that exited 0 measured nothing, or null when something ran. A filter that matches
 * no package prints "No projects matched the filters"; `-r --if-present` with a script no package
 * has prints only the scope line. Neither may read as green.
 * @param {string} text
 * @param {string} script
 * @returns {string | null}
 */
export function emptyRunProblem(text, script) {
  const { lines } = normalizeLines(text);
  const matched = lines.find((line) =>
    line.startsWith("No projects matched the filters"),
  );
  if (matched) return matched.replace(/ in ".*$/, "");
  if (!lines.some((line) => /\$ \S/.test(line)))
    return `no package ran ${script}`;
  return null;
}
