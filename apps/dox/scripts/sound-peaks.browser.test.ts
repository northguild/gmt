import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { build } from "esbuild";

/**
 * Hearing safety for the press, zoom and arrival cues (DOX-G10). Each voice renders offline in
 * Chromium, at 48 kHz into a unity bus, and its loudest sample must stay at or under the figure
 * its audition sound measured in the same render: the port may not play louder than what the
 * owner chose by ear. The engine's ceiling still sits after the bus; this checks the voices
 * themselves.
 *
 * The noise in a voice comes from `Math.random`, so every render seeds it: the same seeds give
 * the same samples, and the audition sounds, rendered with these seeds, peaked at the figures
 * below. A Lens servo step is rendered at both ends of the zoom, where its filter is lowest and
 * highest.
 */

/** The audition's measured peaks, rounded up to four places. */
const CASES: { cue: string; rank: number; sound: string; peak: number }[] = [
  { cue: "press", rank: 0, sound: "Deep sonar", peak: 0.1308 },
  {
    cue: "zoomIn",
    rank: 0,
    sound: "Lens servo, in, whole Earth",
    peak: 0.0169,
  },
  { cue: "zoomIn", rank: 1, sound: "Lens servo, in, closest", peak: 0.0219 },
  {
    cue: "zoomOut",
    rank: 0,
    sound: "Lens servo, out, whole Earth",
    peak: 0.0114,
  },
  { cue: "zoomOut", rank: 1, sound: "Lens servo, out, closest", peak: 0.0182 },
  { cue: "appearMap", rank: 0, sound: "Sonar dawn", peak: 0.0866 },
  { cue: "appearGlobe", rank: 0, sound: "Steel horizon", peak: 0.0524 },
  { cue: "locate", rank: 0, sound: "Sonar lock", peak: 0.0739 },
];

/** How many seeds each voice renders with. */
const SEEDS = 20;

let browser: Browser;
let page: Page;

beforeAll(async () => {
  const { outputFiles } = await build({
    stdin: {
      contents: `
        import { VOICES } from "./voices";
        import { setMaster } from "./kit";
        window.peakOf = async (name, rank, seeds) => {
          let loudest = 0;
          for (let i = 0; i < seeds; i++) {
            let x = 1 + i * 7919;
            Math.random = () => (x = (x * 16807) % 2147483647) / 2147483647;
            const c = new OfflineAudioContext(2, 48000 * 6, 48000);
            const bus = c.createGain();
            bus.connect(c.destination);
            setMaster(c, bus);
            VOICES[name](c, bus, 0.05, rank);
            const rendered = await c.startRendering();
            for (let ch = 0; ch < rendered.numberOfChannels; ch++)
              for (const v of rendered.getChannelData(ch))
                loudest = Math.max(loudest, Math.abs(v));
          }
          return loudest;
        };`,
      resolveDir: resolve(import.meta.dirname, "../src/lib/sound"),
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "iife",
  });
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.addScriptTag({ content: outputFiles[0].text });
});

afterAll(async () => {
  await browser?.close();
});

describe("the ported cues play no louder than their audition sounds", () => {
  it.each(CASES)(
    "$cue at $rank, $sound, peaks at $peak or under",
    async ({ cue, rank, peak }) => {
      const loudest = await page.evaluate(
        ([name, at, seeds]) =>
          (
            window as unknown as {
              peakOf: (n: string, r: number, s: number) => Promise<number>;
            }
          ).peakOf(name, at, seeds),
        [cue, rank, SEEDS] as const,
      );
      expect(loudest).toBeGreaterThan(0);
      expect(loudest).toBeLessThanOrEqual(peak);
    },
  );
});
