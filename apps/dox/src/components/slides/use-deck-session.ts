import { useEffect, useMemo, useRef, useState } from "react";
import { isActive, onDeckState, whenStageRests } from "~/lib/slides/deck-state";
import {
  announceDemo,
  createDeckSession,
  type SourceState,
} from "~/lib/slides/deck-transport";
import { toolStream } from "./deck-dox-tool-stream";
import type { DeckDoxMode } from "./DeckDox";
import type { DeckToolScript } from "~/lib/slides/live-data";

/**
 * A Dox slide's life on the deck: one session for each round, where the answer on screen comes
 * from, and how many times the slide has been reached. Leaving the slide aborts the session and
 * clears the demo line at once, and starts a new round once the stage rests (`whenStageRests`), so a
 * fresh chat follows, nothing is left running and the remount never lands on the flight's frames.
 * Coming back before then starts the new round at once.
 */
export function useDeckSession(o: {
  mode: DeckDoxMode;
  demoId: string;
  pageContext: string;
  zone: string;
  tool: DeckToolScript | undefined;
  /** The frame the slide is in, to find the deck it belongs to. */
  rootRef: React.RefObject<HTMLElement | null>;
}) {
  const { mode, demoId, pageContext, zone, tool, rootRef } = o;
  const [source, setSource] = useState<SourceState | null>(null);
  /* Bumped on leaving the slide: a new session and a fresh chat, nothing left running. */
  const [round, setRound] = useState(0);
  /* Bumped each time the slide (or the build holding the chat) is reached while a round is idle. */
  const [run, setRun] = useState(0);
  const deckRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef(false);

  const session = useMemo(
    () =>
      createDeckSession({
        onSource: (state) => {
          setSource(state);
          const deck = deckRef.current;
          if (deck && activeRef.current)
            announceDemo(
              deck,
              state ? { id: demoId, source: state.source } : null,
            );
        },
        pageContext,
        zone,
        ...(mode === "tools" && tool
          ? { local: (signal: AbortSignal) => toolStream(tool.year, signal) }
          : {}),
      }),
    // A new round is a new session; the demo and its mode never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round],
  );

  useEffect(() => {
    const root = rootRef.current;
    const deck = root?.closest<HTMLElement>("[data-deck-root]") ?? null;
    deckRef.current = deck;
    if (!root || !deck) return;
    const life = new AbortController();
    /** The new round waiting for the stage to rest, if any. */
    let pending: AbortController | null = null;
    const newRound = (): void => {
      pending?.abort();
      pending = null;
      setSource(null);
      setRun(0);
      setRound((n) => n + 1);
    };
    onDeckState(deck, life.signal, (state) => {
      const now = isActive(root, state);
      if (now === activeRef.current) return;
      activeRef.current = now;
      if (now) {
        // Back before the stage rested: the fresh chat comes now.
        if (pending) newRound();
        if (mode === "tools") setRun((n) => n + 1);
        return;
      }
      session.abort();
      announceDemo(deck, null);
      pending = new AbortController();
      life.signal.addEventListener("abort", () => pending?.abort());
      whenStageRests(deck, pending.signal, newRound);
    });
    const leave = (): void => session.abort();
    addEventListener("pagehide", leave);
    return () => {
      life.abort();
      removeEventListener("pagehide", leave);
      session.abort();
      activeRef.current = false;
    };
  }, [session, mode, rootRef]);

  return { session, source, round, run };
}
