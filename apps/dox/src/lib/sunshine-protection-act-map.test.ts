/**
 * @vitest-environment jsdom
 *
 * The drawn maps of the Sunshine Protection Act page: the inset frames on both views, and the
 * Navajo Nation's hatch on Proposals. The boundary files are the real ones the page serves.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { installJsdomShims } from "~/test/jsdom-shims";
import { setHtml, type SafeHtml } from "~/widgets/builders";
import { computeSunshineActZones } from "../../worker/sunshine-protection-act";
import {
  hatchedParts,
  insetFrames,
  mapSvg,
  shapeOutline,
} from "~/test/us-map-parts";
import { PROPOSALS_CHECKED } from "../data/sunshine-protection-act-proposals";
import {
  mountSunshineProtectionAct,
  renderSunshineProtectionActTemplate,
} from "./sunshine-protection-act-mount";

installJsdomShims();

const controllers: AbortController[] = [];
const roots: HTMLElement[] = [];

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.abort();
  for (const root of roots.splice(0)) root.remove();
});

const publicFile = (name: string): string =>
  readFileSync(resolve(import.meta.dirname, "../../public", name), "utf8");

const serving = (): typeof fetch =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("state-boundaries-us"))
      return new Response(publicFile("state-boundaries-us.json"));
    if (url.includes("timezone-boundaries-us"))
      return new Response(publicFile("timezone-boundaries-us.json"));
    return Response.json(computeSunshineActZones("2026-11-13T12:00:00Z"));
  }) as never;

async function mountWide() {
  const root = document.createElement("div");
  document.body.append(root);
  roots.push(root);
  setHtml(root, renderSunshineProtectionActTemplate() as SafeHtml);
  const controller = new AbortController();
  controllers.push(controller);
  const handle = await mountSunshineProtectionAct(
    root,
    controller.signal,
    { kind: "proposals" },
    {
      fetch: serving(),
      measure: () => 900,
      today: async () => PROPOSALS_CHECKED,
    },
  );
  await handle.ready;
  return { root, handle, user: userEvent.setup() };
}

describe("the Sunshine Protection Act maps", () => {
  it("outlines each inset in a frame, on both views, and no frame takes focus", async () => {
    const { root, user } = await mountWide();
    for (const scope of ["sunshine-proposals", "sunshine-today"]) {
      if (scope === "sunshine-today")
        await user.click(screen.getByRole("radio", { name: "Today" }));
      await vi.waitFor(() => expect(mapSvg(root, scope)).not.toBeNull());
      const frames = insetFrames(mapSvg(root, scope)!);
      // Alaska, Hawaii, Puerto Rico and the Virgin Islands, the Marianas and Samoa.
      expect(frames).toHaveLength(5);
      for (const frame of frames) {
        expect(frame).toHaveAttribute("aria-hidden", "true");
        expect(frame).not.toHaveAttribute("tabindex");
        expect(frame).not.toHaveAttribute("role");
      }
    }
  });

  it("paints the Navajo Nation inside Arizona only, out of reach of assistive technology", async () => {
    const { root } = await mountWide();
    const svg = mapSvg(root, "sunshine-proposals")!;
    const parts = hatchedParts(svg);
    expect(parts).toHaveLength(1);
    const { hatch, clipD } = parts[0]!;
    expect(hatch).toHaveAttribute("aria-hidden", "true");
    expect(hatch).not.toHaveAttribute("tabindex");
    // It is clipped to Arizona's own outline, so no part of it lies outside the state.
    expect(clipD).toBe(shapeOutline(svg, "Arizona"));
    expect(clipD).not.toBeNull();
  });

  it("names the Navajo Nation in Arizona's legend and pin", async () => {
    const { root, handle } = await mountWide();
    expect(
      within(root).getByText("Navajo Nation, in Arizona: keeps daylight time"),
    ).toBeVisible();
    handle.pin("AZ");
    expect(
      await within(root).findAllByText(
        /The Navajo Nation, in the north-east, keeps daylight time/,
      ),
    ).not.toHaveLength(0);
  });
});
