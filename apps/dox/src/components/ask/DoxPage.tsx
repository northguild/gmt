/**
 * DOX-C3a (#139) — Host 2 chrome: the full-bleed `/dox` surface.
 *
 * Deliberately not a nav bar. The Starlight header is hidden on this route
 * (see `dox.astro`'s `data-dox-shell` scoping), so this strip carries the only
 * wayfinding a reader needs — one way back to the docs — plus an environment
 * badge when pointed at a local Worker. Everything else is the conversation.
 *
 * DOX-C3b adds the widget rail as a sibling of `<DoxChat>` inside
 * `.gmt-hive-body`. The rail collapses to nothing when empty, so a conversation
 * with no widget in it lays out exactly as it did before.
 */
import { useCallback, useEffect, useState } from "react";
import { BrainSelector } from "./BrainSelector";
import { DoxChat } from "./DoxChat";
import { useBrains } from "./use-brains";
import { ChatErrorBoundary } from "./ChatErrorBoundary";
import { WidgetRail, type RailWidget } from "./WidgetRail";
import { resolveWidget } from "./widget-registry";

/** Which Worker this page is talking to.
 *
 * Read after mount, never during render. Deriving it straight from
 * `window.location` made the server render one value and the client render
 * another, which React reports as a hydration mismatch (#418) — this is
 * client-only state, so it has to arrive in a second pass. `null` is the
 * pre-mount state and renders nothing, which is also why the badge cannot
 * flicker from the wrong label to the right one. */
type Environment = "local" | "live";

function useEnvironment(): Environment | null {
  const [environment, setEnvironment] = useState<Environment | null>(null);
  useEffect(() => {
    const { hostname } = window.location;
    setEnvironment(
      hostname === "localhost" || hostname === "127.0.0.1" ? "local" : "live",
    );
  }, []);
  return environment;
}

export default function DoxPage() {
  const environment = useEnvironment();
  const { info, refresh } = useBrains();
  /** The reader's explicit brain choice; null means "whichever has budget".
   * Held here rather than in `DoxChat` because the selector lives in the strip,
   * which is this host's chrome — the dock (phase 2) will supply its own. */
  const [selectedBrainId, setSelectedBrainId] = useState<string | null>(null);

  /* The rail's state lives here rather than in `DoxChat`, for the same reason
     the brain selector does: it is this host's chrome. One widget at a time. */
  const [railWidget, setRailWidget] = useState<RailWidget | null>(null);

  const showWidget = useCallback(
    (toolCallId: string, toolName: string, input: unknown) => {
      /* The single dispatch point. An unknown tool name or input that fails the
         schema resolves to a reason, and the rail simply never opens — the
         receipt in the transcript has already said so. */
      const resolved = resolveWidget(toolName, input);
      if (!resolved.ok) return;
      setRailWidget({ toolCallId, entry: resolved.entry, args: resolved.args });
    },
    [],
  );

  const closeWidget = useCallback(() => setRailWidget(null), []);

  return (
    <div className="gmt-ask gmt-hive-shell">
      <header className="gmt-hive-strip">
        <a className="gmt-hive-back" href="/">
          ← @northguild/gmt
        </a>
        <div className="gmt-hive-strip-end">
          <BrainSelector
            info={info}
            selectedId={selectedBrainId}
            onSelect={setSelectedBrainId}
          />
          {/* Environment sits last, hard against the edge: it is standing
              status rather than a control, so it should not push the thing a
              reader actually clicks away from the corner. */}
          {environment && (
            <span
              className="gmt-hive-env"
              data-env={environment}
              title={
                environment === "local"
                  ? "Pointed at a Worker on this machine"
                  : "Pointed at the deployed Worker"
              }
            >
              ● {environment}
            </span>
          )}
        </div>
      </header>
      <div className="gmt-hive-body">
        {/* Two boundaries, not one. The transcript is the reader's
            conversation — a widget that fails to mount must not take it away,
            and the rail is by far the likelier of the two to break, since it
            runs third-party rendering code against arguments a model chose. */}
        <ChatErrorBoundary label="transcript">
          <DoxChat
            brains={info}
            selectedBrainId={selectedBrainId}
            onUsed={refresh}
            onWidget={showWidget}
          />
        </ChatErrorBoundary>
        <ChatErrorBoundary
          label="widget rail"
          /* No reload offered here: the conversation behind this is intact and
             reloading would throw it away to fix a panel the reader can simply
             close. */
          fallback={(_error, reset) => (
            <aside className="gmt-hive-rail" aria-label="Widget panel">
              <div className="gmt-hive-boundary" role="alert">
                <span className="gmt-hive-boundary-marker" aria-hidden="true">
                  ⟨ ! ⟩
                </span>
                <div>
                  <p>This widget couldn&rsquo;t be shown.</p>
                  <button
                    type="button"
                    className="gmt-hive-boundary-reload gmt-sonar-focus"
                    onClick={() => {
                      reset();
                      closeWidget();
                    }}
                  >
                    Close the panel
                  </button>
                </div>
              </div>
            </aside>
          )}
        >
          <WidgetRail widget={railWidget} onClose={closeWidget} />
        </ChatErrorBoundary>
      </div>
    </div>
  );
}
