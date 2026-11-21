/**
 * The one lazy import of the gmt modules the deck's clocks, lapses and pins read. They load after
 * first paint (the polyfill behind them is heavy); every caller awaits this and takes the modules
 * it needs, so the list of imports lives here and nowhere else.
 */

export interface DeckGmt {
  unixGet: typeof import("@northguild/gmt/unix/get");
  unixConvert: typeof import("@northguild/gmt/unix/convert");
  unixCalculate: typeof import("@northguild/gmt/unix/calculate");
  zonedGet: typeof import("@northguild/gmt/zoned/get");
  zonedConvert: typeof import("@northguild/gmt/zoned/convert");
  utcConvert: typeof import("@northguild/gmt/utc/convert");
}

/** The gmt modules the deck uses at run time; the import system caches them after the first call. */
export async function loadDeckGmt(): Promise<DeckGmt> {
  const [
    unixGet,
    unixConvert,
    unixCalculate,
    zonedGet,
    zonedConvert,
    utcConvert,
  ] = await Promise.all([
    import("@northguild/gmt/unix/get"),
    import("@northguild/gmt/unix/convert"),
    import("@northguild/gmt/unix/calculate"),
    import("@northguild/gmt/zoned/get"),
    import("@northguild/gmt/zoned/convert"),
    import("@northguild/gmt/utc/convert"),
  ]);
  return {
    unixGet,
    unixConvert,
    unixCalculate,
    zonedGet,
    zonedConvert,
    utcConvert,
  };
}
