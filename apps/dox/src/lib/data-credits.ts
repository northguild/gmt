/**
 * The data-credits panel's content and markup (CORE-88).
 *
 * A drawing of third-party data carries an info button on the drawing itself, which opens a small
 * popup; each source is a row, label left, credit right. The globe's button is the fourth of its
 * control stack; a map's is a glass square in the drawing's corner. The pure part lives here so
 * the Astro shells and the plain-DOM mounts (the chat's, which cannot instantiate an Astro
 * component) render the same markup.
 *
 * The time-zone shapes are timezone-boundary-builder's, derived from OpenStreetMap, offered under the
 * ODbL 1.0 (§4.2–4.3: notice; §4.4: share-alike). The wording follows its README § Licenses at the pinned release.
 */
import { LICENCE_LEAD, LICENCE_LINK_TEXT, LICENCE_URL } from "./licence";
import {
  dataCredits,
  type DataCredit,
  type DataCreditsPlacement,
} from "~/widgets/builders";

export type { DataCredit, DataCreditsPlacement };

/** The timezone-boundary-builder release the boundary files come from (see `context/dox/built/tier-4-zones.md`, "Boundary data"). */
export const TBB_TAG = "2026e";

/** The Natural Earth release the coastlines come from (see `context/dox/built/tier-4-zones.md`, "Boundary data"). */
export const NE_TAG = "v5.1.2";

/** The HYG v4.4 commit the star list comes from (see `context/dox/built/tier-4-zones.md`, "Boundary data"). */
export const HYG_COMMIT = "53e3df311869e813ace5f1ad2ec4ce909f13256c";

export const TZ_BOUNDARIES: DataCredit = {
  label: "Time zone boundaries",
  parts: [
    "© ",
    {
      text: "OpenStreetMap contributors",
      href: "https://www.openstreetmap.org/copyright",
    },
    ", ",
    {
      text: "timezone-boundary-builder",
      href: `https://github.com/evansiroky/timezone-boundary-builder/releases/tag/${TBB_TAG}`,
    },
    " (",
    { text: "ODbL", href: "https://opendatacommons.org/licenses/odbl/1-0/" },
    ").",
  ],
};

export const COASTLINES: DataCredit = {
  label: "Coastlines",
  parts: [
    {
      text: "Natural Earth",
      href: "https://www.naturalearthdata.com/",
    },
    " (public domain, ",
    {
      text: NE_TAG,
      href: `https://github.com/nvkelso/natural-earth-vector/releases/tag/${NE_TAG}`,
    },
    ").",
  ],
};

/** The state and territory outlines of the Sunshine Protection Act map: Natural Earth admin-0 and admin-1. */
export const STATE_BOUNDARIES: DataCredit = {
  label: "State outlines",
  parts: [
    "State and territory outlines: ",
    {
      text: "Natural Earth",
      href: "https://www.naturalearthdata.com/",
    },
    " 5.1.2, public domain (",
    {
      text: NE_TAG,
      href: `https://github.com/nvkelso/natural-earth-vector/releases/tag/${NE_TAG}`,
    },
    ").",
  ],
};

export const EARTH_IMAGERY: DataCredit = {
  label: "Earth imagery",
  parts: ["NASA Earth Observatory (Blue Marble Next Generation)."],
};

/**
 * The star catalogue behind the landing's night sky. CC BY-SA 4.0 asks for the creator and a note
 * that the material was changed (§3(a)(1)); the cut is `hero-sky.json`'s `magnitudeLimit`.
 */
export const NIGHT_SKY: DataCredit = {
  label: "Stars",
  parts: [
    {
      text: "HYG v4.4",
      href: `https://codeberg.org/astronexus/hyg/src/commit/${HYG_COMMIT}`,
    },
    " by astronexus, from Hipparcos, Yale Bright Star and Gliese, adapted to the stars of magnitude 5.5 and brighter (",
    {
      text: "CC BY-SA 4.0",
      href: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
    ").",
  ],
};

/**
 * The all-sky photograph behind the landing's Milky Way. CC BY 4.0 asks for the credit as given
 * and a note that the material was changed (§3(a)(1)); the changes are `hero-milkyway.json`'s.
 */
export const MILKY_WAY: DataCredit = {
  label: "Milky Way",
  parts: [
    {
      text: "The Milky Way panorama",
      href: "https://www.eso.org/public/images/eso0932a/",
    },
    " by ESO/S. Brunier, adapted to a starless greyscale sky map (",
    {
      text: "CC BY 4.0",
      href: "https://creativecommons.org/licenses/by/4.0/",
    },
    ").",
  ],
};

/**
 * The Sun disc behind the night sky's Sun: ESA's Solar Orbiter PHI image, a multinational body's
 * (CC BY-SA 3.0 IGO). The credit is the one ESA asks for; the change is `sky-sun.json`'s.
 */
export const SUN_IMAGERY: DataCredit = {
  label: "Sun",
  parts: [
    {
      text: "PHI's view of the Sun in visible light",
      href: "https://www.esa.int/ESA_Multimedia/Images/2024/11/PHI_s_view_of_the_Sun_in_visible_light",
    },
    " by ESA & NASA/Solar Orbiter/PHI Team, 22 March 2023, cropped, scaled and reduced to grey (",
    {
      text: "CC BY-SA 3.0 IGO",
      href: "https://creativecommons.org/licenses/by-sa/3.0/igo/",
    },
    ").",
  ],
};

/**
 * The Moon map behind the night sky's Moon: NASA's visualisation of LRO LROC data, a national peer
 * (no international body publishes a global lunar mosaic). NASA's media guidelines ask for the
 * credit and no implied endorsement; the change is `sky-moon.json`'s.
 */
export const MOON_IMAGERY: DataCredit = {
  label: "Moon",
  parts: [
    {
      text: "NASA's Scientific Visualization Studio, CGI Moon Kit",
      href: "https://svs.gsfc.nasa.gov/4720",
    },
    ", from Lunar Reconnaissance Orbiter LROC data, scaled (",
    {
      text: "NASA media guidelines",
      href: "https://www.nasa.gov/multimedia/guidelines/index.html",
    },
    ").",
  ],
};

/**
 * The planets' places in the night sky: VSOP87 of Bretagnon and Francou, IMCCE (Observatoire de
 * Paris, an observatory of the French national research body, published for use with attribution).
 * The change is `sky-orbits.json`'s: terms dropped and rounded.
 */
export const PLANET_ORBITS: DataCredit = {
  label: "Planets",
  parts: [
    "Planet positions: ",
    {
      text: "VSOP87",
      href: "https://ftp.imcce.fr/pub/ephem/planets/vsop87/",
    },
    ", Bretagnon and Francou, IMCCE, with the smallest terms dropped.",
  ],
};

/**
 * Vesta's place in the night sky: the osculating elements of the IAU Minor Planet Center, whose
 * bright minor planets file is published for use with acknowledgement, and its absolute magnitude
 * and slope from JPL's Small-Body Database. The change is `sky-orbits.json`'s: the one body kept,
 * with its elements read as a two-body orbit.
 */
export const SMALL_BODY_ORBITS: DataCredit = {
  label: "Vesta",
  parts: [
    "Vesta's orbit: ",
    {
      text: "IAU Minor Planet Center",
      href: "https://www.minorplanetcenter.net/",
    },
    ", its brightness: ",
    {
      text: "JPL Small-Body Database",
      href: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html",
    },
    ".",
  ],
};

/**
 * Pluto's place and brightness in the night sky: its orbit is the IAU Minor Planet Center's
 * distant-bodies file (`sky-orbits.json`'s `small.pluto`), read by `prepare-sky-orbits.ts` beside the
 * bright-bodies file, and its magnitude is the Explanatory Supplement's law (`magnitude.ts`).
 */
export const DISTANT_ORBITS: DataCredit = {
  label: "Pluto",
  parts: [
    "Pluto's orbit: ",
    {
      text: "IAU Minor Planet Center",
      href: "https://www.minorplanetcenter.net/iau/Ephemerides/Distant/",
    },
    ", its brightness: Urban and Seidelmann (eds.), Explanatory Supplement to the Astronomical Almanac, 3rd ed. (2013), table 10.6.",
  ],
};

/**
 * The close passes' positions in the night sky: JPL's Horizons integration of
 * a Small-Body Database orbit solution, a national peer (see `context/dox/built/tier-4-globe.md`,
 * "Night sky"). It is listed exactly while `sky-orbits.json` ships a pass; `data-credits.test.ts`
 * holds the two together.
 */
export const PASS_ORBITS: DataCredit = {
  label: "Close approaches",
  parts: [
    "Close-approach positions: NASA ",
    {
      text: "JPL Small-Body Database",
      href: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html",
    },
    " and ",
    { text: "Horizons", href: "https://ssd.jpl.nasa.gov/horizons/" },
    ".",
  ],
};

/** The night sky's rows in reading order: the globe's popover, the deck's and the slides' read this list. */
export const SKY_CREDITS: readonly DataCredit[] = [
  NIGHT_SKY,
  MILKY_WAY,
  SUN_IMAGERY,
  MOON_IMAGERY,
  PLANET_ORBITS,
  SMALL_BODY_ORBITS,
  DISTANT_ORBITS,
  PASS_ORBITS,
];

/** The site's licence note, as the landing popover's last row (everywhere else it is the footer line). */
export const LICENCE_CREDIT: DataCredit = {
  label: "Licence",
  parts: [
    `${LICENCE_LEAD} `,
    { text: LICENCE_LINK_TEXT, href: LICENCE_URL },
    ".",
  ],
};

/**
 * The info button and its popover, as one string. `""` for an empty list, so a drawing with
 * nothing to credit gets no button. `id` must be unique in the document: two mounts of one drawing
 * (the page's and the chat's) each pass their own prefix.
 */
export function renderDataCreditsHtml(
  credits: readonly DataCredit[],
  opts: { id: string; placement: DataCreditsPlacement },
): string {
  return dataCredits({ credits, ...opts }).toString();
}

let watching = false;

/**
 * Keeps each credits button's `aria-expanded` true to its panel. A `popovertarget` button should
 * expose its expanded state with no attribute, but WebKit's accessibility tree does not (a bare
 * `<button popovertarget>` with its popover open reads as a plain button in Safari 26), so a
 * screen-reader user there would never hear it. The popover's `toggle` event does not bubble, so
 * one capturing listener on the document covers every panel, the chat's mounts included.
 * Idempotent; call it from any client code that puts a credits button on a page.
 */
export function watchDataCredits(): void {
  if (watching || typeof document === "undefined") return;
  watching = true;
  document.addEventListener(
    "toggle",
    (event) => {
      const panel = event.target;
      if (
        !(panel instanceof HTMLElement) ||
        !panel.hasAttribute("data-credits-panel")
      )
        return;
      const open = (event as ToggleEvent).newState === "open";
      for (const button of document.querySelectorAll(
        `[popovertarget="${CSS.escape(panel.id)}"]`,
      ))
        button.setAttribute("aria-expanded", String(open));
    },
    true,
  );
}
