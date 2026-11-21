/**
 * Test plumbing for the deck's tests (not a `.test` file, so the `dox-test/*` lint does not read
 * it). jsdom has no modal `<dialog>` and no Fullscreen API; this gives it the part of each the
 * deck uses, and hands back one call that undoes all of it.
 *
 * - `showModal()` sets `open`; `close()` clears it and fires `close`, as a browser does.
 * - `requestFullscreen()` makes the element `document.fullscreenElement` and fires
 *   `fullscreenchange`; `exitFullscreen()` clears it and fires the event again.
 */

type Patched = { target: object; key: string; had: boolean; value: unknown };

export function installDialogFullscreenShims(): {
  restore(): void;
  requests: Element[];
} {
  const patched: Patched[] = [];
  const requests: Element[] = [];
  const set = (target: object, key: string, value: unknown): void => {
    patched.push({
      target,
      key,
      had: Object.prototype.hasOwnProperty.call(target, key),
      value: (target as Record<string, unknown>)[key],
    });
    Object.defineProperty(target, key, {
      value,
      configurable: true,
      writable: true,
    });
  };
  const fire = (): void => {
    document.dispatchEvent(new Event("fullscreenchange"));
  };
  let current: Element | null = null;
  const enter = (el: Element): void => {
    requests.push(el);
    current = el;
    fire();
  };

  set(
    HTMLDialogElement.prototype,
    "showModal",
    function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  );
  set(HTMLDialogElement.prototype, "close", function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
  set(Element.prototype, "requestFullscreen", function (this: Element) {
    enter(this);
    return Promise.resolve();
  });
  set(document, "exitFullscreen", () => {
    current = null;
    fire();
    return Promise.resolve();
  });
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => current,
  });

  return {
    requests,
    restore() {
      for (const { target, key, had, value } of patched.reverse()) {
        if (had)
          Object.defineProperty(target, key, {
            value,
            configurable: true,
            writable: true,
          });
        else delete (target as Record<string, unknown>)[key];
      }
      delete (document as unknown as Record<string, unknown>)[
        "fullscreenElement"
      ];
      current = null;
    },
  };
}
