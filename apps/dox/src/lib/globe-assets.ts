/**
 * The two files the globe fetches, as their hashed URLs. They sit here and not in `globe.ts` so the
 * landing can start them (`globe-warmup.ts`) without loading the engine that `globe.ts` pulls in.
 */
import imageryUrl from "../assets/earth-blue-marble.webp?url";
import boundariesUrl from "../assets/timezone-boundaries-globe.json?url";

/**
 * NASA's Blue Marble, prepared by `scripts/prepare-globe-imagery.py`. Only the WebGPU renderer
 * fetches it, and only while `--gmt-globe-imagery-alpha` is above 0.
 */
export const EARTH_IMAGERY_URL = imageryUrl;

/** The zone boundary dataset, fetched once the Earth has its imagery. */
export const ZONE_BOUNDARIES_URL = boundariesUrl;
