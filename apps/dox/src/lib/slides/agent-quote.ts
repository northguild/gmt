/**
 * The recorded agent answer on slide 2: the owner's real transcript, with the question, the model,
 * the date of the recording and the code the model wrote. The record is a seam until the owner
 * supplies it: while any field is empty the slide shows a clearly marked "transcript to come"
 * panel, never an invented answer.
 */
export interface AgentQuoteRecord {
  question: string;
  model: string;
  /** The day the answer was recorded, as the owner states it. */
  date: string;
  /** The code of the answer. */
  answer: string;
}

export type AgentQuote =
  | { ready: false }
  | ({ ready: true } & AgentQuoteRecord);

export function agentQuote(record: AgentQuoteRecord): AgentQuote {
  const fields = [record.question, record.model, record.date, record.answer];
  if (fields.some((f) => f.trim() === "")) return { ready: false };
  return { ready: true, ...record };
}
