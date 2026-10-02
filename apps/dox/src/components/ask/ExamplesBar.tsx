/**
 * The phone's way back to the examples once a conversation has started: a bar
 * above the composer that toggles the bottom sheet. Hidden by CSS outside the
 * phone layout (gmt-hive.css), so on desktop it is neither seen nor tabbed to.
 */
import type { Ref } from "react";
import { ChevronUpIcon } from "lucide-react";
import { CHAT_STARTERS } from "~/lib/chat-constants";

export function ExamplesBar({
  expanded,
  railId,
  onToggle,
  ref,
}: {
  expanded: boolean;
  railId: string;
  onToggle: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className="gmt-hive-examples-bar gmt-sonar-focus"
      aria-expanded={expanded}
      aria-controls={railId}
      onClick={onToggle}
    >
      {/* The literal spaces keep the accessible name "Examples 17": inline
          spans otherwise run together, and a flex container ignores them. */}
      <span>Examples</span> <span aria-hidden="true">·</span>{" "}
      <span>{CHAT_STARTERS.length}</span>
      <ChevronUpIcon
        className="gmt-hive-examples-bar-chevron"
        aria-hidden="true"
      />
    </button>
  );
}
