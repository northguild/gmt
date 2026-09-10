/**
 * DOX-C3b (#139) — the panel beside the transcript that holds a live widget.
 *
 * One widget at a time. Mounting several of these concurrently — each with its
 * own rAF loop and per-second clock tick — is not a feature.
 *
 * Composed inside `ai-elements/artifact.tsx`, which `DOX-C0` vendored and
 * nothing has used until now. The widget stylesheets are already loaded on
 * `/dox` via Starlight's `customCss` (see `astro.config.mjs`), so a mounted
 * widget arrives fully styled with no CSS of its own.
 */
import { useCallback, useState } from "react";
import {
  Artifact,
  ArtifactActions,
  ArtifactClose,
  ArtifactHeader,
  ArtifactTitle,
} from "../ai-elements/artifact";
import { encodeWidgetPermalink } from "~/lib/widget-permalink";
import type { WidgetHandle } from "~/lib/widget-mount";
import { MountedWidget } from "./MountedWidget";
import type { AnyWidgetEntry } from "./widget-registry";

export interface RailWidget {
  /** The tool call this came from — also the mount's identity. */
  toolCallId: string;
  entry: AnyWidgetEntry;
  args: unknown;
}

export function WidgetRail({
  widget,
  onClose,
}: {
  widget: RailWidget | null;
  onClose: () => void;
}) {
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
        (state ?? (widget.args as Record<string, unknown>)) ?? {},
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

  // Collapsed to nothing when empty, so `/dox` is pixel-unchanged with no
  // widget mounted.
  if (!widget) return null;

  return (
    <aside className="gmt-hive-rail" aria-label="Widget panel">
      <Artifact className="gmt-hive-artifact">
        <ArtifactHeader className="gmt-hive-artifact-header">
          <ArtifactTitle className="gmt-hive-artifact-title">
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
  );
}
