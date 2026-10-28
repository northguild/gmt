/**
 * Which SKILL.md vocabulary to put in front of the model for one question.
 *
 * The eight consumer skills come to ~100 KB — over half of every prompt, and
 * most of the reason a question took Gemini seconds to start answering. A
 * question about demurrage does not need the GNSS week rules, so the prompt
 * now carries only the skills the retrieved context points at.
 *
 * Each skill names its own sources in its frontmatter (`sources:` — the
 * library modules and guide pages it was written from, or a whole guide
 * folder as `guides/intervals/*.mdx`). A retrieved chunk votes for every skill
 * whose sources contain it, weighted by its rank, and split evenly between
 * the skills that share it, so a module several skills list (such as
 * `zoned/validate/`) is weaker evidence for each of them. A chunk no skill
 * lists votes for nothing: guessing from a neighbouring page in the same
 * folder gave the conversion guide to the Integration skill, which lists an
 * unrelated page beside it.
 *
 * The best skill always goes in. Others follow while they fit
 * `VOCABULARY_BUDGET_CHARS` and scored at least `RUNNER_UP_SHARE` of the
 * best — a skill one stray hit voted for is noise, not context.
 *
 * Each skill is also trimmed to what helps an answer. Its frontmatter,
 * "When to load" (instructions for a coding agent deciding whether to read
 * it) and "References" (links Dox may not use — see the linking rules) are
 * dropped.
 */
import type { RetrievalChunk } from "../src/lib/retrieval/types";

/** Roughly 4,000 tokens. Big enough for any one skill's rules after
 *  trimming, and for two of the smaller ones together. */
export const VOCABULARY_BUDGET_CHARS = 16_000;

/** How many retrieved chunks vote. Below this the hits are mostly noise. */
const VOTING_DEPTH = 10;

/** A second skill must score at least this share of the best one. */
const RUNNER_UP_SHARE = 0.5;

/** Sections of a SKILL.md that never help answer a reader. */
const DROPPED_SECTIONS = new Set(["When to load", "References"]);

export interface VocabularySkill {
  name: string;
  /** The skill's text as the prompt carries it. */
  body: string;
  /** Library modules it covers, as reference chunk id prefixes
   *  (`zoned/validate/`, or `zoned/calculate/addZoned` for a single file). */
  modules: string[];
  /** Guide pages it covers, as chunk URL prefixes (`/guides/integration/linting/`,
   *  or `/guides/intervals/` for a whole folder). */
  pages: string[];
}

const LIB_SOURCE = "packages/gmt/src/";
const DOCS_SOURCE = "apps/dox/src/content/docs/";

/** Reads one SKILL.md into its name, trimmed body and sources. */
export function parseSkill(markdown: string): VocabularySkill {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
  const frontmatter = match?.[1] ?? "";
  const content = match ? markdown.slice(match[0].length) : markdown;

  const name = /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim() ?? "";
  const sources = [
    ...frontmatter.matchAll(/^\s+-\s+['"]?([^'"\n]+)['"]?\s*$/gm),
  ]
    .map((m) => m[1]?.replace(/^[^:]+:/, "") ?? "")
    .filter(Boolean);

  const modules: string[] = [];
  const pages: string[] = [];
  for (const source of sources) {
    if (source.startsWith(LIB_SOURCE)) {
      const path = source.slice(LIB_SOURCE.length).replace(/\.ts$/, "");
      modules.push(
        path.endsWith("/index") ? path.slice(0, -"index".length) : path,
      );
    } else if (source.startsWith(DOCS_SOURCE)) {
      const path = source.slice(DOCS_SOURCE.length);
      // `guides/intervals/*.mdx` → every page in the folder.
      const glob = path.indexOf("*");
      pages.push(
        glob >= 0
          ? `/${path.slice(0, glob)}`
          : `/${path.replace(/\.mdx?$/, "").replace(/\/index$/, "")}/`,
      );
    }
  }

  return { name, body: trimSections(content).trim(), modules, pages };
}

/** Drops each `## ` section named in `DROPPED_SECTIONS`, up to the next. */
function trimSections(content: string): string {
  const kept: string[] = [];
  let dropping = false;
  for (const line of content.split("\n")) {
    const heading = /^## (.+?)\s*$/.exec(line);
    if (heading) dropping = DROPPED_SECTIONS.has(heading[1] ?? "");
    if (!dropping) kept.push(line);
  }
  return kept.join("\n");
}

/** Whether a skill's sources include the chunk. */
function covers(skill: VocabularySkill, chunk: RetrievalChunk): boolean {
  if (chunk.kind === "function") {
    return skill.modules.some((module) =>
      module.endsWith("/")
        ? chunk.id.startsWith(module)
        : chunk.id === module || chunk.id.startsWith(`${module}/`),
    );
  }
  return skill.pages.some((page) => chunk.url.startsWith(page));
}

/**
 * The vocabulary for one question, best-matching skill first, or `""` when no
 * retrieved chunk belongs to any skill.
 */
export function selectVocabulary(
  skills: readonly VocabularySkill[],
  retrieved: readonly RetrievalChunk[],
  budget: number = VOCABULARY_BUDGET_CHARS,
): string {
  const scores = new Map<VocabularySkill, number>();
  retrieved.slice(0, VOTING_DEPTH).forEach((chunk, rank) => {
    const claimants = skills.filter((skill) => covers(skill, chunk));
    for (const skill of claimants) {
      scores.set(
        skill,
        (scores.get(skill) ?? 0) + 1 / (rank + 1) / claimants.length,
      );
    }
  });

  // Stable: equal scores keep the registry's order.
  const ranked = skills
    .filter((skill) => scores.has(skill))
    .sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));

  const best = ranked[0] ? (scores.get(ranked[0]) ?? 0) : 0;
  const chosen: VocabularySkill[] = [];
  let used = 0;
  for (const skill of ranked) {
    if (chosen.length > 0) {
      if ((scores.get(skill) ?? 0) < best * RUNNER_UP_SHARE) break;
      if (used + skill.body.length > budget) continue;
    }
    chosen.push(skill);
    used += skill.body.length;
  }
  return chosen.map((skill) => skill.body).join("\n\n---\n\n");
}
