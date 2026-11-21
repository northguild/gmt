/**
 * What the matrix runner (`run.mjs`), the zone probe (`probe/run.mjs`) and the agent-answer runner
 * (`agent-answer.mjs`) share: stopping with a message, reading flags, running a command on a Node
 * major under `fnm exec`, reading a Node major's version and tzdata, and a bounded work pool.
 */
import { spawn, spawnSync } from "node:child_process";

export class StepError extends Error {}

/** Prints `message` and exits with `code`. */
export const stop = (code, message) => {
  console.error(message);
  process.exit(code);
};

/**
 * Reads `--plan`, repeatable list flags, numeric flags and string flags. An unknown flag stops the
 * run with exit 2.
 *
 * @param {string[]} argv
 * @param {{ lists: string[]; numbers?: Record<string, number>; strings?: Record<string, string> }} spec
 *   the list flags (`--zone` becomes `out.zone`) and the flags with a default value
 */
export function parseFlags(argv, { lists, numbers = {}, strings = {} }) {
  const out = { plan: false, ...numbers, ...strings };
  for (const name of lists) out[name] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const name = a.slice(2);
    if (a === "--plan") out.plan = true;
    else if (lists.includes(name)) out[name].push(argv[++i]);
    else if (name in numbers) out[name] = Number(argv[++i]);
    else if (name in strings) out[name] = argv[++i];
    else stop(2, `unknown flag ${a}`);
  }
  return out;
}

/** Runs a command to the end and returns its trimmed stdout; throws a `StepError` when it fails. */
export function sh(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 1 << 28,
    ...options,
  });
  if (r.status !== 0) {
    throw new StepError(
      `${cmd} ${args.join(" ")} failed (${r.status})\n${(r.stderr ?? "").slice(-600)}${(r.stdout ?? "").slice(-300)}`,
    );
  }
  return r.stdout.trim();
}

/** The `fnm` argument list that runs `cmd` on the given Node major. */
export const fnmArgs = (major, cmd, args) => [
  "exec",
  `--using=${major}`,
  "--",
  cmd,
  ...args,
];

/** Runs a command on the given Node major. Resolves with the exit code and both streams. */
export function onNode(major, cmd, args, { cwd, env }) {
  return new Promise((resolve) => {
    const child = spawn("fnm", fnmArgs(major, cmd, args), {
      cwd,
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.on("error", (error) =>
      resolve({ code: 127, stdout, stderr: String(error) }),
    );
  });
}

/** The full version and the time-zone data (`process.versions.tz`) of a Node major. */
export const nodeInfoOf = (major) => {
  const [version, tzdata] = sh(
    "fnm",
    fnmArgs(major, "node", [
      "-p",
      "process.version + ' ' + process.versions.tz",
    ]),
  ).split(" ");
  return { version, tzdata };
};

/** Runs `jobs` (functions returning promises) with at most `limit` at once. */
export async function pool(jobs, limit) {
  const results = Array.from({ length: jobs.length });
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        results[i] = await jobs[i]();
      }
    }),
  );
  return results;
}
