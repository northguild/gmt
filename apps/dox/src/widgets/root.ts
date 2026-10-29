/**
 * Finding a mounted widget and its parts.
 *
 * `widget()` writes `data-widget` (the slug) and `data-scope` (the template's `idPrefix`)
 * on the region. `findWidget(root, name)` reads both back, so a mount reaches its parts
 * with `part("local")` instead of guessing the prefix from some heading's id. The region is
 * `root` itself on a docs page and a descendant of it in the chat rail; both work.
 */
import { idScope } from "./builders/ids";

export interface FoundWidget {
  /** The widget's region element. */
  el: HTMLElement;
  /** `idScope` of the widget's scope: `id("pick")` is the id the template wrote. */
  id: (local: string) => string;
  /** The element with id `id(local)` inside the region. Throws, naming the part, if absent. */
  part: <T extends Element = HTMLElement>(local: string) => T;
}

export function findWidget(root: Element, name: string): FoundWidget {
  const selector = `[data-widget="${CSS.escape(name)}"]`;
  const el = root.matches(selector)
    ? (root as HTMLElement)
    : root.querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`no ${name} widget markup to mount`);
  const scope = el.dataset["scope"];
  if (scope === undefined)
    throw new Error(`the ${name} widget has no scope: build it with widget()`);
  const id = idScope(scope);
  return {
    el,
    id,
    part<T extends Element = HTMLElement>(local: string): T {
      const found = el.querySelector<T>(`[id="${CSS.escape(id(local))}"]`);
      if (found === null)
        throw new Error(`no ${local} part in the ${name} widget`);
      return found;
    },
  };
}
