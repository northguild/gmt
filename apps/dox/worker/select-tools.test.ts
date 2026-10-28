import type { UIMessage } from "ai";
import { CHAT_STARTERS } from "../src/lib/chat-constants";
import { ENABLED_TOOL_NAMES } from "../src/lib/dox-tools";
import { buildRetrievalCorpus } from "../src/lib/retrieval/corpus";
import { searchChunks } from "../src/lib/retrieval/search";
import {
  CORE_TOOL_COUNT,
  MATCHED_TOOL_COUNT,
  selectTools,
} from "./select-tools";

const corpus = buildRetrievalCorpus();
const pick = (query: string, messages: UIMessage[] = []) =>
  selectTools({ query, retrieved: searchChunks(corpus, query), messages });

const CORE = CHAT_STARTERS.slice(0, CORE_TOOL_COUNT).map((s) => s.widget);

describe("selectTools", () => {
  // The starters are the questions these widgets exist for. A starter whose
  // own widget is not offered can never get it from the model.
  it.each(CHAT_STARTERS.map((starter) => [starter.widget, starter.text]))(
    "offers %s for its own chat starter",
    (widget, text) => {
      expect(pick(text)).toContain(widget);
    },
  );

  it("always offers the core tools, first", () => {
    expect(pick("recommend a pizza restaurant").slice(0, CORE.length)).toEqual(
      CORE,
    );
  });

  it("offers at most the core tools plus the matched ones", () => {
    for (const starter of CHAT_STARTERS) {
      expect(pick(starter.text).length).toBeLessThanOrEqual(
        CORE_TOOL_COUNT + MATCHED_TOOL_COUNT,
      );
    }
  });

  it("offers only enabled tools", () => {
    const enabled = new Set<string>(ENABLED_TOOL_NAMES);
    for (const starter of CHAT_STARTERS) {
      for (const name of pick(starter.text)) expect(enabled).toContain(name);
    }
  });

  it("keeps a tool the conversation already called", () => {
    const history: UIMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-showGnssRolloverChecker",
            toolCallId: "call-1",
            state: "output-available",
            input: {},
            output: { ok: true, widget: "gnss-rollover-checker" },
          },
        ],
      },
    ];
    expect(pick("and in Tokyo?", history)).toContain(
      "showGnssRolloverChecker",
    );
  });

  it("ignores a tool part that is not an enabled widget", () => {
    const history: UIMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-somethingElse",
            toolCallId: "call-1",
            state: "output-available",
            input: {},
            output: {},
          },
        ],
      },
    ];
    expect(pick("and in Tokyo?", history)).not.toContain("somethingElse");
  });
});
