/** The `Intl` formatter classes GMT caches. */
type FormatterKind =
  | "DateTimeFormat"
  | "NumberFormat"
  | "ListFormat"
  | "RelativeTimeFormat";

type Constructor = new (...args: unknown[]) => object;

/**
 * How many `Intl` formatters of these kinds `run` constructs.
 *
 * Each kind is replaced by a subclass that counts its constructions, then put back. A subclass
 * builds a working formatter, as a `vi.spyOn` mock does not. Replacing a kind empties GMT's
 * formatter cache for it, so `warmUp` runs first under the same subclasses to fill the cache
 * again; only `run` is counted.
 */
export function countIntlConstructions(
  kinds: readonly FormatterKind[],
  run: () => void,
  warmUp: () => void = () => {},
): number {
  const intl = Intl as unknown as Record<FormatterKind, Constructor>;
  const natives = kinds.map((kind) => intl[kind]);
  let built = 0;

  kinds.forEach((kind, index) => {
    intl[kind] = class extends natives[index] {
      constructor(...args: unknown[]) {
        super(...args);
        built += 1;
      }
    };
  });

  try {
    warmUp();
    built = 0;
    run();
    return built;
  } finally {
    kinds.forEach((kind, index) => {
      intl[kind] = natives[index];
    });
  }
}
