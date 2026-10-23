/**
 * The tense views the checker tests render with: the real library, read at a fixed day (23 October 2026),
 * after Morocco's change and before Canada's. Morocco's words do not follow a clock; Canada's
 * `canadaTenseAt` reads any other instant.
 */
import { CANADA_MOMENTS } from "./canada-clock-change";
import { loadTenseView } from "./clock-change-mount";
import { MOROCCO_MOMENTS } from "./morocco-clock-change";

export const TENSE_NOW = "2026-10-23T12:00:00Z";

export const canadaTense = await loadTenseView(CANADA_MOMENTS, TENSE_NOW);
export const moroccoTense = await loadTenseView(MOROCCO_MOMENTS, TENSE_NOW);

export const canadaTenseAt = (now: string) =>
  loadTenseView(CANADA_MOMENTS, now);
