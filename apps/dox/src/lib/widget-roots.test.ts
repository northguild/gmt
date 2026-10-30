// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { WIDGET_REGISTRY } from "~/components/ask/widget-registry";
import { renderHtml } from "~/widgets/test-fixture";

/**
 * Every widget the chat rail can mount draws one root: a region with an accessible name and
 * a `data-widget` slug. The gates find a widget by that slug and the finding key
 * (`widget:<slug> › …`) reads it, so a root without it is invisible to both.
 */
const entries = Object.entries(WIDGET_REGISTRY);

async function rootOf(name: string): Promise<HTMLElement> {
  const loaded =
    await WIDGET_REGISTRY[name as keyof typeof WIDGET_REGISTRY]!.load();
  const markup = loaded.renderTemplate(`probe-${name}`, {} as never);
  renderHtml(markup);
  // An inner `<section aria-labelledby>` is a region too. The root is the outermost one.
  return screen.getAllByRole("region")[0]!;
}

describe("widget roots", () => {
  it.each(entries.map(([name]) => name))(
    "%s draws a named region with a slug",
    async (name) => {
      const root = await rootOf(name);
      expect(root).toHaveAccessibleName();
      expect(root.dataset.widget).toBeTruthy();
    },
  );
});
