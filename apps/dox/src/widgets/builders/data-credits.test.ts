// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { dataCredits, type DataCredit } from "./data-credits";

const SOURCES: DataCredit[] = [
  {
    label: "Boundaries",
    parts: [
      "© ",
      { text: "Map makers", href: "https://maps.example/copyright" },
      " (",
      { text: "ODbL", href: "https://licence.example/odbl" },
      ").",
    ],
  },
  { label: "Imagery", parts: ["An observatory."] },
];

const show = (placement: "stack" | "corner" | "corner-start" = "stack") =>
  renderHtml(dataCredits({ id: "credits-1", placement, credits: SOURCES }));

describe("dataCredits", () => {
  it("is one button named Data credits that controls the popup", () => {
    show();
    const button = screen.getByRole("button", { name: "Data credits" });
    expect(button).toHaveAttribute("popovertarget", "credits-1");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("lists every source with its label and credit", () => {
    show();
    const labels = screen.getAllByRole("term", { hidden: true });
    expect(labels.map((t) => t.textContent)).toEqual(["Boundaries", "Imagery"]);
    const credits = screen.getAllByRole("definition", { hidden: true });
    expect(credits[0]).toHaveTextContent("© Map makers (ODbL).");
    expect(credits[1]).toHaveTextContent("An observatory.");
  });

  it("links each named source to its address", () => {
    show();
    const maps = screen.getByRole("link", { name: "Map makers", hidden: true });
    expect(maps).toHaveAttribute("href", "https://maps.example/copyright");
    expect(
      screen.getByRole("link", { name: "ODbL", hidden: true }),
    ).toHaveAttribute("href", "https://licence.example/odbl");
  });

  it("works in every placement", async () => {
    for (const placement of ["stack", "corner", "corner-start"] as const) {
      const { host } = show(placement);
      expect(
        within(host).getByRole("button", { name: "Data credits" }),
      ).toBeInTheDocument();
      await expectNoAxeViolations(host);
    }
  });

  it("escapes every interpolation", () => {
    const hostile: DataCredit = {
      label: '<img src=x onerror="a">',
      parts: ['"quoted" & <b>', { text: "<i>t</i>", href: 'x" onclick="y' }],
    };
    renderHtml(
      dataCredits({
        id: 'a" onclick="b',
        placement: "corner",
        credits: [hostile],
      }),
    );
    expect(
      screen.getByText('<img src=x onerror="a">', { exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "<i>t</i>", hidden: true }),
    ).toHaveAttribute("href", 'x" onclick="y');
    expect(
      screen.getByRole("button", { name: "Data credits" }),
    ).toHaveAttribute("popovertarget", 'a" onclick="b');
  });

  it("prints nothing for an empty list, so a drawing with nothing to credit gets no button", () => {
    renderHtml(dataCredits({ id: "none", placement: "stack", credits: [] }));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
