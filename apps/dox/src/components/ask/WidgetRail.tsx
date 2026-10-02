/**
 * DOX-C3b (#139) — the panel beside the transcript. It holds a live widget, or,
 * with none mounted, the examples panel.
 *
 * One widget at a time. Mounting several of these concurrently — each with its
 * own rAF loop and per-second clock tick — is not a feature.
 *
 * Composed inside `ai-elements/artifact.tsx`, which `DOX-C0` vendored and
 * nothing has used until now. The widget stylesheets are already loaded on
 * `/dox` via Starlight's `customCss` (see `astro.config.mjs`), so a mounted
 * widget arrives fully styled with no CSS of its own.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  ViewTransition,
  type RefObject,
} from "react";
import {
  Artifact,
  ArtifactActions,
  ArtifactClose,
  ArtifactHeader,
  ArtifactTitle,
} from "../ai-elements/artifact";
import { encodeWidgetPermalink } from "~/lib/widget-permalink";
import type { WidgetHandle } from "~/lib/widget-mount";
import type { CHAT_STARTERS } from "~/lib/chat-constants";
import { ExamplesPanel } from "./ExamplesPanel";
import { MountedWidget } from "./MountedWidget";
import type { AnyWidgetEntry } from "./widget-registry";

export interface RailWidget {
  /** The tool call this came from — also the mount's identity. */
  toolCallId: string;
  /** The tool's name, so closing the widget can return focus to its card. */
  toolName: string;
  entry: AnyWidgetEntry;
  args: unknown;
}

export function WidgetRail({
  widget,
  onClose,
  onPick,
  collapsed = false,
  railId,
  focusTitleRef,
}: {
  widget: RailWidget | null;
  onClose: () => void;
  /** An example card was activated. */
  onPick: (starter: (typeof CHAT_STARTERS)[number]) => void;
  /** Phone only: the examples sheet is folded away until the bar opens it. */
  collapsed?: boolean;
  /** The id the examples bar points `aria-controls` at. */
  railId: string;
  /** Set by the host for a card activation only: the next widget to commit
   *  takes focus on its title. A widget the model opens never does — the
   *  reader may be typing. Cleared once consumed. */
  focusTitleRef: RefObject<boolean>;
}) {
  const titleRef = useRef<HTMLParagraphElement>(null);
  const toolCallId = widget?.toolCallId;
  useEffect(() => {
    if (!toolCallId || !focusTitleRef.current) return;
    focusTitleRef.current = false;
    titleRef.current?.focus();
  }, [toolCallId, focusTitleRef]);

  const [handle, setHandle] = useState<WidgetHandle | null>(null);
  const [copied, setCopied] = useState(false);

  const copyPermalink = useCallback(() => {
    if (!widget) return;
    /* The *live* state, not the arguments Dox was given — the reader may have
       spun the globe somewhere else, and that is the view worth linking to. The
       transcript receipt carries the seeded state instead; the two mean
       different things and are labelled differently. */
    const state = handle?.getPermalinkState?.() ?? null;
    const url = new URL(
      encodeWidgetPermalink(
        widget.entry.kind,
        state ?? (widget.args as Record<string, unknown>) ?? {},
      ),
      window.location.origin,
    ).toString();

    void navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {
        // Clipboard denied (permissions, insecure context). Silent rather than
        // an error banner — the widget itself still works.
      },
    );
  }, [handle, widget]);

  /* With no widget the rail holds the examples panel, so it is never empty.
     Phone, conversation started: `collapsed` hides it until the bar opens it. */
  if (!widget) {
    return (
      <ViewTransition
        key="examples"
        enter="gmt-rail-in"
        exit="gmt-rail-out"
        default="none"
      >
        <aside
          className="gmt-hive-rail"
          id={railId}
          aria-label="Examples"
          data-collapsed={collapsed || undefined}
        >
          <ExamplesPanel onPick={onPick} />
        </aside>
      </ViewTransition>
    );
  }

  /* Slides in and out (gmt-hive.css, "Rail and transcript view transitions").
     Only animates for updates inside `startTransition` — the host's
     `showWidget`/`closeWidget` — and must stay the outermost element, before
     any DOM node, or React won't run enter/exit for it. Keyed on the call, so
     swapping widgets plays the old one out and the new one in. */
  return (
    <ViewTransition
      key={widget.toolCallId}
      enter="gmt-rail-in"
      exit="gmt-rail-out"
      default="none"
    >
      <aside className="gmt-hive-rail" id={railId} aria-label="Widget panel">
        <Artifact className="gmt-hive-artifact">
          <ArtifactHeader className="gmt-hive-artifact-header">
            <ArtifactTitle
              ref={titleRef}
              tabIndex={-1}
              className="gmt-hive-artifact-title"
            >
              {widget.entry.title}
            </ArtifactTitle>
            <ArtifactActions>
              <button
                type="button"
                className="gmt-hive-artifact-link gmt-sonar-focus"
                onClick={copyPermalink}
              >
                {copied ? "Copied" : "Copy link to this view"}
              </button>
              <ArtifactClose onClick={onClose} />
            </ArtifactActions>
          </ArtifactHeader>
          <div className="gmt-hive-artifact-body">
            <MountedWidget
              /* Keyed on the call, so asking a second question remounts rather
               than reusing a host that still holds the first widget's DOM. */
              key={widget.toolCallId}
              entry={widget.entry}
              args={widget.args}
              idPrefix={`rail-${widget.toolCallId}`}
              onHandle={setHandle}
            />
          </div>
        </Artifact>
      </aside>
    </ViewTransition>
  );
}
