/**
 * Fails a test file that leaves global state behind, because the next file in a shared worker
 * (`isolate: false`) would inherit it. `vi.mock`, `vi.stubGlobal` and the rest are undone by
 * `setup-dom.ts`; this catches what they cannot see: a direct `globalThis.x = …`, a replaced
 * `fetch` or `matchMedia`, a patched `Intl`, an environment variable, a `window` or `document`
 * listener nobody removed.
 *
 * `watchLeaks()` records the state when the file's first test starts, so anything a module
 * sets up while it is imported is not counted, and compares it after the file's last test.
 * Listeners are seen through a wrapper on the four `window` and `document` methods, installed
 * once per worker. A listener added with `once` or an `AbortSignal` removes itself, so it is
 * not recorded.
 */
import { afterAll, beforeAll } from "vitest";

interface ListenerRecord {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  capture: boolean;
}

export interface State {
  globals: Map<string, unknown>;
  intl: Map<string, unknown>;
  env: Map<string, string | undefined>;
  listeners: ListenerRecord[];
}

/** Flags a library sets on first use and leaves set, which carry no state a test could change. */
const LIBRARY_FLAGS = new Set(["IS_REACT_ACT_ENVIRONMENT"]);

const LISTENERS = Symbol.for("dox.leak-guard.listeners");
type Tracked = typeof globalThis & { [LISTENERS]?: ListenerRecord[] };

const captureOf = (
  o?: boolean | AddEventListenerOptions | EventListenerOptions,
) => (typeof o === "boolean" ? o : (o?.capture ?? false));

/**
 * Listeners the product installs once for the life of a page, and by design never removes:
 * `watchDataCredits` puts one capturing `toggle` listener on the document. It is guarded by a
 * module flag, so in a shared worker it stays installed and stays correct.
 */
function isPageLifetime(record: ListenerRecord): boolean {
  return (
    record.target === globalThis.document &&
    record.type === "toggle" &&
    record.capture
  );
}

/** Marks a wrapper, so a window already wrapped is not wrapped twice. */
const WRAPPED = Symbol.for("dox.leak-guard.wrapped");

/**
 * Whether a package, not the test or the code under test, is adding the listener. User-event,
 * jsdom and React each register a few of their own once per document and never remove them, which
 * is not a leak of the test's. The stack is read only when a listener is added, which is rare.
 */
function fromLibrary(): boolean {
  const frames = (new Error().stack ?? "").split("\n").slice(1);
  const caller = frames.find((line) => !line.includes("/leak-guard.ts"));
  return caller?.includes("/node_modules/") ?? false;
}

/** Wraps the listener methods of `window` and `document`, once per window. */
function trackListeners(): ListenerRecord[] {
  const root = globalThis as Tracked;
  const records = (root[LISTENERS] ??= []);
  if (typeof window === "undefined") return records;
  // jsdom's selector engine registers its own listeners on first use. Wake it before the
  // wrappers go on, so they are not mistaken for a test's.
  document.querySelector("html");
  for (const target of [window, document] as EventTarget[]) {
    const add = target.addEventListener;
    if ((add as { [WRAPPED]?: boolean })[WRAPPED]) continue;
    const remove = target.removeEventListener;
    const wrappedAdd: typeof add = function (type, listener, options) {
      const flags =
        typeof options === "object" && options ? options : undefined;
      if (listener && !flags?.once && !flags?.signal && !fromLibrary()) {
        records.push({ target, type, listener, capture: captureOf(options) });
      }
      return add.call(target, type, listener, options);
    };
    const wrappedRemove: typeof remove = function (type, listener, options) {
      const at = records.findIndex(
        (r) =>
          r.target === target &&
          r.type === type &&
          r.listener === listener &&
          r.capture === captureOf(options),
      );
      if (at >= 0) records.splice(at, 1);
      return remove.call(target, type, listener, options);
    };
    (wrappedAdd as { [WRAPPED]?: boolean })[WRAPPED] = true;
    target.addEventListener = wrappedAdd;
    target.removeEventListener = wrappedRemove;
  }
  return records;
}

function valueOf(descriptor: PropertyDescriptor): unknown {
  return "value" in descriptor
    ? descriptor.value
    : [descriptor.get, descriptor.set];
}

/** The state to compare: identities, never contents, so it stays cheap. */
export function captureState(): State {
  const globals = new Map<string, unknown>();
  for (const key of Object.getOwnPropertyNames(globalThis)) {
    if (LIBRARY_FLAGS.has(key)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    if (descriptor) globals.set(key, valueOf(descriptor));
  }
  const intl = new Map<string, unknown>();
  for (const key of Object.getOwnPropertyNames(Intl)) {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, key);
    if (descriptor) intl.set(key, valueOf(descriptor));
  }
  return {
    globals,
    intl,
    env: new Map(Object.entries(process.env)),
    listeners: [...trackListeners()],
  };
}

/** Names what differs, one line each. Empty when nothing leaked. */
export function describeLeaks(before: State, after: State): string[] {
  const out: string[] = [];
  const compare = (
    label: string,
    a: Map<string, unknown>,
    b: Map<string, unknown>,
  ) => {
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      const was = a.get(key);
      const now = b.get(key);
      const same =
        Array.isArray(was) && Array.isArray(now)
          ? was.every((fn, i) => fn === now[i])
          : Object.is(was, now);
      if (!a.has(key) || !b.has(key) || !same) {
        out.push(
          `${label}${key} ${a.has(key) ? (b.has(key) ? "was replaced" : "was removed") : "was added"}`,
        );
      }
    }
  };
  compare("globalThis.", before.globals, after.globals);
  compare("Intl.", before.intl, after.intl);
  compare("process.env.", before.env, after.env);
  for (const record of after.listeners) {
    if (!before.listeners.includes(record) && !isPageLifetime(record)) {
      const where = record.target === globalThis.window ? "window" : "document";
      out.push(`${where} "${record.type}" listener was never removed`);
    }
  }
  return out;
}

/** Registers the check for the file being set up. Call once per file, from the setup file. */
export function watchLeaks(): void {
  let before: State | undefined;
  beforeAll(() => {
    before = captureState();
  });
  afterAll(() => {
    if (!before) return;
    const leaks = describeLeaks(before, captureState());
    if (leaks.length > 0) {
      throw new Error(
        `This file left global state behind, which a file sharing its worker would inherit. ` +
          `Undo it in afterEach or a finally block:\n  ${leaks.join("\n  ")}`,
      );
    }
  });
}
