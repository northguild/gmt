#!/usr/bin/env node
/**
 * Story dependency tooling for the epic trackers.
 *
 *   node scripts/deps.mjs check          validate both trackers; exit 1 on drift
 *   node scripts/deps.mjs sync           regenerate the domination `Blocked by` column
 *   node scripts/deps.mjs ready          list stories nothing is blocking
 *   node scripts/deps.mjs whoneeds <ID>  reverse lookup: who consumes this story
 *
 * The domination column is derived from two inputs: the story IDs named in each story's
 * `## What gmt provides (do not re-implement)` section in `issues/<ID>.md`, minus the ones
 * whose tracker `Status` is already `Done`. So it shrinks as the epic lands, and an empty
 * cell means "nothing is stopping you". The full, permanent graph lives in the issue files
 * — use `whoneeds` to read it back.
 *
 * Dox works the same way, one level down. Its dependency lines are prose inside each
 * sub-story's description block (`Depends on DOX-B1a (the component) and ...`), and its
 * tracker rows are GitHub issues that bundle several sub-stories. So an issue's cell is the
 * union of its sub-stories' dependencies, mapped back to issue numbers.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const DOMINATION = "context/domination/tracker.md";
const DOMINATION_ISSUES = "context/domination/issues";
const DOX = "context/dox/tracker.md";
const DOX_ISSUES = "context/dox/issues";

const DOX_SUB = /\bitem (DOX-[A-E]\d+[a-z]?)\b/;
const DOX_ID = /\bDOX-[A-E]\d+[a-z]?\b/g;

const STORY_ID = /\b(?:CORE|TRAN|INT|MAR|ROAD|RAI|AV|IOT|HLTH|FIN|SPA)-\d+\b/g;
const orderOf = (id) => Number(id.split("-")[1]);

/** Row shape: { line, id, cells: string[], deps: string[], status } */

// ---------------------------------------------------------------- parsing

/** Dependencies each domination story declares in its issue file. */
function declaredDeps() {
  const out = new Map();
  for (const file of readdirSync(DOMINATION_ISSUES).filter((f) =>
    f.endsWith(".md"),
  )) {
    const id = file.replace(/\.md$/, "");
    const body = readFileSync(`${DOMINATION_ISSUES}/${file}`, "utf8");
    const section =
      body.split(/^## What gmt provides.*$/m)[1]?.split(/^## /m)[0] ?? "";
    const ids = [...new Set([...section.matchAll(STORY_ID)].map((m) => m[0]))]
      .filter((d) => d !== id)
      .sort((a, b) => orderOf(a) - orderOf(b));
    out.set(id, ids);
  }
  return out;
}

/**
 * Text from "Depends on" to the end of that sentence, ignoring periods inside parentheses.
 * The same paragraph often continues with unrelated prose naming other stories (DOX-C0's
 * "Blocks every other Tier 6 story — DOX-C1, ..."), which must not be read as dependencies.
 */
function dependsSentence(paragraph) {
  const start = paragraph.indexOf("Depends on");
  if (start === -1) return "";
  let depth = 0;
  for (let i = start; i < paragraph.length; i++) {
    const c = paragraph[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "." && depth === 0) return paragraph.slice(start, i);
  }
  return paragraph.slice(start);
}

/** Dependencies each dox sub-story declares, keyed by sub-story ID. */
function doxSubDeps() {
  const out = new Map();
  for (const file of readdirSync(DOX_ISSUES).filter((f) => f.endsWith(".md"))) {
    const lines = readFileSync(`${DOX_ISSUES}/${file}`, "utf8").split("\n");
    let current = null;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(DOX_SUB);
      if (m) current = m[1];
      if (!current || !lines[i].startsWith("Depends on")) continue;
      let para = lines[i];
      for (
        let j = i + 1;
        j < lines.length && lines[j].trim() && !lines[j].startsWith("#");
        j++
      ) {
        para += " " + lines[j];
      }
      const ids = [
        ...new Set(
          [...dependsSentence(para).matchAll(DOX_ID)].map((x) => x[0]),
        ),
      ];
      out.set(
        current,
        ids.filter((d) => d !== current),
      );
    }
  }
  return out;
}

/** Sub-story ID -> issue number, read from the tracker's `Story` column. */
function doxSubToIssue(rows) {
  const map = new Map();
  for (const r of rows) {
    const inner = r.id.match(/\(([^)]+)\)/);
    const subs = inner
      ? inner[1].split(",").map((x) => x.trim())
      : [r.id.trim()];
    for (const sub of subs) map.set(sub, r.cells[3]);
  }
  return map;
}

/** Issue-level dependencies: the union of each issue's sub-stories', minus itself. */
function doxIssueDeps(rows) {
  const subDeps = doxSubDeps();
  const toIssue = doxSubToIssue(rows);
  const out = new Map();
  for (const r of rows) {
    const inner = r.id.match(/\(([^)]+)\)/);
    const subs = inner
      ? inner[1].split(",").map((x) => x.trim())
      : [r.id.trim()];
    const issues = new Set();
    for (const sub of subs) {
      for (const d of subDeps.get(sub) ?? []) {
        const issue = toIssue.get(d);
        if (issue && issue !== r.cells[3]) issues.add(issue);
      }
    }
    out.set(
      r.cells[3],
      [...issues].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))),
    );
  }
  return out;
}

/** Parse a tracker's story table. Returns { lines, rows, headerLine }. */
function parseTracker(path, { idColumn, depColumn }) {
  const lines = readFileSync(path, "utf8").split("\n");
  const rows = [];
  let headerLine = -1;
  let width = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("|")) continue;
    const cells = lines[i]
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells[0] === "#" || cells[0] === "Order") {
      headerLine = i;
      width = cells.length;
      continue;
    }
    // Skip the separator row and any later table (the tracker has more than one).
    if (headerLine === -1 || /^-+$/.test(cells[0]) || cells.length !== width)
      continue;
    if (!cells[idColumn]) continue;
    rows.push({
      line: i,
      cells,
      id: cells[idColumn],
      deps:
        cells[depColumn] === "—"
          ? []
          : cells[depColumn].split(",").map((d) => d.trim()),
      status: cells.at(-1),
    });
  }
  return { lines, rows, headerLine };
}

const dominationTracker = () =>
  parseTracker(DOMINATION, { idColumn: 1, depColumn: 4 });
const doxTracker = () => parseTracker(DOX, { idColumn: 1, depColumn: 2 });

/**
 * The bare story ID or issue number in a cell entry.
 *
 * Handles both shapes: a wholly parenthesised domination entry — `(SPA-48)`, a shared
 * primitive — and a dox entry with a trailing sub-story qualifier — `#135 (A4b–d)`.
 */
const bareId = (entry) => {
  const e = entry.trim().replace(/\s*⚠\s*$/, "");
  const wrapped = e.match(/^\((.+)\)$/);
  return (wrapped ? wrapped[1] : e.replace(/\s*\(.*\)$/, "")).trim();
};

// ---------------------------------------------------------------- rendering

/**
 * What still stands between this story and a start.
 *
 * - A dependency already `Done` is dropped — it is no longer blocking anything.
 * - A `(parenthesised)` entry is a shared primitive built later in the order. It does not
 *   block the story; whoever arrives first builds it, so it is extra scope, not a wait.
 * - A `⚠` entry is a mutual dependency: two stories naming each other.
 */
function renderCell(id, deps, all, done) {
  const cells = deps
    .filter((d) => !done.has(d))
    .map((d) => {
      if (all.get(d)?.includes(id)) return `${d} ⚠`;
      return orderOf(d) > orderOf(id) ? `(${d})` : d;
    });
  return cells.length ? cells.join(", ") : "—";
}

/** True when nothing in the cell is a genuine blocker. */
const isReady = (cell) =>
  cell === "—" || cell.split(",").every((e) => e.trim().startsWith("("));

/** Story IDs whose tracker row is marked Done. */
const doneSet = (rows) =>
  new Set(rows.filter((r) => r.status.startsWith("Done")).map((r) => r.id));

/** Re-pad a markdown table in place so columns line up. */
function repad(lines, headerLine, rows) {
  const header = lines[headerLine]
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  const widths = header.map((h, c) =>
    Math.max([...h].length, ...rows.map((r) => [...(r.cells[c] ?? "")].length)),
  );
  const pad = (s, w) => s + " ".repeat(Math.max(0, w - [...s].length));
  const row = (cells) =>
    `| ${cells.map((c, i) => pad(c, widths[i])).join(" | ")} |`;

  lines[headerLine] = row(header);
  lines[headerLine + 1] = `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`;
  for (const r of rows) lines[r.line] = row(r.cells);
}

// ---------------------------------------------------------------- commands

function sync() {
  const declared = declaredDeps();
  const { lines, rows, headerLine } = dominationTracker();
  const done = doneSet(rows);
  let changed = 0;
  for (const r of rows) {
    const cell = renderCell(r.id, declared.get(r.id) ?? [], declared, done);
    if (r.cells[4] !== cell) changed++;
    r.cells[4] = cell;
  }
  repad(lines, headerLine, rows);
  writeFileSync(DOMINATION, lines.join("\n"));

  const dox = doxTracker();
  const doxDeps = doxIssueDeps(dox.rows);
  const doxDone = new Set(
    dox.rows.filter((r) => r.status.startsWith("Done")).map((r) => r.cells[3]),
  );
  let doxChanged = 0;
  for (const r of dox.rows) {
    const remaining = (doxDeps.get(r.cells[3]) ?? []).filter(
      (d) => !doxDone.has(d),
    );
    const cell = remaining.length ? remaining.join(", ") : "—";
    if (r.cells[2] !== cell) doxChanged++;
    r.cells[2] = cell;
  }
  repad(dox.lines, dox.headerLine, dox.rows);
  writeFileSync(DOX, dox.lines.join("\n"));

  console.log(
    `sync: domination ${rows.length} rows / ${changed} updated, ` +
      `dox ${dox.rows.length} rows / ${doxChanged} updated`,
  );
}

function check() {
  const problems = [];
  const warnings = [];
  const declared = declaredDeps();
  const { rows } = dominationTracker();
  const known = new Set(rows.map((r) => r.id));
  const done = doneSet(rows);

  // Every story in the tracker has an issue file, and vice versa.
  for (const r of rows) {
    if (!declared.has(r.id)) problems.push(`${r.id}: no issues/${r.id}.md`);
  }
  for (const id of declared.keys()) {
    if (!known.has(id)) problems.push(`${id}: issue file has no tracker row`);
  }

  // The column matches the specs it is derived from.
  for (const r of rows) {
    if (!declared.has(r.id)) continue;
    const expected = renderCell(r.id, declared.get(r.id), declared, done);
    const actual = r.cells[4];
    if (expected !== actual) {
      problems.push(
        `${r.id}: column says "${actual}", issue file implies "${expected}" — run: pnpm deps:sync`,
      );
    }
  }

  // Referenced IDs exist; forward edges carry a marker.
  for (const [id, deps] of declared) {
    for (const d of deps) {
      if (!known.has(d)) problems.push(`${id}: depends on unknown story ${d}`);
      else if (declared.get(d)?.includes(id) && orderOf(id) < orderOf(d)) {
        // A planning defect, not tracker drift. Reported every run, but it must not
        // fail CI for unrelated work until someone resolves the split.
        warnings.push(
          `${id} <-> ${d}: mutual dependency — neither can be built second`,
        );
      }
    }
  }

  // Dox: the column is derived from the sub-story dependency lines, same as domination.
  const dox = doxTracker();
  const doxDeps = doxIssueDeps(dox.rows);
  const doxDone = new Set(
    dox.rows.filter((r) => r.status.startsWith("Done")).map((r) => r.cells[3]),
  );
  const doxIssues = new Set(dox.rows.map((r) => r.cells[3]));
  for (const r of dox.rows) {
    const declaredFor = doxDeps.get(r.cells[3]) ?? [];
    for (const d of declaredFor) {
      if (!doxIssues.has(d))
        problems.push(`dox ${r.id}: depends on unknown issue ${d}`);
    }
    const remaining = declaredFor.filter((d) => !doxDone.has(d));
    const expected = remaining.length ? remaining.join(", ") : "—";
    if (r.cells[2] !== expected) {
      problems.push(
        `dox ${r.id}: column says "${r.cells[2]}", issue files imply "${expected}" — run: pnpm deps:sync`,
      );
    }
    // Bundling sub-stories into one issue can make two issues appear to need each other
    // even though the underlying sub-story chain is fine. Only worth flagging while open.
    for (const d of declaredFor) {
      if (
        (doxDeps.get(d) ?? []).includes(r.cells[3]) &&
        !doxDone.has(d) &&
        !doxDone.has(r.cells[3])
      ) {
        warnings.push(
          `dox ${r.cells[3]} <-> ${d}: mutual at issue level — check the sub-story chain`,
        );
      }
    }
  }

  for (const w of warnings) console.warn(`  warning: ${w}`);
  if (problems.length) {
    console.error(
      "Dependency problems:\n" + problems.map((p) => `  - ${p}`).join("\n"),
    );
    process.exit(1);
  }
  const suffix = warnings.length ? `, ${warnings.length} unresolved` : "";
  console.log(
    `deps check: ${rows.length} domination + ${dox.rows.length} dox rows OK${suffix}`,
  );
}

function ready() {
  const open = (rows) => rows.filter((r) => !r.status.startsWith("Done"));

  // Domination: the cell already excludes everything Done, so it reads directly.
  const dom = open(dominationTracker().rows);
  const startable = dom.filter((r) => isReady(r.cells[4]));
  console.log(
    `\nDomination — ${startable.length} ready of ${dom.length} open:`,
  );
  for (const r of startable) {
    const shared = r.deps.filter((e) => e.startsWith("(")).map(bareId);
    console.log(
      `  ${r.id}${shared.length ? `  (also builds ${shared.join(", ")})` : ""}`,
    );
  }

  const doxOpen = open(doxTracker().rows);
  const doxReady = doxOpen.filter((r) => isReady(r.cells[2]));
  console.log(`\nDox — ${doxReady.length} ready of ${doxOpen.length} open:`);
  for (const r of doxReady) console.log(`  ${r.id}`);
}

/** Reverse lookup against the permanent graph in the issue files. */
function whoneeds() {
  const target = argv[1];
  if (!target) {
    console.error("Usage: node scripts/deps.mjs whoneeds <STORY-ID>");
    process.exit(1);
  }
  const declared = declaredDeps();
  if (!declared.has(target)) {
    console.error(`Unknown story: ${target}`);
    process.exit(1);
  }
  const status = new Map(dominationTracker().rows.map((r) => [r.id, r.status]));
  const consumers = [...declared]
    .filter(([, deps]) => deps.includes(target))
    .map(([id]) => id)
    .sort((a, b) => orderOf(a) - orderOf(b));

  console.log(
    `${target} is consumed by ${consumers.length} stor${consumers.length === 1 ? "y" : "ies"}:`,
  );
  for (const id of consumers)
    console.log(`  ${id}  [${status.get(id) ?? "?"}]`);
}

// pnpm forwards a literal `--` separator; drop it so `pnpm deps -- ready` works.
const argv = process.argv.slice(2).filter((a) => a !== "--");
const command = argv[0] ?? "check";
const commands = { check, sync, ready, whoneeds };
if (!commands[command]) {
  console.error(
    `Usage: node scripts/deps.mjs <check|sync|ready|whoneeds <ID>>`,
  );
  process.exit(1);
}
commands[command]();
