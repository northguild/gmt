// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { countdownFace } from "./countdown-face";

const face = (value: string, iso: string, live = false) =>
  countdownFace({
    id: "face",
    caption: "Time to cut-off",
    value,
    iso,
    samples: ["−8888 h 88 min 88 s"],
    live,
  });

describe("countdownFace", () => {
  it("names the value by its caption and shows the ISO the library returned", () => {
    renderHtml(face("−20 min", "-PT20M"));
    expect(
      screen.getByRole("status", { name: "Time to cut-off" }),
    ).toHaveTextContent("−20 min");
    expect(screen.getByText("-PT20M")).toBeInTheDocument();
  });

  it("shows the signal-lost state, not a blank, for an empty value", () => {
    renderHtml(face("", ""));
    expect(
      screen.getByRole("status", { name: "Time to cut-off" }),
    ).toHaveTextContent("NO SIGNAL");
  });

  it("keeps its announcement region silent until the mount writes to it", () => {
    renderHtml(face("5 min", "PT5M", true));
    expect(
      screen.getByRole("status", { name: "Time to cut-off (announcement)" }),
    ).toBeEmptyDOMElement();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(face("−20 min", "-PT20M"));
    await expectNoAxeViolations(host);
  });
});
