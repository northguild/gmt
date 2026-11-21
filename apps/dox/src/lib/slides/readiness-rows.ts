/**
 * What a readiness row is, what the page calls each one and the order they are listed in. The
 * checks (`readiness-files.ts`, `readiness-chat.ts`, `readiness-env.ts`) build rows with `row`;
 * `readiness.ts` runs them.
 */
import type { AssetRow } from "./stage-data";

export type ReadinessStatus = "ok" | "failed";

export interface ReadinessRow {
  id: string;
  /** What is checked: `Preloaded files`. */
  label: string;
  status: ReadinessStatus;
  /** The result in words. */
  text: string;
}

/** The checks every deck has, before and after the deck's own file lists. */
const FIRST_ROWS = ["preloads", "fonts", "modules"] as const;
const LAST_ROWS = [
  "recordings",
  "renderer",
  "motion",
  "fullscreen",
  "chat",
] as const;

const BASE_LABELS: Readonly<Record<string, string>> = {
  preloads: "Preloaded files",
  fonts: "Fonts",
  modules: "gmt modules",
  recordings: "Demo recordings",
  renderer: "Deck renderer",
  motion: "Deck motion",
  fullscreen: "Deck fullscreen",
  chat: "Dox chat",
};

/** The rows, in the order the page lists them: the deck's own file lists sit after the modules. */
export function rowOrder(assetRows: readonly AssetRow[] = []): string[] {
  return [...FIRST_ROWS, ...assetRows.map((r) => r.id), ...LAST_ROWS];
}

/** What the page calls a row. */
export function rowLabel(
  id: string,
  assetRows: readonly AssetRow[] = [],
): string {
  return assetRows.find((r) => r.id === id)?.label ?? BASE_LABELS[id] ?? id;
}

/** What every failure that a second try on the venue's network could fix tells the presenter. */
export const RETRY = "retry on venue Wi-Fi";

export const row = (
  id: string,
  status: ReadinessStatus,
  text: string,
  label: string = rowLabel(id),
): ReadinessRow => ({ id, label, status, text });
