/**
 * The readiness rows that fetch files: the deck's own page, read once for its preloads, its extra
 * file lists and its recordings, and each file fetched in turn. Every fetch is `force-cache`, so
 * the check also warms the HTTP cache.
 */
import { RETRY, row, rowLabel, type ReadinessRow } from "./readiness-rows";
import type { AssetRow } from "./stage-data";

/** Fetches one address from the cache when it can, true when it answered. */
async function reachable(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, { cache: "force-cache", signal });
    // Reading the body makes sure the whole file is in the cache, not only its headers.
    await response.arrayBuffer();
    return response.ok;
  } catch {
    return false;
  }
}

/** The last path segment of an address, for a row that names what failed. */
function fileName(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname.split("/").filter(Boolean).at(-1) ?? url;
  } catch {
    return url;
  }
}

/** One row for a list of files: how many loaded, and the names of those that did not. */
async function fileRow(
  id: string,
  urls: readonly string[],
  signal: AbortSignal,
  none: string,
  label?: string,
): Promise<ReadinessRow> {
  if (urls.length === 0) return row(id, "ok", none, label);
  const results = await Promise.all(
    urls.map(async (url) => ({ url, ok: await reachable(url, signal) })),
  );
  const failed = results.filter((r) => !r.ok).map((r) => fileName(r.url));
  if (failed.length === 0)
    return row(
      id,
      "ok",
      `Loaded: ${urls.length} ${urls.length === 1 ? "file" : "files"}`,
      label,
    );
  return row(
    id,
    "failed",
    `Failed: ${RETRY}. ${failed.length} of ${urls.length} did not load: ${failed.join(", ")}`,
    label,
  );
}

/** What the deck's page lists, as absolute addresses: its preloads, each extra row's files by row id. */
interface DeckAssets {
  preloads: string[];
  /** The files each of the deck's `assetRows` lists, by row id. */
  rows: Record<string, string[]>;
  recordings: string[];
}

/** Reads the asset lists out of the deck page's markup. Never throws: bad markup lists nothing. */
export function readDeckAssets(
  markup: string,
  deckUrl: string,
  assetRows: readonly AssetRow[] = [],
): DeckAssets {
  const doc = new DOMParser().parseFromString(markup, "text/html");
  const absolute = (value: string | null): string | null => {
    if (!value) return null;
    try {
      return new URL(value, deckUrl).href;
    } catch {
      return null;
    }
  };
  const list = (selector: string, attribute: string): string[] => [
    ...new Set(
      Array.from(doc.querySelectorAll(selector))
        .map((el) => absolute(el.getAttribute(attribute)))
        .filter((u): u is string => u !== null),
    ),
  ];
  const rows = Object.fromEntries(
    assetRows.map((r) => [r.id, list(r.selector, r.attribute)]),
  );
  const recordings = list("[data-recording-src]", "data-recording-src");
  // A file is fetched once however many lists name it.
  const claimed = new Set([...Object.values(rows).flat(), ...recordings]);
  const preloads = list('link[rel="preload"]', "href").filter(
    (u) => !claimed.has(u),
  );
  return { preloads, rows, recordings };
}

/**
 * Reads the deck page, then every list it names. Each row goes to `done` as it settles. When the
 * page itself does not load, every row that depends on it fails together.
 */
export async function deckFileRows(o: {
  signal: AbortSignal;
  deckUrl: string;
  assetRows: readonly AssetRow[];
  done: (row: ReadinessRow) => void;
}): Promise<void> {
  const { signal, deckUrl, assetRows, done } = o;
  let assets: DeckAssets | null = null;
  try {
    const response = await fetch(deckUrl, { cache: "force-cache", signal });
    if (response.ok)
      assets = readDeckAssets(await response.text(), deckUrl, assetRows);
  } catch {
    assets = null;
  }
  if (!assets) {
    const text = `Failed: the deck page did not load; ${RETRY}`;
    for (const id of ["preloads", ...assetRows.map((r) => r.id), "recordings"])
      done(row(id, "failed", text, rowLabel(id, assetRows)));
    return;
  }
  const found = assets;
  await Promise.all([
    fileRow("preloads", found.preloads, signal, "Nothing to load").then(done),
    ...assetRows.map((r) =>
      fileRow(r.id, found.rows[r.id] ?? [], signal, r.none, r.label).then(done),
    ),
    fileRow(
      "recordings",
      found.recordings,
      signal,
      "No recordings listed yet",
    ).then(done),
  ]);
}
