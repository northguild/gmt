/**
 * DOX-C3a (#139) — Host 2 chrome: the full-bleed `/dox` surface.
 *
 * Deliberately not a nav bar. The Starlight header is hidden on this route
 * (see `dox.astro`'s `data-dox-shell` scoping), so this strip carries the only
 * wayfinding a reader needs — one way back to the docs — plus an environment
 * badge when pointed at a local Worker. Everything else is the conversation.
 *
 * A future widget rail (DOX-C3b) slots in as a sibling of `<DoxChat>`; nothing
 * here assumes a single column.
 */
import { useEffect, useState } from "react";
import { BrainSelector } from "./BrainSelector";
import { DoxChat } from "./DoxChat";
import { useBrains } from "./use-brains";

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
      <DoxChat
        brains={info}
        selectedBrainId={selectedBrainId}
        onUsed={refresh}
      />
    </div>
  );
}
