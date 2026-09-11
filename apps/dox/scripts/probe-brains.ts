/**
 * DOX-C4 (#240) — a live probe of Dox's brains through a running Worker.
 *
 * Asks each brain the questions that decide whether it can serve Dox, and
 * reports what actually happened rather than what the model's catalog entry
 * promises. It takes any brain id, so it also serves the brain-list runbook in
 * context/dox/built.md.
 *
 * Per brain, it records:
 *
 *   - which brain actually answered — failover can silently substitute another
 *   - whether each `CHAT_STARTERS` question called its intended widget tool
 *   - whether a plausible-but-absent question is refused, not improvised
 *   - whether every link in an answer is on that answer's retrieval allowlist
 *   - time to first output and to completion
 *   - real token usage and estimated Neurons, when given the wrangler log
 *
 * **It spends real quota.** AI models never run locally, so every probe draws
 * on the account's 10,000 Neurons for the day. Default settings ask each
 * Workers AI brain 5 questions: 5 requests and roughly 500 Neurons per brain.
 *
 * Usage, from apps/dox with `dist/` already built:
 *
 *   npx wrangler dev --var DOX_DEV_KEY:probe --var NORTHGUILD_GMT_GEMINI_API_KEY: \
 *     2>&1 | tee /tmp/dox-wrangler.log
 *   npx tsx scripts/probe-brains.ts --log /tmp/dox-wrangler.log
 *
 * Emptying the Gemini key stops a failing Workers AI brain from failing over
 * onto Gemini's far smaller allowance mid-probe. The script checks for that
 * anyway, and flags any answer from a brain other than the one it asked.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { BRAINS, CHAT_STARTERS, type Brain } from "../src/lib/chat-constants";
import { RETRIEVAL_PART_TYPE } from "../src/lib/chat-types";

/** Neurons per million tokens, [input, output], from Cloudflare's pricing page
 * on 2026-09-11. Only used to turn logged token counts into an estimate. */
const NEURONS_PER_MILLION: Record<string, [number, number]> = {
  "@cf/zai-org/glm-4.7-flash": [5500, 36400],
  "@cf/qwen/qwen3-30b-a3b-fp8": [4625, 30475],
  "@cf/openai/gpt-oss-20b": [18182, 27273],
  "@cf/meta/llama-4-scout-17b-16e-instruct": [24545, 77273],
};

/** The refusal fixture: plausible for a date library, and absent
 * from gmt — the case where grounding fails quietly if it fails at all. */
const REFUSAL_QUESTION = "How do I parse a cron expression with gmt?";
const REFUSAL_PATTERN =
  /does(?: not|n't) cover|not covered|not documented|isn't documented|no (?:function|support)|can only help|doesn't (?:have|include|provide)|does not (?:have|include|provide)/i;

interface Question {
  label: string;
  text: string;
  expectTool: string | null;
}

interface ProbeResult {
  brain: string;
  question: string;
  status: number;
  answeredBy: string | null;
  retrieved: number;
  tool: string | null;
  pass: boolean;
  note: string;
  badLinks: string[];
  firstOutputMs: number | null;
  totalMs: number;
  inputTokens?: number;
  outputTokens?: number;
  neurons?: number;
  answer: string;
}

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "http://localhost:8787" },
    brains: { type: "string" },
    attempts: { type: "string", default: "1" },
    "dev-key": { type: "string", default: "probe" },
    log: { type: "string" },
    out: { type: "string" },
    "delay-ms": { type: "string", default: "3500" },
  },
});

const base = values.base!.replace(/\/$/, "");
const attempts = Math.max(1, Number(values.attempts));
// The Worker's burst limiter allows 20 requests a minute per isolate.
const delayMs = Math.max(0, Number(values["delay-ms"]));

const brains: Brain[] = values.brains
  ? values.brains.split(",").map((id) => {
      const brain = BRAINS.find((candidate) => candidate.id === id.trim());
      if (!brain) throw new Error(`unknown brain id: ${id}`);
      return brain;
    })
  : BRAINS.filter((brain) => brain.provider === "workers-ai");

const questions: Question[] = [
  ...Array.from({ length: attempts }, () =>
    CHAT_STARTERS.map((starter) => ({
      label: starter.widget,
      text: starter.text,
      expectTool: starter.widget,
    })),
  ).flat(),
  { label: "refusal", text: REFUSAL_QUESTION, expectTool: null },
];

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function devCookie(): Promise<string> {
  // Not `/?key=`: a path that matches a static asset is served before the
  // Worker runs, so the `?key=` exchange never happens there (observed
  // 2026-09-11 — `/` and `/dox/` answer 200 with no cookie). `/api/*` is never
  // an asset, so it always reaches the Worker's `?key=` check.
  const response = await fetch(`${base}/api/brains?key=${values["dev-key"]}`, {
    redirect: "manual",
  });
  const cookie = response.headers.getSetCookie()[0]?.split(";")[0];
  if (!cookie) {
    throw new Error(
      "No dev cookie. Start wrangler dev with --var DOX_DEV_KEY:<key> and pass the same --dev-key; without it the 5-per-visitor cap ends the probe early.",
    );
  }
  return cookie;
}

/** The `dox-usage` lines `openFirstWorkingBrain` logs, in order. */
function usageLines(): {
  brain: string;
  inputTokens?: number;
  outputTokens?: number;
}[] {
  if (!values.log) return [];
  return readFileSync(values.log, "utf8")
    .split("\n")
    .flatMap((line) => {
      const at = line.indexOf("dox-usage ");
      if (at === -1) return [];
      try {
        return [JSON.parse(line.slice(at + "dox-usage ".length))];
      } catch {
        return [];
      }
    });
}

/** Strip our own origin and any fragment, so a link compares to a route. */
function normaliseHref(href: string): string {
  return href
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/#.*$/, "")
    .replace(/\/$/, "");
}

async function ask(
  brain: Brain,
  question: Question,
  cookie: string,
): Promise<ProbeResult> {
  const started = performance.now();
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      model: brain.id,
      messages: [
        {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text: question.text }],
        },
      ],
    }),
  });

  const result: ProbeResult = {
    brain: brain.id,
    question: question.label,
    status: response.status,
    answeredBy: null,
    retrieved: 0,
    tool: null,
    pass: false,
    note: "",
    badLinks: [],
    firstOutputMs: null,
    totalMs: 0,
    answer: "",
  };

  if (!response.ok || !response.body) {
    result.totalMs = Math.round(performance.now() - started);
    result.note = `HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`;
    return result;
  }

  let allowlist: string[] = [];
  let buffered = "";
  const decoder = new TextDecoder();

  for await (const chunk of response.body) {
    buffered += decoder.decode(chunk, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const part = JSON.parse(line.slice("data: ".length));

      if (part.type === RETRIEVAL_PART_TYPE) {
        result.answeredBy = part.data.brainId;
        result.retrieved = part.data.retrievedCount;
        allowlist = part.data.chunkUrls.map(normaliseHref);
      } else if (
        part.type === "text-delta" ||
        part.type === "tool-input-available"
      ) {
        result.firstOutputMs ??= Math.round(performance.now() - started);
        if (part.type === "text-delta") result.answer += part.delta;
        else result.tool = part.toolName;
      } else if (part.type === "tool-input-start") {
        // Recorded on start, not only on success: a call whose arguments fail
        // to parse never reaches `tool-input-available`, and reporting that
        // as "no tool" hides that the model chose correctly. Observed
        // 2026-09-11 — see `tool-input-error` below.
        result.tool ??= part.toolName;
      } else if (part.type === "tool-input-error") {
        result.note = `tool input rejected: ${String(part.errorText).slice(0, 120)}`;
      } else if (part.type === "error") {
        result.note = `stream error: ${part.errorText}`;
      }
    }
  }
  result.totalMs = Math.round(performance.now() - started);

  for (const [, href] of result.answer.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^https?:/.test(href) && !href.startsWith(base)) {
      result.badLinks.push(href);
    } else if (!allowlist.includes(normaliseHref(href))) {
      result.badLinks.push(href);
    }
  }

  const problems: string[] = [];
  if (result.answeredBy !== brain.id)
    problems.push(`answered by ${result.answeredBy}`);
  if (question.expectTool && result.tool !== question.expectTool)
    problems.push(
      `expected ${question.expectTool}, got ${result.tool ?? "no tool"}`,
    );
  if (!question.expectTool && result.tool)
    problems.push(`unexpected tool ${result.tool}`);
  if (!question.expectTool && !REFUSAL_PATTERN.test(result.answer))
    problems.push("did not refuse");
  if (result.badLinks.length > 0)
    problems.push(`${result.badLinks.length} link(s) off the allowlist`);
  if (result.answer.trim() === "") problems.push("no prose");
  if (result.note) problems.push(result.note);

  result.pass = problems.length === 0;
  result.note = problems.join("; ");
  return result;
}

async function main() {
  const cookie = await devCookie();

  const listed = (await (
    await fetch(`${base}/api/brains`, { headers: { cookie } })
  ).json()) as {
    brains: { id: string }[];
  };
  const offered = new Set(listed.brains.map((brain) => brain.id));
  const leakedGemini = listed.brains.filter((b) => !b.id.startsWith("cf-"));
  if (
    leakedGemini.length > 0 &&
    brains.every((b) => b.provider === "workers-ai")
  ) {
    console.warn(
      `! Gemini brains are configured (${leakedGemini.length}); a failing Workers AI brain may fail over onto them.`,
    );
  }

  const results: ProbeResult[] = [];
  let seenUsage = usageLines().length;

  outer: for (const brain of brains) {
    if (!offered.has(brain.id)) {
      console.warn(`! ${brain.id} is not offered by this Worker; skipping`);
      continue;
    }
    for (const question of questions) {
      const result = await ask(brain, question, cookie);

      // Give wrangler a moment to flush the onFinish log line.
      await sleep(250);
      const usage = usageLines();
      const mine = usage
        .slice(seenUsage)
        .find((line) => line.brain === brain.id);
      seenUsage = usage.length;
      if (mine) {
        result.inputTokens = mine.inputTokens;
        result.outputTokens = mine.outputTokens;
        const rates = brain.model
          ? NEURONS_PER_MILLION[brain.model]
          : undefined;
        if (
          rates &&
          mine.inputTokens !== undefined &&
          mine.outputTokens !== undefined
        ) {
          result.neurons = Math.round(
            (mine.inputTokens * rates[0] + mine.outputTokens * rates[1]) / 1e6,
          );
        }
      }

      results.push(result);
      console.log(
        `${result.pass ? "PASS" : "FAIL"}  ${brain.id.padEnd(22)} ${question.label.padEnd(24)} ${String(result.totalMs).padStart(6)}ms  ${result.neurons ?? "?"}N  ${result.note}`,
      );

      if (result.status === 429) {
        console.warn("! 429 — the pool or the visitor cap is spent; stopping.");
        break outer;
      }
      await sleep(delayMs);
    }
  }

  const summary = brains
    .map((brain) => {
      const mine = results.filter((r) => r.brain === brain.id);
      if (mine.length === 0) return undefined;
      const widget = mine.filter((r) => r.question !== "refusal");
      const neurons = mine
        .map((r) => r.neurons)
        .filter((n): n is number => n !== undefined);
      return {
        brain: brain.id,
        passed: `${mine.filter((r) => r.pass).length}/${mine.length}`,
        toolHits: `${widget.filter((r) => r.tool === r.question).length}/${widget.length}`,
        refused: mine.some((r) => r.question === "refusal" && r.pass)
          ? "yes"
          : "no",
        badLinks: mine.reduce((n, r) => n + r.badLinks.length, 0),
        meanMs: Math.round(
          mine.reduce((n, r) => n + r.totalMs, 0) / mine.length,
        ),
        meanFirstMs: Math.round(
          mine.reduce((n, r) => n + (r.firstOutputMs ?? r.totalMs), 0) /
            mine.length,
        ),
        meanNeurons: neurons.length
          ? Math.round(neurons.reduce((a, b) => a + b, 0) / neurons.length)
          : "?",
        totalNeurons: neurons.length ? neurons.reduce((a, b) => a + b, 0) : "?",
      };
    })
    .filter(Boolean);

  console.log();
  console.table(summary);

  if (values.out) {
    writeFileSync(values.out, JSON.stringify({ summary, results }, null, 2));
    console.log(`full results written to ${values.out}`);
  }
}

await main();
