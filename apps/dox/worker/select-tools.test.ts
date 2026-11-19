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

// Whether a question gets its tool is scored by `evals/offline.test.ts` (`tools.offered`);
// these tests pin the mechanism.
describe("selectTools", () => {
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
    expect(pick("and in Tokyo?", history)).toContain("showGnssRolloverChecker");
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

  it("reads a reader's noun as the tool's verb: parser finds parse, uuid finds UUIDv7", () => {
    // "parser" meets the tool's "parse" through the -er stem.
    expect(
      pick("When a setting says 1m, how will a parser read it?"),
    ).toContain("showDurationParserBench");
    expect(pick("which instant is in this uuid")).toContain(
      "showIdTimestampDecoder",
    );
  });

  it("weighs a function the search ranked high the same against a long question as a short one", () => {
    // The question names no word of the dwell tool, so only the retrieved
    // `dwellTime` can offer it. Its full-text matches score in the hundreds
    // for a question this long, and once drowned that retrieved function.
    const dwell = corpus.filter((c) => c.id.endsWith("/dwellTime"));
    expect(dwell).toHaveLength(1);
    const long =
      "leap second TAI GNSS week rollover satellite cron schedule recurrence business day holiday calendar FHIR instant offset DST gap overlap spring forward fall back ambiguous skipped wall clock local time zone";
    for (const query of ["how long", long]) {
      expect(
        selectTools({ query, retrieved: dwell, messages: [] }),
        query,
      ).toContain("showDwellLedger");
    }
  });
});
