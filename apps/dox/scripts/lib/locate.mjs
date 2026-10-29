/**
 * How a gate finds things on a Dox page, without naming a style class or a role attribute.
 *
 * - The widget: `widgetRoot(slug)`, the `data-widget` every mount gives its root.
 * - A control: `control(page, root, { role, name })`, the control a reader or a screen reader
 *   finds, by its ARIA role and its exact accessible name, inside the widget root. A hidden
 *   control does not match, which is what "not shown in this preset" means.
 * - A structural part that has no role or name (a chart frame, a drawn region the readout
 *   comparison skips, the track a handle runs along): `gate(...parts)`, the `data-gate` hook the
 *   mount puts on it. The parts and why each exists are listed in
 *   `context/dox/specs/gate-stability/03-locators.md`.
 *
 * A class name is a style detail; the component kit renames it, and the gate must not notice.
 */

import { locatorCountProblem } from "../gate-checks.mjs";

/** `[data-widget="slug"]`: the root of one widget. */
export const widgetRoot = (slug) => `[data-widget="${slug}"]`;

/** A selector for any of the named `data-gate` parts. */
export const gate = (...parts) =>
  parts.map((part) => `[data-gate~="${part}"]`).join(", ");

/**
 * A Playwright locator for one control of a widget, by role and exact accessible name. `nth` picks
 * one of several controls that share a name (the X12 reader has two selects named "Preset").
 */
export function control(page, root, { role, name, nth }) {
  const found = page.locator(root).getByRole(role, { name, exact: true });
  return nth === undefined ? found : found.nth(nth);
}

/** A short readable label for a control, for logs and finding ids. */
export const controlLabel = ({ role, name }) => `${role} "${name}"`;

/**
 * The misses a page has against a list of asks, for a gate's `--resolve-only`. An ask is
 * `{ name, sel | loc, min, max }`: a CSS selector or a Playwright locator, and how many matches
 * it must have: exactly one by default, `min` alone means "at least that many", `min` and `max`
 * together a range.
 */
export async function resolveMisses(page, asks) {
  const miss = [];
  for (const ask of asks) {
    const problem = locatorCountProblem(
      ask.name,
      await (ask.loc ?? page.locator(ask.sel)).count(),
      ask.min !== undefined && ask.max === undefined
        ? { ...ask, max: Number.POSITIVE_INFINITY }
        : ask,
    );
    if (problem) miss.push(problem);
  }
  return miss;
}

/**
 * The preset select of a tool page: the first native select (a combobox by role) inside a widget
 * root; a text field with a list is also a combobox and has no options to fill. Every tool puts its
 * preset select first, ahead of the inputs it fills, and a tool's accessible name for it varies
 * ("Preset", "Try", "Locale"), so the page-wide gates that sweep every tool ask by role and
 * position, not by name.
 */
export const presetSelect = (page) =>
  page
    .locator("[data-widget]")
    .getByRole("combobox")
    .and(page.locator("select"))
    .first();
