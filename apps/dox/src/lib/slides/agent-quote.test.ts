import { describe, expect, it } from "vitest";
import {
  agentAnswers,
  agentQuote,
  excerptOf,
  quotedAnswer,
  hashOf,
  TRANSCRIPT_FIELDS,
  valueLabel,
  zoneSpread,
  type AgentQuoteConfig,
  type AgentQuoteRecord,
  type AgentRunFile,
  type AgentRunRecord,
  type AgentTranscript,
} from "./agent-quote";

const CONFIG: AgentQuoteConfig = {
  shown: { node: "26", zone: "Europe/Helsinki" },
  answerPath: "quotes/agent-answer.json",
  runCommand: "node agent-answer.mjs",
};
const SHOWN = CONFIG.shown;

const full: AgentQuoteRecord = {
  question: "q",
  model: "m",
  date: "d",
  answer: "a",
  code: "one\ntwo\nthree\nfour",
  call: "f()",
};

const runFor = (
  record: AgentQuoteRecord,
  value = "2027-03-28T00:30:00.000Z",
): AgentRunRecord => ({
  sha256: hashOf(record.code, record.call),
  command: "c",
  instant: "2026-11-19T00:00:00Z",
  libraries: { luxon: "3.7.2" },
  nodes: [
    { node: "24", version: "v24.0.0", tzdata: "t" },
    { node: SHOWN.node, version: `v${SHOWN.node}.0.0`, tzdata: "t" },
  ],
  zones: [SHOWN.zone, "Pacific/Niue"],
  values: [
    ["other", "other"],
    [value, { threw: "Error: x" }],
  ],
});

describe("the agent quote", () => {
  it("is ready with a matching run record, and counts distinct values", () => {
    const quote = agentQuote(full, runFor(full), CONFIG);
    expect(quote).toMatchObject({
      ready: true,
      shownCode: full.code,
      lines: 4,
      distinct: 3,
      runs: 4,
      zones: 2,
      nodes: 2,
      nodesAgree: false,
      shown: {
        node: SHOWN.node,
        zone: SHOWN.zone,
        value: "2027-03-28T00:30:00.000Z",
      },
      libraries: { luxon: "3.7.2" },
    });
  });

  it("says the Node majors agree when every zone gave each of them the same value", () => {
    const run = runFor(full);
    const agreeing = { ...run, values: [run.values[1]!, run.values[1]!] };
    expect(agentQuote(full, agreeing, CONFIG)).toMatchObject({
      ready: true,
      distinct: 2,
      nodesAgree: true,
    });
  });

  it.each(TRANSCRIPT_FIELDS)(
    "shows the transcript panel while %s is empty",
    (field) => {
      const quote = agentQuote(
        { ...full, [field]: "  " },
        runFor(full),
        CONFIG,
      );
      expect(quote).toMatchObject({ ready: false, why: "transcript" });
      if (quote.ready) throw new Error("expected a pending quote");
      expect(quote.problem).toContain("agent-answer.json");
      expect(quote.problem).toContain(field);
      expect(quote.problem).toContain("node agent-answer.mjs");
    },
  );

  it("keeps the question when the rest is to come", () => {
    const quote = agentQuote({ ...full, code: "" }, null, CONFIG);
    expect(quote).toMatchObject({ ready: false, question: "q" });
  });

  it.each([null, undefined])("says the run record is missing for %s", (run) => {
    const quote = agentQuote(full, run, CONFIG);
    expect(quote).toMatchObject({ ready: false, why: "run" });
    if (quote.ready) throw new Error("expected a pending quote");
    expect(quote.problem).toContain("is missing");
    expect(quote.problem).toContain("node agent-answer.mjs");
  });

  it("says the run record is out of date when the code changed", () => {
    const quote = agentQuote(
      { ...full, code: "changed" },
      runFor(full),
      CONFIG,
    );
    expect(quote).toMatchObject({ ready: false, why: "run" });
    if (quote.ready) throw new Error("expected a pending quote");
    expect(quote.problem).toContain("out of date");
  });

  it("says the run record is out of date when the call changed", () => {
    expect(
      agentQuote({ ...full, call: "g()" }, runFor(full), CONFIG),
    ).toMatchObject({
      ready: false,
      why: "run",
    });
  });

  it("says the run record is out of date when it lacks the shown run", () => {
    const run = runFor(full);
    run.nodes = run.nodes.slice(0, 1);
    run.values = run.values.slice(0, 1);
    const quote = agentQuote(full, run, CONFIG);
    expect(quote).toMatchObject({ ready: false, why: "run" });
    if (quote.ready) throw new Error("expected a pending quote");
    expect(quote.problem).toContain(`Node ${SHOWN.node}`);
  });

  it("says the run record is not a grid when a Node major lacks a zone's value", () => {
    const run = runFor(full);
    run.values[1] = run.values[1]!.slice(0, 1);
    const quote = agentQuote(full, run, CONFIG);
    expect(quote).toMatchObject({ ready: false, why: "run" });
    if (quote.ready) throw new Error("expected a pending quote");
    expect(quote.problem).toContain("not a grid");
  });

  it("applies the excerpt, and refuses ranges outside the code", () => {
    const quote = agentQuote(
      {
        ...full,
        excerpt: [
          [1, 1],
          [3, 4],
        ],
      },
      runFor(full),
      CONFIG,
    );
    expect(quote).toMatchObject({
      ready: true,
      shownCode: "one\n// …\nthree\nfour",
    });
    expect(
      agentQuote({ ...full, excerpt: [[2, 9]] }, runFor(full), CONFIG),
    ).toMatchObject({
      ready: false,
    });
  });
});

describe("several answers", () => {
  const { question, ...rest } = full;
  const transcript: AgentTranscript = {
    question,
    quoted: "two",
    answers: [
      { ...rest, id: "one", model: "First" },
      { ...rest, id: "two", model: "Second", code: "x\ny" },
    ],
  };
  const runsFor = (t: AgentTranscript): AgentRunFile =>
    Object.fromEntries(
      t.answers.map((a) => [a.id, runFor({ ...a, question: t.question })]),
    );

  it("lists every answer in file order, each with its model and quote", () => {
    const all = agentAnswers(transcript, runsFor(transcript), CONFIG);
    expect(all.map((a) => [a.id, a.model, a.quote.ready])).toEqual([
      ["one", "First", true],
      ["two", "Second", true],
    ]);
    expect(all[1]!.quote).toMatchObject({ lines: 2, question });
  });

  it("quotes the answer `quoted` names", () => {
    expect(quotedAnswer(transcript, runsFor(transcript), CONFIG)).toMatchObject(
      {
        ready: true,
        model: "Second",
        code: "x\ny",
      },
    );
  });

  it("names the answer whose run record is missing", () => {
    const runs = runsFor(transcript);
    delete runs["one"];
    const [one, two] = agentAnswers(transcript, runs, CONFIG);
    expect(two!.quote.ready).toBe(true);
    if (one!.quote.ready) throw new Error("expected a pending quote");
    expect(one!.quote.problem).toContain('Answer "one"');
    expect(one!.quote.problem).toContain("is missing");
  });

  it("is not ready when `quoted` names no answer, or there are none", () => {
    for (const t of [
      { ...transcript, quoted: "three" },
      { ...transcript, answers: [] },
    ]) {
      const quote = quotedAnswer(t, runsFor(transcript), CONFIG);
      expect(quote).toMatchObject({
        ready: false,
        why: "transcript",
        question,
      });
      if (quote.ready) throw new Error("expected a pending quote");
      expect(quote.problem).toContain("agent-answer.json");
    }
  });
});

describe("excerptOf", () => {
  it("returns the whole code without ranges", () => {
    expect(excerptOf("a\nb", undefined)).toBe("a\nb");
    expect(excerptOf("a\nb", [])).toBe("a\nb");
  });
  it.each([[[0, 1]], [[2, 1]], [[1, 3]], [[1.5, 2]]] as [[number, number]][])(
    "refuses the range %j",
    (range) => {
      expect(excerptOf("a\nb", [range])).toBeUndefined();
    },
  );
});

describe("hashOf", () => {
  it("joins code and call with a NUL, as the runner does", () => {
    expect(hashOf("a", "b")).toBe(
      "59b271ae1bbcb1d31d41929817f4b16fb439eb4f31520b5ad1d5ce98920a7138",
    );
  });
});

describe("valueLabel", () => {
  it("shows a value, or what was thrown", () => {
    expect(valueLabel("x")).toBe("x");
    expect(valueLabel({ threw: "RangeError: y" })).toBe("Threw RangeError: y");
  });
});

describe("how the machine's time zone changes an answer", () => {
  it("says so when every zone gave the same answer", () => {
    expect(zoneSpread({ distinct: 1, zones: 11 })).toBe(
      "Same answer in all 11",
    );
  });

  it("counts the answers when the zones disagree", () => {
    expect(zoneSpread({ distinct: 11, zones: 11 })).toBe(
      "11 different answers in 11",
    );
  });
});
