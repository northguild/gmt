import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { distDirOrSkip as distRootOrSkip } from "./dist-dir";

/**
 * No built `<select>` offers an option twice (DOX-G7).
 *
 * A select that lists `years` and `year`, or one value under two labels, makes a reader choose
 * between two names for one thing. This reads every built page, tool pages and playgrounds alike,
 * and fails naming the page, the select and the repeated value or label.
 *
 * Needs a build; the dist test returns early without one and throws under `DOX_DIST_REQUIRED`.
 */

/** The built pages: `dist/gmt`, or null without a build. */
function distDirOrSkip(): string | null {
  const root = distRootOrSkip();
  return root === null ? null : resolve(root, "gmt");
}

function htmlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) found.push(...htmlFiles(full));
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

const decode = (text: string): string =>
  text
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

function attr(tag: string, name: string): string | undefined {
  const match = new RegExp(
    `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  ).exec(tag);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value === undefined ? undefined : decode(value);
}

/** Each repeated option of each `<select>` in `html`, as `select: value "x"` lines. */
function repeatedOptions(html: string): string[] {
  const failures: string[] = [];
  const selects = html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi);
  let n = 0;
  for (const [, open, body] of selects) {
    n += 1;
    const name =
      attr(open, "aria-label") ??
      attr(open, "name") ??
      attr(open, "id") ??
      `#${n}`;
    const values = new Set<string>();
    const labels = new Set<string>();
    for (const [, tag, inner] of body.matchAll(
      /<option\b([^>]*)>([\s\S]*?)(?:<\/option>|(?=<option\b)|$)/gi,
    )) {
      const label = decode(inner);
      const value = attr(tag, "value") ?? label;
      if (values.has(value)) failures.push(`${name}: value "${value}"`);
      if (labels.has(label)) failures.push(`${name}: label "${label}"`);
      values.add(value);
      labels.add(label);
    }
  }
  return failures;
}

describe("repeatedOptions", () => {
  const page = (...options: string[]) =>
    `<select aria-label="unit">${options.join("")}</select>`;

  it("passes a select whose options are all different", () => {
    expect(
      repeatedOptions(
        page('<option value="year">year</option>', "<option>month</option>"),
      ),
    ).toEqual([]);
  });
  it("names a repeated value and a repeated label", () => {
    expect(
      repeatedOptions(
        page(
          '<option value="a">One</option>',
          '<option value="a">Two</option>',
          '<option value="b">One</option>',
        ),
      ),
    ).toEqual(['unit: value "a"', 'unit: label "One"']);
  });
  it("checks each select on its own", () => {
    expect(
      repeatedOptions(
        `${page("<option>day</option>")}${page("<option>day</option>")}`,
      ),
    ).toEqual([]);
  });
});

describe("options of the built site", () => {
  it("repeats no value or label inside any select", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const failures: string[] = [];
    for (const path of htmlFiles(dist)) {
      for (const failure of repeatedOptions(readFileSync(path, "utf8"))) {
        failures.push(`${relative(dist, path)} ${failure}`);
      }
    }
    const shown = failures.slice(0, 15).join("\n  ");
    const more =
      failures.length > 15 ? `\n  ... and ${failures.length - 15} more` : "";
    expect(
      failures,
      `${failures.length} failure(s):\n  ${shown}${more}`,
    ).toEqual([]);
  });
});
