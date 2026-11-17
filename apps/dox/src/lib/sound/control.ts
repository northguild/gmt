/**
 * Wires the sound controls in the header's settings panel (`components/settings-control.ts`) to
 * the reader's choice in `dox:sound`. The panel itself (its button, open state and focus) is
 * `lib/settings-control.ts`'s.
 *
 * - The mute button toggles mute and keeps the level. It plays the Ice snap itself (it carries
 *   `data-cue`, so the press hook leaves it alone).
 * - The fader writes the level; moving it while muted unmutes at the new level. Its Glass tick
 *   is the kit range's own.
 * - The Aura switch writes `aura`; its Ice snap is the kit switch's own (switch-cue.ts).
 * - The track radios (Ice cavern, Deep drone) write `track`; the engine crossfades a playing aura.
 *   They stay enabled with the aura off: the pick is then kept for when it is on, and a reader
 *   can choose before switching it on rather than in a fixed order.
 * - Nothing is written on mount. A change here or in another tab repaints them all, and keeps
 *   `data-sound` on `<html>` true to the mute, which draws the speaker.
 *
 * Every listener is on one `AbortController`; the returned function is `destroy()`.
 */
import { defineElements } from "~/widgets/define";
import type { GmtRange } from "~/widgets/primitives/range/range";
import { cue } from "./cue";
import {
  isTrack,
  onSoundChange,
  readSound,
  writeSound,
  type SoundSettings,
} from "./settings";

export function mountSoundControl(root: ParentNode = document): () => void {
  defineElements();
  const mute = root.querySelector<HTMLButtonElement>("#gmt-sound-mute");
  const fader = root.querySelector<GmtRange>("gmt-range");
  const aura = root.querySelector<HTMLInputElement>("#gmt-sound-aura");
  const tracks = [
    ...root.querySelectorAll<HTMLInputElement>("input[name='gmt-sound-track']"),
  ];
  if (!mute || !fader || !aura || tracks.length === 0) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  let muted = false;

  const paint = (s: SoundSettings) => {
    muted = s.muted;
    mute.setAttribute("aria-pressed", String(s.muted));
    document.documentElement.dataset.sound = s.muted ? "off" : "on";
    fader.formatValue = (n) => `Volume ${n} of 11${muted ? ", muted" : ""}`;
    fader.value = s.level;
    aura.checked = s.aura;
    for (const input of tracks) input.checked = input.value === s.track;
  };
  paint(readSound());
  signal.addEventListener("abort", onSoundChange(paint), { once: true });

  mute.addEventListener(
    "click",
    () => {
      if (muted) {
        writeSound({ muted: false });
        // Unmuting is what loads the engine, a moment later. Cue one task after it has loaded,
        // by which time `cue.ts` has attached it, whichever of the two imports settled first.
        void import("./engine").then(() => setTimeout(() => cue("toggle"), 0));
      } else {
        cue("toggle");
        writeSound({ muted: true });
      }
    },
    { signal },
  );

  // The kit range re-emits the native `input` as one with `detail`.
  fader.addEventListener(
    "input",
    (event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as { value: number };
      writeSound({ level: detail.value, muted: false });
    },
    { signal },
  );
  aura.addEventListener("change", () => writeSound({ aura: aura.checked }), {
    signal,
  });
  for (const input of tracks)
    input.addEventListener(
      "change",
      () => {
        if (input.checked && isTrack(input.value))
          writeSound({ track: input.value });
      },
      { signal },
    );

  return () => controller.abort();
}
