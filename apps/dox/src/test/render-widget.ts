/**
 * The only DOM helpers a widget test may use (slice 7). The `dox-test/*` lint rules ban
 * everything this file does by hand: `dispatchEvent`, `new Event`, and so on. This file
 * is exempt through an `overrides` entry in `oxlint.config.mts`, not through comments.
 *
 * Import it only from a `@vitest-environment jsdom` file.
 */
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type {
  AnyWidgetEntry,
  LoadedWidget,
} from "~/components/ask/widget-registry";
import { encodeWidgetPermalink } from "~/lib/widget-permalink";
import type { WidgetHandle } from "~/lib/widget-mount";
import { trackWidget } from "./live-widgets";
import { raw, setHtml } from "~/widgets/builders";

export interface RenderWidgetOptions {
  /** The widget's args, as the chat rail passes them. */
  args?: unknown;
  /** A permalink (`?w=…&wa=…` or a full URL) to seed a page-mode widget from `location`. */
  permalink?: string;
  /**
   * The template's `idPrefix`: what `renderTemplate` scopes its ids and `data-scope` with.
   * Defaults to `"test"`. Give two renders on one page different prefixes.
   */
  idPrefix?: string;
  /** Aborts the mount's signal before `mount` runs, as a rail that closed mid-load does. */
  aborted?: boolean;
}

export interface RenderedWidget {
  user: ReturnType<typeof userEvent.setup>;
  /** The element the widget is mounted in. */
  root: HTMLElement;
  /** Aborts the signal, destroys the handle, and fails if a listener outlived it. */
  destroy(): void;
  /** The permalink the rail's copy button would produce. Needs a registry entry. */
  permalink(): string;
}

interface Recorded {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  capture: boolean;
  signal: AbortSignal | undefined;
}

const sessions = new Set<{ root: HTMLElement; records: Recorded[] }>();
let restorePatch: (() => void) | null = null;

const captureOf = (
  o?: boolean | AddEventListenerOptions | EventListenerOptions,
) => (typeof o === "boolean" ? o : (o?.capture ?? false));

/** Patches `EventTarget` once while any widget is live, and records who listens where. */
function installRecorder(): void {
  if (restorePatch) return;
  // jsdom gives `window` its own add/remove methods, so the prototype alone misses it.
  const hosts: EventTarget[] = [EventTarget.prototype, window];
  const originals = hosts.map((host) => ({
    host,
    add: host.addEventListener,
    remove: host.removeEventListener,
  }));
  for (const { host, add, remove } of originals) {
    host.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (listener) {
        for (const s of sessions) {
          // A listener on a node inside the root dies with the subtree.
          if (this instanceof Node && s.root.contains(this)) continue;
          s.records.push({
            target: this,
            type,
            listener,
            capture: captureOf(options),
            signal: typeof options === "object" ? options.signal : undefined,
          });
        }
      }
      return add.call(this, type, listener, options);
    } as typeof host.addEventListener;
    host.removeEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) {
      for (const s of sessions) {
        s.records = s.records.filter(
          (r) =>
            !(
              r.target === this &&
              r.type === type &&
              r.listener === listener &&
              r.capture === captureOf(options)
            ),
        );
      }
      return remove.call(this, type, listener, options);
    } as typeof host.removeEventListener;
  }
  restorePatch = () => {
    for (const { host, add, remove } of originals) {
      host.addEventListener = add;
      host.removeEventListener = remove;
    }
    restorePatch = null;
  };
}

const pending = new Set<Promise<unknown>>();

function isEntry(x: AnyWidgetEntry | LoadedWidget<never>): x is AnyWidgetEntry {
  return "load" in x;
}

/**
 * Builds the root the way `MountedWidget.tsx` does: `renderTemplate(idPrefix, args)` into a
 * connected element, then `mount(root, args, signal)`.
 */
export async function renderWidget(
  entryOrMount: AnyWidgetEntry | LoadedWidget<never>,
  {
    args,
    permalink,
    idPrefix = "test",
    aborted = false,
  }: RenderWidgetOptions = {},
): Promise<RenderedWidget> {
  // Before the recorder, so user-event's own document listeners are not counted.
  const user = userEvent.setup();
  // user-event hangs its own document listeners on the first call; do that now.
  await user.click(document.body);
  if (permalink !== undefined) {
    const search = permalink.includes("?")
      ? permalink.slice(permalink.indexOf("?"))
      : permalink;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search}`,
    );
  }

  const root = document.createElement("div");
  document.body.append(root);
  const session = { root, records: [] as Recorded[] };
  sessions.add(session);
  installRecorder();
  const controller = new AbortController();
  if (aborted) controller.abort();

  const loading = (async () => {
    const loaded = isEntry(entryOrMount)
      ? await entryOrMount.load()
      : entryOrMount;
    const rendered = loaded.renderTemplate(idPrefix, args as never);
    setHtml(root, typeof rendered === "string" ? raw(rendered) : rendered);
    return loaded.mount(root, args as never, controller.signal);
  })();
  pending.add(loading);
  let handle: WidgetHandle;
  try {
    handle = await loading;
  } finally {
    pending.delete(loading);
  }

  let destroyed = false;
  const untrack = trackWidget(() => {
    if (!destroyed) finish(false);
  });

  /** `check` is false for the afterEach sweep, which only cleans up. */
  function finish(check: boolean): void {
    destroyed = true;
    untrack();
    controller.abort();
    handle.destroy();
    const leaked = session.records.filter((r) => !r.signal?.aborted);
    sessions.delete(session);
    if (sessions.size === 0) restorePatch?.();
    root.remove();
    if (check && leaked.length > 0) {
      throw new Error(
        `Widget left ${leaked.length} listener(s) running after destroy(): ` +
          leaked
            .map((r) => `${r.type} on ${r.target.constructor.name}`)
            .join(", "),
      );
    }
  }

  return {
    user,
    root,
    destroy: () => {
      if (!destroyed) finish(true);
    },
    permalink() {
      if (!isEntry(entryOrMount)) {
        throw new Error(
          "permalink() needs a registry entry: it carries the widget kind.",
        );
      }
      const state = handle.getPermalinkState?.() ?? null;
      return encodeWidgetPermalink(
        entryOrMount.kind,
        state ?? (args as Record<string, unknown>) ?? {},
      );
    },
  };
}

/**
 * The one sanctioned direct input event. jsdom cannot drag a native range input, so this
 * sets `value` and fires `input` then `change`. Pass the element `getByRole("slider")`
 * returned; anything else is rejected.
 */
export function setRange(slider: HTMLElement, value: number | string): void {
  if (!(slider instanceof HTMLInputElement) || slider.type !== "range") {
    throw new Error(
      'setRange takes an <input type="range"> found with getByRole("slider").',
    );
  }
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(slider, String(value));
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  slider.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Fails with every violation's rule id, node role and name, and help text.
 * `color-contrast` and `target-size` are off: jsdom has no layout, and the Chromium
 * `a11y-axe` and `contrast-measure` gates own those two rules.
 */
export async function expectNoAxeViolations(
  container: HTMLElement,
): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false },
      "target-size": { enabled: false },
    },
  });
  if (results.violations.length === 0) return;
  const lines = results.violations.flatMap((v) =>
    v.nodes.map((n) => {
      const el = container.ownerDocument.querySelector(String(n.target[0]));
      const role = el?.getAttribute("role") ?? el?.localName ?? "unknown";
      const name =
        el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
      return `${v.id}: ${role} "${name}" (${n.target.join(" ")}): ${v.help}`;
    }),
  );
  throw new Error(
    `axe found ${lines.length} violation(s):\n${lines.join("\n")}`,
  );
}

/** Awaits every widget loader still in flight, then pending microtasks and one timer turn. */
export async function flushWidget(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled(pending);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/**
 * The cells of one table column, top to bottom: finds the column by its header's
 * accessible name, then takes that position's `rowheader` or `cell` from each body row.
 * Throws when no header has that name.
 */
export function cellsInColumn(
  table: HTMLElement,
  headerName: string | RegExp,
): HTMLElement[] {
  const view = within(table);
  const headers = view.getAllByRole("columnheader");
  const index = headers.findIndex((h) =>
    typeof headerName === "string"
      ? h.textContent?.trim() === headerName
      : headerName.test(h.textContent ?? ""),
  );
  if (index < 0) {
    throw new Error(
      `no column header ${String(headerName)} in the table; found ${headers
        .map((h) => `"${h.textContent?.trim()}"`)
        .join(", ")}`,
    );
  }
  const rows = view
    .getAllByRole("row")
    .filter((row) => within(row).queryAllByRole("columnheader").length === 0);
  return rows.map((row) => {
    const cells = [
      ...within(row).queryAllByRole("rowheader"),
      ...within(row).queryAllByRole("cell"),
    ];
    const cell = cells[index];
    if (!cell) throw new Error(`a body row has no cell in column ${index + 1}`);
    return cell;
  });
}
