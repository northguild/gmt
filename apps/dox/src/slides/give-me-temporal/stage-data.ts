/**
 * Deck 0's stage data (`lib/slides/stage-data.ts`): the places its slides name, the zones the
 * planet camera centres on, its lapses and the wall's images the readiness check fetches.
 */
import { zoneMatrixSummary } from "~/data/zone-matrix";
import type { DeckStageData } from "~/lib/slides/stage-data";
import { LAPSES } from "./lapses";

export const STAGE: DeckStageData = {
  points: {
    galicia: {
      // Santiago de Compostela, the capital of Galicia.
      lng: -8.5448,
      lat: 42.8782,
      label: "Galicia",
      source: "GeoNames 3109642, Santiago de Compostela: 42.8782 N, 8.5448 W",
    },
    greenwich: {
      // The Airy transit circle, which marked the Prime Meridian of 1884.
      lng: 0,
      lat: 51.4772,
      label: "Greenwich",
      source:
        "Royal Museums Greenwich, the Airy Transit Circle: 51 deg 28 min 38 sec N, longitude 0",
    },
  },
  // The zones GMT's CI runs in, so the Earth the deck turns and the zones slide 5 counts in are
  // one list.
  planetZones: zoneMatrixSummary.zones,
  lapses: LAPSES,
  assetRows: [
    {
      id: "wall",
      label: "Wall images",
      selector: "[data-wall-pane] img",
      attribute: "src",
      none: "No wall images listed",
    },
  ],
};
