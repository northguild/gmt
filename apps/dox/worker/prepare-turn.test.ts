import type { UIMessage } from "ai";
import type { RetrievalChunk } from "../src/lib/retrieval/types";
import { fitChunks } from "./fit-chunks";
import { prepareTurn, queryOf } from "./prepare-turn";
import { selectTools } from "./select-tools";
import type { VocabularySkill } from "./select-vocabulary";

const user = (...texts: string[]): UIMessage => ({
  id: "u",
  role: "user",
  parts: texts.map((text) => ({ type: "text", text })),
});
const assistant = (text: string): UIMessage => ({
  id: "a",
  role: "assistant",
  parts: [{ type: "text", text }],
});

const chunk = (id: string, size = 10): RetrievalChunk => ({
  id,
  kind: "function",
  url: `/reference/${id}/`,
  namespace: id.split("/")[0] ?? "",
  title: id,
  text: "x".repeat(size),
});
const skill: VocabularySkill = {
  name: "zoned-skill",
  body: "ZONED",
  modules: ["zoned/"],
  pages: [],
};

describe("queryOf", () => {
  it("joins only the last user turn's text parts", () => {
    const messages: UIMessage[] = [
      user("first question"),
      assistant("an answer"),
      {
        id: "u2",
        role: "user",
        parts: [
          { type: "text", text: "second " },
          { type: "step-start" },
          { type: "text", text: "question" },
        ],
      },
      assistant("another answer"),
    ];
    expect(queryOf(messages)).toBe("second question");
  });

  it("is empty when no user turn exists", () => {
    expect(queryOf([assistant("hello")])).toBe("");
    expect(queryOf([])).toBe("");
  });
});

describe("prepareTurn", () => {
  it("cuts what was searched, offers tools and picks skills from the cut", async () => {
    const searched = Array.from({ length: 12 }, (_, i) =>
      chunk(`zoned/convert/fn${i}`),
    );
    const messages = [user("convert a time")];
    const turn = await prepareTurn({
      messages,
      pageContext: undefined,
      search: () => searched,
      skills: [skill],
    });
    expect(turn.query).toBe("convert a time");
    expect(turn.searched).toEqual(searched);
    expect(turn.retrieved).toEqual(fitChunks(searched));
    expect(turn.retrieved.length).toBeLessThan(searched.length);
    expect(turn.offered).toEqual(
      selectTools({ query: turn.query, retrieved: turn.retrieved, messages }),
    );
    expect(turn.chosen).toEqual([skill]);
  });

  it("passes the page's namespace and the query to search, awaiting an async search", async () => {
    const calls: [string, { namespace?: string }][] = [];
    const turn = await prepareTurn({
      messages: [user("what is a gap")],
      pageContext: "/reference/zoned/convert/convert-zoned/",
      search: async (query, options) => {
        calls.push([query, options]);
        return [chunk("zoned/a/b")];
      },
      skills: [],
    });
    expect(calls).toEqual([["what is a gap", { namespace: "zoned" }]]);
    expect(turn.retrieved).toHaveLength(1);
    expect(turn.chosen).toEqual([]);
  });

  it("sends no namespace for a page outside the reference and guides", async () => {
    let seen: { namespace?: string } | undefined;
    await prepareTurn({
      messages: [user("hi")],
      pageContext: "/dox",
      search: (_query, options) => {
        seen = options;
        return [];
      },
      skills: [],
    });
    expect(seen).toEqual({ namespace: undefined });
  });

  describe("a question that names zone cities", () => {
    const workforce: VocabularySkill = {
      name: "workforce-skill",
      body: "WORKFORCE",
      modules: ["workforce/"],
      pages: [],
    };
    const timezone: VocabularySkill = {
      name: "timezone-skill",
      body: "TIMEZONE",
      modules: ["zoned/convert/"],
      pages: [],
    };
    const ask = async (text: string) =>
      (
        await prepareTurn({
          messages: [user(text)],
          pageContext: undefined,
          // Retrieval found only workforce chunks, as "shift" pulls in.
          search: () => [chunk("workforce/calculate/dutyDayFor")],
          skills: [workforce, timezone],
        })
      ).chosen.map((s) => s.name);

    it("is a zone conversion whatever else the sentence says, so the zone skill is chosen", async () => {
      expect(
        await ask("her shift starts at 6am in Nairobi, what is that in Seoul"),
      ).toContain("timezone-skill");
    });

    it("gives the zone skill no vote for one city or none", async () => {
      expect(await ask("her shift starts at 6am in Nairobi")).toEqual([
        "workforce-skill",
      ]);
      expect(await ask("her shift starts at 6am")).toEqual(["workforce-skill"]);
    });
  });
});
