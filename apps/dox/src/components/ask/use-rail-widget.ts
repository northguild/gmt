import { startTransition, useCallback, useRef, useState } from "react";
import type { RailWidget } from "./WidgetRail";
import { isSameWidget, resolveWidget } from "./widget-registry";

/**
 * The widget rail's one open widget, for every host that has a rail (`/dox` and the deck's Dox
 * slides): `showWidget` is the single dispatch point a chat's `onWidget` calls. An unknown tool or
 * input that fails the schema opens nothing, and the same widget with the same arguments is not
 * remounted (a starter pill seeds its widget on click, and the model's own call for it must not
 * reset what the reader has dragged); either way `showWidget` returns `false`. Opening and closing
 * go through a transition, so the rail's `<ViewTransition>` slides the widget in and out.
 * `closeWidget` returns the tool name of the widget it closed, so a host can return focus to it.
 * `openRef` reads the open widget from a stable callback, which cannot see state.
 */
export function useRailWidget() {
  const [railWidget, setRailWidget] = useState<RailWidget | null>(null);
  const railWidgetRef = useRef<RailWidget | null>(null);
  railWidgetRef.current = railWidget;

  const showWidget = useCallback(
    (toolCallId: string, toolName: string, input: unknown): boolean => {
      const resolved = resolveWidget(toolName, input);
      if (!resolved.ok) return false;
      if (isSameWidget(railWidgetRef.current, resolved.entry, resolved.args))
        return false;
      startTransition(() => {
        setRailWidget({
          toolCallId,
          toolName,
          entry: resolved.entry,
          args: resolved.args,
        });
      });
      return true;
    },
    [],
  );
  const closeWidget = useCallback((): string | null => {
    const closed = railWidgetRef.current?.toolName ?? null;
    startTransition(() => setRailWidget(null));
    return closed;
  }, []);
  return { railWidget, openRef: railWidgetRef, showWidget, closeWidget };
}
