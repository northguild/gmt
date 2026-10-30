/**
 * Test plumbing for the kit's own tests (not a `.test` file, so the `dox-test/*`
 * lint does not read it). Renders builder output into the document with the
 * elements defined, and hands back the few things a test cannot reach by role:
 * the custom element itself and a re-connect.
 *
 * Import it only from a `@vitest-environment jsdom` file. Widget tests elsewhere
 * use `~/test/render-widget` instead.
 */
import { setHtml, type SafeHtml } from "./builders/html";
import { defineElements } from "./define";

const hosts = new Set<HTMLElement>();

afterEach(() => {
  for (const host of hosts) host.remove();
  hosts.clear();
});

export interface Fixture {
  /** The element that holds the markup; listen here for bubbled events. */
  host: HTMLElement;
  /** The outermost element the markup produced, for a wrapper that has no role to find it by. */
  first(): HTMLElement;
  /** The first kit element of this kind (`range` for the range element). */
  element<T extends HTMLElement>(kind: string): T;
  /** Disconnect and connect again, as a move or a StrictMode double mount does. */
  reconnect(el: HTMLElement): void;
}

export function renderHtml(markup: SafeHtml): Fixture {
  defineElements();
  const host = document.createElement("div");
  document.body.append(host);
  hosts.add(host);
  setHtml(host, markup);
  return {
    host,
    first(): HTMLElement {
      const found = host.firstElementChild;
      if (!(found instanceof HTMLElement))
        throw new Error("the fixture rendered nothing");
      return found;
    },
    element<T extends HTMLElement>(kind: string): T {
      const found = host.querySelector<T>(`gmt-${kind}`);
      if (!found) throw new Error(`no ${kind} element in the fixture`);
      return found;
    },
    reconnect(el) {
      const parent = el.parentNode;
      const next = el.nextSibling;
      el.remove();
      parent?.insertBefore(el, next);
    },
  };
}

/** A slider's `aria-valuenow` as a number (jest-dom has no matcher for a non-input slider). */
export function valueNow(slider: HTMLElement): number {
  return Number(slider.getAttribute("aria-valuenow"));
}
