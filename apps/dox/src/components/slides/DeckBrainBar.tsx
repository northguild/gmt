import { BrainSelector } from "~/components/ask/BrainSelector";
import { ResetClock } from "~/components/ask/ResetClock";
import type { useBrains } from "~/components/ask/use-brains";
import type { useResetClock } from "~/components/ask/use-reset-clock";
import { setDeckBrain } from "~/lib/slides/deck-brain";
import styles from "./deck-dox.module.css";

/**
 * The brain bar every Dox slide ends in: the brain the live questions go to, the questions left
 * today and when they come back. When the counts cannot be read it says so, where /dox leaves the
 * badge out.
 */
export function DeckBrainBar({
  brains,
  brainId,
  clock,
}: {
  brains: ReturnType<typeof useBrains>;
  brainId: string | null;
  clock: ReturnType<typeof useResetClock>;
}) {
  return (
    <fieldset
      className={`gmt-hive-controls not-content ${styles["brains"]}`}
      aria-label="Dox brain"
      data-slot="brains"
    >
      {brains.status === "ready" ? (
        <>
          <ResetClock
            info={brains.info}
            selectedBrainId={brainId}
            clock={clock}
          />
          <BrainSelector
            info={brains.info}
            selectedId={brainId}
            onSelect={setDeckBrain}
            clock={clock}
          />
        </>
      ) : (
        <p className={styles["brainsNote"]} data-fine-print>
          {brains.status === "loading"
            ? "Reading Dox's brains…"
            : "Dox's brains did not answer: questions left unknown, recorded answers still play."}
        </p>
      )}
    </fieldset>
  );
}
