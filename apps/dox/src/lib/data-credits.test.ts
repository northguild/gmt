// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { raw } from "~/widgets/builders";
import { renderHtml } from "~/widgets/test-fixture";
import milkyWay from "../assets/hero-milkyway.json";
import sky from "../assets/hero-sky.json";
import {
  COASTLINES,
  EARTH_IMAGERY,
  HYG_COMMIT,
  LICENCE_CREDIT,
  MILKY_WAY,
  NE_TAG,
  NIGHT_SKY,
  renderDataCreditsHtml,
  STATE_BOUNDARIES,
  TBB_TAG,
  TZ_BOUNDARIES,
} from "./data-credits";
import { LICENCE_LEAD, LICENCE_LINK_TEXT, LICENCE_URL } from "./licence";

function show(
  credits: Parameters<typeof renderDataCreditsHtml>[0],
  opts: Parameters<typeof renderDataCreditsHtml>[1],
): void {
  renderHtml(raw(renderDataCreditsHtml(credits, opts)));
}

/** The credit listed under `label`: terms and definitions pair up in source order. */
const text = (label: string) => {
  const at = screen
    .getAllByRole("term", { hidden: true })
    .findIndex((t) => t.textContent === label);
  return screen.getAllByRole("definition", { hidden: true })[at];
};

describe("the coastline credit", () => {
  it("is listed after the time zone boundaries, naming Natural Earth as public domain", () => {
    show([TZ_BOUNDARIES, COASTLINES], { id: "c", placement: "corner" });
    const labels = screen
      .getAllByRole("term", { hidden: true })
      .map((t) => t.textContent);
    expect(labels).toEqual(["Time zone boundaries", "Coastlines"]);
    expect(text("Coastlines")).toHaveTextContent(
      `Natural Earth (public domain, ${NE_TAG}).`,
    );
  });

  it("links Natural Earth and the pinned tag", () => {
    show([COASTLINES], { id: "c", placement: "corner" });
    expect(
      screen.getByRole("link", { name: "Natural Earth", hidden: true }),
    ).toHaveAttribute("href", "https://www.naturalearthdata.com/");
    expect(
      screen.getByRole("link", { name: NE_TAG, hidden: true }),
    ).toHaveAttribute(
      "href",
      `https://github.com/nvkelso/natural-earth-vector/releases/tag/${NE_TAG}`,
    );
    expect(NE_TAG).toBe("v5.1.2");
  });
});

describe("the state outline credit", () => {
  it("is labelled State outlines and names Natural Earth as public domain", () => {
    show([TZ_BOUNDARIES, COASTLINES, STATE_BOUNDARIES], {
      id: "c",
      placement: "corner",
    });
    const labels = screen
      .getAllByRole("term", { hidden: true })
      .map((t) => t.textContent);
    expect(labels).toEqual([
      "Time zone boundaries",
      "Coastlines",
      "State outlines",
    ]);
    expect(text("State outlines")).toHaveTextContent(
      `State and territory outlines: Natural Earth 5.1.2, public domain (${NE_TAG}).`,
    );
  });

  it("links Natural Earth and the pinned tag", () => {
    show([STATE_BOUNDARIES], { id: "c", placement: "corner" });
    expect(
      screen.getByRole("link", { name: "Natural Earth", hidden: true }),
    ).toHaveAttribute("href", "https://www.naturalearthdata.com/");
    expect(
      screen.getByRole("link", { name: NE_TAG, hidden: true }),
    ).toHaveAttribute(
      "href",
      `https://github.com/nvkelso/natural-earth-vector/releases/tag/${NE_TAG}`,
    );
  });
});

describe("the night sky credit", () => {
  it("is labelled Stars and links the pinned catalogue commit and the licence", () => {
    show([NIGHT_SKY], { id: "c", placement: "stack" });
    expect(text("Stars")).toHaveTextContent(
      "HYG v4.4 by astronexus, from Hipparcos, Yale Bright Star and Gliese, adapted to the stars of magnitude 5.5 and brighter (CC BY-SA 4.0).",
    );
    // The cut it names is the one the star list was made with.
    expect(text("Stars")).toHaveTextContent(
      `magnitude ${sky.magnitudeLimit} and brighter`,
    );
    expect(
      screen.getByRole("link", { name: "HYG v4.4", hidden: true }),
    ).toHaveAttribute(
      "href",
      `https://codeberg.org/astronexus/hyg/src/commit/${HYG_COMMIT}`,
    );
    expect(
      screen.getByRole("link", { name: "CC BY-SA 4.0", hidden: true }),
    ).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0/",
    );
    expect(HYG_COMMIT).toBe("53e3df311869e813ace5f1ad2ec4ce909f13256c");
  });
});

describe("the Milky Way credit", () => {
  it("is labelled Milky Way, credits ESO's photograph as ESO asks, and says it was changed", () => {
    show([MILKY_WAY], { id: "c", placement: "stack" });
    expect(text("Milky Way")).toHaveTextContent(
      "The Milky Way panorama by ESO/S. Brunier, adapted to a starless greyscale sky map (CC BY 4.0).",
    );
    // The page it links is the one the map was made from, and the credit is ESO's own.
    expect(
      screen.getByRole("link", {
        name: "The Milky Way panorama",
        hidden: true,
      }),
    ).toHaveAttribute("href", milkyWay.source.page);
    expect(text("Milky Way")).toHaveTextContent(milkyWay.credit);
    expect(
      screen.getByRole("link", { name: "CC BY 4.0", hidden: true }),
    ).toHaveAttribute("href", milkyWay.licenseUrl);
  });
});

describe("the licence credit", () => {
  it("is labelled Licence and reads as the site's licence note, linked to the terms", () => {
    show([LICENCE_CREDIT], { id: "c", placement: "stack" });
    expect(text("Licence")).toHaveTextContent(
      `${LICENCE_LEAD} ${LICENCE_LINK_TEXT}.`,
    );
    expect(
      screen.getByRole("link", { name: LICENCE_LINK_TEXT, hidden: true }),
    ).toHaveAttribute("href", LICENCE_URL);
  });
});

describe("renderDataCreditsHtml", () => {
  it("renders one button wired to one popover, with every label and credit", () => {
    show([TZ_BOUNDARIES, EARTH_IMAGERY], { id: "globe", placement: "stack" });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Data credits" }),
    ).toHaveAttribute("popovertarget", "globe");
    expect(text("Time zone boundaries")).toHaveTextContent(
      "© OpenStreetMap contributors, timezone-boundary-builder (ODbL).",
    );
    expect(text("Earth imagery")).toHaveTextContent(
      "NASA Earth Observatory (Blue Marble Next Generation).",
    );
  });

  it("links the exact sources", () => {
    show([TZ_BOUNDARIES], { id: "g", placement: "stack" });
    const href = (name: string) =>
      screen.getByRole("link", { name, hidden: true }).getAttribute("href");
    expect(href("OpenStreetMap contributors")).toBe(
      "https://www.openstreetmap.org/copyright",
    );
    expect(href("timezone-boundary-builder")).toBe(
      `https://github.com/evansiroky/timezone-boundary-builder/releases/tag/${TBB_TAG}`,
    );
    expect(href("ODbL")).toBe("https://opendatacommons.org/licenses/odbl/1-0/");
    expect(TBB_TAG).toBe("2026e");
  });

  it("returns an empty string for an empty list, so a drawing with nothing to credit gets no button", () => {
    expect(renderDataCreditsHtml([], { id: "g", placement: "stack" })).toBe("");
  });
});
