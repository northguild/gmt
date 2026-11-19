/**
 * The deck's live page-tool call: Moving Feasts' `compute_easter_dates`, run in the deck's page the
 * way a browser agent's call runs it, for 2027. `execute` is the tool's own (the one
 * `offerPageTools` hands the browser), so the answer is the full JSON an agent would read: the
 * input the page filled in, both Easters, the feasts, the notes and the link. No network: the
 * library loads from the site's own chunks.
 *
 * 2027 because the two calendars split widely that year, and Gregorian Easter, 28 March, is the
 * day Helsinki's clocks go forward, the running question's date. The year is a fixed date in the
 * talk, not a window that ages.
 *
 * The slide shows less than the agent reads: the call, then the two Easter Sundays and the days
 * between them (`answerText`). The month grids the call opens beside the chat show the rest.
 */
import tool from "~/lib/webmcp/tools/moving-feasts";
import type { PageToolResult } from "~/lib/webmcp/model-context";

/** The talk's year: Gregorian Easter falls on the day of the running question. */
export const DECK_YEAR = 2027;

export interface PageToolCall {
  /** What the agent sends: the tool's name and its arguments. */
  call: { name: string; arguments: { year: number } };
  /** What it gets back. */
  answer: PageToolResult<unknown>;
  /** The answer as the slide's chat shows it (`answerText`). */
  text: string;
}

/** The part of the tool's result the slide reads. */
interface EasterAnswer {
  year: number;
  easter: {
    gregorian: string | null;
    julian: string | null;
    apart: string | null;
    side: string | null;
  };
}

/** The call as JSON text, two-space indented, for a code block. */
export const jsonText = (value: unknown): string =>
  JSON.stringify(value, null, 2);

/** What the call sends, before it runs. */
export const pageToolRequest = (): PageToolCall["call"] => ({
  name: tool.name,
  arguments: { year: DECK_YEAR },
});

/**
 * Runs the call. Aborting `signal` rejects with its reason, as a browser agent's cancelled call
 * does; the caller owns the controller.
 */
export async function runPageToolCall(
  signal: AbortSignal,
): Promise<PageToolCall> {
  signal.throwIfAborted();
  const call = pageToolRequest();
  const answer = await tool.execute(call.arguments, { signal });
  signal.throwIfAborted();
  return { call, answer, text: answerText(answer) };
}

const dateOrNone = (date: string | null): string =>
  date === null ? "none placed" : `\`${date}\``;

/**
 * The answer as the slide's chat shows it, in Markdown: the year, then the Gregorian and the
 * Julian Easter Sunday, and how far apart they fall. The page's notes name the inputs it filled
 * in for the agent (the offsets and the weekday of a month), which the slide does not show, so it
 * leaves them to the JSON. A year with no Easter placed says so, with the page's notes. A refusal
 * says why.
 */
export function answerText(answer: PageToolResult<unknown>): string {
  if (!answer.ok)
    return answer.error === "unavailable"
      ? `The page could not run the tool: ${answer.message}`
      : `The page refused the input: ${answer.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`;
  const { year, easter } = answer.result as EasterAnswer;
  const lines = [
    `The page answers, for Easter Sunday in ${year}:`,
    "",
    `- Gregorian: ${dateOrNone(easter.gregorian)}`,
    `- Julian: ${dateOrNone(easter.julian)}`,
  ];
  if (easter.apart !== null)
    lines.push(
      `- Apart: ${easter.apart}${easter.side === null ? "" : `, ${easter.side}`}`,
    );
  else lines.push(...answer.notes.map((note) => `\n${note}`));
  return lines.join("\n");
}
