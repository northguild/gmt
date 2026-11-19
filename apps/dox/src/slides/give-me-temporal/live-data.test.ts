/**
 * Deck 0's live data: the committed agent transcript and run records, and the recordings the live
 * panels play (`recorded/`). Every one the deck needs is there, parses, names its brain and
 * instant, labels itself, and holds no secret.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SHOWN_ZONE } from "../../../../../scripts/zone-matrix/agent-answer.mjs";
import {
  agentAnswers,
  quotedAnswer,
  TRANSCRIPT_FIELDS,
  type AgentRunFile,
  type AgentTranscript,
} from "~/lib/slides/agent-quote";
import { recordingIds } from "~/lib/slides/live-data";
import { findSecret } from "~/lib/slides/recording-capture";
import { formatRecordedLabel, parseRecording } from "~/lib/slides/replay";
import { DECKS } from "../decks";
import { LIVE } from "./live-data";
import answer from "./quotes/agent-answer.json";
import runRecord from "./quotes/agent-run.json";

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
      LIVE.agentRun,
    ))
      expect(quote.ready ? "ready" : quote.problem, id).toBe("ready");
    expect(
      quotedAnswer(
        answer as AgentTranscript,
        runRecord as AgentRunFile,
        LIVE.agentRun,
      ).ready,
    ).toBe(true);
  });

  it("show a zone the script runs in, whatever the CI matrix lists", () => {
    expect(LIVE.agentRun.shown.zone).toBe(SHOWN_ZONE);
  });
});

const read = (id: string): string =>
  readFileSync(resolve(process.cwd(), LIVE.recordedDir, `${id}.json`), "utf8");

describe.each(recordingIds(LIVE))("recording %s", (id) => {
  it("parses and names its brain and instant", () => {
    const recording = parseRecording(JSON.parse(read(id)));
    expect(recording?.id).toBe(id);
    expect(recording?.brain.label).not.toBe("");
    expect(recording?.instant).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  });

  it("labels itself with its date and brain", async () => {
    const recording = parseRecording(JSON.parse(read(id)))!;
    expect(
      await formatRecordedLabel(
        recording,
        DECKS.find((d) => d.slug === "give-me-temporal")!.zone,
      ),
    ).toMatch(/^Recorded \d{1,2} \w+ \d{4}, .+/u);
  });

  it("holds no secret and no usage counters", () => {
    const text = read(id);
    expect(findSecret(text, [process.env["DOX_DEV_KEY"] ?? ""])).toBeNull();
    expect(text).not.toContain("data-usage");
  });
});
