/**
 * Keeps a crash inside the chat island from blanking the page.
 *
 * ## Why this exists
 *
 * Without it, any error thrown during render unmounts the whole island, and
 * because `.gmt-hive-shell` is `position: fixed; inset: 0` over `--gmt-void`,
 * what the reader is left with is a **completely black screen** — no message,
 * no way back, nothing to report but "it went black".
 *
 * That was found in development, where a stale Vite dependency cache made a
 * lazily-imported chunk 404. The trigger was tooling; the outcome was not, and
 * the same outcome is reachable in production for a reason that is designed
 * into this project: `deploy-dox.yml` fires on every push to `main`, and Vite
 * content-addresses its chunks, so **every deploy renames them**. A reader with
 * `/dox` already open when a deploy lands, who then asks a question, requests a
 * lazily-loaded chunk that no longer exists. Streamdown's syntax highlighting is
 * exactly such a chunk, and it loads when the first answer renders — so the
 * failure lands mid-conversation rather than on page load, which is the worst
 * moment for the page to vanish.
 *
 * A boundary cannot prevent that. What it can do is degrade it from "black
 * screen" to "a sentence and a reload button", which is the difference between
 * a reader thinking the site is broken and a reader pressing a button.
 *
 * ## Why a class component
 *
 * React has no hook equivalent — `getDerivedStateFromError` and
 * `componentDidCatch` are class-only, still, in React 19. `react-error-boundary`
 * wraps the same API in a dependency; this is thirty lines and adds none.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Names the part that failed, so the message can say which. */
  label: string;
  /** Rendered instead of the default notice — used by the rail, which should
   *  not offer a page reload for a widget that failed. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Deliberately still logged: the boundary makes the failure survivable, not
    // invisible, and the stack is what makes it diagnosable.
    console.error(
      `[dox] ${this.props.label} crashed`,
      error,
      info.componentStack,
    );
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    /* A failed dynamic import is the expected case here and it is not
       recoverable by re-rendering — the chunk is gone. Reloading fetches the
       current build, so that is what is offered. */
    const isStaleChunk =
      /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
        error.message,
      );

    return (
      <div className="gmt-hive-boundary" role="alert">
        <span className="gmt-hive-boundary-marker" aria-hidden="true">
          ⟨ ! ⟩
        </span>
        <div>
          <p>
            {isStaleChunk
              ? "Dox couldn’t finish loading. This usually means the site was updated while this page was open."
              : "Something went wrong in the chat."}
          </p>
          <button
            type="button"
            className="gmt-hive-boundary-reload gmt-sonar-focus"
            onClick={() => window.location.reload()}
          >
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
