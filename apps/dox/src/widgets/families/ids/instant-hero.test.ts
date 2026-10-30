// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import {
  instantHero,
  NO_SIGNAL_PILL,
  type InstantHeroOptions,
} from "./instant-hero";

const base: InstantHeroOptions = {
  caption: "UUID",
  captions: ["Reading", "Snowflake"],
  label: "Decoded instant",
  state: "one",
  value: "2022-02-22T19:22:22Z",
  sample: "5236-03-31T21:21:00.6846975Z",
  lost: false,
  bar: true,
  chip: { text: "v7", sample: "v7" },
  call: null,
  reason: "",
  reasons: ["Paste an identifier."],
};

describe("instantHero", () => {
  it("is a figure named by its caption over a named instant", () => {
    renderHtml(instantHero(base));
    expect(screen.getByRole("figure", { name: "UUID" })).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Decoded instant" }),
    ).toHaveTextContent("2022-02-22T19:22:22Z");
    expect(screen.getByText("v7")).toBeInTheDocument();
  });

  it("writes the sentinel as a bracketed pill, not a blank", () => {
    renderHtml(instantHero({ ...base, lost: true, value: "", chip: null }));
    expect(
      screen.getByRole("status", { name: "Decoded instant" }),
    ).toHaveTextContent(NO_SIGNAL_PILL);
  });

  it("leaves a legitimately empty reading empty and says why", () => {
    renderHtml(
      instantHero({
        ...base,
        value: "",
        chip: null,
        reason: "Paste an identifier.",
      }),
    );
    const out = screen.getByRole("status", { name: "Decoded instant" });
    expect(out).toBeEmptyDOMElement();
    expect(screen.getByText("Paste an identifier.")).toBeInTheDocument();
  });

  it("prints a validator call when it has one", () => {
    renderHtml(
      instantHero({
        ...base,
        call: {
          line: html`isValidInstant("x") → false`,
          sample: "isValidInstant",
        },
      }),
    );
    expect(
      within(screen.getByRole("figure")).getByText(/isValidInstant\("x"\)/),
    ).toBeInTheDocument();
  });

  it("escapes what it is given", () => {
    renderHtml(instantHero({ ...base, reason: "<img src=x onerror=1>" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(instantHero(base));
    await expectNoAxeViolations(host);
  });
});
