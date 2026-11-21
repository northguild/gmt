#!/usr/bin/env node
/**
 * ui-standards: holds the branch's Dox changes to `Reuse, never reinvent`
 * (`context/dox/built/index.md`) and the house UI rules. Only lines the branch adds are checked;
 * the copies check also finds an added block that repeats code already on `main`.
 *
 *   node .agents/skills/ui-standards/scripts/run.mjs [--base origin/main] [--all]
 *
 * Exit 0 PASS, 1 FAIL, 2 usage. A recorded exception carries `ui-standards-ok: <reason>` on the
 * line or the line above; the reason is required.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const git = (...a) =>
  execFileSync("git", a, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1 << 28,
    stdio: ["ignore", "pipe", "ignore"],
  });
const BASE = git("merge-base", option("--base", "origin/main"), "HEAD").trim();

const DOX = "apps/dox/";
const SKIP =
  /^apps\/dox\/(src\/generated|public|dist|node_modules|\.astro|\.globe-smoke)\//;
const CODE = /\.(ts|tsx|mts|mjs|js|astro|css)$/;
const TEST = /\.test\.(ts|tsx|mjs)$|\/src\/test\//;
const SHARED = /^apps\/dox\/src\/(lib|components|widgets|styles|pages)\//;
const ACCEPTED = /ui-standards-ok:\s*\S.{8,}/;

/* ---- What the branch adds: committed, staged, unstaged and untracked ---- */

/** path → Set of added line numbers (1-based, in the working tree). */
const added = new Map();
let hunk = null;
for (const line of git(
  "diff",
  "--unified=0",
  "--no-color",
  "--no-renames",
  BASE,
  "--",
  DOX,
).split("\n")) {
  const file = /^\+\+\+ b\/(.+)$/.exec(line);
  if (file)
    hunk = SKIP.test(file[1])
      ? null
      : (added.set(file[1], added.get(file[1]) ?? new Set()), file[1]);
  const at = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (at && hunk) {
    const start = Number(at[1]);
    for (let n = start; n < start + Number(at[2] ?? 1); n++)
      added.get(hunk).add(n);
  }
}
for (const file of git(
  "ls-files",
  "--others",
  "--exclude-standard",
  "--",
  DOX,
).split("\n")) {
  if (!file || SKIP.test(file)) continue;
  const lines = readFileSync(path.join(ROOT, file), "utf8").split("\n").length;
  added.set(file, new Set(Array.from({ length: lines }, (_, i) => i + 1)));
}

const text = new Map();
const read = (file) => {
  if (!text.has(file))
    text.set(
      file,
      existsSync(path.join(ROOT, file))
        ? readFileSync(path.join(ROOT, file), "utf8").split("\n")
        : [],
    );
  return text.get(file);
};
const accepted = (file, n) => {
  const lines = read(file);
  return ACCEPTED.test(lines[n - 1] ?? "") || ACCEPTED.test(lines[n - 2] ?? "");
};

const findings = [];
const report = (check, file, n, message) => {
  if (!accepted(file, n))
    findings.push({ check, where: `${file}:${n}`, message });
};

/* ---- copies: an added block of six meaningful lines that appears twice ---- */

const TRIVIAL =
  /^(?:[{}()[\];,]+|<\/[\w-]+>|\/\/.*|\/\*.*|\*.*|import\b.*|export \{[^}]*\} from .*|\} from .*|---|)$/;
const WINDOW = 6;
const corpus = git(
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "--",
  "apps/dox/src",
  "apps/dox/scripts",
)
  .split("\n")
  .filter(
    (f) => f && CODE.test(f) && !SKIP.test(f) && existsSync(path.join(ROOT, f)),
  );
const windows = new Map();
for (const file of corpus) {
  const meaningful = [];
  // Vitest hoists `vi.mock` from the test file's own text, so each file states its mocks; the
  // factories are what get one home.
  let inMock = false;
  read(file).forEach((raw, i) => {
    const line = raw.trim().replace(/\s+/g, " ");
    if (line.startsWith("vi.mock(")) inMock = true;
    if (inMock) {
      if (/\);$/.test(line)) inMock = false;
      return;
    }
    if (!TRIVIAL.test(line) && line.length >= 4)
      meaningful.push({ line, n: i + 1 });
  });
  for (let i = 0; i + WINDOW <= meaningful.length; i++) {
    const slice = meaningful.slice(i, i + WINDOW);
    const key = slice.map((s) => s.line).join("\n");
    if (key.length < 160) continue;
    const at = {
      file,
      from: slice[0].n,
      to: slice[WINDOW - 1].n,
      lines: slice.map((s) => s.n),
    };
    windows.set(key, [...(windows.get(key) ?? []), at]);
  }
}
const pairs = new Map();
for (const places of windows.values()) {
  if (places.length < 2) continue;
  for (const a of places) {
    if (!a.lines.some((n) => added.get(a.file)?.has(n))) continue;
    for (const b of places) {
      if (a === b || (a.file === b.file && Math.abs(a.from - b.from) < WINDOW))
        continue;
      const id = `${a.file}\0${b.file}`;
      pairs.set(id, [...(pairs.get(id) ?? []), { a, b }]);
    }
  }
}
const seen = new Set();
for (const list of pairs.values()) {
  list.sort((x, y) => x.a.from - y.a.from);
  let run = null;
  const flush = () => {
    if (!run) return;
    const mirror = `${run.b.file}:${run.bFrom}\0${run.a.file}:${run.from}`;
    seen.add(`${run.a.file}:${run.from}\0${run.b.file}:${run.bFrom}`);
    if (!seen.has(mirror) || run.a.file === run.b.file)
      report(
        "copies",
        run.a.file,
        run.from,
        `lines ${run.from}–${run.to} repeat ${run.b.file}:${run.bFrom}; give them one home (rule 2)`,
      );
    run = null;
  };
  for (const { a, b } of list) {
    if (run && a.from <= run.to + 1 && a.file === run.a.file)
      run.to = Math.max(run.to, a.to);
    else (flush(), (run = { a, b, from: a.from, to: a.to, bFrom: b.from }));
  }
  flush();
}

/* ---- Line rules on added lines ---- */

const deadCandidates = [];

for (const [file, lines] of added) {
  if (!CODE.test(file)) continue;
  const all = read(file);
  const test = TEST.test(file);
  for (const n of lines) {
    const line = all[n - 1] ?? "";
    if (
      !test &&
      file.startsWith("apps/dox/src/") &&
      /\brequestAnimationFrame\s*\(/.test(line) &&
      !file.endsWith("lib/slides/frames.ts")
    )
      report(
        "own-loop",
        file,
        n,
        "a new frame loop; play it on `play` (src/lib/slides/frames.ts) or the module's existing loop (rule 2)",
      );
    if (
      SHARED.test(file) &&
      !test &&
      /location\.(pathname|href|hash)\b.*(includes|startsWith|endsWith|match|===|!==)\s*\(?\s*["'`/]/.test(
        line,
      )
    )
      report(
        "url-sniff",
        file,
        n,
        "shared code reads the URL to learn its feature; pass the feature in as a prop or registry row (rule 3)",
      );
    if (
      file.endsWith(".css") &&
      /^apps\/dox\/src\/(styles|components)\//.test(file) &&
      /:has\(/.test(line)
    )
      report(
        "has-layout",
        file,
        n,
        "`:has()` in a shared sheet; choose the layout by an attribute the component sets (rule 5)",
      );
    const exported =
      /^export\s+(?:async\s+)?(?:const|let|function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/.exec(
        line,
      );
    if (
      exported &&
      !test &&
      !file.endsWith(".astro") &&
      !/^(Props|prerender|getStaticPaths|GET|POST|PUT|DELETE|ALL)$/.test(
        exported[1],
      )
    )
      deadCandidates.push({ file, n, name: exported[1] });
  }
}

/* ---- dead exports: an added export no other file reads ---- */

if (deadCandidates.length) {
  const readers = git(
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    "apps/dox",
  )
    .split("\n")
    .filter(
      (f) =>
        f &&
        /\.(ts|tsx|mts|mjs|js|astro|mdx|md|json)$/.test(f) &&
        !/node_modules|\/dist\//.test(f) &&
        existsSync(path.join(ROOT, f)),
    );
  const bodies = readers.map((f) => [f, read(f).join("\n")]);
  for (const { file, n, name } of deadCandidates) {
    const word = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`);
    if (!bodies.some(([f, body]) => f !== file && word.test(body)))
      report(
        "dead-export",
        file,
        n,
        `\`${name}\` is exported but only its own file reads it; drop the export or the code (rule 8)`,
      );
  }
}

/* ---- CSS blocks the branch touched: left-border accents and rounded arcs ---- */

const selectorsOf = (head) =>
  head
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(",")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean);
// A selector some other rule already bevels, such as one in the shared panel list.
const bevelled = new Set();
for (const [file] of added) {
  if (!file.endsWith(".css")) continue;
  for (const block of read(file)
    .join("\n")
    .matchAll(/([^{}]*)\{([^{}]*)\}/g))
    if (/corner-shape\s*:\s*bevel/.test(block[2]))
      for (const s of selectorsOf(block[1])) bevelled.add(s);
}

for (const [file, lines] of added) {
  if (!file.endsWith(".css")) continue;
  const source = read(file).join("\n");
  for (const block of source.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const first =
      source.slice(0, block.index).split("\n").length +
      block[1].split("\n").length -
      1;
    const last = first + block[2].split("\n").length;
    if (
      !Array.from({ length: last - first + 1 }, (_, i) => first + i).some((n) =>
        lines.has(n),
      )
    )
      continue;
    const body = block[2];
    const at =
      first +
      Math.max(
        0,
        body
          .split("\n")
          .findIndex((l) =>
            /border-(left|inline-start)\s*:|border-radius\s*:/.test(l),
          ),
      );
    if (
      /border-(left|inline-start)\s*:[ \t]*(?![ \t]|none|0\b)/.test(body) &&
      !/(^|[\s;])border(-block)?\s*:/.test(body)
    )
      report(
        "left-accent",
        file,
        at,
        "an accent on one side only; use a full border or a bottom edge",
      );
    const radius = /border-radius\s*:\s*([^;]+)/.exec(body);
    if (
      radius &&
      !/^(0|50%|inherit|9999px|999px|var\(--gmt-radius-full\))$/.test(
        radius[1].trim(),
      ) &&
      !/corner-shape\s*:/.test(body) &&
      !selectorsOf(block[1]).every((s) => bevelled.has(s))
    )
      report(
        "rounded",
        file,
        at,
        "a rounded corner; panels use `corner-shape: bevel` with the radius",
      );
  }
}

/* ---- Data: a committed file that repeats a fact on every row, or is a cache ---- */

for (const [file] of added) {
  if (!file.endsWith(".json") || !existsSync(path.join(ROOT, file))) continue;
  const bytes = statSync(path.join(ROOT, file)).size;
  if (bytes > 512 * 1024)
    report(
      "cache",
      file,
      1,
      `${Math.round(bytes / 1024)} KB of data; if a script rebuilds it, write it to a gitignored work folder (rule 7)`,
    );
  let data;
  try {
    data = JSON.parse(read(file).join("\n"));
  } catch {
    continue;
  }
  const visit = (node, where) => {
    if (Array.isArray(node)) {
      const rows = node.filter(
        (r) => r && typeof r === "object" && !Array.isArray(r),
      );
      if (rows.length >= 20)
        for (const key of new Set(rows.flatMap(Object.keys))) {
          const values = rows.map((r) => JSON.stringify(r[key]));
          if (values.every((v) => v === values[0]) && values[0] !== undefined)
            report(
              "repeated-fact",
              file,
              1,
              `\`${where}[].${key}\` is ${values[0].slice(0, 40)} on all ${rows.length} rows; state it once (rule 7)`,
            );
        }
      node.forEach((child) => visit(child, `${where}[]`));
    } else if (node && typeof node === "object")
      for (const [k, v] of Object.entries(node))
        visit(v, where ? `${where}.${k}` : k);
  };
  visit(data, "");
}

/* ---- Size: the diff, and modules the branch grew past a split ---- */

let total = 0;
for (const [file, lines] of added) {
  total += lines.size;
  if (!CODE.test(file) || TEST.test(file) || /\.(css|astro)$/.test(file))
    continue;
  const length = read(file).length;
  if (length <= 400) continue;
  // Only a module this branch made or grew past the line; an older one is backlog, never grown on.
  let before = 0;
  try {
    before = git("show", `${BASE}:${file}`).split("\n").length;
  } catch {}
  if (before <= 400)
    report(
      "big-module",
      file,
      1,
      `${length} lines (${before ? `${before} on main` : "new"}); split into a core and opt-in features (rule 6)`,
    );
}

/* ---- Report ---- */

const shown = flag("--all") ? findings : findings.slice(0, 60);
console.log(
  `ui-standards: ${findings.length ? "FAIL" : "PASS"} — ${findings.length} finding(s), ${total} added line(s) in apps/dox since ${BASE.slice(0, 8)}`,
);
if (total > 10_000)
  console.log(
    "  note: over 10,000 added lines — rule 10's duplication pass is due (this run is it).",
  );
for (const check of [...new Set(shown.map((f) => f.check))]) {
  console.log(`\n${check}`);
  for (const f of shown.filter((x) => x.check === check))
    console.log(`  ${f.where}  ${f.message}`);
}
if (shown.length < findings.length)
  console.log(`\n… ${findings.length - shown.length} more; --all lists them.`);
process.exit(findings.length ? 1 : 0);
