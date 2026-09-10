/**
 * Dox's brain: which model is answering, what is left today, and a way to
 * change it.
 *
 * ## Why this is in the UI at all
 *
 * The Gemini free tier allows ~20 requests per day **per model, shared by every
 * visitor**. That is a strange enough constraint that hiding it produces a
 * worse experience than showing it: without this badge, Dox simply stops
 * answering partway through a day for reasons the reader cannot see or predict.
 * With it, the limit is legible and the reader can switch to a brain that still
 * has budget.
 *
 * The visitor's own allowance comes first because it is the number they can act
 * on; the shared pool follows because it explains a refusal that their own
 * number would not.
 */
import { useState } from "react";
import type { BrainsInfo } from "./use-brains";
import { untilReset } from "./use-brains";

export function BrainSelector({
  info,
  selectedId,
  onSelect,
}: {
  info: BrainsInfo | null;
  /** The reader's explicit pick, or null for "whichever has budget". */
  selectedId: string | null;
  onSelect: (brainId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  // No data (endpoint missing, Worker restarting, offline) → no badge. The
  // chat stays fully usable; this is ornament plus an escape hatch, not a gate.
  if (!info) return null;

  const active =
    info.brains.find(
      (brain) => brain.id === (selectedId ?? info.activeBrainId),
    ) ?? info.brains[0];

  const poolLeft = info.brains.reduce(
    (total, brain) => total + brain.remaining,
    0,
  );

  return (
    <div className="gmt-hive-brains">
      <button
        type="button"
        className="gmt-hive-brain-badge gmt-sonar-focus"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        title={`Dox resets ${untilReset(info.resetsAt)}`}
      >
        <span className="gmt-hive-brain-name">{active?.label ?? "Dox"}</span>
        <span className="gmt-hive-brain-counts">
          {info.visitor.unlimited ? (
            <span className="gmt-hive-brain-dev">dev</span>
          ) : (
            <>You {info.visitor.remaining} left</>
          )}
          <span aria-hidden="true"> · </span>
          Dox {poolLeft} today
        </span>
      </button>

      {open && (
        <ul className="gmt-hive-brain-list" role="listbox">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={selectedId === null}
              className="gmt-hive-brain-option gmt-sonar-focus"
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
            >
              <span>Automatic</span>
              <span className="gmt-hive-brain-meta">whichever has budget</span>
            </button>
          </li>
          {info.brains.map((brain) => (
            <li key={brain.id}>
              <button
                type="button"
                role="option"
                aria-selected={selectedId === brain.id}
                data-state={brain.state}
                className="gmt-hive-brain-option gmt-sonar-focus"
                onClick={() => {
                  onSelect(brain.id);
                  setOpen(false);
                }}
              >
                <span>{brain.label}</span>
                <span className="gmt-hive-brain-meta">
                  {brain.state === "unavailable"
                    ? "not available"
                    : brain.state === "spent"
                      ? "spent today"
                      : `${brain.remaining} left`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
