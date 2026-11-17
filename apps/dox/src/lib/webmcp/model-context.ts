/**
 * The slice of the WebMCP model context that Dox uses, and the way to find it.
 *
 * WebMCP (W3C Web Machine Learning CG draft) lets a page hand tools to an agent in the reader's
 * browser: `document.modelContext.registerTool(tool, { signal })`. Chrome shipped the object on
 * `navigator` first and moved it to `document`; the first of the two that has a callable
 * `registerTool` wins, so both builds work.
 *
 * Imports nothing, so `offer.ts`, which every tool page loads, stays tiny. The result types sit
 * here for the same reason; `page-tool.ts` re-exports them.
 */

/** What `execute` reports on success: the call's input, the answer and the notes the page would show. */
export interface PageToolRun<R> {
  input: unknown;
  result: R;
  notes: string[];
  /** The page's permalink for this call. A run sets a site path; the tool answers with a full URL. */
  link?: string;
}

/** What a tool resolves with. A refusal resolves too: the UA hides a rejection's message. */
export type PageToolResult<R> =
  | ({ ok: true; tool: string } & PageToolRun<R>)
  | {
      ok: false;
      tool: string;
      error: "invalid-input";
      issues: { path: string; message: string }[];
    }
  | { ok: false; tool: string; error: "unavailable"; message: string };

export interface ModelContextToolInit {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: true };
  execute(
    input: object,
    options?: { signal?: AbortSignal },
  ): Promise<PageToolResult<unknown>>;
}

export interface ModelContextLike {
  registerTool(
    tool: ModelContextToolInit,
    options?: { signal?: AbortSignal },
  ): Promise<void> | void;
}

function usable(value: unknown): value is ModelContextLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { registerTool?: unknown }).registerTool === "function"
  );
}

function read(owner: object | undefined): unknown {
  try {
    return (owner as { modelContext?: unknown } | undefined)?.modelContext;
  } catch {
    return undefined;
  }
}

/** `doc.modelContext`, else `nav.modelContext`, only when it has a callable `registerTool`. */
export function findModelContext(
  doc: Document | undefined = typeof document === "undefined"
    ? undefined
    : document,
  nav: Navigator | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
): ModelContextLike | null {
  for (const owner of [doc, nav]) {
    const found = read(owner);
    if (usable(found)) return found;
  }
  return null;
}
