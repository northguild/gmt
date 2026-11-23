/**
 * The Opening Hours Board's verdict line: one of four, from the facts. Pure, with no builder
 * import, so the WebMCP tool reads the same words the page shows.
 */
import type { BoardFacts } from "./opening-hours-board";

interface BoardVerdict {
  tone: "neutral" | "sentinel";
  title: string;
  detail: string;
}

export const VERDICTS = {
  refused: {
    tone: "sentinel",
    title: "Schedule refused",
    detail:
      "⟨ NO SIGNAL ⟩ isValidOperatingSchedule returns false, so every reading below is blank. A refused schedule is not a closed one.",
  },
  noWeek: {
    tone: "neutral",
    title: "Valid schedule",
    detail: "Type Week of or From to draw a week.",
  },
  closed: {
    tone: "neutral",
    title: "Closed all week",
    detail:
      "The schedule is valid and has no open time in this week: operatingIntervals returns [].",
  },
  open: {
    tone: "neutral",
    title: "Open this week",
    detail: "The schedule is valid and has open time in the week drawn.",
  },
} as const satisfies Record<string, BoardVerdict>;

export function verdictOf(facts: BoardFacts): BoardVerdict {
  if (facts.kind === "refused") return VERDICTS.refused;
  if (facts.week === null) return VERDICTS.noWeek;
  return facts.intervals.length === 0 ? VERDICTS.closed : VERDICTS.open;
}
