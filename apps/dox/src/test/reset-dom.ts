/**
 * What the shared setup puts back after every test in a jsdom file, so a file can run in a
 * worker that other files also used (`isolate: false`; see `vitest.config.ts` and
 * `isolation.ts`). Only the DOM is reset here. `setup-dom.ts` restores mocks, timers and
 * stubs, and `leak-guard.ts` fails a file that leaves other global state behind.
 *
 * It resets the state a test can leave in a shared jsdom: the body's children and
 * attributes, the root element's attributes, the title, the location, both storages, cookies
 * and a `navigator.clipboard` a test defined. It leaves `document.head` alone, because a module that injects a `<style>` once
 * at import time would not inject it again.
 */
function clearAttributes(element: Element): void {
  for (const name of element.getAttributeNames()) element.removeAttribute(name);
}

export function resetDom(): void {
  document.body.replaceChildren();
  clearAttributes(document.body);
  clearAttributes(document.documentElement);
  document.title = "";
  // Tests define their own clipboard; jsdom has none, so the own property is the test's.
  Reflect.deleteProperty(navigator, "clipboard");
  // `replaceState` only: a location change would reload the page in a real browser.
  window.history.replaceState(null, "", "/");
  for (const storage of [window.localStorage, window.sessionStorage]) {
    storage.clear();
  }
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name)
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}
