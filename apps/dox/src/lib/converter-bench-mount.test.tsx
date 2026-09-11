/**
 * @vitest-environment jsdom
 *
 * The first Tier 2 widget driven end to end in a test: template → mount →
 * interact → assert, against the real `@northguild/gmt`.
 *
 * `apps/dox` had no DOM-testing pattern before DOX-C3b — the widget tests here
 * all covered pure logic modules, and the `.astro` scripts that wired them to
 * the page were reachable by nothing. Extracting `mount(root)` is what makes
 * this possible, and this file is the pattern the two harder widgets follow.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  mountConverterBench,
  renderConverterTemplate,
} from "./converter-bench-mount";

installJsdomShims();

/** Roles the mount looks up. Every lookup is a null-tolerant `querySelector`,
 *  so a missing role does not throw — it silently makes a control inert, which
 *  is exactly the failure a test has to catch instead. */
const REQUIRED_ROLES = [
  "convert-value",
  "convert-source",
  "convert-target",
  "convert-result",
  "format-value",
  "format-locale",
  "format-parts",
  "format-relative",
  "call-format-parts",
  "call-format-relative",
  "regex-input",
  "regex-results",
];

function mountInto(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderConverterTemplate(args);
  document.body.append(root);
  return { root, controller: new AbortController() };
}

const q = (root: HTMLElement, role: string) =>
  root.querySelector(`[data-role="${role}"]`);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderConverterTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderConverterTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(q(root, role), `missing [data-role="${role}"]`).not.toBeNull();
    }
  });

  it("marks exactly one option selected per select", () => {
    const root = document.createElement("div");
    root.innerHTML = renderConverterTemplate();
    for (const role of ["convert-source", "convert-target", "format-locale"]) {
      const select = q(root, role) as HTMLSelectElement;
      expect(select.querySelectorAll("option[selected]")).toHaveLength(1);
    }
  });

  it("paints seeded arguments rather than defaults", () => {
    // A seeded widget must not flash defaults and correct itself, which is why
    // the template takes args at all.
    const root = document.createElement("div");
    root.innerHTML = renderConverterTemplate({
      from: "Asia/Tokyo",
      to: "Europe/Paris",
      locale: "fr-FR",
    });
    expect((q(root, "convert-source") as HTMLSelectElement).value).toBe(
      "Asia/Tokyo",
    );
    expect((q(root, "convert-target") as HTMLSelectElement).value).toBe(
      "Europe/Paris",
    );
    expect((q(root, "format-locale") as HTMLSelectElement).value).toBe("fr-FR");
  });

  it("appends a seeded zone the curated list does not contain", () => {
    // Otherwise a valid but unusual zone would silently fall back to the first
    // option, and the widget would answer a different question than was asked.
    const root = document.createElement("div");
    root.innerHTML = renderConverterTemplate({ to: "Pacific/Chatham" });
    expect((q(root, "convert-target") as HTMLSelectElement).value).toBe(
      "Pacific/Chatham",
    );
  });
});

describe("mountConverterBench", () => {
  it("converts on mount, into the real library", async () => {
    const { root, controller } = mountInto();
    await mountConverterBench(root, {}, controller.signal);

    const out = q(root, "convert-result") as HTMLElement;
    // Default input is 14:30 New York; London is four hours ahead in March.
    expect(out.textContent).toContain("18:30");
    expect(out.textContent).toContain("Europe/London");
  });

  it("reconverts when the target zone changes", async () => {
    const { root, controller } = mountInto();
    await mountConverterBench(root, {}, controller.signal);

    const target = q(root, "convert-target") as HTMLSelectElement;
    target.value = "Asia/Tokyo";
    target.dispatchEvent(new Event("change", { bubbles: true }));

    const out = q(root, "convert-result") as HTMLElement;
    expect(out.textContent).toContain("Asia/Tokyo");
  });

  it("writes the live call line the copy button copies", async () => {
    const { root, controller } = mountInto();
    await mountConverterBench(root, {}, controller.signal);

    const call = q(root, "call-format-parts") as HTMLElement;
    expect(call.textContent).toContain("formatZonedToParts");
  });

  it("renders a regex chip per exported pattern, marking matches", async () => {
    const { root, controller } = mountInto();
    await mountConverterBench(root, {}, controller.signal);

    const chips = (q(root, "regex-results") as HTMLElement).querySelectorAll(
      ".gmt-converter-chip",
    );
    expect(chips.length).toBeGreaterThan(10);
    expect(
      (q(root, "regex-results") as HTMLElement).querySelectorAll(
        ".gmt-converter-chip--match",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("re-tests the regexes as the input changes", async () => {
    const { root, controller } = mountInto();
    await mountConverterBench(root, {}, controller.signal);

    const results = q(root, "regex-results") as HTMLElement;
    const before = results.querySelectorAll(
      ".gmt-converter-chip--match",
    ).length;

    const input = q(root, "regex-input") as HTMLInputElement;
    input.value = "not a date at all";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(
      results.querySelectorAll(".gmt-converter-chip--match").length,
    ).toBeLessThan(before);
  });

  it("reports its live state for a permalink, not the seeded state", async () => {
    const { root, controller } = mountInto();
    const handle = await mountConverterBench(root, {}, controller.signal);

    const target = q(root, "convert-target") as HTMLSelectElement;
    target.value = "Asia/Tokyo";
    target.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handle.getPermalinkState?.()).toMatchObject({ to: "Asia/Tokyo" });
  });

  it("returns an inert handle when the mount is already aborted", async () => {
    const { root, controller } = mountInto();
    controller.abort();
    const handle = await mountConverterBench(root, {}, controller.signal);
    expect(() => handle.destroy()).not.toThrow();
  });

  it("survives destroy being called twice", async () => {
    const { root, controller } = mountInto();
    const handle = await mountConverterBench(root, {}, controller.signal);
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});

/**
 * Escaping at the template boundary.
 *
 * Until DOX-C3b these widgets were `.astro` templates and **Astro escaped every
 * interpolation**. A hand-written template string does not, and the values
 * flowing in now are the least trustworthy these widgets have ever seen: chosen
 * by a language model, or decoded from a URL a reader was handed by someone
 * else. `escapeHtml` alone is not enough — it leaves quotes alone, and every
 * one of these values lands in an HTML attribute.
 */
describe("template escaping", () => {
  it("neutralises a quote that would otherwise close an attribute", () => {
    const root = document.createElement("div");
    root.innerHTML = renderConverterTemplate({
      value: `" autofocus onfocus="alert(1)`,
    });

    const input = root.querySelector(
      '[data-role="convert-value"]',
    ) as HTMLInputElement;
    // The payload survives as text *in the value*, and nothing became an
    // attribute of its own.
    expect(input.getAttribute("value")).toBe(`" autofocus onfocus="alert(1)`);
    expect(input.hasAttribute("onfocus")).toBe(false);
    expect(input.hasAttribute("autofocus")).toBe(false);
  });

  it("neutralises a tag injected through a zone name", () => {
    const root = document.createElement("div");
    root.innerHTML = renderConverterTemplate({
      to: `<script>alert(1)</script>`,
    });
    expect(root.querySelector("script")).toBeNull();
  });

  it("leaves ordinary values untouched", () => {
    const root = document.createElement("div");
    root.innerHTML = renderConverterTemplate({ to: "Asia/Tokyo" });
    expect(
      (root.querySelector('[data-role="convert-target"]') as HTMLSelectElement)
        .value,
    ).toBe("Asia/Tokyo");
  });
});
