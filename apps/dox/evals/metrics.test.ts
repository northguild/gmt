import corpusJson from "../src/generated/reference/gmt-corpus.json";
import type { RetrievalChunk } from "../src/lib/retrieval/types";
import type { VocabularySkill } from "../worker/select-vocabulary";
import type { EvalCase } from "./cases";
import {
  PASS_FAIL_METRICS,
  resolveName,
  scoreCases,
  trunc3,
  type TurnResult,
} from "./metrics";

const nameA = corpusJson[0]!.name;
const nameB = corpusJson[1]!.name;

/** A chunk that answers a gmt name. */
const chunkFor = (name: string): RetrievalChunk => ({
  id: resolveName(name),
  kind: "function",
  url: `/reference/${name}/`,
  namespace: "x",
  title: name,
  text: "",
});
const guide = (url: string): RetrievalChunk => ({
  id: url,
  kind: "guide",
  url,
  namespace: "g",
  title: "g",
  text: "",
});
const filler = (n: number): RetrievalChunk[] =>
  Array.from({ length: n }, (_, i) => guide(`/guides/filler-${i}/`));
const skill = (name: string): VocabularySkill => ({
  name,
  body: "",
  modules: [],
  pages: [],
});

const turn = (overrides: Partial<TurnResult> = {}): TurnResult => ({
  searched: [],
  retrieved: [],
  offered: [],
  chosen: [],
  ...overrides,
});

/** One case per metric so none is empty; every one passes unless a test says otherwise. */
function fixture(): { cases: EvalCase[]; run: Record<string, TurnResult> } {
  const cases: EvalCase[] = [
    {
      id: "a",
      kind: "lookup",
      question: "q",
      chunks: [nameA],
      k: 2,
      skill: "s1",
      tool: "showDstInspector",
    },
    { id: "off", kind: "offTopic", question: "q", skill: null },
  ];
  const hit = turn({
    searched: [chunkFor(nameA)],
    retrieved: [chunkFor(nameA)],
    offered: ["showDstInspector"],
    chosen: [skill("s1")],
  });
  return { cases, run: { a: hit, off: turn() } };
}

describe("scoreCases", () => {
  it("scores a clean run as 1 everywhere with no failures", () => {
    const { cases, run } = fixture();
    const scores = scoreCases(cases, run);
    for (const name of [...PASS_FAIL_METRICS, "retrieval.mrr" as const]) {
      expect(scores.metrics[name], name).toBe(1);
      expect(scores.failures[name], name).toEqual([]);
    }
    expect(scores.ranks).toEqual({ a: 1 });
  });

  it("gives a hit at rank 3 a reciprocal rank of one third", () => {
    const { cases, run } = fixture();
    run.a = turn({
      ...run.a,
      searched: [...filler(2), chunkFor(nameA)],
    });
    const scores = scoreCases(cases, run);
    expect(scores.metrics["retrieval.mrr"]).toBeCloseTo(1 / 3);
    expect(scores.ranks.a).toBe(3);
    expect(scores.failures["retrieval.withinK"]).toEqual(["a"]);
    expect(scores.failures["retrieval.recallAt10"]).toEqual([]);
  });

  it("fails recall for a missing expectation and counts expectations once each", () => {
    const { cases, run } = fixture();
    cases[0] = { ...cases[0]!, chunks: [nameA, nameB] };
    const scores = scoreCases(cases, run);
    expect(scores.metrics["retrieval.recallAt10"]).toBe(0.5);
    expect(scores.failures["retrieval.recallAt10"]).toEqual(["a"]);
  });

  it("does not count a hit past rank 10 for recall", () => {
    const { cases, run } = fixture();
    run.a = turn({ ...run.a, searched: [...filler(10), chunkFor(nameA)] });
    const scores = scoreCases(cases, run);
    expect(scores.failures["retrieval.recallAt10"]).toEqual(["a"]);
    expect(scores.ranks.a).toBe(11);
  });

  it("scores a rank of 0 for an absent first expectation", () => {
    const { cases, run } = fixture();
    run.a = turn({ ...run.a, searched: filler(2) });
    const scores = scoreCases(cases, run);
    expect(scores.ranks.a).toBe(0);
    expect(scores.metrics["retrieval.mrr"]).toBe(0);
  });

  it("matches a URL prefix and any alternative of an array", () => {
    const { cases, run } = fixture();
    cases[0] = {
      ...cases[0]!,
      chunks: [["/guides/leap/", nameB], "/guides/other/"],
    };
    run.a = turn({
      ...run.a,
      searched: [guide("/guides/leap/#x"), guide("/guides/other/")],
      retrieved: [guide("/guides/leap/#x"), guide("/guides/other/")],
    });
    const scores = scoreCases(cases, run);
    expect(scores.failures["retrieval.recallAt10"]).toEqual([]);
    expect(scores.failures["fit.kept"]).toEqual([]);
  });

  it("fails fit.kept when the cut drops a hit", () => {
    const { cases, run } = fixture();
    run.a = turn({ ...run.a, retrieved: [] });
    expect(scoreCases(cases, run).failures["fit.kept"]).toEqual(["a"]);
  });

  it("checks the skill, and an empty pick for a null skill", () => {
    const { cases, run } = fixture();
    run.a = turn({ ...run.a, chosen: [skill("other")] });
    run.off = turn({ chosen: [skill("s1")] });
    expect(scoreCases(cases, run).failures["vocabulary.hit"]).toEqual([
      "a",
      "off",
    ]);
  });

  it("checks the tool offer", () => {
    const { cases, run } = fixture();
    run.a = turn({ ...run.a, offered: [] });
    expect(scoreCases(cases, run).failures["tools.offered"]).toEqual(["a"]);
  });

  it("holds an off-topic question to under five hits", () => {
    const { cases, run } = fixture();
    run.off = turn({ searched: filler(5) });
    expect(scoreCases(cases, run).failures["refusal.quiet"]).toEqual(["off"]);
    run.off = turn({ searched: filler(4) });
    expect(scoreCases(cases, run).failures["refusal.quiet"]).toEqual([]);
  });

  it("throws when a metric has no eligible case", () => {
    const { cases, run } = fixture();
    expect(() => scoreCases([cases[0]!], run)).toThrow(/refusal\.quiet/);
  });

  it("throws for a case with no result", () => {
    const { cases } = fixture();
    expect(() => scoreCases(cases, {})).toThrow(/no result/);
  });
});

describe("resolveName and trunc3", () => {
  it("resolves a corpus name to its chunk id and rejects an unknown one", () => {
    expect(resolveName(nameA)).toMatch(new RegExp(`/${nameA}$`));
    expect(() => resolveName("noSuchFunction")).toThrow(
      /not in the gmt corpus/,
    );
  });

  it("truncates to 3 decimals instead of rounding", () => {
    expect(trunc3(0.8749999)).toBe(0.874);
    expect(trunc3(1)).toBe(1);
    expect(trunc3(2 / 3)).toBe(0.666);
  });
});
