/**
 * The eval case list checked on its own: a case that names a missing function, an unknown skill
 * or an invalid tool input fails here, before it can skew a score. No count is hardcoded.
 */
import corpusJson from "../src/generated/reference/gmt-corpus.json";
import { resolveWidget } from "../src/components/ask/widget-registry";
import { CHAT_STARTERS } from "../src/lib/chat-constants";
import { DOX_TOOL_DOCS, ENABLED_TOOL_NAMES } from "../src/lib/dox-tools";
import { buildRetrievalCorpus } from "../src/lib/retrieval/corpus";
import { VOCABULARY_SKILLS } from "../worker/vocabulary";
import { CASES, LIVE_CASES, REWORDINGS, type CaseKind } from "./cases";

const corpusNames = new Set(corpusJson.map((entry) => entry.name));
const chunkUrls = buildRetrievalCorpus().map((chunk) => chunk.url);
const toolNames: readonly string[] = ENABLED_TOOL_NAMES;
const withTool = CASES.filter((c) => c.tool !== undefined);
const kinds: readonly CaseKind[] = [
  "starter",
  "reworded",
  "lookup",
  "absent",
  "offTopic",
  "injection",
  "followUp",
  "fault",
];

/** Every name or URL prefix a case expects, flattened. */
const expected = (alternatives: readonly (string | readonly string[])[]) =>
  alternatives.flatMap((entry) =>
    typeof entry === "string" ? [entry] : [...entry],
  );

describe("the eval cases", () => {
  it("have unique kebab-case ids", () => {
    const ids = CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i);
  });

  it("give every case a question and every kind at least one case", () => {
    for (const c of CASES)
      expect(c.question.trim().length, c.id).toBeGreaterThan(0);
    for (const kind of kinds) {
      expect(
        CASES.some((c) => c.kind === kind),
        kind,
      ).toBe(true);
    }
  });

  it("give every starter widget one starter case and two rewordings", () => {
    for (const starter of CHAT_STARTERS) {
      const own = CASES.filter((c) => c.tool === starter.widget);
      expect(
        own.filter((c) => c.kind === "starter").map((c) => c.question),
      ).toEqual([starter.text]);
      expect(
        own.filter((c) => c.kind === "reworded").map((c) => c.question),
      ).toEqual([...REWORDINGS[starter.widget]]);
    }
  });

  it("reword only widgets that have a starter", () => {
    const widgets: string[] = CHAT_STARTERS.map((s) => s.widget);
    expect(
      Object.keys(REWORDINGS).filter((key) => !widgets.includes(key)),
    ).toEqual([]);
  });

  it("reword a starter without naming a tool or repeating its text", () => {
    for (const c of CASES.filter((x) => x.kind === "reworded")) {
      expect(
        CHAT_STARTERS.map((s) => s.text),
        c.id,
      ).not.toContain(c.question);
      for (const doc of DOX_TOOL_DOCS)
        expect(c.question, c.id).not.toContain(doc.name);
    }
  });

  it("expect only functions and pages that exist", () => {
    for (const c of CASES) {
      for (const entry of expected(c.chunks ?? [])) {
        if (entry.startsWith("/")) {
          expect(
            chunkUrls.some((url) => url.startsWith(entry)),
            `${c.id}: no chunk under ${entry}`,
          ).toBe(true);
        } else {
          expect(
            corpusNames.has(entry),
            `${c.id}: ${entry} is not in the corpus`,
          ).toBe(true);
        }
      }
    }
  });

  it("name only skills that exist", () => {
    const skills = new Set(VOCABULARY_SKILLS.map((s) => s.name));
    for (const c of CASES) {
      if (c.skill)
        expect(skills.has(c.skill), `${c.id}: ${c.skill}`).toBe(true);
    }
  });

  it("require functions in an answer that the library has", () => {
    for (const c of CASES) {
      for (const name of c.names ?? []) {
        expect(corpusNames.has(name), `${c.id}: ${name}`).toBe(true);
      }
    }
  });

  it("use enabled tools, each with an input", () => {
    for (const c of CASES) {
      if (c.tool) expect(toolNames, c.id).toContain(c.tool);
      if (c.tool)
        expect(c.input, `${c.id} has a tool and no input`).toBeDefined();
      if (c.input)
        expect(c.tool, `${c.id} has an input and no tool`).toBeDefined();
    }
  });

  it.each(withTool.map((c) => [c.id, c] as const))(
    "gives %s an input its tool accepts and its widget can show",
    async (_id, c) => {
      const resolved = resolveWidget(c.tool as string, c.input);
      expect(resolved.ok, JSON.stringify(resolved)).toBe(true);
      if (!resolved.ok) return;
      expect(await resolved.entry.validate?.(resolved.args)).toBeFalsy();
    },
  );

  it("match only keys of the input", () => {
    for (const c of CASES) {
      for (const key of c.match ?? []) {
        expect(Object.keys(c.input ?? {}), `${c.id}: ${key}`).toContain(key);
      }
    }
  });

  it("keep refusals free of tools and injections free of the corpus", () => {
    const corpusText = buildRetrievalCorpus()
      .map((chunk) => chunk.text)
      .join("\n")
      .toLowerCase();
    for (const c of CASES.filter((x) => x.refuse))
      expect(c.tool, c.id).toBeUndefined();
    for (const c of CASES.filter((x) => x.kind === "injection")) {
      expect(c.canary, c.id).toBeTruthy();
      expect(corpusText, c.id).not.toContain((c.canary ?? "").toLowerCase());
      expect(c.question, c.id).not.toMatch(/\bcanary\b/i);
    }
  });

  it("give a follow-up a history that holds a call to its tool", () => {
    for (const c of CASES.filter((x) => x.kind === "followUp")) {
      const calls = (c.history ?? []).flatMap((m) =>
        m.parts.map((p) => p.type),
      );
      expect(calls, c.id).toContain(`tool-${c.tool}`);
    }
  });

  it("send a live subset with every kind but lookups", () => {
    for (const kind of kinds.filter((k) => k !== "lookup")) {
      expect(
        LIVE_CASES.some((c) => c.kind === kind),
        kind,
      ).toBe(true);
    }
    expect(LIVE_CASES).toEqual(CASES.filter((c) => c.live));
  });

  it("lead with no national example and name no law", () => {
    // Starters are governed by chat-starters.test.ts; an X12 time code names its own zone.
    const authored = CASES.filter((c) => c.kind !== "starter");
    for (const c of authored) {
      const x12 = c.input !== undefined && "timeCode" in c.input;
      const text = `${c.question} ${x12 ? "" : JSON.stringify(c.input ?? {})}`;
      if (!x12) expect(text, c.id).not.toMatch(/New[ _]York|en-US/);
      expect(c.question, c.id).not.toMatch(
        /\b(?:statute|regulation|docket|section \d|Sunshine Protection)\b/i,
      );
    }
  });
});
