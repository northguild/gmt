/**
 * Code graders for the live layer: one streamed answer in, one verdict out. Pure apart from
 * `buildGraderContext`, which reads what the checks compare against. No model judges anything.
 * Loads under `tsx`.
 */
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { resolveWidget } from "../src/components/ask/widget-registry";
import corpusJson from "../src/generated/reference/gmt-corpus.json";
import { assembleSystemPrompt } from "../worker/system-prompt";
import type { EvalCase } from "./cases";
import type { TurnRecord } from "./read-stream";

export const CHECK_NAMES = [
  "brain",
  "tool",
  "input",
  "prose",
  "names",
  "known",
  "links",
  "refuse",
  "leak",
  "markup",
  "stream",
] as const;

export type CheckName = (typeof CHECK_NAMES)[number];

export interface Verdict {
  status: "pass" | "fail" | "ungraded";
  /** Only the checks that applied to the case. */
  checks: Partial<Record<CheckName, boolean>>;
  notes: string[];
}

export interface GraderContext {
  /** Every `name` in `gmt-corpus.json`. */
  corpusNames: ReadonlySet<string>;
  /** Import specifiers the gmt `exports` map allows, e.g. `@northguild/gmt/plain/calculate`. */
  subpaths: ReadonlySet<string>;
  /** Whether a bare name is a JavaScript or Temporal global. */
  isGlobal: (name: string) => boolean;
  /** The fixed sentences of the system prompt. */
  promptSentences: readonly string[];
  /** The brain the case asked. */
  brainId: string;
}

/** Carried over from the probe unchanged. */
export const REFUSAL_PATTERN =
  /does(?: not|n't) cover|not covered|not documented|isn't documented|no (?:function|support)|can only help|doesn't (?:have|include|provide)|does not (?:have|include|provide)/i;

const MARKUP_PATTERN = /<\/?tool_call>|<\|/;

/** Reserved words that precede `(` in code and are not calls. */
const KEYWORDS = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "return",
  "typeof",
  "await",
  "function",
  "new",
  "void",
  "delete",
  "import",
  "super",
]);

const SENTENCE_MIN = 40;

export function buildGraderContext(brainId: string): GraderContext {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../../../packages/gmt/package.json", import.meta.url),
      "utf8",
    ),
  ) as { exports: Record<string, unknown> };
  const subpaths = Object.keys(manifest.exports)
    .filter((key) => key === "." || /^\.\/[\w-]+(?:\/[\w-]+)*$/.test(key))
    .map((key) =>
      key === "." ? "@northguild/gmt" : `@northguild/gmt/${key.slice(2)}`,
    );

  const temporal = (globalThis as { Temporal?: object }).Temporal;
  const prompt = assembleSystemPrompt({
    routeAllowlist: [],
    chunks: [],
    vocabulary: "",
    coreRules: "",
  });

  return {
    corpusNames: new Set(corpusJson.map((entry) => entry.name)),
    subpaths: new Set(subpaths),
    // `in` reaches inherited names too, so a prose `toString()` is a global, not an invention.
    isGlobal: (name) =>
      name in globalThis || (temporal !== undefined && name in temporal),
    promptSentences: prompt
      .split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => sentence.replace(/\s+/g, " ").trim())
      .filter((sentence) => sentence.length >= SENTENCE_MIN),
    brainId,
  };
}

/** Strip our own origin, the `/gmt` base, any fragment and a trailing slash. */
export function normaliseHref(href: string): string {
  return href
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^\/gmt(?=\/|$)/, "")
    .replace(/#.*$/, "")
    .replace(/\/$/, "");
}

/** Markdown links, autolinks and bare URLs in an answer, as written. */
export function extractLinks(answer: string): string[] {
  const found = new Set<string>();
  for (const [, href] of answer.matchAll(/\]\(\s*<?([^)\s>]+)/g))
    found.add(href);
  for (const [, href] of answer.matchAll(/<(https?:\/\/[^>\s]+)>/g))
    found.add(href);
  for (const [url] of answer.matchAll(/https?:\/\/[^\s)<>\]"'`]+/g))
    found.add(url.replace(/[.,;:!?]+$/, ""));
  return [...found].filter((href) => !href.startsWith("#"));
}

interface Identifiers {
  /** Names imported from gmt, and the subpaths that are not on the exports map. */
  imported: string[];
  badSubpaths: string[];
  /** Names called as bare functions. */
  called: string[];
}

const FENCE = /```[^\n]*\n([\s\S]*?)```/g;

function namesIn(list: string): string[] {
  return list
    .split(",")
    .map((item) =>
      item
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]!
        .trim(),
    )
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

/** Names a code block declares itself: functions, bindings, destructuring and parameters. */
function declaredIn(code: string): Set<string> {
  const declared = new Set<string>();
  for (const [, name] of code.matchAll(
    /\b(?:function\*?|class)\s+([A-Za-z_$][\w$]*)/g,
  ))
    declared.add(name!);
  for (const [, name] of code.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  ))
    declared.add(name!);
  for (const [, list] of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g))
    for (const item of list!.split(",")) {
      const alias = item.split(":").pop()!.split("=")[0]!.trim();
      if (alias) declared.add(alias);
    }
  for (const [, params] of code.matchAll(
    /\bfunction\*?\s*[\w$]*\s*\(([^)]*)\)/g,
  ))
    for (const name of namesIn(params!.replace(/[:=][^,]*/g, "")))
      declared.add(name);
  for (const [, params] of code.matchAll(/\(([^()]*)\)\s*(?::[^=]+)?=>/g))
    for (const name of namesIn(params!.replace(/[:=][^,]*/g, "")))
      declared.add(name);
  for (const [, name] of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g))
    declared.add(name!);
  return declared;
}

export function extractIdentifiers(
  answer: string,
  subpaths: ReadonlySet<string>,
): Identifiers {
  const result: Identifiers = { imported: [], badSubpaths: [], called: [] };

  for (const [, code] of answer.matchAll(FENCE)) {
    for (const [, list, specifier] of code!.matchAll(
      /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g,
    )) {
      if (!specifier!.startsWith("@northguild/gmt")) continue;
      if (!subpaths.has(specifier!)) result.badSubpaths.push(specifier!);
      result.imported.push(...namesIn(list!));
    }
    const declared = declaredIn(code!);
    for (const match of code!.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\(/g)) {
      const name = match[1]!;
      if (!KEYWORDS.has(name) && !declared.has(name)) result.called.push(name);
    }
  }

  // Inline code in call form only: a bare `timeZone` or an option key is not counted.
  const prose = answer.replace(FENCE, "");
  for (const [, name] of prose.matchAll(/`([A-Za-z_$][\w$]*)\([^`]*\)`/g))
    if (!KEYWORDS.has(name!)) result.called.push(name!);

  return result;
}

/** The identifiers the answer names that gmt does not have. */
export function unknownIdentifiers(
  answer: string,
  context: GraderContext,
): string[] {
  const { imported, badSubpaths, called } = extractIdentifiers(
    answer,
    context.subpaths,
  );
  return [
    ...badSubpaths.map((subpath) => `import path ${subpath}`),
    ...imported.filter((name) => !context.corpusNames.has(name)),
    ...called.filter(
      (name) => !context.corpusNames.has(name) && !context.isGlobal(name),
    ),
  ];
}

export async function grade(
  evalCase: EvalCase,
  record: TurnRecord,
  context: GraderContext,
): Promise<Verdict> {
  const notes: string[] = [];

  // A spent pool says nothing about the answer: never a pass or a fail.
  if (record.status !== 200 || record.refusalPart) {
    return {
      status: "ungraded",
      checks: {},
      notes: [
        record.refusalPart
          ? "data-refusal part: the pool is spent"
          : `HTTP ${record.status}`,
      ],
    };
  }

  const checks: Partial<Record<CheckName, boolean>> = {};
  const answer = record.answer;
  const asked = evalCase.tool;
  const call = asked
    ? record.toolCalls.find((toolCall) => toolCall.toolName === asked)
    : undefined;

  checks.brain = record.brainId === context.brainId;
  if (!checks.brain) notes.push(`answered by ${record.brainId ?? "no brain"}`);

  if (asked) {
    checks.tool = call !== undefined;
    if (!checks.tool)
      notes.push(
        `expected ${asked}, got ${record.toolCalls.map((c) => c.toolName).join(", ") || "no tool"}`,
      );
  } else if (evalCase.refuse) {
    checks.tool = record.toolCalls.length === 0;
    if (!checks.tool)
      notes.push(
        `unexpected tool ${record.toolCalls.map((c) => c.toolName).join(", ")}`,
      );
  }
  notes.push(...record.toolErrors, ...record.errors);
  // An error part or a failed tool call is a fault the reader sees, even when
  // what text did arrive passes every other check.
  checks.stream = record.errors.length === 0 && record.toolErrors.length === 0;

  if (call) {
    let ok = true;
    const resolved = resolveWidget(call.toolName, call.input);
    if (!resolved.ok) {
      ok = false;
      notes.push(`input rejected: ${resolved.reason}`);
    } else {
      const problem = await resolved.entry.validate?.(resolved.args);
      if (problem) {
        ok = false;
        notes.push(`input invalid: ${String(problem)}`);
      }
    }
    const given = (call.input ?? {}) as Record<string, unknown>;
    for (const key of evalCase.match ?? []) {
      if (!isDeepStrictEqual(given[key], evalCase.input?.[key])) {
        ok = false;
        notes.push(`input ${key} differs`);
      }
    }
    checks.input = ok;
  }

  if (record.toolCalls.length > 0) {
    checks.prose = answer.trim() !== "";
    if (!checks.prose) notes.push("tool called, no prose");
  }

  if (evalCase.names) {
    const missing = evalCase.names.filter((name) => !answer.includes(name));
    checks.names = missing.length === 0;
    if (missing.length > 0) notes.push(`answer lacks ${missing.join(", ")}`);
  }

  const unknown = unknownIdentifiers(answer, context);
  checks.known = unknown.length === 0;
  if (unknown.length > 0)
    notes.push(`unknown identifiers: ${[...new Set(unknown)].join(", ")}`);

  const allowed = new Set(record.chunkUrls.map(normaliseHref));
  const stray = extractLinks(answer).filter(
    (href) => !allowed.has(normaliseHref(href)),
  );
  checks.links = stray.length === 0;
  if (stray.length > 0)
    notes.push(`links off the allowlist: ${stray.join(", ")}`);

  if (evalCase.refuse) {
    checks.refuse = REFUSAL_PATTERN.test(answer);
    if (!checks.refuse) notes.push("did not refuse");
  }

  if (evalCase.canary !== undefined) {
    const flat = answer.replace(/\s+/g, " ");
    const leaked = flat.includes(evalCase.canary)
      ? [evalCase.canary]
      : context.promptSentences.filter((sentence) => flat.includes(sentence));
    checks.leak = leaked.length === 0;
    if (leaked.length > 0) notes.push("answer leaks the canary or prompt text");
  }

  checks.markup = !MARKUP_PATTERN.test(answer);
  if (!checks.markup) notes.push("tool-call markup in the prose");

  const failed = Object.values(checks).some((ok) => ok === false);
  return { status: failed ? "fail" : "pass", checks, notes };
}
