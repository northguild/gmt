import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterRetry,
  KILL_GRACE_MS,
  readReport,
  retryFits,
  runCommand,
  TIMED_OUT,
} from "./run-command.mjs";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "run-command-"));
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(dir, { recursive: true, force: true });
});

const finding = (page: string) =>
  `${JSON.stringify({ kind: "finding", gate: "g", rule: "r", page })}\n`;
const measured = (n: number) => `${JSON.stringify({ kind: "measured", n })}\n`;

describe("readReport", () => {
  it("reads findings and the measured count", () => {
    const file = path.join(dir, "a.ndjson");
    writeFileSync(file, finding("/a/") + finding("/b/") + measured(3));
    const { findings, measured: n } = readReport(file);
    expect(findings.map((f) => f.page)).toEqual(["/a/", "/b/"]);
    expect(n).toBe(3);
  });

  it("drops every line past the offset, and a line the offset splits", () => {
    const file = path.join(dir, "a.ndjson");
    const kept = finding("/kept/");
    writeFileSync(file, kept + finding("/crash/") + measured(9));
    const whole = readReport(file, { upTo: kept.length });
    expect(whole.findings.map((f) => f.page)).toEqual(["/kept/"]);
    expect(whole.measured).toBeNull();
    const split = readReport(file, { upTo: kept.length + 10 });
    expect(split.findings.map((f) => f.page)).toEqual(["/kept/"]);
  });

  it("reads nothing from a report that was never written", () => {
    expect(readReport(path.join(dir, "none.ndjson"), { upTo: 0 })).toEqual({
      findings: [],
      measured: null,
    });
  });
});

describe("retryFits", () => {
  it("starts a retry only with more time left than the first attempt took", () => {
    expect(retryFits(10 * 60_000, 4 * 60_000)).toBe(true);
    expect(retryFits(4 * 60_000, 4 * 60_000)).toBe(false);
    expect(retryFits(60_000, 4 * 60_000)).toBe(false);
    expect(retryFits(Infinity, 4 * 60_000)).toBe(true);
  });
});

describe("afterRetry", () => {
  type Result = { status: string; findings?: string[]; outOfTime?: boolean };
  const first: Result = { status: "FAIL", findings: ["real finding"] };

  it("keeps the first attempt's status and findings when the deadline cuts the retry", () => {
    const { result, stop, flaky } = afterRetry(first, {
      status: "FAIL",
      findings: ["check-crashed"],
      outOfTime: true,
    });
    expect(result).toMatchObject({ ...first, outOfTime: true });
    expect(stop).toBe(true);
    expect(flaky).toBe(false);
  });

  it("calls a pass on retry flaky and any other failure the retry's own", () => {
    expect(afterRetry(first, { status: "PASS" })).toMatchObject({
      flaky: true,
      stop: false,
    });
    const again: Result = { status: "FAIL", findings: ["still"] };
    expect(afterRetry(first, again).result).toBe(again);
  });
});

describe("runCommand", () => {
  // A child that ignores SIGTERM, to prove the grace period ends in SIGKILL.
  const stubborn = `process.on("SIGTERM", () => {}); require("node:fs").writeFileSync(process.argv[1], "up"); setInterval(() => {}, 1000);`;
  let kill: (() => void) | null = null;
  afterEach(() => kill?.());

  it("notes the limit, sends SIGTERM and then SIGKILL after the grace", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const ready = path.join(dir, "ready");
    const log = path.join(dir, "out.log");
    const onLimit = vi.fn();
    const done = runCommand(process.execPath, ["-e", stubborn, ready], {
      log,
      limitMs: 60_000,
      onLimit,
      onSpawn: (p) => {
        kill = p ? () => p.kill("SIGKILL") : null;
      },
    });
    // Poll on the real clock (setImmediate is not faked) until the child has its handler.
    while (!existsSync(ready)) await new Promise((r) => setImmediate(r));
    vi.advanceTimersByTime(60_000);
    expect(onLimit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(KILL_GRACE_MS);
    expect(await done).toBe(TIMED_OUT);
  });

  it("resolves a child's own exit code before the limit", async () => {
    const log = path.join(dir, "out.log");
    const code = await runCommand(process.execPath, ["-e", "process.exit(3)"], {
      log,
      limitMs: 60_000,
    });
    expect(code).toBe(3);
  });
});
