/**
 * The presenter's pre-talk check: everything the deck needs, read before the talk and again on
 * "Check again". Run on the laptop with the venue's Wi-Fi, it also warms the HTTP cache (every
 * fetch here is `force-cache`), so the deck survives a dropped connection.
 *
 * One row for each thing checked. A row's `text` says the result in words (`Loaded`, `Failed: retry
 * on venue Wi-Fi`) and its `status` is `ok` or `failed`; the page never shows a failure by colour
 * alone. A failure never blocks anything: the checklist informs the presenter and stops there.
 *
 * What it reads, each in its own module:
 * - the deck's own page and the files it names (`readiness-files.ts`): its preloads, the extra
 *   file lists the deck's stage data names (`assetRows`, such as a wall's images) and the
 *   recordings named by `[data-recording-src]`;
 * - the fonts, the gmt modules the deck imports and what the deck window reports over the
 *   channel: its renderer, reduced motion and fullscreen (`readiness-env.ts`);
 * - Dox chat (`readiness-chat.ts`): `GET /api/brains` answers, the venue laptop is `unlimited`,
 *   and a brain has allowance left. A failure there says the demos will play their recordings.
 *
 * The row model and order are in `readiness-rows.ts`.
 */
import { brainsRow } from "./readiness-chat";
import {
  envRows,
  fontsRow,
  modulesRow,
  type FontSet,
  type ModuleLoader,
} from "./readiness-env";
import { deckFileRows } from "./readiness-files";
import {
  RETRY,
  row,
  rowLabel,
  rowOrder,
  type ReadinessRow,
} from "./readiness-rows";
import type { AssetRow } from "./stage-data";
import type { DeckEnv } from "./sync";

export interface ReadinessOptions {
  signal: AbortSignal;
  /** The deck page's address, which the check reads and resolves every other address against. */
  deckUrl: string;
  /** The address of `/api/brains`. */
  brainsUrl: string;
  /** What the deck window last reported, or `null` while no deck window has. */
  env: DeckEnv | null;
  /** Font shorthands for `document.fonts.check`, such as `1em Michroma`. */
  fonts: readonly string[];
  fontSet: FontSet | null;
  /** The gmt modules the deck imports. */
  modules: readonly ModuleLoader[];
  /** The deck's own file lists (its stage data's `assetRows`), read after the preloads. */
  assetRows?: readonly AssetRow[];
  /** Called as each row settles, so the page can fill in as results arrive. */
  onRow?: (row: ReadinessRow) => void;
}

/**
 * Runs every check and returns the rows in `rowOrder`. Settles when all have; `onRow` hears each
 * as it lands. An aborted signal stops the fetches and the rows that did not finish come back
 * failed, so nothing is left pending.
 */
export async function runReadiness(
  o: ReadinessOptions,
): Promise<ReadinessRow[]> {
  const rows = new Map<string, ReadinessRow>();
  const extra = o.assetRows ?? [];
  const done = (r: ReadinessRow): void => {
    rows.set(r.id, r);
    o.onRow?.(r);
  };

  for (const r of envRows(o.env)) done(r);

  await Promise.all([
    deckFileRows({
      signal: o.signal,
      deckUrl: o.deckUrl,
      assetRows: extra,
      done,
    }),
    fontsRow(o.fontSet, o.fonts).then(done),
    modulesRow(o.modules).then(done),
    brainsRow(o.brainsUrl, o.signal).then(done),
  ]);

  return rowOrder(extra).map(
    (id) =>
      rows.get(id) ??
      row(id, "failed", `Failed: not checked; ${RETRY}`, rowLabel(id, extra)),
  );
}
