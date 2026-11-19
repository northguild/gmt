/**
 * Records Dox's answers for Deck 0 (DOX-G12, #548): the running question on `ask-dox` and the three
 * ready questions of the audience FAQ on `thanks`. The deck plays each one back with no network
 * when the live answer is slow or fails (`src/lib/slides/replay.ts`).
 *
 * Each question goes to the Worker's `/gmt/api/chat` once, as the deck sends it, and the raw
 * event stream is saved with its timing under `src/slides/give-me-temporal/recorded/<id>.json`.
 * It prints the brain that answered, the gmt tools the model called and the answer's text, so a
 * wrong or tool-less answer is seen before it is committed. **It spends real quota**: on
 * `wrangler dev` every call draws on the account's Neurons, like `probe-brains.ts`. Run it once.
 *
 * The key comes from the environment and is used only to get the `dox_dev` cookie from
 * `/gmt/api/brains?key=`; it is never written. Before it saves, the script refuses a recording
 * that holds the key or a dev-key marker.
 *
 * Usage, from apps/dox, with the Worker running (`--base` defaults to `wrangler dev`):
 *
 *   DOX_DEV_KEY=... npx tsx scripts/record-deck-answers.ts
 *   DOX_DEV_KEY=... npx tsx scripts/record-deck-answers.ts --only faq-samoa-skip
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { getUtcNow } from "@northguild/gmt/utc/get";
import { createCapture, findSecret } from "../src/lib/slides/recording-capture";
import {
  DECK_PAGE_CONTEXT,
  FALLBACK_RUNNING_QUESTION,
  FAQ,
  RECORDED_DIR,
  RUNNING_QUESTION_ID,
} from "../src/lib/slides/live-demos";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "http://localhost:8787/gmt" },
    only: { type: "string" },
    model: { type: "string" },
  },
});

const key = process.env["DOX_DEV_KEY"];
if (!key) {
  console.error(
    "DOX_DEV_KEY is not set. Put the key in the environment (not on the command line) so the 5-per-visitor cap does not end the run.",
  );
  process.exit(1);
}
const base = values.base!.replace(/\/$/, "");

/** The running question as the slide shows it: the owner's transcript, or the fallback. */
function runningQuestion(): string {
  const file = resolve(
    appRoot,
    "src/slides/give-me-temporal/quotes/agent-answer.json",
  );
  const question = (
    JSON.parse(readFileSync(file, "utf8")) as { question?: string }
  ).question;
  return typeof question === "string" && question.trim() !== ""
    ? question
    : FALLBACK_RUNNING_QUESTION;
}

async function devCookie(): Promise<string> {
  // `/gmt/api/*` is never a static asset, so it always reaches the Worker's `?key=` check.
  const response = await fetch(
    `${base}/api/brains?key=${encodeURIComponent(key!)}`,
    {
      redirect: "manual",
    },
  );
  const cookie = response.headers.getSetCookie()[0]?.split(";")[0];
  if (!cookie)
    throw new Error(
      "No dev cookie: is the Worker running with the same DOX_DEV_KEY?",
    );
  return cookie;
}

async function record(id: string, question: string, cookie: string) {
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      messages: [
        {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text: question }],
        },
      ],
      pageContext: DECK_PAGE_CONTEXT,
      ...(values.model ? { model: values.model } : {}),
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(
      `${id}: HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  const capture = createCapture();
  const decoder = new TextDecoder();
  // Offsets are durations from the first byte, not a reading of the time of day.
  for await (const bytes of response.body) {
    capture.push(decoder.decode(bytes, { stream: true }), performance.now());
  }
  capture.finish();
  const brain = capture.brain();
  if (!brain) throw new Error(`${id}: the answer named no brain`);
  if (capture.failure())
    throw new Error(`${id}: the stream failed (${capture.failure()})`);
  return {
    recording: {
      id,
      question,
      brain,
      instant: getUtcNow(),
      chunks: capture.chunks(),
    },
    tools: capture.tools(),
    answer: capture.answer(),
  };
}

const jobs = [
  { id: RUNNING_QUESTION_ID, question: runningQuestion() },
  ...FAQ.map((item) => ({ id: item.id, question: item.question })),
].filter((job) => values.only === undefined || job.id === values.only);

if (jobs.length === 0) {
  console.error(`No question has the id ${values.only}.`);
  process.exit(1);
}

const cookie = await devCookie();
const outDir = resolve(appRoot, RECORDED_DIR);
mkdirSync(outDir, { recursive: true });

for (const job of jobs) {
  const { recording, tools, answer } = await record(
    job.id,
    job.question,
    cookie,
  );
  const text = `${JSON.stringify(recording, null, 2)}\n`;
  const secret = findSecret(text, [key]);
  if (secret)
    throw new Error(
      `${job.id}: the recording holds ${secret}; nothing was saved`,
    );
  writeFileSync(resolve(outDir, `${job.id}.json`), text);
  console.log(
    `\n${job.id}  brain ${recording.brain.label} (${recording.brain.id})`,
  );
  console.log(`  tools: ${tools.length ? tools.join(", ") : "none"}`);
  console.log(
    `  chunks: ${recording.chunks.length}, last at ${recording.chunks.at(-1)?.at ?? 0} ms`,
  );
  console.log(`  answer: ${answer.slice(0, 300).replaceAll("\n", " ")}`);
}
