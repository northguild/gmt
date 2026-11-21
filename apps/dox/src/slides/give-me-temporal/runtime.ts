/**
 * Deck 0's client-side data (`../deck-runtime.ts`): the stage's places, lapses and pins. Every
 * Deck 0 specific the runtime needs lives in `./stage-data`, never under `lib/slides/`.
 */
import type { DeckRuntime } from "../deck-runtime";
import { STAGE } from "./stage-data";

export const runtime: DeckRuntime = { stage: STAGE };
