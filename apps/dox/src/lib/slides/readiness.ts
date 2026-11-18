/**
 * The presenter's pre-talk check: everything the deck needs, read before the talk and again on
 * "Check again". Run on the laptop with the venue's Wi-Fi, it also warms the HTTP cache (every
 * fetch here is `force-cache`), so the deck survives a dropped connection.
 *
 * One row for each thing checked. A row's `text` says the result in words (`Loaded`, `Failed: retry
 * on venue Wi-Fi`) and its `status` is `ok` or `failed`; the page never shows a failure by colour
 * alone. A failure never blocks anything: the checklist informs the presenter and stops there.
 *
 * What it reads:
 * - the deck's own page, fetched once: its `<link rel="preload">` list, the wall's images and the
 *   recordings named by `[data-recording-src]` (slice 4b adds those), each fetched in turn;
 * - the fonts (`document.fonts.check`) and the gmt modules the deck imports (the dynamic imports);
 * - what the deck window reports over the channel: its renderer, reduced motion and fullscreen;
 * - Dox chat: `GET /api/brains` answers, the venue laptop is `unlimited`, and a brain has
 *   allowance left. A failure there says the demos will play their recordings.
 */
import type { DeckEnv } from "./sync";

export type ReadinessStatus = "ok" | "failed";

export interface ReadinessRow {
  id: string;
  /** What is checked: `Preloaded files`. */
  label: string;
  status: ReadinessStatus;
  /** The result in words. */
  text: string;
}

/** The rows, in the order the page lists them. */
export const ROW_ORDER = [
  "preloads",
  "fonts",
  "modules",
  "wall",
  "recordings",
  "renderer",
  "motion",
  "fullscreen",
  "chat",
] as const;
export type RowId = (typeof ROW_ORDER)[number];

export const ROW_LABELS: Readonly<Record<RowId, string>> = {
  preloads: "Preloaded files",
  fonts: "Fonts",
  modules: "gmt modules",
  wall: "Wall images",
  recordings: "Demo recordings",
  renderer: "Deck renderer",
  motion: "Deck motion",
  fullscreen: "Deck fullscreen",
  chat: "Dox chat",
};

const RETRY = "retry on venue Wi-Fi";

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
  /* `load` is asked first: a face the page has not used yet is not loaded, and `check` alone
     would call that missing. */
  fontSet:
    | (Pick<FontFaceSet, "check"> & Partial<Pick<FontFaceSet, "load">>)
    | null;
  /** The gmt modules the deck imports: each loader's promise settles when the module resolves. */
  modules: readonly { name: string; load: () => Promise<unknown> }[];
  /** Called as each row settles, so the page can fill in as results arrive. */
  onRow?: (row: ReadinessRow) => void;
}

const row = (
  id: RowId,
  status: ReadinessStatus,
  text: string,
): ReadinessRow => ({
  id,
  label: ROW_LABELS[id],
  status,
  text,
});

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

/** One row for a list of files: how many loaded, and the names of those that did not. */
async function fileRow(
  id: RowId,
  urls: readonly string[],
  signal: AbortSignal,
  none: string,
): Promise<ReadinessRow> {
  if (urls.length === 0) return row(id, "ok", none);
  const results = await Promise.all(
    urls.map(async (url) => ({ url, ok: await reachable(url, signal) })),
  );
  const failed = results.filter((r) => !r.ok).map((r) => fileName(r.url));
  if (failed.length === 0)
    return row(
      id,
      "ok",
      `Loaded: ${urls.length} ${urls.length === 1 ? "file" : "files"}`,
    );
  return row(
    id,
    "failed",
    `Failed: ${RETRY}. ${failed.length} of ${urls.length} did not load: ${failed.join(", ")}`,
  );
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

/** What the deck's page lists: its preloads, wall images and recordings, as absolute addresses. */
export interface DeckAssets {
  preloads: string[];
  wall: string[];
  recordings: string[];
}

/** Reads the asset lists out of the deck page's markup. Never throws: bad markup lists nothing. */
export function readDeckAssets(markup: string, deckUrl: string): DeckAssets {
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
  const wall = list("[data-wall-pane] img", "src");
  const recordings = list("[data-recording-src]", "data-recording-src");
  // A file is fetched once however many lists name it.
  const claimed = new Set([...wall, ...recordings]);
  const preloads = list('link[rel="preload"]', "href").filter(
    (u) => !claimed.has(u),
  );
  return { preloads, wall, recordings };
}

/** The Dox chat row from what `/api/brains` answered. */
export function chatRow(payload: unknown): ReadinessRow {
  const failed = (why: string): ReadinessRow =>
    row(
      "chat",
      "failed",
      `Failed: the demos will play their recordings (${why})`,
    );
  if (typeof payload !== "object" || payload === null)
    return failed("the answer was not readable");
  const info = payload as {
    visitor?: { unlimited?: unknown };
    brains?: { state?: unknown; remaining?: unknown }[];
  };
  if (info.visitor?.unlimited !== true)
    return failed(
      "this browser has no dev cookie, so the visitor limit applies",
    );
  const usable = (info.brains ?? []).some(
    (b) =>
      b.state === "ok" && typeof b.remaining === "number" && b.remaining > 0,
  );
  if (!usable) return failed("no brain has allowance left today");
  return row("chat", "ok", "Ready: live answers, no visitor limit");
}

async function brainsRow(
  url: string,
  signal: AbortSignal,
): Promise<ReadinessRow> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal,
    });
    if (!response.ok)
      return row(
        "chat",
        "failed",
        `Failed: the demos will play their recordings (the chat answered ${response.status})`,
      );
    return chatRow(await response.json());
  } catch {
    return row(
      "chat",
      "failed",
      `Failed: the demos will play their recordings (no answer: ${RETRY})`,
    );
  }
}

const RENDERER_TEXT: Record<DeckEnv["renderer"], [ReadinessStatus, string]> = {
  webgpu: ["ok", "WebGPU"],
  canvas2d: ["ok", "Canvas 2D"],
  sky: [
    "failed",
    "Failed: sky only, the Earth did not start in the deck window",
  ],
  pending: [
    "failed",
    "Failed: the Earth has not started yet; check again in a moment",
  ],
};

function envRows(env: DeckEnv | null): ReadinessRow[] {
  if (!env) {
    const text =
      "Failed: no deck window answered; press T on the deck to open this view from it";
    return [
      row("renderer", "failed", text),
      row("motion", "failed", text),
      row("fullscreen", "failed", text),
    ];
  }
  const [status, text] = RENDERER_TEXT[env.renderer];
  return [
    row("renderer", status, text),
    row(
      "motion",
      "ok",
      env.reducedMotion
        ? "Reduced motion is on: flights and the shatter are cuts and fades"
        : "Reduced motion is off: flights and the shatter play",
    ),
    row(
      "fullscreen",
      "ok",
      env.fullscreen
        ? "The deck is fullscreen"
        : "The deck is not fullscreen; press F on the deck",
    ),
  ];
}

async function modulesRow(
  modules: ReadinessOptions["modules"],
): Promise<ReadinessRow> {
  const results = await Promise.all(
    modules.map(async (m) => {
      try {
        await m.load();
        return null;
      } catch {
        return m.name;
      }
    }),
  );
  const failed = results.filter((n): n is string => n !== null);
  if (failed.length === 0)
    return row("modules", "ok", `Loaded: ${modules.length} modules`);
  return row(
    "modules",
    "failed",
    `Failed: ${RETRY}. Not loaded: ${failed.join(", ")}`,
  );
}

async function fontsRow(o: ReadinessOptions): Promise<ReadinessRow> {
  const set = o.fontSet;
  if (!set) return row("fonts", "ok", "Not checked: this browser cannot tell");
  const results = await Promise.all(
    o.fonts.map(async (font) => {
      try {
        await set.load?.(font);
        return set.check(font) ? null : font;
      } catch {
        return font;
      }
    }),
  );
  const missing = results.filter((font): font is string => font !== null);
  if (missing.length === 0) return row("fonts", "ok", "Loaded");
  return row(
    "fonts",
    "failed",
    `Failed: ${RETRY}. Not loaded: ${missing.join(", ")}`,
  );
}

/**
 * Runs every check and returns the rows in `ROW_ORDER`. Settles when all have; `onRow` hears each
 * as it lands. An aborted signal stops the fetches and the rows that did not finish come back
 * failed, so nothing is left pending.
 */
export async function runReadiness(
  o: ReadinessOptions,
): Promise<ReadinessRow[]> {
  const rows = new Map<RowId, ReadinessRow>();
  const done = (r: ReadinessRow): void => {
    rows.set(r.id as RowId, r);
    o.onRow?.(r);
  };

  for (const r of envRows(o.env)) done(r);

  const deck = async (): Promise<void> => {
    let assets: DeckAssets | null = null;
    try {
      const response = await fetch(o.deckUrl, {
        cache: "force-cache",
        signal: o.signal,
      });
      if (response.ok)
        assets = readDeckAssets(await response.text(), o.deckUrl);
    } catch {
      assets = null;
    }
    if (!assets) {
      const text = `Failed: the deck page did not load; ${RETRY}`;
      for (const id of ["preloads", "wall", "recordings"] as const)
        done(row(id, "failed", text));
      return;
    }
    const found = assets;
    await Promise.all([
      fileRow("preloads", found.preloads, o.signal, "Nothing to load").then(
        done,
      ),
      fileRow("wall", found.wall, o.signal, "No wall images listed").then(done),
      fileRow(
        "recordings",
        found.recordings,
        o.signal,
        "No recordings listed yet",
      ).then(done),
    ]);
  };

  await Promise.all([
    deck(),
    fontsRow(o).then(done),
    modulesRow(o.modules).then(done),
    brainsRow(o.brainsUrl, o.signal).then(done),
  ]);

  return ROW_ORDER.map(
    (id) => rows.get(id) ?? row(id, "failed", `Failed: not checked; ${RETRY}`),
  );
}
