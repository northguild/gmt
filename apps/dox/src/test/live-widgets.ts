/**
 * The widgets `renderWidget` has mounted and not yet destroyed. No DOM import, so
 * `setup-dom.ts` can load it in any environment.
 */
const live = new Set<() => void>();

export function trackWidget(destroy: () => void): () => void {
  live.add(destroy);
  return () => live.delete(destroy);
}

/** Runs after every test: a test that forgot `destroy()` leaves nothing behind. */
export function destroyLiveWidgets(): void {
  // Each `destroy` removes itself from the set; deleting during iteration is safe.
  for (const destroy of live) destroy();
  live.clear();
}
