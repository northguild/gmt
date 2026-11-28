/**
 * @vitest-environment jsdom
 */
import { THEME_ATTRIBUTES, watchTheme } from "./globe-theme";
import { LOOK_ATTRIBUTE, setLook } from "../look";

const controllers: AbortController[] = [];
const watch = (callback: () => void): AbortController => {
  const abort = new AbortController();
  controllers.push(abort);
  watchTheme(callback, abort.signal);
  return abort;
};

/** The next task: MutationObserver callbacks have run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

afterEach(() => {
  for (const abort of controllers.splice(0)) abort.abort();
  document.documentElement.removeAttribute(LOOK_ATTRIBUTE);
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("lang");
  localStorage.clear();
});

describe("watchTheme", () => {
  it("names the colour scheme and the look", () => {
    expect(THEME_ATTRIBUTES).toEqual(["data-theme", LOOK_ATTRIBUTE]);
  });

  it("fires once per look change or theme change, never for another attribute", async () => {
    const seen = vi.fn();
    watch(seen);
    setLook("natural");
    await settle();
    expect(seen).toHaveBeenCalledTimes(1);
    document.documentElement.setAttribute("data-theme", "light");
    await settle();
    expect(seen).toHaveBeenCalledTimes(2);
    document.documentElement.setAttribute("lang", "en");
    await settle();
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("never fires after its signal aborts, nor when started aborted", async () => {
    const seen = vi.fn();
    watch(seen).abort();
    const late = new AbortController();
    late.abort();
    watchTheme(seen, late.signal);
    setLook("natural");
    await settle();
    expect(seen).not.toHaveBeenCalled();
  });
});
