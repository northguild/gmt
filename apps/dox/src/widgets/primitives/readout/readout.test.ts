// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations, setRange } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { range } from "../range/range";
import { readout, SENTINEL_TEXT, type GmtReadout } from "./readout";

const pairUp = () =>
  html`${range({ id: "off", label: "Offset", min: 0, max: 10, step: 1, value: 1, valueText: "1" })}${readout({ label: "Local time", value: "09:00", samples: ["23:59:59"], announceOn: ["off"] })}`;

describe("the readout element", () => {
  it("shows its value in a named output", () => {
    renderHtml(pairUp());
    expect(
      screen.getByRole("status", { name: "Local time" }),
    ).toHaveTextContent("09:00");
  });

  it("announces on change and not on each input tick", () => {
    const fx = renderHtml(pairUp());
    const el = fx.element<GmtReadout>("readout");
    const slider = screen.getByRole("slider", { name: "Offset" });
    const announcer = screen.getByRole("status", {
      name: "Local time (announcement)",
    });
    // The mount's own input handler writes the value as the reader drags.
    fx.host.addEventListener("input", () => {
      el.value = `0${Number((slider as HTMLInputElement).value)}:00`;
    });
    setRange(slider, 4);
    expect(
      screen.getByRole("status", { name: "Local time" }),
    ).toHaveTextContent("04:00");
    // setRange fires input then change, so the settled value was announced once.
    expect(announcer).toHaveTextContent("04:00");
  });

  it("stays silent while only input ticks arrive", () => {
    const fx = renderHtml(pairUp());
    const el = fx.element<GmtReadout>("readout");
    el.value = "10:00";
    expect(
      screen.getByRole("status", { name: "Local time (announcement)" }),
    ).toBeEmptyDOMElement();
  });

  it("shows the sentinel for an empty value, and not for a legitimate empty result", () => {
    const fx = renderHtml(
      readout({ label: "Overlap", value: "x", samples: ["12:00 to 13:00"] }),
    );
    const el = fx.element<GmtReadout>("readout");
    const out = screen.getByRole("status", { name: "Overlap" });
    el.value = "";
    expect(out).toHaveTextContent(SENTINEL_TEXT);
    expect(el.state).toBe("sentinel");
    el.setEmpty("No overlap");
    expect(out).toHaveTextContent("No overlap");
    expect(out).not.toHaveTextContent("NO SIGNAL");
    expect(el.state).toBe("empty");
    el.value = "12:00 to 13:00";
    expect(el.state).toBe("live");
  });

  it("starts as the sentinel when built empty, and reserves the sentinel's width", () => {
    const markup = readout({
      label: "Local time",
      value: "",
      samples: ["23:59:59"],
    });
    renderHtml(markup);
    expect(
      screen.getByRole("status", { name: "Local time" }),
    ).toHaveTextContent(SENTINEL_TEXT);
    expect(markup.value.split(SENTINEL_TEXT).length).toBeGreaterThan(2);
  });

  it("escapes what it is given", () => {
    renderHtml(readout({ label: "<b>x</b>", value: "<i>1</i>", samples: [] }));
    expect(screen.getByRole("status", { name: "<b>x</b>" })).toHaveTextContent(
      "<i>1</i>",
    );
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(pairUp());
    await expectNoAxeViolations(fx.host);
  });
});
