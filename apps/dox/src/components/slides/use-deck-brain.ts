import { useMemo, useSyncExternalStore } from "react";
import {
  getDeckBrain,
  setDeckBrain,
  subscribeDeckBrain,
} from "~/lib/slides/deck-brain";

/** The deck's one brain pick, shared by every Dox slide; `pick` is what the chat host takes. */
export function useDeckBrain() {
  const id = useSyncExternalStore(subscribeDeckBrain, getDeckBrain, () => null);
  const pick = useMemo(() => ({ id, onSelect: setDeckBrain }), [id]);
  return { id, pick };
}
