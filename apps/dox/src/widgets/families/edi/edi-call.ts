/**
 * The library calls a reading made and what they returned, each in a hold that keeps the size of
 * the largest it can show.
 *
 * The live frame is the kit's `codeFrame`, which has a copy button and a scrollable line and so
 * cannot be a hidden ghost (a ghost takes no focus). Each ghost is a plain block that takes the
 * same padding, face and line height as the frame, with the call's text in it, so the box is as
 * tall and as wide as the real one. `callOutput` is reserved the same way.
 */
import { callOutput, type CallOutputLine } from "../gnss/call-output";
import { callLines, outputOf, type CallOutputState } from "../gnss/call-lines";
import type { EdiCall } from "~/lib/edi-widgets";
import { codeFrame } from "../../builders/code-frame";
import { html, type SafeHtml } from "../../builders/html";
import { hold } from "./edi-hold";
import styles from "./edi-call.module.css";

export { callLines, outputOf };

interface CallFrameSpec {
  /** The frame's name. */
  label: string;
  copyLabel?: string;
  calls: readonly EdiCall[];
}

/** The frame for a reading's calls, or nothing when it made none. */
export function callFrameContent(spec: CallFrameSpec): SafeHtml {
  if (spec.calls.length === 0) return html``;
  const lines = callLines(spec.calls);
  return codeFrame({
    label: spec.label,
    copyLabel: spec.copyLabel ?? "Copy call",
    copyText: lines.plain,
    code: lines.code,
    gate: "codeframe",
  });
}

/** A frame's ghost: the call text in a block of the frame's size. */
function frameGhost(text: string): SafeHtml {
  return html`<pre class="${styles.frameGhost}"><code>${text}</code></pre>`;
}

interface CallFrameHoldOptions {
  id: string;
  spec: CallFrameSpec;
  /** Every call text the region can show, as plain text. */
  samples: readonly string[];
}

export function callFrameHold(o: CallFrameHoldOptions): SafeHtml {
  return hold({
    id: o.id,
    content: callFrameContent(o.spec),
    ghosts: [...new Set(o.samples)].map(frameGhost),
  });
}

/** The result pane's state for a plain message (nothing to read, nothing to write back). */
export function emptyOutput(text: string): CallOutputState {
  return { state: "empty", lines: [{ text, lost: false }] };
}

/** A result pane holding one live value. */
export function valueOutput(text: string): CallOutputState {
  return { state: "live", lines: [{ text, lost: false }] };
}

/** A result pane holding the sentinel. */
export function lostOutput(): CallOutputState {
  return { state: "sentinel", lines: [{ text: "NO SIGNAL", lost: true }] };
}

export function outputContent(label: string, s: CallOutputState): SafeHtml {
  return callOutput({ label, state: s.state, lines: s.lines });
}

/** A result pane's ghost: the lines in a block of the pane's size. */
function outputGhost(lines: readonly string[]): SafeHtml {
  return html`<div class="${styles.outputGhost}">${lines.join("\n")}</div>`;
}

interface OutputHoldOptions {
  id: string;
  label: string;
  state: CallOutputState;
  /** Every text the pane can show, one entry per state, lines joined by a newline. */
  samples: readonly string[];
}

export function outputHold(o: OutputHoldOptions): SafeHtml {
  return hold({
    id: o.id,
    content: outputContent(o.label, o.state),
    ghosts: [...new Set(["NO SIGNAL", ...o.samples])].map((s) =>
      outputGhost(s.split("\n")),
    ),
  });
}

export type { CallOutputLine, CallOutputState };
