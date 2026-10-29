// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { html } from "../../builders/html";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { tenseSlot, tensedSlot } from "./tense-slot";

const BEFORE = "Stops changing clocks on 1 November 2026";
const AFTER = "Stopped changing clocks on 1 November 2026";

/** A heading takes its name from the content the accessibility tree keeps. */
const heading = (slot: ReturnType<typeof tenseSlot>) =>
  renderHtml(html`<section aria-label="Phrase"><h3>${slot}</h3></section>`);

describe("tenseSlot", () => {
  it("names the future form while the moment is ahead, and only that one", async () => {
    heading(tenseSlot("region", BEFORE, AFTER, "before"));
    expect(screen.getByRole("heading", { name: BEFORE })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: AFTER }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("names the past form once the moment has passed", async () => {
    heading(tenseSlot("region", BEFORE, AFTER, "after", true));
    expect(screen.getByRole("heading", { name: AFTER })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: BEFORE }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("escapes the words it is given", () => {
    heading(tenseSlot("region", "<b>x</b>", "y", "before"));
    expect(
      screen.getByRole("heading", { name: "<b>x</b>" }),
    ).toBeInTheDocument();
  });
});

describe("tensedSlot", () => {
  const view = { tenseOf: () => "after" as const, words: () => null };

  it("draws a one-form phrase as plain text", () => {
    renderHtml(
      html`<h3>${tensedSlot({ key: null, before: "Never changes clocks", after: "Never changes clocks" }, view)}</h3>`,
    );
    expect(
      screen.getByRole("heading", { name: "Never changes clocks" }),
    ).toBeInTheDocument();
  });

  it("draws the form the view says is true", () => {
    renderHtml(
      html`<h3>${tensedSlot({ key: "region", before: BEFORE, after: AFTER }, view)}</h3>`,
    );
    expect(screen.getByRole("heading", { name: AFTER })).toBeInTheDocument();
  });
});
