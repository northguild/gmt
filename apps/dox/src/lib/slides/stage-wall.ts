/**
 * The space stage's ice wall: the captured landing pages that hang before the Earth and break into
 * the clock pins (`ice-wall/wall.ts`). Opt-in: a deck with no `[data-wall-pane] img` never mounts
 * one, and `arrange` then does nothing.
 *
 * This hands the wall what it needs (the panes, the globe's projection, the pin callbacks), keeps
 * the wall's state, arranges the wall and the clock pins for each kind of place, and tells the deck
 * root whether motion that crosses the slides' text is running.
 */
import type { GlobeEngine } from "~/lib/globe/types";
import { mountIceWall, type IceWall, type WallState } from "./ice-wall/wall";
import { nearestZones, WALL_PINS } from "./clocks";
import {
  getPlanetZones,
  isGeographic,
  pointFor,
  resolvePlace,
  zoomFor,
  type Place,
  type PlaceContext,
} from "./places";
import type { ClockPins } from "./stage-clocks";
import { lngLat } from "./stage-route";
import { targetOf, type StageState } from "./stage-state";

interface StageWallDeps {
  state: StageState;
  root: HTMLElement;
  host: HTMLElement | null;
  stageEl: HTMLElement | null;
  signal: AbortSignal;
  reduced(): boolean;
  clocks: ClockPins;
  context(): PlaceContext;
  draw(): void;
}

interface StageWall {
  state(): WallState;
  /** The kind of place the wall and the clocks were last arranged for. */
  kind(): Place["kind"] | null;
  /** Hangs the wall over the page's panes once the globe is up. */
  mount(globe: GlobeEngine): Promise<void>;
  /** Arranges the wall and the clocks for a change of place kind. */
  arrange(next: Place["kind"]): void;
  /** Keeps the hanging wall at the depth the camera's zoom gives it; call every frame. */
  follow(globe: GlobeEngine): void;
  /**
   * Tells the deck whether motion that crosses the slides' text is running: the wall's approach and
   * shatter. The deck root carries `data-stage-busy` while it is; the arriving slide's text stays
   * hidden (`slides.css`) and the visuals hold their start (`bug-visuals.ts`) until the root says
   * `gmt-stage-idle`. Under reduced motion nothing waits.
   */
  syncBusy(): void;
  destroy(): void;
}

export function createStageWall(d: StageWallDeps): StageWall {
  const { state: s, root, host, clocks } = d;
  let wall: IceWall | null = null;
  let kind: Place["kind"] | null = null;
  /** The wall's last published state, which decides whether the slide's text waits. */
  let wallState: WallState = "hidden";

  /** The twelve zones nearest the planet camera's point become the shards' pins. */
  const shardZones = (): string[] =>
    nearestZones(
      getPlanetZones(),
      pointFor({ kind: "planet" }, d.context()),
      WALL_PINS,
    );

  function syncBusy(): void {
    const busy =
      !d.reduced() && (wallState === "approach" || wallState === "breaking");
    if (busy === root.hasAttribute("data-stage-busy")) return;
    if (busy) {
      root.setAttribute("data-stage-busy", "");
      return;
    }
    root.removeAttribute("data-stage-busy");
    root.dispatchEvent(new CustomEvent("gmt-stage-idle"));
  }

  /** Where each pane's centre is and how wide a pane is, for the gate's pixel check. */
  function publishPanes(live: IceWall, layer: HTMLElement): void {
    const centres = live
      .paneCentres()
      .map((c) => `${c[0].toFixed(1)},${c[1].toFixed(1)}`)
      .join(" ");
    if (layer.dataset["wallCentres"] !== centres)
      layer.dataset["wallCentres"] = centres;
    const paneWidth = live.paneWidth().toFixed(1);
    if (layer.dataset["wallPaneWidth"] !== paneWidth)
      layer.dataset["wallPaneWidth"] = paneWidth;
  }

  function arrange(next: Place["kind"]): void {
    const prev = kind;
    if (!wall || prev === next) return;
    kind = next;
    if (next === "wall") {
      clocks.clear();
      if (prev === "planet") wall.restore();
      else wall.show(zoomFor({ kind: "wall" }) / (s.engine?.getZoom() || 1));
      d.draw();
    } else if (next === "planet") {
      if (prev === "wall") {
        clocks.clear();
        wall.flyThrough(shardZones());
      } else {
        wall.hide();
        for (const zone of getPlanetZones()) clocks.light(zone);
      }
    } else {
      wall.hide();
      clocks.clear();
      d.draw();
    }
  }

  async function mount(globe: GlobeEngine): Promise<void> {
    const images = Array.from(
      root.querySelectorAll<HTMLImageElement>("[data-wall-pane] img"),
    );
    if (!host || !s.theme || images.length === 0) return;
    try {
      await Promise.all(images.map((image) => image.decode()));
    } catch {
      return;
    }
    if (d.signal.aborted) return;
    wall = mountIceWall({
      layer: host,
      engine: globe,
      panes: images.map((image) => {
        const card = image.closest<HTMLElement>("[data-wall-pane]");
        return {
          id: card?.dataset["wallPane"] ?? image.src,
          image,
          ...(card ? { card } : {}),
        };
      }),
      ice: s.theme.label,
      stageWidth: () => d.stageEl?.clientWidth ?? 0,
      signal: d.signal,
      reduced: d.reduced,
      target: (zone) => {
        const place = resolvePlace(zone);
        if (!isGeographic(place)) return null;
        const at = globe.project(lngLat(place));
        return [at.x, at.y];
      },
      onPin: clocks.light,
      onState: (state) => {
        wallState = state;
        syncBusy();
      },
      onDrawn: () => {
        if (wall) publishPanes(wall, host);
      },
      onBreak: () => {
        // The twelve shards light their own pins as they land; the rest are lit now and come
        // round as the Earth turns.
        const shards = new Set(shardZones());
        for (const zone of getPlanetZones())
          if (!shards.has(zone)) clocks.light(zone);
      },
    });
    clocks.refresh();
    arrange(targetOf(s).kind);
  }

  return {
    state: () => wallState,
    kind: () => kind,
    mount,
    arrange,
    follow(globe) {
      if (wall && kind === "wall")
        wall.setDepth(zoomFor({ kind: "wall" }) / (globe.getView().zoom || 1));
    },
    syncBusy,
    destroy() {
      wall?.destroy();
      wall = null;
    },
  };
}
