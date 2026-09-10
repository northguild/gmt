/**
 * DOX-C3b (#139) — the chip in the transcript recording that Dox showed a widget.
 *
 * The widget itself lives in the rail; this is the durable record of it in the
 * conversation, and the way back to it after the rail is closed.
 *
 * It is also where two of this story's Definition-of-Done cases are handled,
 * **before anything mounts** — which is what makes them cheap to test directly
 * rather than inferring them from the happy path:
 *
 *   - an **unknown tool name** renders an inert chip and never opens the rail;
 *   - an **`output-error`** part is checked before `part.input` is read at all,
 *     so a part carrying an error and no usable input cannot reach a schema.
 */
import type { ToolUIPart } from "ai";
import { getToolName } from "ai";
import { encodeWidgetPermalink } from "~/lib/widget-permalink";
import { resolveWidget } from "./widget-registry";

export function WidgetReceipt({
  part,
  onOpen,
}: {
  part: ToolUIPart;
  onOpen: (toolCallId: string, toolName: string, input: unknown) => void;
}) {
  const toolName = getToolName(part);

  /* Terminal-failure states first. `part.input` is not to be trusted — or even
     read — in either of them. */
  if (part.state === "output-error") {
    return (
      <ChipShell>
        Dox couldn&rsquo;t build that widget.
        {part.errorText ? ` ${part.errorText}` : ""}
      </ChipShell>
    );
  }

  if (part.state === "input-streaming") {
    return <ChipShell>Preparing a widget&#8230;</ChipShell>;
  }

  const resolved = resolveWidget(toolName, part.input);
  if (!resolved.ok) {
    return <ChipShell>{resolved.reason}</ChipShell>;
  }

  const permalink = encodeWidgetPermalink(
    resolved.entry.kind,
    (resolved.args as Record<string, unknown>) ?? {},
  );

  return (
    <div className="gmt-hive-receipt">
      <span className="gmt-hive-receipt-name">{resolved.entry.title}</span>
      <button
        type="button"
        className="gmt-hive-receipt-open gmt-sonar-focus"
        onClick={() => onOpen(part.toolCallId, toolName, part.input)}
      >
        Open in panel
      </button>
      {/* A real link, not a clipboard button: this one addresses the state Dox
          seeded, which is fixed, so it can simply be followed. The rail's copy
          button addresses live state, which cannot. */}
      <a className="gmt-hive-receipt-link" href={permalink}>
        Open the full page
      </a>
    </div>
  );
}

function ChipShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="gmt-hive-receipt" data-inert="">
      <span className="gmt-hive-receipt-name">{children}</span>
    </div>
  );
}
