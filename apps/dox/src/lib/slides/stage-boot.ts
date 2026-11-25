/**
 * Brings the stage's sky and globe up, after the slides have painted. Neither is waited for: the
 * sky starts at once, and the globe mounts when gmt's clock and the engine have loaded. If the
 * globe cannot start on either renderer the sky is drawn once without it; if the sky fails the
 * slides read on the void. No failure is shown to the reader.
 *
 * The engine has one frame slot and the sky's follow loop needs it, so this owns the slot, runs
 * the loop from it, and then runs the stage's own per-frame work (`frame`).
 */
import type { GlobeEngine, GlobeFraming, Rgba } from "~/lib/globe/types";
import {
  labelFont,
  parseColour,
  readTheme,
  rendererOverride,
} from "~/lib/globe/globe-theme";
import {
  drawWithoutGlobe,
  followGlobe,
  loadClock,
  loadSky,
  skyInputsOf,
} from "~/lib/space-sky";
import { loadDeckGmt } from "./gmt-loader";
import { rotationFor, zoomFor, type Place, type PlaceContext } from "./places";
import { hardenCanvases } from "./stage-camera";
import { targetOf, type StageState } from "./stage-state";
import { lapseToolsFrom, type LapseTools } from "./time-lapse";

interface BootDeps {
  state: StageState;
  host: HTMLElement;
  stageEl: HTMLElement | null;
  signal: AbortSignal;
  reduced(): boolean;
  framing(width: number, height: number): GlobeFraming;
  /** Where the camera looks first. */
  aimed(): Place;
  context(): PlaceContext;
  sun: {
    /** The instant the sun, the Moon and the stars show. */
    shownSun(): number;
    setTools(tools: LapseTools): void;
    apply(): void;
  };
  wall: { mount(globe: GlobeEngine): Promise<void> };
  /** Places the camera, once the engine exists. */
  fly(hop: boolean): void;
  /** Runs once a frame, after the sky has followed the globe. */
  frame(globe: GlobeEngine): void;
}

/** Starts the sky, which needs no globe. `null` when the page has no sky to draw. */
function startSky(d: BootDeps): ReturnType<typeof loadSky> | Promise<null> {
  const inputs = skyInputsOf(d.host, d.host, d.signal);
  return inputs ? loadSky(inputs) : Promise.resolve(null);
}

/** The engine, or `null` when neither renderer starts (or the stage was torn down meanwhile). */
async function createEngine(
  d: BootDeps,
  watcher: MutationObserver | null,
): Promise<GlobeEngine | null> {
  const { state: s, host } = d;
  try {
    // The wall time is read before the camera is placed: over the pole the zone sits under the hand.
    const [time, gmt] = await Promise.all([
      loadClock(),
      loadDeckGmt().catch(() => null),
    ]);
    if (d.signal.aborted) return null;
    s.now = time.getUnixNow;
    if (gmt) {
      s.zonedNow ??= gmt.zonedGet.getZonedNow;
      // The camera's first aim may be the Moon at a lapse's end, so the tools are in before it.
      d.sun.setTools(lapseToolsFrom(gmt));
    }
    d.sun.apply();
    const { createGlobeEngine } = await import("~/lib/globe/engine");
    if (d.signal.aborted) return null;
    const theme = readTheme(host);
    s.theme = theme;
    const style = getComputedStyle(host);
    const token = (name: string, fallback: Rgba): Rgba =>
      parseColour(style.getPropertyValue(name).trim()) ?? fallback;
    s.colours = {
      cyan: token("--gmt-cyan", theme.markerPrimary),
      teal: token("--gmt-teal", theme.markerOther),
    };
    watcher?.observe(host, { childList: true });
    return await createGlobeEngine(host, {
      renderer: rendererOverride(),
      sunInstant: d.sun.shownSun,
      theme,
      labelFont: labelFont(host),
      ariaLabel: "The Earth and the night sky behind the slides",
      initialRotation: rotationFor(d.aimed(), d.context()),
      zoomRange: [0.5, 4],
      // The slide's zoom from the first frame, so the clock over the Earth keeps its size.
      initialZoom: zoomFor(targetOf(s)),
      reducedMotion: d.reduced,
      ambient: false,
      maxDpr: 1.5,
      pauseWhenHidden: host,
      framing: d.framing,
      ...(d.stageEl ? { framingWatch: [d.stageEl] } : {}),
      ...(host.dataset["earth"] ? { imageryUrl: host.dataset["earth"] } : {}),
    });
  } catch {
    return null;
  }
}

/** Starts the sky and the globe; never throws. */
export async function bootStage(d: BootDeps): Promise<void> {
  const { state: s, host, signal } = d;
  const sky = startSky(d);
  const watcher =
    typeof MutationObserver === "function"
      ? new MutationObserver(() => hardenCanvases(host))
      : null;
  signal.addEventListener("abort", () => watcher?.disconnect(), { once: true });
  const created = await createEngine(d, watcher);
  if (signal.aborted) {
    created?.destroy();
    return;
  }
  if (!created) {
    host.dataset["globe"] = "none";
    void drawWithoutGlobe(sky, host, signal);
    return;
  }
  const globe = created;
  s.engine = globe;
  hardenCanvases(host);
  globe.onInteract(() => {
    s.commanded = false;
  });
  host.dataset["globe"] = "ready";
  d.fly(false);
  let follow: (() => void) | null = null;
  globe.onFrame(() => {
    follow?.();
    d.frame(globe);
  });
  void d.wall.mount(globe);
  void followGlobe({
    sky,
    globe: {
      getRotation: () => globe.getRotation(),
      getZoom: () => globe.getZoom(),
      getCentre: () => globe.getCentre(),
      onFrame: (callback) => {
        follow = callback;
      },
    },
    origin: host,
    surface: host,
    signal,
    // The Sun, the Moon and the stars follow a running lapse and the glide between slides.
    instant: d.sun.shownSun,
  });
}
