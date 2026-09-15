/**
 * The runtime's own CLDR week data, read straight from `Intl` — the independent oracle the
 * locale-week tests compare GMT against.
 *
 * Reads `Intl.Locale#getWeekInfo()` (Node 24, Node 26) and falls back to the older `weekInfo`
 * accessor (Node 22; removed in Node 26). It deliberately does not import GMT's own
 * `internal/localeWeekInfo`, so a bug there cannot make a test agree with itself.
 *
 * Throws when the runtime exposes neither form, so a test fails loudly instead of comparing two
 * fallbacks. `minimalDays` is optional: Node 24/26 omit it.
 */
interface RuntimeWeekInfo {
  firstDay?: number;
  weekend?: number[];
  minimalDays?: number;
}

export function runtimeWeekInfo(locale: string): {
  firstDay: number;
  weekend: number[];
  minimalDays?: number;
} {
  // A standalone shape, not an intersection with `Intl.Locale`, so the global augmentation in
  // `internal/localeWeekInfo.ts` cannot leak into this oracle's types.
  const intlLocale = new Intl.Locale(locale) as unknown as {
    getWeekInfo?: () => RuntimeWeekInfo;
    weekInfo?: RuntimeWeekInfo;
  };
  const info =
    typeof intlLocale.getWeekInfo === "function"
      ? intlLocale.getWeekInfo()
      : intlLocale.weekInfo;
  if (
    !info ||
    typeof info.firstDay !== "number" ||
    !Array.isArray(info.weekend)
  ) {
    throw new Error(`runtime exposes no week data for ${locale}`);
  }
  return {
    firstDay: info.firstDay,
    weekend: info.weekend,
    minimalDays: info.minimalDays,
  };
}
