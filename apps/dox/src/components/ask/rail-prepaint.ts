/**
 * The widget rail's saved width, painted before the first frame on `/dox`.
 *
 * The rail is server-rendered at its default width, and `RailResizer` can read
 * the saved width only after hydration. Without this inline head script the
 * rail would paint at the default and then jump to the saved width on every
 * load. The script puts the saved width on `<html>`; the hive body inherits
 * it, and the rail's CSS clamps it (`gmt-hive.css`), so a width saved in a
 * wider window still lands in bounds. On mount `RailResizer` moves the value
 * onto the hive body and clears this one, so a reset to the default is not
 * undone by inheritance.
 */

/** The custom property that carries the rail's width. */
export const WIDTH_PROPERTY = "--gmt-hive-rail-width";
/** The reader's last width, in whole CSS pixels, in this browser only. */
export const STORAGE_KEY = "gmt-dox-rail-width";

/** The inline script, for `dox.astro`'s `<head>`. Storage can throw (a private
 * window, blocked site data): the rail then paints at its default. */
export const RAIL_PREPAINT = `try{var w=Number(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));if(isFinite(w)&&w>0)document.documentElement.style.setProperty(${JSON.stringify(WIDTH_PROPERTY)},w+"px")}catch(e){}`;
