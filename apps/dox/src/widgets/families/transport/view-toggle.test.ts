// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { viewToggle } from "./view-toggle";

const render = () =>
  renderHtml(
    viewToggle({
      label: "Chart view",
      views: [
        { id: "v-route", label: "Route", pressed: true },
        { id: "v-scale", label: "To scale", pressed: false },
      ],
    }),
  );

describe("viewToggle", () => {
  it("is a named group of buttons with one pressed", async () => {
    const { host } = render();
    expect(
      screen.getByRole("group", { name: "Chart view" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Route" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "To scale" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Route", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "To scale", pressed: false }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("is reached and pressed from the keyboard", async () => {
    render();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "Route" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "To scale" })).toHaveFocus();
  });
});
