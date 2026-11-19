import { readFileSync } from "node:fs";
import { buildRetrievalCorpus } from "../src/lib/retrieval/corpus";
import { searchChunks } from "../src/lib/retrieval/search";
import type { RetrievalChunk } from "../src/lib/retrieval/types";
import {
  parseSkill,
  chooseSkills,
  joinSkills,
  VOCABULARY_BUDGET_CHARS,
  type VocabularySkill,
} from "./select-vocabulary";

/* The real skills, read from disk. `vocabulary.ts` imports them as Wrangler
   Text modules, which Vitest cannot load — see chat-handler.ts. */
const SKILL_NAMES = [
  "gmt-basics",
  "gmt-arithmetic",
  "gmt-timezone",
  "gmt-integration",
  "gmt-gnss",
  "gmt-finance",
  "gmt-aviation",
  "gmt-rail",
  "gmt-iot",
  "gmt-transport",
  "gmt-intermodal",
  "gmt-workforce",
  "gmt-healthcare",
];
const SKILLS = SKILL_NAMES.map((name) =>
  parseSkill(
    readFileSync(
      new URL(`../../../packages/gmt/skills/${name}/SKILL.md`, import.meta.url),
      "utf8",
    ),
  ),
);

const corpus = buildRetrievalCorpus();
const namesFor = (question: string) =>
  chooseSkills(SKILLS, searchChunks(corpus, question)).map((s) => s.name);

function chunk(overrides: Partial<RetrievalChunk>): RetrievalChunk {
  return {
    id: "zoned/convert/convertZoned",
    kind: "function",
    url: "/reference/zoned/convert/convert-zoned/",
    namespace: "zoned",
    title: "convertZoned",
    text: "",
    ...overrides,
  };
}

function skill(overrides: Partial<VocabularySkill>): VocabularySkill {
  return { name: "s", body: "BODY", modules: [], pages: [], ...overrides };
}

describe("parseSkill", () => {
  const markdown = [
    "---",
    "name: gmt-example",
    "description: >",
    "  A folded description that mentions packages/gmt/src/zoned/ in passing.",
    "sources:",
    "  - 'northguild/gmt:packages/gmt/src/zoned/index.ts'",
    '  - "northguild/gmt:packages/gmt/src/zoned/calculate/addZoned.ts"',
    "  - 'northguild/gmt:apps/dox/src/content/docs/guides/intervals/index.mdx'",
    "  - 'northguild/gmt:apps/dox/src/content/docs/guides/zoned/*.mdx'",
    "  - 'northguild/gmt:apps/dox/src/content/docs/guides/how-to/convert.md'",
    "metadata:",
    "  type: core",
    "---",
    "",
    "# Example",
    "",
    "Intro.",
    "",
    "## When to load",
    "",
    "Load when a coding agent asks.",
    "",
    "## Core rules",
    "",
    "Rule one.",
    "",
    "## References",
    "",
    "- https://example.test",
  ].join("\n");
  const parsed = parseSkill(markdown);

  it("reads the name from the frontmatter", () => {
    expect(parsed.name).toBe("gmt-example");
  });

  it("turns library sources into chunk id prefixes, in either quote style", () => {
    expect(parsed.modules).toEqual(["zoned/", "zoned/calculate/addZoned"]);
  });

  it("turns docs sources into page URL prefixes, and a folder glob into the folder", () => {
    expect(parsed.pages).toEqual([
      "/guides/intervals/",
      "/guides/zoned/",
      "/guides/how-to/convert/",
    ]);
  });

  it("drops the frontmatter and the sections a reader never needs", () => {
    expect(parsed.body).toBe(
      "# Example\n\nIntro.\n\n## Core rules\n\nRule one.",
    );
  });

  it("reads a skill with no frontmatter as all body", () => {
    expect(parseSkill("# Bare\n\nText.")).toEqual({
      name: "",
      body: "# Bare\n\nText.",
      modules: [],
      pages: [],
    });
  });

  it("finds sources in every real skill", () => {
    for (const real of SKILLS) {
      expect(real.name).toMatch(/^gmt-/);
      expect(real.modules.length + real.pages.length).toBeGreaterThan(0);
      expect(real.body).not.toMatch(/^## (When to load|References)$/m);
    }
  });
});

describe("joinSkills", () => {
  it("joins bodies with a rule, and is empty for no skills", () => {
    const a = skill({ body: "A" });
    const b = skill({ body: "B" });
    expect(joinSkills([a, b])).toBe("A\n\n---\n\nB");
    expect(joinSkills([])).toBe("");
  });
});

describe("chooseSkills", () => {
  it("returns nothing when no chunk belongs to any skill", () => {
    expect(chooseSkills([skill({ modules: ["gnss/"] })], [chunk({})])).toEqual(
      [],
    );
  });

  it("always includes the best skill, even over budget", () => {
    const big = skill({ body: "x".repeat(100), modules: ["zoned/"] });
    expect(chooseSkills([big], [chunk({})], 10)).toEqual([big]);
  });

  it("leaves out a runner-up that scored under half the best", () => {
    const zoned = skill({ body: "ZONED", modules: ["zoned/"] });
    const gnss = skill({ body: "GNSS", modules: ["gnss/"] });
    const chunks = [
      chunk({}),
      chunk({ id: "zoned/a/b" }),
      chunk({ id: "gnss/convert/utcToGnss" }),
    ];
    expect(chooseSkills([gnss, zoned], chunks)).toEqual([zoned]);
  });

  it("adds a close runner-up while it fits the budget", () => {
    const zoned = skill({ body: "ZONED", modules: ["zoned/"] });
    const gnss = skill({ body: "GNSS", modules: ["gnss/"] });
    const chunks = [chunk({}), chunk({ id: "gnss/convert/utcToGnss" })];
    expect(chooseSkills([gnss, zoned], chunks)).toEqual([zoned, gnss]);
    expect(chooseSkills([gnss, zoned], chunks, 7)).toEqual([zoned]);
  });

  it("splits a chunk every skill claims, so it decides nothing", () => {
    const shared = chunk({ id: "types/zoned/ZonedString" });
    const a = skill({ body: "A", modules: ["types/", "zoned/"] });
    const b = skill({ body: "B", modules: ["types/", "gnss/"] });
    const chunks = [shared, chunk({ id: "gnss/x/y" })];
    expect(chooseSkills([a, b], chunks)).toEqual([b, a]);
  });

  it("matches a guide section by its page, and only by its page", () => {
    const guide = chunk({
      id: "/guides/intervals/set-operations/#union",
      kind: "guide",
      url: "/guides/intervals/set-operations/#union",
    });
    const page = skill({
      body: "PAGE",
      pages: ["/guides/intervals/set-operations/"],
    });
    const folder = skill({ body: "FOLDER", pages: ["/guides/intervals/"] });
    const sibling = skill({
      body: "SIBLING",
      pages: ["/guides/intervals/overview/"],
    });
    expect(chooseSkills([sibling, page], [guide])).toEqual([page]);
    expect(chooseSkills([sibling, folder], [guide])).toEqual([folder]);
    expect(chooseSkills([sibling], [guide])).toEqual([]);
  });

  it("picks the GNSS skill for a GNSS week question", () => {
    expect(namesFor("GPS week rollover and time of week")).toContain(
      "gmt-gnss",
    );
  });

  it("picks only the time-zone skill for a zone conversion question", () => {
    expect(namesFor("convert a meeting time between time zones")).toEqual([
      "gmt-timezone",
    ]);
  });

  it("picks the time-zone skill for a DST question", () => {
    expect(namesFor("what is a DST gap")).toEqual(["gmt-timezone"]);
  });

  it("picks the interval rules for an interval question", () => {
    expect(namesFor("merge overlapping intervals")).toContain("gmt-arithmetic");
  });

  it("stays within the budget for every real question", () => {
    for (const question of [
      "what is a DST gap",
      "how long did the container wait at the port",
      "driver hours in a rolling week",
      "convert TAI to UTC",
    ]) {
      const chosen = chooseSkills(SKILLS, searchChunks(corpus, question));
      expect(chosen.length).toBeGreaterThan(0);
      // One skill may exceed the budget on its own; two together may not.
      if (chosen.length > 1) {
        const total = chosen.reduce((sum, real) => sum + real.body.length, 0);
        expect(total).toBeLessThanOrEqual(VOCABULARY_BUDGET_CHARS);
      }
    }
  });
});
