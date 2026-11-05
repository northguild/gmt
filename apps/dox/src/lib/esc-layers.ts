/**
 * One Escape order for the whole site.
 *
 * Every layer a reader can open (a dialog, a menu, a popover, a drawer, a disclosure, a list, a
 * pinned card) registers here instead of listening for Escape itself.
 * One listener per document then closes exactly one layer per press and does nothing else:
 *
 * 1. The layers that hold focus go first, then the rest. A layer that has not been opened since
 *    the last press is not skipped; it is just ranked by when it opened.
 * 2. Among those, the one opened last wins. A layer that contains another open layer gives way
 *    to it, so a panel inside a drawer closes before the drawer.
 *    A layer that names another as `over` also goes before it, whichever opened first.
 * 3. A `focusOnly` layer (a `<details>` the reader is reading) counts only while focus is in it.
 *
 * After the layer shuts, focus goes to the control that opened it (WAI-ARIA APG: dialog,
 * disclosure, combobox, menu button), so it never falls to `<body>`. The press is heard once it
 * has bubbled to the window, so a control that handled it itself keeps it, and is consumed
 * (`preventDefault`, `stopImmediatePropagation`) so a native popover or dialog does not close with
 * it. A Radix layer is controlled by the page (`open` state) and ignores its own Escape.
 *
 * Opening order is read, not told: a layer's `isOpen` is read after each change the page makes
 * to `open`, `hidden`, `inert`, `aria-expanded` or `data-open`, after each popover `toggle`, and
 * again on the press. A layer whose state lives elsewhere (a closure, React state) calls
 * `changed()` when it flips. The listener exists only while a layer is registered.
 */

export interface EscLayer {
  /** The layer's root. Decides which document it lives in, and which layer sits inside which. */
  el?: Element | null;
  /** Whether the layer is open now. Cheap: it runs after every relevant change in the page. */
  isOpen(): boolean;
  /** Shuts this layer and nothing else. */
  close(): void;
  /** The control that opened it. Focus goes here once the layer has closed. */
  opener?(): HTMLElement | null;
  /** Whether a node is inside the layer, for "holds focus". Defaults to `el.contains`. */
  contains?(node: Node): boolean;
  /** A layer only while focus is inside it. */
  focusOnly?: boolean;
  /**
   * The layer that sits under this one on screen (its `el`). While both are open this one closes
   * first, whichever opened last: a card drawn over the Earth goes before the drawer beside it.
   */
  over?: Element | null;
  /** The layer puts focus back itself (a React effect, a Radix trigger), so the helper does not. */
  returnsFocus?: boolean;
}

export interface EscRegistration {
  /** Tell the helper the layer's state changed, for state it cannot see in the document. */
  changed(): void;
  /** Take the layer out. Also happens when the `signal` given at registration aborts. */
  remove(): void;
}

interface Entry {
  layer: EscLayer;
  open: boolean;
  seq: number;
}

interface DocState {
  records: Set<Entry>;
  counter: number;
  observer: MutationObserver | null;
  stop: AbortController;
}

const states = new WeakMap<Document, DocState>();

const WATCHED = ["open", "hidden", "inert", "aria-expanded", "data-open"];

function holds(layer: EscLayer, node: Node | null): boolean {
  if (!node) return false;
  if (layer.contains) return layer.contains(node);
  return layer.el ? layer.el.contains(node) : false;
}

function read(layer: EscLayer): boolean {
  try {
    return layer.isOpen();
  } catch {
    return false;
  }
}

/** Re-reads every layer and stamps the ones that have just opened. */
function sync(state: DocState): void {
  for (const rec of state.records) {
    const open = read(rec.layer);
    if (open && !rec.open) rec.seq = ++state.counter;
    rec.open = open;
  }
}

/** The focused element, or null when focus is on the page itself. */
function active(doc: Document): Element | null {
  const el = doc.activeElement;
  return el && el !== doc.body ? el : null;
}

/**
 * The layer one Escape closes, or null. Exported for its tests.
 * `focused` is the focused element, or null for none.
 */
export function pickLayer(
  entries: readonly { layer: EscLayer; seq: number }[],
  focused: Node | null,
): EscLayer | null {
  const open = entries.filter(
    (e) => !e.layer.focusOnly || holds(e.layer, focused),
  );
  if (open.length === 0) return null;
  const inner = open.filter(
    (a) =>
      !open.some(
        (b) =>
          b !== a &&
          a.layer.el &&
          b.layer.el &&
          a.layer.el !== b.layer.el &&
          a.layer.el.contains(b.layer.el),
      ),
  );
  const clear = inner.filter(
    (a) =>
      !open.some(
        (b) => b.layer.over != null && b.layer.over === a.layer.el && b !== a,
      ),
  );
  const pool = clear.length > 0 ? clear : inner.length > 0 ? inner : open;
  const holders = pool.filter((e) => holds(e.layer, focused));
  const ranked = holders.length > 0 ? holders : pool;
  let top = ranked[0]!;
  for (const e of ranked) if (e.seq > top.seq) top = e;
  return top.layer;
}

function focusable(el: HTMLElement | null): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  if (el.closest("[inert]")) return false;
  return true;
}

function handle(state: DocState, doc: Document, event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.defaultPrevented || event.isComposing)
    return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  sync(state);
  const entries = [...state.records].filter((r) => r.open);
  const layer = pickLayer(entries, active(doc));
  if (!layer) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const before = active(doc);
  layer.close();
  if (layer.returnsFocus) {
    sync(state);
    return;
  }
  const opener = layer.opener?.() ?? null;
  if (focusable(opener)) opener.focus();
  else if (!active(doc) && before instanceof HTMLElement && focusable(before))
    before.focus();
  sync(state);
}

function install(doc: Document): DocState | null {
  const win = doc.defaultView;
  if (!win) return null;
  const stop = new AbortController();
  const state: DocState = {
    records: new Set(),
    counter: 0,
    observer: null,
    stop,
  };
  const run = (): void => sync(state);
  /* Heard on the way up, so a control that handled Escape itself (and said so with
     `preventDefault`) keeps the press. */
  win.addEventListener("keydown", (e) => handle(state, doc, e), {
    signal: stop.signal,
  });
  // `toggle` does not bubble, so a native popover is heard on the way down.
  doc.addEventListener("toggle", run, { capture: true, signal: stop.signal });
  doc.addEventListener("beforetoggle", run, {
    capture: true,
    signal: stop.signal,
  });
  if (typeof win.MutationObserver === "function") {
    state.observer = new win.MutationObserver(run);
    state.observer.observe(doc.documentElement, {
      attributes: true,
      attributeFilter: WATCHED,
      subtree: true,
    });
  }
  states.set(doc, state);
  return state;
}

function uninstall(doc: Document, state: DocState): void {
  state.stop.abort();
  state.observer?.disconnect();
  states.delete(doc);
}

/**
 * Adds `layer` to the order for its document (`doc`, or its `el`'s, or the page's). Pass a
 * `signal` to take it out again when the widget that owns it is torn down.
 */
export function registerEscLayer(
  layer: EscLayer,
  signal?: AbortSignal,
  doc: Document = layer.el?.ownerDocument ?? document,
): EscRegistration {
  if (signal?.aborted) return { changed: () => {}, remove: () => {} };
  const state = states.get(doc) ?? install(doc);
  if (!state) return { changed: () => {}, remove: () => {} };
  const rec: Entry = { layer, open: false, seq: 0 };
  state.records.add(rec);
  sync(state);
  const remove = (): void => {
    if (!state.records.delete(rec)) return;
    if (state.records.size === 0 && states.get(doc) === state)
      uninstall(doc, state);
  };
  signal?.addEventListener("abort", remove, { once: true });
  return { changed: () => sync(state), remove };
}
