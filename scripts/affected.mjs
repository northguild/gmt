/**
 * Runs only the checks a change needs. The rules are in `scripts/lib/affected.mjs`.
 *
 *   node scripts/affected.mjs run              `pnpm run validate`: the checks for the files changed
 *                                              against origin/main, committed or not
 *   node scripts/affected.mjs run --full       every check, whatever changed (`validate:full`)
 *   node scripts/affected.mjs run --base <ref> compare against <ref> instead of origin/main
 *   node scripts/affected.mjs run --dry-run    print the plan and stop
 *   node scripts/affected.mjs run --checks <json> --only <ids>
 *                                              CI: run the named checks, limited to `--only`
 *   node scripts/affected.mjs show [path...]   print the plan for the given paths, or for the change
 *   node scripts/affected.mjs github --base <sha> --head <sha>
 *                                              CI: write the plan to $GITHUB_OUTPUT
 *   node scripts/affected.mjs github --full    CI: every check, for a push to main
 *   node scripts/affected.mjs audit [--only <ids>] [--logs <dir>]
 *                                              run every check with each file it reads recorded,
 *                                              and list the reads the rules miss; exit 1 on any.
 *                                              As long as `validate:full`. `--logs` re-reads the
 *                                              logs of an earlier run instead of running again.
 *
 * `--only` takes a comma-separated list; an entry ending in `:` matches every id with that prefix,
 * so `--only build:,lint:` is every build and every lint. A changed file is any file that differs
 * from the merge base: committed, staged, unstaged or untracked. A rename counts as both paths.
 *
 * Runs on the runner's own Node in CI, before any install: built-in modules only.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  affected,
  ALL_CHECKS,
  assertRulesValid,
  CHECKS,
  uncovered,
  withNeeds,
} from "./lib/affected.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(
  /[\\/]$/,
  "",
);

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

const lines = (text) => text.split("\n").filter(Boolean);

/** `git diff --name-status` output → `{ path, status }`, status being A, M, D or T. */
function parseStatus(text) {
  return lines(text).map((line) => {
    const [status, path] = line.split("\t");
    return { path, status: status[0] };
  });
}

/** Files that differ between the merge base of `base` and HEAD, and the working tree. */
function changedSince(base) {
  let mergeBase;
  try {
    mergeBase = git("merge-base", base, "HEAD").trim();
  } catch {
    throw new Error(
      `Cannot find the merge base with ${base}. Run \`git fetch origin main\`, pass --base <ref>, or use --full.`,
    );
  }
  const changes = [
    ...parseStatus(git("diff", "--name-status", "--no-renames", mergeBase)),
    ...lines(git("ls-files", "--others", "--exclude-standard")).map((path) => ({
      path,
      status: "A",
    })),
  ];
  return { mergeBase, changes };
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--full" || arg === "--dry-run") opts[arg.slice(2)] = true;
    else if (["--base", "--head", "--checks", "--only", "--logs"].includes(arg))
      opts[arg.slice(2)] = argv[++i];
    else if (arg === "--")
      (opts._.push(...argv.slice(i + 1)), (i = argv.length));
    else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}.`);
    else opts._.push(arg);
  }
  return opts;
}

/** `--only build:,lint:gmt` → a predicate on check ids. */
function onlyFilter(only) {
  if (!only) return () => true;
  const entries = only
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const e of entries) {
    if (!e.endsWith(":") && !ALL_CHECKS.includes(e))
      throw new Error(`--only names an unknown check "${e}".`);
  }
  return (id) =>
    entries.some((e) => (e.endsWith(":") ? id.startsWith(e) : id === e));
}

/** The plan as lines a person reads: each check with the first paths that asked for it. */
function describe({ checks, reasons }, { local }) {
  const shown = checks.filter(
    (id) => !local || CHECKS.find((c) => c.id === id).local !== false,
  );
  if (checks.length === 0)
    return ["  No check reads these files, so none runs."];
  // A path every check names is one whose rule runs everything: say that once.
  const everywhere = (reasons.get(checks[0]) ?? []).filter((why) =>
    ALL_CHECKS.every((id) => reasons.get(id)?.includes(why)),
  );
  if (checks.length === ALL_CHECKS.length && everywhere.length > 0) {
    const more =
      everywhere.length > 5 ? ` and ${everywhere.length - 5} more` : "";
    return [`  every check, for ${everywhere.slice(0, 5).join(", ")}${more}`];
  }
  const width = Math.max(...ALL_CHECKS.map((id) => id.length));
  const out = shown.map((id) => {
    const why = reasons.get(id) ?? [];
    const more = why.length > 3 ? ` and ${why.length - 3} more` : "";
    return `  ${id.padEnd(width)}  ${why.slice(0, 3).join(", ")}${more}`;
  });
  const skipped = ALL_CHECKS.filter(
    (id) =>
      !checks.includes(id) &&
      (!local || CHECKS.find((c) => c.id === id).local !== false),
  );
  if (skipped.length > 0)
    out.push(`  skipped: ${skipped.join(", ")} (nothing they read changed)`);
  return out;
}

/** The checks to run and why, from `--checks`, `--full` or the change against `--base`. */
export function plan(opts) {
  if (opts.checks) {
    const named = JSON.parse(opts.checks);
    for (const id of named) {
      if (!ALL_CHECKS.includes(id))
        throw new Error(`--checks names an unknown check "${id}".`);
    }
    const result = withNeeds(new Map(named.map((id) => [id, ["named by CI"]])));
    return { ...result, header: `${named.length} checks named by CI` };
  }
  if (opts.full) {
    const reasons = new Map(ALL_CHECKS.map((id) => [id, ["--full"]]));
    return { checks: [...ALL_CHECKS], reasons, full: true, header: "--full" };
  }
  const base = opts.base ?? "origin/main";
  const { mergeBase, changes } = changedSince(base);
  const result = affected(changes);
  const count = `${changes.length} changed file${changes.length === 1 ? "" : "s"}`;
  return {
    ...result,
    changes,
    header: `${count} against ${base} (merge base ${mergeBase.slice(0, 10)})`,
  };
}

function run(opts) {
  const p = plan(opts);
  const keep = onlyFilter(opts.only);
  const todo = CHECKS.filter(
    (c) => p.checks.includes(c.id) && keep(c.id) && c.local !== false,
  );
  console.log(
    `validate: ${todo.length} of ${CHECKS.filter((c) => c.local !== false).length} checks, for ${p.header}.`,
  );
  if (!opts.full)
    for (const line of describe(p, { local: true })) console.log(line);
  if (p.changes?.length === 0)
    console.log(
      "  No file differs from the base. Run `pnpm run validate:full` to check everything anyway.",
    );
  else if (!opts.full && !opts.checks)
    console.log("  `pnpm run validate:full` runs every check.");
  if (opts["dry-run"]) return 0;
  for (const check of todo) {
    console.log(`\n▶ ${check.id}: ${check.run}`);
    const r = spawnSync(check.run, {
      cwd: ROOT,
      shell: true,
      stdio: "inherit",
    });
    if (r.status !== 0) {
      console.error(`\n✗ ${check.id} failed (exit ${r.status ?? r.signal}).`);
      return r.status || 1;
    }
  }
  console.log(
    `\n✓ ${todo.length} check${todo.length === 1 ? "" : "s"} passed.`,
  );
  return 0;
}

function show(opts) {
  const p =
    opts._.length > 0
      ? { ...affected(opts._), header: `${opts._.length} given paths` }
      : plan(opts);
  console.log(
    `${p.checks.length} of ${ALL_CHECKS.length} checks, for ${p.header}.`,
  );
  for (const line of describe(p, { local: false })) console.log(line);
  return 0;
}

/** CI: the plan as step outputs. `checks` is a JSON array; the rest gate whole jobs. */
function github(opts) {
  let p;
  if (opts.full) {
    p = plan(opts);
    console.log(
      `${ALL_CHECKS.length} of ${ALL_CHECKS.length} checks: --full runs them all.`,
    );
  } else {
    if (!opts.base || !opts.head)
      throw new Error("github needs --base <sha> and --head <sha>, or --full.");
    const changes = parseStatus(
      git("diff", "--name-status", "--no-renames", opts.base, opts.head),
    );
    p = {
      ...affected(changes),
      header: `${changes.length} changed files, ${opts.base.slice(0, 10)}..${opts.head.slice(0, 10)}`,
    };
    console.log(
      `${p.checks.length} of ${ALL_CHECKS.length} checks, for ${p.header}.`,
    );
    for (const line of describe(p, { local: false })) console.log(line);
  }
  const has = (...prefixes) =>
    p.checks.some((id) =>
      prefixes.some((x) => (x.endsWith(":") ? id.startsWith(x) : id === x)),
    );
  const outputs = {
    checks: JSON.stringify(p.checks),
    full: String(p.full),
    build_lint: String(has("build:", "lint:", "typecheck:")),
    tests: String(has("test:dox", "test:gmt-oxlint")),
    gmt_tests: String(has("test:gmt")),
  };
  const file = process.env.GITHUB_OUTPUT;
  for (const [key, value] of Object.entries(outputs)) {
    console.log(`${key}=${value}`);
    if (file) appendFileSync(file, `${key}=${value}\n`);
  }
  return 0;
}

/** Runs each check with the read tracer, then lists the reads the rules do not cover. */
function audit(opts) {
  const keep = onlyFilter(opts.only);
  const checks = CHECKS.filter((c) => keep(c.id));
  const dir = opts.logs ?? mkdtempSync(join(tmpdir(), "affected-audit-"));
  const logOf = (id) => join(dir, `${id.replaceAll(":", "-")}.log`);
  if (!opts.logs) {
    const tracer = pathToFileURL(
      join(ROOT, "scripts/lib/read-tracer.mjs"),
    ).href;
    for (const check of checks) {
      writeFileSync(logOf(check.id), "");
      console.log(`\n▶ ${check.id}: ${check.run}`);
      const r = spawnSync(check.run, {
        cwd: ROOT,
        shell: true,
        stdio: "inherit",
        env: {
          ...process.env,
          AFFECTED_TRACE_ROOT: ROOT,
          AFFECTED_TRACE_LOG: logOf(check.id),
          NODE_OPTIONS:
            `${process.env.NODE_OPTIONS ?? ""} --import=${tracer}`.trim(),
        },
      });
      if (r.status !== 0) {
        console.error(
          `\n✗ ${check.id} failed (exit ${r.status ?? r.signal}); the audit needs every check to pass.`,
        );
        return r.status || 1;
      }
    }
  }
  const traces = new Map();
  for (const check of checks) {
    if (existsSync(logOf(check.id)))
      traces.set(check.id, lines(readFileSync(logOf(check.id), "utf8")));
    else console.log(`  no log for ${check.id} in ${dir}`);
  }
  // A check with no log measured nothing, so it cannot pass.
  if (traces.size < checks.length) {
    console.error(
      `\n✗ ${checks.length - traces.size} of ${checks.length} checks have no read log in ${dir}.`,
    );
    return 1;
  }
  const misses = uncovered(traces, lines(git("ls-files")));
  console.log(`\nRead logs: ${dir}`);
  if (misses.length === 0) {
    console.log(
      `✓ Every read of ${traces.size} checks is covered by a rule. Native tools are not traced; see scripts/lib/affected.mjs.`,
    );
    return 0;
  }
  console.log(
    `✗ ${misses.length} reads the rules in scripts/lib/affected.mjs do not cover:`,
  );
  for (const m of misses)
    console.log(`  ${m.check.padEnd(22)} ${m.via.padEnd(10)} ${m.path}`);
  return 1;
}

// `scripts/verdict.mjs validate` imports `plan`; only a direct run is the command line.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    assertRulesValid();
    const [command, ...rest] = process.argv.slice(2);
    const opts = parseArgs(rest);
    const commands = { run, show, github, audit };
    if (!commands[command]) {
      console.error(
        "Usage: node scripts/affected.mjs run|show|github|audit [options] — see the header of this file.",
      );
      process.exit(2);
    }
    process.exit(commands[command](opts));
  } catch (error) {
    console.error(`affected: ${error.message}`);
    process.exit(2);
  }
}
