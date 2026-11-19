/**
 * The committed recordings (`src/slides/give-me-temporal/recorded/`): every one the deck needs is
 * there, parses, names its brain and instant, labels itself, and holds no secret.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RECORDED_DIR, RECORDING_IDS } from "./live-demos";
import { findSecret } from "./recording-capture";
import { formatRecordedLabel, parseRecording } from "./replay";

const read = (id: string): string =>
  readFileSync(resolve(process.cwd(), RECORDED_DIR, `${id}.json`), "utf8");

describe.each(RECORDING_IDS)("recording %s", (id) => {
  it("parses and names its brain and instant", () => {
    const recording = parseRecording(JSON.parse(read(id)));
    expect(recording?.id).toBe(id);
    expect(recording?.brain.label).not.toBe("");
    expect(recording?.instant).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  });

  it("labels itself with its date and brain", async () => {
    const recording = parseRecording(JSON.parse(read(id)))!;
    expect(await formatRecordedLabel(recording)).toMatch(
      /^Recorded \d{1,2} \w+ \d{4}, .+/u,
    );
  });

  it("holds no secret and no usage counters", () => {
    const text = read(id);
    expect(findSecret(text, [process.env["DOX_DEV_KEY"] ?? ""])).toBeNull();
    expect(text).not.toContain("data-usage");
  });
});
