// @vitest-environment jsdom
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { gnssRing, type GnssRingOptions } from "./gnss-ring";

const lap = (label: string, chosen: boolean) => ({
  label,
  pin: 24.1,
  today: chosen ? 40 : null,
  chosen,
  gap: false,
});

const live: GnssRingOptions = {
  modulus: 1024,
  state: "live",
  laps: [lap("era 0", false), lap("era 1", false), lap("era 2", true)],
  hand: 24.1,
  cap: "era 2",
  week: "247",
  sub: "of 1024",
};

const text = (host: HTMLElement) =>
  [...host.querySelectorAll("text")].map((t) => t.textContent);

describe("gnssRing", () => {
  it("is decoration: hidden from assistive technology, since the lane sentences say the same", () => {
    const { host } = renderHtml(gnssRing(live));
    expect(host.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("labels the ticks by dividing the modulus, and writes the hub and each lap's era", () => {
    const { host } = renderHtml(gnssRing(live));
    expect(text(host)).toEqual(
      expect.arrayContaining([
        "0",
        "128",
        "896",
        "era 0",
        "era 2",
        "247",
        "of 1024",
      ]),
    );
    const eight = renderHtml(gnssRing({ ...live, modulus: 8192 }));
    expect(text(eight.host).slice(0, 8)).toEqual([
      "0",
      "1024",
      "2048",
      "3072",
      "4096",
      "5120",
      "6144",
      "7168",
    ]);
  });

  it("draws one lap for each era, and a hand only when it has a place", () => {
    const { host } = renderHtml(gnssRing(live));
    expect(host.querySelectorAll("circle[pathLength]")).toHaveLength(3);
    expect(host.querySelectorAll("g[style] line").length).toBeGreaterThan(0);
    const none = renderHtml(gnssRing({ ...live, hand: null, laps: [] }));
    expect(none.host.querySelectorAll("circle[pathLength]")).toHaveLength(0);
  });

  it("writes the signal-lost words in the hub, not a blank", () => {
    const { host } = renderHtml(
      gnssRing({
        ...live,
        state: "lost",
        hand: null,
        laps: [
          { label: null, pin: null, today: null, chosen: false, gap: false },
        ],
        cap: "⟨ NO SIGNAL ⟩",
        week: " ",
        sub: " ",
      }),
    );
    expect(host).toHaveTextContent("⟨ NO SIGNAL ⟩");
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(gnssRing(live));
    await expectNoAxeViolations(host);
  });
});
