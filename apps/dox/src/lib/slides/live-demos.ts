/**
 * The deck's live demos, named once: the running question's fallback text, the three ready
 * questions of the audience FAQ and where their recordings live. No imports, so the recording
 * script (run by Node's type stripping) and the Astro components read the same list.
 */

/** The recording of the running question, played on `ask-dox`. */
export const RUNNING_QUESTION_ID = "ask-dox";

/**
 * Used only while `quotes/agent-answer.json` has no question. The slide's question is the owner's
 * transcript, word for word; this keeps the panel usable before that file is filled.
 */
export const FALLBACK_RUNNING_QUESTION =
  "Write a JavaScript function that sets a reminder for 03:30 on 28 March 2027, Helsinki time, and returns the time as a UTC ISO string.";

export interface FaqQuestion {
  id: string;
  question: string;
}

/** The three ready questions, word for word, each with a recorded Dox answer. */
export const FAQ: readonly FaqQuestion[] = [
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
];

/** Every recording the deck needs, by id. */
export const RECORDING_IDS: readonly string[] = [
  RUNNING_QUESTION_ID,
  ...FAQ.map((item) => item.id),
];

/** Where the recordings are kept, relative to `apps/dox`. */
export const RECORDED_DIR = "src/slides/give-me-temporal/recorded";

/** The page the Worker is told a question comes from, for retrieval's namespace bias. */
export const DECK_PAGE_CONTEXT = "/slides/give-me-temporal/";
