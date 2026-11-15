/**
 * Reads named functions out of a gmt module that `GMT_MODULES` loaded.
 *
 * Shared by the widget library loaders, so a module that no longer exports a
 * name fails the same way everywhere: the error becomes the loader's
 * `WidgetLoadError`.
 */

/** Reads each name from a module, and fails loudly on a name it lacks. */
export function pickFunctions(
  module: Record<string, unknown>,
  names: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    names.map((name) => {
      if (typeof module[name] !== "function") {
        throw new Error(`The library module has no ${name}.`);
      }
      return [name, module[name]];
    }),
  );
}

/**
 * `pickFunctions` with the library's own types: `M` is the module (`typeof import("...")`), so
 * a name the library renames or retypes fails the typecheck where it is used, not at run time.
 * The one assertion is here, where a name has just been checked to be a function.
 */
export function pickTyped<M extends object, K extends keyof M & string>(
  module: Record<string, unknown>,
  names: readonly K[],
): Pick<M, K> {
  return pickFunctions(module, names) as Pick<M, K>;
}
