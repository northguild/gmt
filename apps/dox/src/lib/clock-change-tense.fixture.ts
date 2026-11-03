/**
 * The views the checker tests render with, from the real library: each region's moments in words.
 */
import { CANADA_MOMENTS } from "./canada-clock-change";
import { loadTenseView } from "./clock-change-mount";
import { MOROCCO_MOMENTS } from "./morocco-clock-change";

export const canadaTense = await loadTenseView(CANADA_MOMENTS);
export const moroccoTense = await loadTenseView(MOROCCO_MOMENTS);
