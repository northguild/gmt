/**
 * DOX-C3b (#139) — owns exactly one mounted widget's lifecycle.
 *
 * The widget's DOM is **not** React's. React renders an empty host element;
 * everything inside it is written by `renderTemplate()` and wired by `mount()`.
 * That is deliberate, and it is what makes the hardest widget tractable: the DST
 * inspector keeps scrub state outside its render function, and nothing here ever
 * re-renders inside `root`, so there is no React re-render for that state to be
 * lost across.
 */
import { useEffect, useRef, useState } from "react";
import { WidgetLoadError, type WidgetHandle } from "~/lib/widget-mount";
import type { AnyWidgetEntry } from "./widget-registry";

/** The registry's titles are literals, but the placeholder is `innerHTML`, so
 * escape rather than rely on that. */
function escapeText(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function MountedWidget({
  entry,
  args,
  idPrefix,
  onHandle,
}: {
  entry: AnyWidgetEntry;
  args: unknown;
  idPrefix: string;
  /** Lets the rail read live state for the permalink button. */
  onHandle?: (handle: WidgetHandle | null) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<{
    message: string;
    retryable: boolean;
  } | null>(null);
  /* Bumped by Retry. A dependency of the effect, so a retry is a clean
     remount through the same path as the first attempt. */
  const [attempt, setAttempt] = useState(0);

  /* `argsKey`, not `args`. A fresh object identity on every render — which is
     what a streamed tool part produces — would remount the widget on every
     token. */
  const argsKey = JSON.stringify(args ?? null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const controller = new AbortController();
    let handle: WidgetHandle | undefined;
    let cancelled = false;

    setError(null);
    /* Busy from the first frame until the mount has wired the widget: first a
       placeholder while its chunk loads, then the template, whose controls do
       nothing until the mount has loaded the library. */
    root.setAttribute("aria-busy", "true");
    root.innerHTML = `<p class="gmt-hive-widget-loading" role="status">Loading ${escapeText(entry.title)}\u2026</p>`;

    void (async () => {
      try {
        /* Semantics before mount. A zone the model invented clears the schema
           by design, and this is where it is caught — by the library this site
           documents, not by a regex pretending to know the tz database. */
        const problem = await entry.validate?.(args);
        if (cancelled) return;
        if (problem) {
          setError({ message: problem, retryable: false });
          return;
        }

        const { mount, renderTemplate } = await entry.load();
        if (cancelled) return;
        root.innerHTML = renderTemplate(idPrefix, args as never);

        const mounted = await mount(root, args as never, controller.signal);
        if (cancelled) {
          // StrictMode's cleanup can land between the awaits above; the handle
          // exists now and nothing else will ever release it.
          mounted.destroy();
          return;
        }
        handle = mounted;
        root.removeAttribute("aria-busy");
        onHandle?.(mounted);
      } catch (thrown) {
        if (cancelled) return;
        console.error("widget mount failed", thrown);
        /* Two kinds of failure, and only one is worth a retry. The library not
           loading (or the mount module itself failing to import) is usually a
           dropped connection; a mount that throws on its arguments will throw
           the same way again. */
        const loadFailed =
          thrown instanceof WidgetLoadError ||
          (thrown instanceof TypeError && /import|fetch/i.test(thrown.message));
        setError(
          loadFailed
            ? {
                message: "Its library didn't load, which is usually the connection.",
                retryable: true,
              }
            : { message: "This widget couldn't be shown.", retryable: false },
        );
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      handle?.destroy();
      onHandle?.(null);
      // The host owns `root`, so dropping the subtree releases every listener
      // bound inside it. Mounts only need to clean up timers, observers, and
      // anything bound to window/document.
      root.replaceChildren();
    };
    // `onHandle` is deliberately excluded: the rail passes an inline callback,
    // and depending on it would remount the widget on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, argsKey, idPrefix, attempt]);

  if (error) {
    return (
      <WidgetError
        title={entry.title}
        message={error.message}
        onRetry={
          error.retryable
            ? () => {
                /* Clear the error first: while it is set the host element is
                   not rendered, and the effect would find no root to mount. */
                setError(null);
                setAttempt((n) => n + 1);
              }
            : undefined
        }
      />
    );
  }

  /* `suppressHydrationWarning` because this subtree is written by `mount()`,
     not by React — the server renders it empty and the client fills it. */
  return (
    <div className="gmt-hive-widget-host" ref={ref} suppressHydrationWarning />
  );
}

/**
 * What a reader sees when a widget cannot be shown.
 *
 * Says what was wrong in their language and gives them somewhere to go. No
 * stack trace. A retry only when one can help: a library that failed to load
 * may load now, but asking again for a zone the model invented produces the
 * same invented zone.
 */
export function WidgetError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="gmt-hive-widget-error" role="status">
      <span className="gmt-hive-widget-error-marker" aria-hidden="true">
        ⟨ ! ⟩
      </span>
      <p>
        <strong>{title}</strong> couldn&rsquo;t be shown. {message}
      </p>
      {onRetry && (
        <button
          type="button"
          className="gmt-hive-widget-retry gmt-sonar-focus"
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </div>
  );
}
