// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { idScope } from "../../builders/ids";
import {
  legFieldset,
  legHeader,
  modeChoices,
  setChoice,
  zoneChoices,
} from "./leg-fieldset";

const LEG = {
  departure: "2024-06-10T08:00:00",
  duration: "PT46H",
  timeZone: "America/Los_Angeles",
  dwellAfter: "PT2H",
  mode: "truck",
};
const ZONES = ["America/Los_Angeles", "Asia/Tokyo"];

const render = (n = 1, hidden = false, leg = LEG) =>
  renderHtml(legFieldset({ id: idScope("t"), n, leg, hidden, zones: ZONES }));

describe("legFieldset", () => {
  it("is a group named by its header, holding the five fields", () => {
    render();
    const group = screen.getByRole("group", {
      name: "① Truck · PT46H → Los Angeles",
    });
    const view = within(group);
    expect(view.getByRole("combobox", { name: "Mode (optional)" })).toHaveValue(
      "truck",
    );
    expect(view.getByRole("textbox", { name: "Duration" })).toHaveValue(
      "PT46H",
    );
    expect(view.getByRole("combobox", { name: "Arrives in" })).toHaveValue(
      "America/Los_Angeles",
    );
    expect(view.getByRole("textbox", { name: "Departs" })).toHaveValue(
      "2024-06-10T08:00:00",
    );
    expect(
      view.getByRole("textbox", { name: "Handling after (optional)" }),
    ).toHaveValue("PT2H");
  });

  it("calls the departure of a later leg scheduled and optional", () => {
    render(2);
    expect(
      screen.getByRole("textbox", { name: "Scheduled departure (optional)" }),
    ).toBeInTheDocument();
  });

  it("leaves a hidden leg out of the page", () => {
    render(4, true);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("keeps a mode and a zone the lists lack", () => {
    render(1, false, {
      ...LEG,
      mode: "hovercraft",
      timeZone: "Pacific/Chatham",
    });
    expect(
      screen.getByRole("combobox", { name: "Mode (optional)" }),
    ).toHaveValue("hovercraft");
    expect(screen.getByRole("combobox", { name: "Arrives in" })).toHaveValue(
      "Pacific/Chatham",
    );
  });

  it("takes a typed duration", async () => {
    const user = userEvent.setup();
    const { host } = render();
    const duration = screen.getByRole("textbox", { name: "Duration" });
    await user.clear(duration);
    await user.type(duration, "P3D");
    expect(duration).toHaveValue("P3D");
    await expectNoAxeViolations(host);
  });
});

describe("legHeader and the choices", () => {
  it("reads Leg for a fresh leg", () => {
    const { host } = renderHtml(
      legHeader(2, { mode: "", duration: "", timeZone: "" }),
    );
    expect(host).toHaveTextContent("② Leg");
    expect(host).not.toHaveTextContent("·");
  });

  it("lists a custom mode and zone after the known ones", () => {
    expect(modeChoices("")[0]).toEqual({ value: "", label: "(none)" });
    expect(modeChoices("hovercraft").at(-1)).toEqual({
      value: "hovercraft",
      label: "Hovercraft",
    });
    expect(
      zoneChoices(ZONES, "Europe/Rome", "(none)").map((o) => o.value),
    ).toEqual(["", ...ZONES, "Europe/Rome"]);
  });

  it("adds an option when a value is set that the select lacks", () => {
    const { host } = render();
    const mode = within(host).getByRole("combobox", {
      name: "Mode (optional)",
    });
    setChoice(mode as HTMLSelectElement, "barge2");
    expect(mode).toHaveValue("barge2");
    setChoice(mode as HTMLSelectElement, "");
    expect(mode).toHaveValue("");
  });
});
