/**
 * What the space stage's features share: where the camera belongs and what the engine has been told.
 * The stage owns one object of this shape; each feature (`stage-clocks.ts`, `stage-wall.ts`,
 * `stage-spin.ts`, `stage-camera.ts`, `stage-boot.ts`) reads and writes the members it needs, and
 * nothing else is passed between them.
 */
import type { GlobeEngine, Rgba } from "~/lib/globe/types";
import type { readTheme } from "~/lib/globe/globe-theme";
import type { ZonedNow } from "./clocks";
import type { Place } from "./places";

export interface StageAt {
  /** Zero-based slide and how many of its builds are shown. */
  slide: number;
  build: number;
}

export interface StageState {
  engine: GlobeEngine | null;
  theme: ReturnType<typeof readTheme> | null;
  /** The route arcs' two colours, read from the page's tokens once the engine is up. */
  colours: { cyan: Rgba; teal: Rgba } | null;
  /** Epoch milliseconds now, from gmt; 0 until gmt is in. */
  now: () => number;
  zonedNow: ZonedNow | null;
  /** The place the slide names, and where in the deck it sits. */
  home: Place;
  homeAt: StageAt;
  overviewOpen: boolean;
  /** Whether the camera was last sent to `home` and nothing has moved it since. */
  commanded: boolean;
  steering: boolean;
  /** The Earth has turned off its place since the camera last flew to it. */
  offPlace: boolean;
}

export const newStageState = (): StageState => ({
  engine: null,
  theme: null,
  colours: null,
  now: () => 0,
  zonedNow: null,
  home: { kind: "overview" },
  homeAt: { slide: 0, build: 0 },
  overviewOpen: false,
  commanded: false,
  steering: false,
  offPlace: false,
});

/** The place the camera is bound for: the overview while that is open, else the slide's. */
export const targetOf = (s: StageState): Place =>
  s.overviewOpen ? { kind: "overview" } : s.home;
