/**
 * Ids inside one widget instance. `idPrefix` is unique per instance (the
 * template's argument), so two widgets on a page never share an id. This
 * replaces the module-level `let n = 0` counters, which differed between the
 * server render and the first client render.
 */
export function idScope(idPrefix: string): (local: string) => string {
  return (local) => `${idPrefix}-${local}`;
}
