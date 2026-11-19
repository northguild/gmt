import { describe, expect, it } from "vitest";
import answer from "~/slides/give-me-temporal/quotes/agent-answer.json";
import runRecord from "~/slides/give-me-temporal/quotes/agent-run.json";
import {
  agentQuote,
  excerptOf,
  hashOf,
  SHOWN,
  TRANSCRIPT_FIELDS,
  valueLabel,
  type AgentQuoteRecord,
  type AgentRunRecord,
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

describe("the one-clock agent quote", () => {
  it("is ready with a matching run record, and counts distinct values", () => {
    const quote = agentQuote(full, runFor(full));
    expect(quote).toMatchObject({
      ready: true,
      shownCode: full.code,
      distinct: 3,
      runs: 4,
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
    expect(Object.keys(answer).sort()).toEqual([...TRANSCRIPT_FIELDS].sort());
    expect(answer.question).toBe(
      "Write a JavaScript function that sets a reminder for 03:30 on 28 March 2027, Helsinki time, and returns the time as a UTC ISO string.",
    );
  });

  it("keep the run record's shape", () => {
    expect(Object.keys(runRecord).sort()).toEqual([
      "command",
      "instant",
      "libraries",
      "runs",
      "sha256",
    ]);
  });

  it("are either ready or say which file and command fix them", () => {
    const quote = agentQuote(answer, runRecord);
    if (!quote.ready) {
      expect(quote.problem).toContain("agent-answer.json");
      expect(quote.problem).toContain("node agent-answer.mjs");
    }
  });
});
