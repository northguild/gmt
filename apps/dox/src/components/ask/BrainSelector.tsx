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
 *
 * ## Why Radix and not a hand-rolled popover
 *
 * This was originally a `useState` popover rendering `<ul role="listbox">` with
 * `<li>` wrappers around `role="option"` buttons. That is invalid ARIA — a
 * `listbox` may only contain `option`s, so the interposed `<li>`s broke the
 * accessibility tree — and it implemented none of the pattern its own
 * `aria-haspopup="listbox"` promised: no Escape, no outside-click dismissal, no
 * arrow-key navigation, no focus return to the trigger. It was Tab-reachable,
 * which satisfied `DOX-C3a`'s keyboard-only DoD line on a literal reading and
 * nothing more.
 *
 * `ui/dropdown-menu.tsx` was already vendored and unused. Radix gives the whole
 * pattern — roving focus, typeahead, Escape, outside-click, focus return — and
 * a *menu* with `menuitemradio` children is the honest role for "pick one of
 * these", which is what this control does. That primitive being Radix-backed is
 * the exact reason `DOX-C0` adopted the shadcn registry in the first place.
 */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { BrainsInfo } from "./use-brains";
import { untilReset } from "./use-brains";

/* Radix's RadioGroup addresses items by string value, and "no explicit pick"
   has to be one of them. A sentinel that cannot collide with a Gemini model id
   is cheaper than making the group's value nullable. */
const AUTOMATIC = "\u0000automatic";

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="gmt-hive-brain-badge gmt-sonar-focus"
            title={`Dox resets ${untilReset(info.resetsAt)}`}
          >
            <span className="gmt-hive-brain-name">
              {active?.label ?? "Dox"}
            </span>
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
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="gmt-hive-brain-list">
          <DropdownMenuRadioGroup
            value={selectedId ?? AUTOMATIC}
            onValueChange={(value) =>
              onSelect(value === AUTOMATIC ? null : value)
            }
          >
            <DropdownMenuRadioItem
              value={AUTOMATIC}
              className="gmt-hive-brain-option"
            >
              <span className="gmt-hive-brain-label">Automatic</span>
              <span className="gmt-hive-brain-meta">whichever has budget</span>
            </DropdownMenuRadioItem>
            {info.brains.map((brain) => (
              <DropdownMenuRadioItem
                key={brain.id}
                value={brain.id}
                /* NOT `data-state` — Radix owns that attribute on a menu item
                   (`checked`/`unchecked`), and the two meanings collided. */
                data-brain-state={brain.state}
                className="gmt-hive-brain-option"
              >
                <span className="gmt-hive-brain-label">{brain.label}</span>
                <span className="gmt-hive-brain-meta">
                  {brain.state === "unavailable"
                    ? "not available"
                    : brain.state === "spent"
                      ? "spent today"
                      : `${brain.remaining} left`}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
