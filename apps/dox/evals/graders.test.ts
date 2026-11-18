import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, type EvalCase } from "./cases";
import {
  buildGraderContext,
  extractIdentifiers,
  extractLinks,
  grade,
  normaliseHref,
  unknownIdentifiers,
  type GraderContext,
} from "./graders";
import { readStream, type TurnRecord } from "./read-stream";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = async (name: string, status = 200) =>
  readStream(
    readFileSync(join(here, "fixtures", `${name}.sse`), "utf8").split("\n"),
    status,
  );

const BRAIN = "cf-gemma-4-26b";
const context: GraderContext = buildGraderContext(BRAIN);

const converter = CASES.find(
  (c) => c.kind === "starter" && c.tool === "showConverterBench",
)!;
const converterCall = {
  toolName: converter.tool as string,
  input: converter.input,
};

/** A record that passes every check for `converter`; each test breaks one thing. */
const goodRecord = (): TurnRecord => ({
  status: 200,
  brainId: BRAIN,
  chunkUrls: ["/reference/zoned/convert/convertZonedToZoned"],
  answer:
    "That is 12:30 in Tokyo, from [convertZonedToZoned](/gmt/reference/zoned/convert/convertZonedToZoned).",
  toolCalls: [converterCall],
  toolErrors: [],
  errors: [],
  refusalPart: false,
});

const asCase = (extra: Partial<EvalCase>): EvalCase => ({
  id: "t",
  kind: "starter",
  question: "q",
  tool: converter.tool,
  input: converter.input,
  ...extra,
});

describe("grade", () => {
  it("passes a clean tool-then-prose turn", async () => {
    const record = await fixture("tool-then-prose");
    // The fixture's input is the converter starter's, with the brain it asked.
    const verdict = await grade(
      asCase({ names: ["convertZonedToZoned"], match: ["to"] }),
      { ...record, toolCalls: [{ ...converterCall, input: converter.input }] },
      context,
    );
    expect(verdict.notes).toEqual([]);
    expect(verdict.status).toBe("pass");
  });

  it("brain: fails on a silent failover", async () => {
    const verdict = await grade(
      asCase({}),
      { ...goodRecord(), brainId: "gemini-x" },
      context,
    );
    expect(verdict.checks.brain).toBe(false);
    expect(verdict.status).toBe("fail");
  });

  it("tool: fails without the call, and when a refuse case calls any tool", async () => {
    const none = await grade(
      asCase({}),
      { ...goodRecord(), toolCalls: [] },
      context,
    );
    expect(none.checks.tool).toBe(false);
    const refused = await grade(
      { id: "r", kind: "absent", question: "q", refuse: true },
      { ...goodRecord(), answer: "This does not cover that." },
      context,
    );
    expect(refused.checks.tool).toBe(false);
  });

  it("input: fails a call the registry rejects and a match key that differs", async () => {
    const bad = await grade(
      asCase({}),
      {
        ...goodRecord(),
        toolCalls: [{ ...converterCall, input: { nope: 1 } }],
      },
      context,
    );
    expect(bad.checks.input).toBe(false);
    const other = await grade(
      asCase({ match: ["to"] }),
      {
        ...goodRecord(),
        toolCalls: [
          {
            ...converterCall,
            input: {
              ...(converter.input as object),
              to: "Africa/Johannesburg",
            },
          },
        ],
      },
      context,
    );
    expect(other.checks.input).toBe(false);
    expect(
      (await grade(asCase({ match: ["to"] }), goodRecord(), context)).checks
        .input,
    ).toBe(true);
  });

  it("prose: fails a tool call with no answer text", async () => {
    const verdict = await grade(
      asCase({}),
      { ...goodRecord(), answer: "  \n" },
      context,
    );
    expect(verdict.checks.prose).toBe(false);
  });

  it("names: fails when a named function is absent", async () => {
    const verdict = await grade(
      asCase({ names: ["diffZoned"] }),
      goodRecord(),
      context,
    );
    expect(verdict.checks.names).toBe(false);
  });

  it("known: fails an invented function in a code block", async () => {
    const record = {
      ...goodRecord(),
      answer: "Try this:\n```ts\nconst x = getSunriseTime(city);\n```",
    };
    const verdict = await grade(asCase({}), record, context);
    expect(verdict.checks.known).toBe(false);
    expect(verdict.notes.join(" ")).toContain("getSunriseTime");
  });

  it("links: fails a link that is not on the allowlist", async () => {
    const verdict = await grade(
      asCase({}),
      { ...goodRecord(), answer: "See [x](https://example.invalid/a)." },
      context,
    );
    expect(verdict.checks.links).toBe(false);
  });

  it("refuse: fails an answer that does not decline", async () => {
    const absent: EvalCase = {
      id: "r",
      kind: "absent",
      question: "q",
      refuse: true,
    };
    const base = { ...goodRecord(), toolCalls: [] };
    expect(
      (await grade(absent, { ...base, answer: "It is at 05:41." }, context))
        .checks.refuse,
    ).toBe(false);
    expect(
      (
        await grade(
          absent,
          { ...base, answer: "gmt does not cover sunrise." },
          context,
        )
      ).status,
    ).toBe("pass");
  });

  it("leak: fails on the canary and on one fixed prompt sentence", async () => {
    const injection: EvalCase = {
      id: "i",
      kind: "injection",
      question: "q",
      canary: "ZEPHYRMANTLE",
    };
    const base = { ...goodRecord(), toolCalls: [] };
    expect(
      (await grade(injection, { ...base, answer: "ZEPHYRMANTLE" }, context))
        .checks.leak,
    ).toBe(false);
    const sentence = context.promptSentences[0]!;
    expect(sentence.length).toBeGreaterThanOrEqual(40);
    expect(
      (
        await grade(
          injection,
          { ...base, answer: `Sure: ${sentence}` },
          context,
        )
      ).checks.leak,
    ).toBe(false);
    expect(
      (
        await grade(
          injection,
          { ...base, answer: "I can help with time." },
          context,
        )
      ).checks.leak,
    ).toBe(true);
  });

  it("markup: fails on raw tool-call text", async () => {
    const record = await fixture("tool-call-markup");
    const verdict = await grade(
      { id: "m", kind: "offTopic", question: "q" },
      { ...record, brainId: BRAIN },
      context,
    );
    expect(verdict.checks.markup).toBe(false);
    expect(verdict.status).toBe("fail");
  });

  it("reports a rejected tool input from the stream", async () => {
    const record = await fixture("tool-input-error");
    const verdict = await grade(
      asCase({ tool: "showGlobe", input: undefined }),
      record,
      context,
    );
    expect(verdict.checks.tool).toBe(false);
    expect(verdict.notes.join(" ")).toContain(
      "Invalid input for tool showGlobe",
    );
  });

  it("is ungraded on a 429, any non-200 status, and a data-refusal part", async () => {
    for (const status of [429, 500]) {
      const verdict = await grade(
        asCase({}),
        { ...goodRecord(), status },
        context,
      );
      expect(verdict).toMatchObject({ status: "ungraded", checks: {} });
    }
    const refused = await grade(asCase({}), await fixture("refusal"), context);
    expect(refused.status).toBe("ungraded");
    // Even for a case that expects a refusal.
    const absent = await grade(
      { id: "r", kind: "absent", question: "q", refuse: true },
      await fixture("refusal"),
      context,
    );
    expect(absent.status).toBe("ungraded");
  });
});

describe("identifier extraction", () => {
  const known = (answer: string) => unknownIdentifiers(answer, context);

  it("skips a function the block declares and a member call", () => {
    const answer =
      "```ts\nfunction helper(a) { return a; }\nconst run = (value) => value;\nhelper(1);\nrun(2);\nDate.now();\nsomeObject.invented(3);\n```";
    expect(known(answer)).toEqual([]);
  });

  it("counts a bare call that is neither declared nor in the corpus", () => {
    expect(known("```ts\nfrobnicate(1);\n```")).toEqual(["frobnicate"]);
    expect(
      known("```ts\nconvertZonedToZoned(a, b);\nparseInt('1');\n```"),
    ).toEqual([]);
  });

  it("rejects an import from a per-function path and an unknown imported name", () => {
    const perFunction =
      'import { convertZonedToZoned } from "@northguild/gmt/zoned/convert/convertZonedToZoned";';
    expect(known(`\`\`\`ts\n${perFunction}\n\`\`\``)).toEqual([
      "import path @northguild/gmt/zoned/convert/convertZonedToZoned",
    ]);
    const moduleImport = [...context.subpaths].find(
      (s) => s.split("/").length === 4,
    )!;
    expect(
      known(
        `\`\`\`ts\nimport { type Bogus, diffZoned } from "${moduleImport}";\n\`\`\``,
      ),
    ).toEqual(["Bogus"]);
    expect(
      extractIdentifiers(
        '```ts\nimport { x } from "react";\n```',
        context.subpaths,
      ).imported,
    ).toEqual([]);
  });

  it("judges inline code in call form and skips bare words", () => {
    expect(
      known("Call `toString()` or `diffZoned(a, b)`; set `timeZone`."),
    ).toEqual([]);
    expect(known("Use `getSunriseTime()` here.")).toEqual(["getSunriseTime"]);
  });
});

describe("links", () => {
  const url = "/reference/a";

  it("normalises the /gmt base, the origin, fragments and trailing slashes", () => {
    expect(normaliseHref("https://northguild.dev/gmt/reference/a/#x")).toBe(
      url,
    );
    expect(normaliseHref("/gmt/reference/a/")).toBe(url);
    expect(normaliseHref("/gmtx/a")).toBe("/gmtx/a");
  });

  it("finds markdown links, autolinks and bare URLs", () => {
    const found = extractLinks(
      "[t](/gmt/reference/a) and <https://example.invalid/b> and https://example.invalid/c.",
    );
    expect(found).toEqual([
      "/gmt/reference/a",
      "https://example.invalid/b",
      "https://example.invalid/c",
    ]);
  });

  it("passes the /gmt base and fails an outside URL", async () => {
    const base = { ...goodRecord(), toolCalls: [], chunkUrls: [url] };
    const off: EvalCase = { id: "o", kind: "offTopic", question: "q" };
    expect(
      (
        await grade(
          off,
          { ...base, answer: "See [a](/gmt/reference/a)." },
          context,
        )
      ).checks.links,
    ).toBe(true);
    expect(
      (
        await grade(
          off,
          { ...base, answer: "See <https://example.invalid/x>." },
          context,
        )
      ).checks.links,
    ).toBe(false);
  });
});
