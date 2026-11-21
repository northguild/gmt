/**
 * Records Dox's answers for one deck (DOX-G12, #548): its running question and the ready questions
 * of its audience panel, both read from the deck's `src/slides/<slug>/live-data.ts` (`LIVE`). The
 * deck plays each one back with no network when the live answer is slow or fails
 * (`src/lib/slides/replay.ts`).
 *
 * Each question goes to the Worker's `/gmt/api/chat` once, as the deck sends it, and the raw
 * event stream is saved with its timing under the deck's `recordedDir`, as `<id>.json`.
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
 *   DOX_DEV_KEY=... npx tsx scripts/record-deck-answers.ts --deck <slug>
 *   DOX_DEV_KEY=... npx tsx scripts/record-deck-answers.ts --deck <slug> --only faq-samoa-skip
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { getUtcNow } from "@northguild/gmt/utc/get";
import { createCapture, findSecret } from "../src/lib/slides/recording-capture";
import type { DeckLiveData } from "../src/lib/slides/live-data";
import { DECKS } from "../src/slides/decks";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "http://localhost:8787/gmt" },
    deck: { type: "string" },
    only: { type: "string" },
    model: { type: "string" },
  },
});

const slug = values.deck;
if (!DECKS.some((deck) => deck.slug === slug)) {
  console.error(
    `Name the deck with --deck, one of: ${DECKS.map((deck) => deck.slug).join(", ")}.`,
  );
  process.exit(1);
}
// Every deck keeps its live panels' questions in its own folder (`src/slides/<slug>/live-data.ts`).
const { LIVE } = (await import(`../src/slides/${slug}/live-data.ts`)) as {
  LIVE: DeckLiveData;
};

const key = process.env["DOX_DEV_KEY"];
if (!key) {
  console.error(
    "DOX_DEV_KEY is not set. Put the key in the environment (not on the command line) so the 5-per-visitor cap does not end the run.",
  );
  process.exit(1);
}
const base = values.base!.replace(/\/$/, "");

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
      pageContext: LIVE.pageContext,
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

const jobs = [LIVE.running, ...LIVE.faq].filter(
  (job) => values.only === undefined || job.id === values.only,
);

if (jobs.length === 0) {
  console.error(`No question has the id ${values.only}.`);
  process.exit(1);
}

const cookie = await devCookie();
const outDir = resolve(appRoot, LIVE.recordedDir);
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
