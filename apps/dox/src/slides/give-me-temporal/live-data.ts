/**
 * Deck 0's live panels (`lib/slides/live-data.ts`): the running question and its recording, the
 * three ready questions of the audience panel, the page tool's call, and how the quoted agent's
 * run is shown. The questions are word for word; each has a recording in `recorded/`.
 *
 * Plain data and JSON only, so `scripts/record-deck-answers.ts` reads the same list as the slides.
 */
import type { DeckLiveData } from "~/lib/slides/live-data";
import answer from "./quotes/agent-answer.json";

/**
 * Used only while `quotes/agent-answer.json` has no question. The slide's question is the owner's
 * transcript, word for word; this keeps the panel usable before that file is filled.
 */
const FALLBACK_RUNNING_QUESTION =
  "Write a JavaScript function that sets a reminder for 03:30 on 28 March 2027, Helsinki time, and returns the time as a UTC ISO string.";

export const LIVE: DeckLiveData = {
  pageContext: "/slides/give-me-temporal/",
  recordedDir: "src/slides/give-me-temporal/recorded",
  running: {
    id: "ask-dox",
    question:
      answer.question.trim() === ""
        ? FALLBACK_RUNNING_QUESTION
        : answer.question,
  },
  faq: [
    {
      id: "faq-helsinki-autumn",
      question: "What happens at 03:30 on 31 October 2027 in Helsinki?",
    },
    {
      id: "faq-samoa-skip",
      question: "Which day did Samoa skip, and why?",
    },
    {
      id: "faq-add-month",
      question: "How do I add a month to 31 January with GMT?",
    },
  ],
  // 2027: the two calendars split widely that year, and Gregorian Easter, 28 March, is the day
  // Helsinki's clocks go forward, the running question's date.
  tool: { question: "When is Easter in 2027? Ask this page.", year: 2027 },
  agentRun: {
    shown: { node: "26", zone: "Europe/Helsinki" },
    answerPath: "apps/dox/src/slides/give-me-temporal/quotes/agent-answer.json",
    runCommand:
      "cd scripts/zone-matrix && fnm exec --using=26 -- node agent-answer.mjs",
  },
};
