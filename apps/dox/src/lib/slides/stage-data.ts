/**
 * What the space stage and the presenter view need to know about one deck: its named places, the
 * zones the planet camera centres on, its time-lapses and the extra files its readiness check
 * lists. A deck writes one (`src/slides/<slug>/stage-data.ts`) and registers it in
 * `src/slides/deck-runtime.ts`; nothing under `lib/slides/` names a place, a lapse or a pane.
 */
import {
  resolvePlace,
  setPlanetZones,
  setPoints,
  type PointEntry,
} from "./places";
import type { LapseDef } from "./time-lapse";

/** One list of files the deck's page carries, which the readiness check fetches and reports. */
export interface AssetRow {
  /** The row's id. */
  id: string;
  /** What the presenter's list calls the row: `Wall images`. */
  label: string;
  /** The elements on the deck's page that name the files. */
  selector: string;
  /** The attribute holding each file's address. */
  attribute: string;
  /** What the row says when the page lists none. */
  none: string;
}

export interface DeckStageData {
  /** Named places with no time zone of their own, keyed by what a slide writes in `place`. */
  points: Readonly<Record<string, PointEntry>>;
  /** The zones the `planet` camera centres on and the ice wall's shards land on. */
  planetZones: readonly string[];
  /** The time-lapses a slide or build may name with `lapse`. */
  lapses: Readonly<Record<string, LapseDef>>;
  /** Extra file lists the deck's page carries, read after the preloads. */
  assetRows: readonly AssetRow[];
}

/** A deck with nothing of its own: no named places, no lapses, no extra rows. */
export const NO_STAGE_DATA: DeckStageData = {
  points: {},
  planetZones: [],
  lapses: {},
  assetRows: [],
};

/** Hands the deck's places to the camera. A zone the coordinate table lacks throws. */
export function applyStageData(data: DeckStageData): void {
  setPoints(data.points);
  setPlanetZones(data.planetZones);
}

/** What a `<Slide>` or `<Build>` names for the stage. */
interface StageNames {
  /** Where the camera goes: a zone, a keyword or one of the deck's points. */
  place?: string | undefined;
  /** The zone whose clock stands in the Earth's place until the reveal. */
  reveal?: string | undefined;
  /** One of the deck's time-lapses. */
  lapse?: string | undefined;
}

/**
 * Throws when a slide or build names a place, a reveal zone or a lapse its deck's stage cannot use.
 * `<Slide>` and `<Build>` call it while the page builds, so a typo fails the build. `who` starts the
 * message: `Slide "intro"`.
 */
export function checkStageNames(
  data: DeckStageData,
  names: StageNames,
  who: string,
): void {
  applyStageData(data);
  if (names.place) resolvePlace(names.place);
  if (names.reveal) resolvePlace(`pole:${names.reveal}`);
  if (names.lapse && !Object.hasOwn(data.lapses, names.lapse))
    throw new Error(`${who} names the unknown lapse "${names.lapse}"`);
}
