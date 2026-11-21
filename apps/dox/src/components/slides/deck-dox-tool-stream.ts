/**
 * The `tools` mode's answer as chunks: the page's own tool call, run in this page, in place of a
 * model. The call, the two Easters, then the widget call, which opens the month grids for the
 * call's year.
 */
import type { UIMessageChunk } from "ai";

/** The tool call's id: also the id of the one question the slide offers. */
export const TOOL_ID = "call-1";

export function toolStream(
  year: number,
  signal: AbortSignal,
): ReadableStream<UIMessageChunk> {
  return new ReadableStream<UIMessageChunk>({
    async start(out) {
      try {
        const { pageToolRequest, runPageToolCall } =
          await import("~/lib/slides/page-tool-call");
        const request = pageToolRequest(year);
        out.enqueue({ type: "start" });
        out.enqueue({ type: "text-start", id: "call" });
        out.enqueue({
          type: "text-delta",
          id: "call",
          delta: `Calling \`${request.name}\` on this page.\n`,
        });
        out.enqueue({ type: "text-end", id: "call" });
        const { text, widget } = await runPageToolCall(year, signal);
        if (signal.aborted) return out.close();
        out.enqueue({ type: "text-start", id: "answer" });
        out.enqueue({
          type: "text-delta",
          id: "answer",
          delta: text,
        });
        out.enqueue({ type: "text-end", id: "answer" });
        out.enqueue({
          type: "tool-input-available",
          toolCallId: TOOL_ID,
          toolName: widget.toolName,
          input: widget.input,
        });
        out.enqueue({ type: "finish" });
        out.close();
      } catch (failure) {
        if (signal.aborted) out.close();
        else out.error(failure);
      }
    },
  });
}
