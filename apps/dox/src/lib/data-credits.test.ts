// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { raw } from "~/widgets/builders";
import { renderHtml } from "~/widgets/test-fixture";
import {
  COASTLINES,
  EARTH_IMAGERY,
  NE_TAG,
  renderDataCreditsHtml,
  TBB_TAG,
  TZ_BOUNDARIES,
} from "./data-credits";

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
