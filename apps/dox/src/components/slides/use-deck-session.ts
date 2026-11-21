import { useEffect, useMemo, useRef, useState } from "react";
import { isActive, onDeckState } from "~/lib/slides/deck-state";
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
 * from, and how many times the slide has been reached. Leaving the slide aborts the session,
 * clears the demo line and starts a new round, so a fresh chat follows and nothing is left running.
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
    onDeckState(deck, life.signal, (state) => {
      const now = isActive(root, state);
      if (now === activeRef.current) return;
      activeRef.current = now;
      if (now) {
        if (mode === "tools") setRun((n) => n + 1);
        return;
      }
      session.abort();
      announceDemo(deck, null);
      setSource(null);
      setRun(0);
      setRound((n) => n + 1);
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
