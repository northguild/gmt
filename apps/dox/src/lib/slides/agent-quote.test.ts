import { describe, expect, it } from "vitest";
import { SHOWN_ZONE } from "../../../../../scripts/zone-matrix/agent-answer.mjs";
import answer from "~/slides/give-me-temporal/quotes/agent-answer.json";
import runRecord from "~/slides/give-me-temporal/quotes/agent-run.json";
import {
  agentAnswers,
  agentQuote,
  excerptOf,
  quotedAnswer,
  hashOf,
  SHOWN,
  TRANSCRIPT_FIELDS,
  valueLabel,
  type AgentQuoteRecord,
  type AgentRunFile,
  type AgentRunRecord,
  type AgentTranscript,
} from "./agent-quote";

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
  runs: [
    { node: "24", tzdata: "t", zone: SHOWN.zone, value: "other" },
    { node: SHOWN.node, tzdata: "t", zone: SHOWN.zone, value },
    {
      node: SHOWN.node,
      tzdata: "t",
      zone: "Pacific/Niue",
      value: { threw: "Error: x" },
    },
    { node: SHOWN.node, tzdata: "t", zone: "UTC", value },
  ],
});

describe("the agent quote", () => {
  it("is ready with a matching run record, and counts distinct values", () => {
    const quote = agentQuote(full, runFor(full));
    expect(quote).toMatchObject({
      ready: true,
      shownCode: full.code,
      lines: 4,
      distinct: 3,
      runs: 4,
      zones: 3,
      nodes: 2,
      shown: {
        node: SHOWN.node,
        zone: SHOWN.zone,
        value: "2027-03-28T00:30:00.000Z",
      },
      libraries: { luxon: "3.7.2" },
    });
  });

  it.each(TRANSCRIPT_FIELDS)(
    "shows the transcript panel while %s is empty",
    (field) => {
      const quote = agentQuote({ ...full, [field]: "  " }, runFor(full));
      expect(quote).toMatchObject({ ready: false, why: "transcript" });
      if (quote.ready) throw new Error("expected a pending quote");
      expect(quote.problem).toContain("agent-answer.json");
      expect(quote.problem).toContain(field);
      expect(quote.problem).toContain("node agent-answer.mjs");
    },
  );

  it("keeps the question when the rest is to come", () => {
    const quote = agentQuote({ ...full, code: "" }, null);
    expect(quote).toMatchObject({ ready: false, question: "q" });
  });

  it.each([null, undefined])("says the run record is missing for %s", (run) => {
    const quote = agentQuote(full, run);
    expect(quote).toMatchObject({ ready: false, why: "run" });
    if (quote.ready) throw new Error("expected a pending quote");
    expect(quote.problem).toContain("is missing");
    expect(quote.problem).toContain("node agent-answer.mjs");
  });

  it("says the run record is out of date when the code changed", () => {
    const quote = agentQuote({ ...full, code: "changed" }, runFor(full));
    expect(quote).toMatchObject({ ready: false, why: "run" });
    if (quote.ready) throw new Error("expected a pending quote");
    expect(quote.problem).toContain("out of date");
  });

  it("says the run record is out of date when the call changed", () => {
    expect(agentQuote({ ...full, call: "g()" }, runFor(full))).toMatchObject({
      ready: false,
      why: "run",
    });
  });

  it("says the run record is out of date when it lacks the shown run", () => {
    const run = runFor(full);
    run.runs = run.runs.filter(
      (r) => r.zone !== SHOWN.zone || r.node !== SHOWN.node,
    );
    const quote = agentQuote(full, run);
    expect(quote).toMatchObject({ ready: false, why: "run" });
    if (quote.ready) throw new Error("expected a pending quote");
    expect(quote.problem).toContain(`Node ${SHOWN.node}`);
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
    );
    expect(quote).toMatchObject({
      ready: true,
      shownCode: "one\n// …\nthree\nfour",
    });
    expect(
      agentQuote({ ...full, excerpt: [[2, 9]] }, runFor(full)),
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
    const all = agentAnswers(transcript, runsFor(transcript));
    expect(all.map((a) => [a.id, a.model, a.quote.ready])).toEqual([
      ["one", "First", true],
      ["two", "Second", true],
    ]);
    expect(all[1]!.quote).toMatchObject({ lines: 2, question });
  });

  it("quotes the answer `quoted` names", () => {
    expect(quotedAnswer(transcript, runsFor(transcript))).toMatchObject({
      ready: true,
      model: "Second",
      code: "x\ny",
    });
  });

  it("names the answer whose run record is missing", () => {
    const runs = runsFor(transcript);
    delete runs["one"];
    const [one, two] = agentAnswers(transcript, runs);
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
      const quote = quotedAnswer(t, runsFor(transcript));
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

describe("the committed records", () => {
  it("hold the transcript fields and the question the owner asked", () => {
    expect(Object.keys(answer).sort()).toEqual([
      "answers",
      "question",
      "quoted",
    ]);
    const fields = TRANSCRIPT_FIELDS.filter((f) => f !== "question");
    for (const a of answer.answers)
      expect(
        Object.keys(a)
          .filter((k) => k !== "excerpt")
          .sort(),
      ).toEqual(["id", ...fields].sort());
    expect(answer.question).toBe(
      "Write a JavaScript function that sets a reminder for 03:30 on 28 March 2027, Helsinki time, and returns the time as a UTC ISO string.",
    );
  });

  it("keep one run record per answer, of the run record's shape", () => {
    expect(Object.keys(runRecord)).toEqual(answer.answers.map((a) => a.id));
    for (const record of Object.values(runRecord))
      expect(Object.keys(record).sort()).toEqual([
        "command",
        "instant",
        "libraries",
        "runs",
        "sha256",
      ]);
  });

  it("are ready: every answer is filled and its run record is current", () => {
    for (const { id, quote } of agentAnswers(
      answer as AgentTranscript,
      runRecord as AgentRunFile,
    ))
      expect(quote.ready ? "ready" : quote.problem, id).toBe("ready");
    expect(
      quotedAnswer(answer as AgentTranscript, runRecord as AgentRunFile).ready,
    ).toBe(true);
  });

  it("show a zone the script runs in, whatever the CI matrix lists", () => {
    expect(SHOWN.zone).toBe(SHOWN_ZONE);
  });
});
