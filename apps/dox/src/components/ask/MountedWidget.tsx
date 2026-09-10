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
import type { WidgetHandle } from "~/lib/widget-mount";
import type { AnyWidgetEntry } from "./widget-registry";

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
  const [error, setError] = useState<string | null>(null);

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
    root.innerHTML = entry.renderTemplate(idPrefix);

    void (async () => {
      try {
        /* Semantics before mount. A zone the model invented clears the schema
           by design, and this is where it is caught — by the library this site
           documents, not by a regex pretending to know the tz database. */
        const problem = await entry.validate?.(args);
        if (cancelled) return;
        if (problem) {
          setError(problem);
          return;
        }

        const { mount } = await entry.load();
        if (cancelled) return;

        const mounted = await mount(root, args as never, controller.signal);
        if (cancelled) {
          // StrictMode's cleanup can land between the awaits above; the handle
          // exists now and nothing else will ever release it.
          mounted.destroy();
          return;
        }
        handle = mounted;
        onHandle?.(mounted);
      } catch (thrown) {
        if (cancelled) return;
        console.error("widget mount failed", thrown);
        setError("This widget couldn't be shown.");
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
  }, [entry, argsKey, idPrefix]);

  if (error) {
    return <WidgetError title={entry.title} message={error} />;
  }

  /* `suppressHydrationWarning` because this subtree is written by `mount()`,
     not by React — the server renders it empty and the client fills it. */
  return (
    <div
      className="gmt-hive-widget-host"
      ref={ref}
      suppressHydrationWarning
    />
  );
}

/**
 * What a reader sees when a widget cannot be shown.
 *
 * Says what was wrong in their language and gives them somewhere to go. No
 * stack trace, and deliberately no retry: asking again for a zone the model
 * invented produces the same invented zone.
 */
export function WidgetError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="gmt-hive-widget-error" role="status">
      <span className="gmt-hive-widget-error-marker" aria-hidden="true">
        ⟨ ! ⟩
      </span>
      <p>
        <strong>{title}</strong> couldn&rsquo;t be shown. {message}
      </p>
    </div>
  );
}
