import { CASES, LIVE_CASES, type EvalCase } from "./cases";
import {
  DEFAULT_BUDGET,
  DEFAULT_GEMINI_CAP,
  NEURONS_PER_MILLION,
  RunGuard,
  WORST_CASE_NEURONS,
  casesFor,
  estimateNeurons,
  measureNeurons,
  parseRunArgs,
  parseUsageLines,
  type GuardBrain,
} from "./budget";

const cf: GuardBrain = {
  id: "cf-a",
  provider: "workers-ai",
  model: Object.keys(NEURONS_PER_MILLION)[0],
};
const cf2: GuardBrain = {
  id: "cf-b",
  provider: "workers-ai",
  model: Object.keys(NEURONS_PER_MILLION)[1],
};
const gem: GuardBrain = { id: "gem-a", provider: "google" };
const known = { brains: [cf, cf2, gem], liveCases: LIVE_CASES };
const limits = { budget: 500, geminiCap: 2, geminiReserve: 10 };

describe("RunGuard", () => {
  it("stops before the case that would cross the budget and keeps stopping", () => {
    const guard = new RunGuard(limits);
    const ids = LIVE_CASES.map((c) => c.id);
    let started = 0;
    const notes: string[] = [];
    for (const id of ids) {
      const decision = guard.decide(cf, id);
      if (decision.start) {
        started++;
        guard.record(cf, 100);
      } else notes.push(decision.note);
    }
    // A case starts while spent + the worst-case estimate fits the budget; each costs 100.
    expect(started).toBe(
      Math.min(
        ids.length,
        Math.floor((limits.budget - WORST_CASE_NEURONS) / 100) + 1,
      ),
    );
    expect(started).toBeLessThan(ids.length);
    expect(notes).toHaveLength(ids.length - started);
    expect(new Set(notes)).toEqual(new Set(["budget"]));
    expect(guard.stopped).toBe(true);
  });

  it("estimates from the committed report before the worst case", () => {
    const committed = { [cf.id]: { cases: { cheap: { neurons: 20 } } } };
    expect(estimateNeurons(committed[cf.id], "cheap")).toBe(20);
    expect(estimateNeurons(committed[cf.id], "other")).toBe(WORST_CASE_NEURONS);
    expect(estimateNeurons(undefined, "x")).toBe(WORST_CASE_NEURONS);

    const guard = new RunGuard({ ...limits, budget: 100 }, committed);
    expect(guard.decide(cf, "cheap")).toEqual({ start: true });
    expect(guard.decide(cf, "other")).toMatchObject({
      start: false,
      note: "budget",
      endsRun: true,
    });
  });

  it("allows a case that lands exactly on the budget", () => {
    const guard = new RunGuard({ ...limits, budget: WORST_CASE_NEURONS });
    expect(guard.decide(cf, "x")).toEqual({ start: true });
  });

  it("caps Gemini requests per model and carries on for other brains", () => {
    const guard = new RunGuard(limits);
    for (let i = 0; i < limits.geminiCap; i++) {
      expect(guard.decide(gem, "c", 20)).toEqual({ start: true });
      guard.record(gem, 0);
    }
    expect(guard.decide(gem, "c", 20)).toEqual({
      start: false,
      note: "gemini cap",
      endsRun: false,
    });
    expect(guard.decide(cf, "c")).toEqual({ start: true });
    expect(guard.stopped).toBe(false);
  });

  it("skips Gemini when the reserve would be crossed", () => {
    const guard = new RunGuard(limits);
    expect(guard.decide(gem, "c", limits.geminiReserve + 1)).toEqual({
      start: true,
    });
    expect(guard.decide(gem, "c", limits.geminiReserve)).toMatchObject({
      start: false,
      note: "gemini cap",
    });
  });

  it("does not count Gemini requests as Neurons", () => {
    const guard = new RunGuard(limits);
    guard.record(gem, 999);
    expect(guard.spent).toBe(0);
  });
});

describe("measureNeurons", () => {
  const log = [
    "noise",
    `[wrangler] dox-usage {"brain":"${cf.id}","inputTokens":4000,"outputTokens":300}`,
    "dox-usage not json",
  ].join("\n");

  it("converts the brain's usage line with the rate table", () => {
    const lines = parseUsageLines(log);
    expect(lines).toHaveLength(1);
    const [input, output] = NEURONS_PER_MILLION[cf.model!]!;
    expect(measureNeurons(cf, lines)).toEqual({
      neurons: Math.round((4000 * input + 300 * output) / 1e6),
      measured: true,
    });
  });

  it("counts an answer with no usage line as the worst case and flags it", () => {
    expect(measureNeurons(cf, [])).toEqual({
      neurons: WORST_CASE_NEURONS,
      measured: false,
    });
    expect(measureNeurons(cf2, parseUsageLines(log))).toEqual({
      neurons: WORST_CASE_NEURONS,
      measured: false,
    });
  });
});

describe("parseRunArgs", () => {
  const log = ["--log", "x.log"];

  it("runs BRAINS[0] and the live subset by default", () => {
    const parsed = parseRunArgs(log, {}, known);
    expect(parsed).toMatchObject({ kind: "run", brains: [cf] });
    if (parsed.kind !== "run") throw new Error("expected a run");
    expect(parsed.cases).toEqual([...LIVE_CASES]);
    expect(parsed.options.budget).toBe(DEFAULT_BUDGET);
    expect(parsed.options.geminiCap).toBe(DEFAULT_GEMINI_CAP);
  });

  it("refuses under CI, even for --help-free previews", () => {
    expect(parseRunArgs(log, { CI: "true" }, known)).toMatchObject({
      kind: "error",
    });
    expect(parseRunArgs(["--brains", "all"], { CI: "1" }, known)).toMatchObject(
      { kind: "error" },
    );
  });

  it("refuses a Workers AI run without --log", () => {
    const parsed = parseRunArgs([], {}, known);
    expect(parsed).toMatchObject({ kind: "error" });
    expect(parsed.kind === "error" && parsed.message).toContain("--log");
    // A Gemini-only run measures no Neurons, so needs no log.
    expect(parseRunArgs(["--brains", gem.id], {}, known).kind).toBe("run");
  });

  it("runs nothing for --brains all without --confirm-spend, and prints each brain's cost", () => {
    const parsed = parseRunArgs(["--brains", "all"], {}, known);
    expect(parsed.kind).toBe("preview");
    if (parsed.kind !== "preview") return;
    for (const brain of known.brains)
      expect(parsed.lines.some((line) => line.includes(brain.id))).toBe(true);
    const geminiOnly = casesFor(gem, LIVE_CASES).length;
    expect(parsed.lines.join("\n")).toContain(
      `${geminiOnly} cases, up to ${Math.min(geminiOnly, DEFAULT_GEMINI_CAP)} requests`,
    );
    expect(parsed.lines.at(-1)).toContain("--confirm-spend");

    const confirmed = parseRunArgs(
      ["--brains", "all", "--confirm-spend", ...log],
      {},
      known,
    );
    expect(confirmed).toMatchObject({ kind: "run" });
    expect(confirmed.kind === "run" && confirmed.brains).toEqual(known.brains);
  });

  it("limits the run with --only and --case, and rejects unknown ids", () => {
    const [a, b] = LIVE_CASES;
    const parsed = parseRunArgs(
      [...log, "--only", a!.id, "--case", b!.id],
      {},
      known,
    );
    expect(parsed.kind === "run" && parsed.cases.map((c) => c.id)).toEqual([
      a!.id,
      b!.id,
    ]);
    expect(
      parseRunArgs([...log, "--only", "no-such-case"], {}, known),
    ).toMatchObject({ kind: "error" });
    const notLive = CASES.find((c) => !c.live)!;
    expect(
      parseRunArgs([...log, "--case", notLive.id], {}, known),
    ).toMatchObject({ kind: "error" });
  });

  it("rejects an unknown brain, a bad number and an unknown flag; --help wins", () => {
    expect(parseRunArgs([...log, "--brains", "nope"], {}, known)).toMatchObject(
      { kind: "error" },
    );
    expect(parseRunArgs([...log, "--budget", "lots"], {}, known)).toMatchObject(
      { kind: "error" },
    );
    expect(parseRunArgs([...log, "--bogus"], {}, known)).toMatchObject({
      kind: "error",
    });
    expect(parseRunArgs(["--help"], {}, known)).toEqual({ kind: "help" });
  });
});

describe("casesFor", () => {
  it("runs a provider case only on that provider's brains", () => {
    const only: EvalCase = {
      id: "p",
      kind: "fault",
      question: "q",
      provider: "google",
    };
    const plain: EvalCase = { id: "n", kind: "fault", question: "q" };
    expect(casesFor(cf, [only, plain])).toEqual([plain]);
    expect(casesFor(gem, [only, plain])).toEqual([only, plain]);
  });
});
