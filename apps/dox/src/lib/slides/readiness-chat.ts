/** The Dox chat readiness row, from what `GET /api/brains` answers. */
import { RETRY, row, type ReadinessRow } from "./readiness-rows";

const failed = (why: string): ReadinessRow =>
  row(
    "chat",
    "failed",
    `Failed: the demos will play their recordings (${why})`,
  );

/** The Dox chat row from what `/api/brains` answered. */
export function chatRow(payload: unknown): ReadinessRow {
  if (typeof payload !== "object" || payload === null)
    return failed("the answer was not readable");
  const info = payload as {
    visitor?: { unlimited?: unknown };
    brains?: { state?: unknown; remaining?: unknown }[];
  };
  if (info.visitor?.unlimited !== true)
    return failed(
      "this browser has no dev cookie, so the visitor limit applies",
    );
  const usable = (info.brains ?? []).some(
    (b) =>
      b.state === "ok" && typeof b.remaining === "number" && b.remaining > 0,
  );
  if (!usable) return failed("no brain has allowance left today");
  return row("chat", "ok", "Ready: live answers, no visitor limit");
}

export async function brainsRow(
  url: string,
  signal: AbortSignal,
): Promise<ReadinessRow> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal,
    });
    if (!response.ok) return failed(`the chat answered ${response.status}`);
    return chatRow(await response.json());
  } catch {
    return failed(`no answer: ${RETRY}`);
  }
}
