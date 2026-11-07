/**
 * The code-block themes, built from the site's own palette.
 *
 * Expressive Code needs real colour values: it checks every token's contrast against the
 * background when the site builds, so a theme cannot point at a CSS variable. Instead this module
 * reads the `--gmt-syntax-*` roles from `gmt-tokens.css`, resolves each one to its hex value in
 * the dark and the light theme, and builds a VS Code theme for each. The tokens stay the one
 * source: change a role there and the code blocks and the widget call lines both follow.
 */
import { readFileSync } from "node:fs";

/** The token sheet the syntax roles are read from. */
export const TOKENS_CSS = new URL("../styles/gmt-tokens.css", import.meta.url);

/** The syntax roles `gmt-tokens.css` declares, without their `--gmt-syntax-` prefix. */
const ROLES = [
  "text",
  "comment",
  "punct",
  "keyword",
  "fn",
  "str",
  "num",
  "type",
] as const;
type Role = (typeof ROLES)[number];

/** TextMate scopes for each role. Later entries win, so the narrow scopes come last. */
const SCOPES: readonly { role: Role; scope: string[]; fontStyle?: string }[] = [
  {
    role: "punct",
    scope: [
      "punctuation",
      "meta.brace",
      "keyword.operator",
      "storage.type.function.arrow",
    ],
  },
  {
    role: "text",
    scope: [
      "variable",
      "variable.other.readwrite",
      "variable.parameter",
      "meta.object-literal.key",
      "support.type.property-name",
      "variable.other.property",
      "variable.other.object",
    ],
  },
  {
    role: "keyword",
    scope: [
      "keyword",
      "storage",
      "storage.type",
      "storage.modifier",
      "keyword.control",
      "keyword.operator.new",
      "keyword.operator.expression",
      "keyword.operator.typeof",
      "variable.language",
    ],
  },
  {
    role: "fn",
    scope: [
      "entity.name.function",
      "support.function",
      "meta.function-call entity.name.function",
      "variable.function",
    ],
  },
  {
    role: "type",
    scope: [
      "entity.name.type",
      "entity.name.class",
      "support.type",
      "support.class",
      "entity.other.inherited-class",
      "meta.type.annotation entity.name.type",
      "storage.type.primitive",
      "support.type.primitive",
    ],
  },
  {
    role: "str",
    scope: [
      "string",
      "string.quoted",
      "string.template",
      "punctuation.definition.string",
      "string.regexp",
    ],
  },
  {
    role: "num",
    scope: [
      "constant.numeric",
      "constant.language",
      "constant.language.boolean",
      "constant.other",
      "support.constant",
      "constant.character.escape",
    ],
  },
  {
    role: "comment",
    scope: ["comment", "punctuation.definition.comment"],
    fontStyle: "italic",
  },
];

/** Every `--name: value;` declaration in one block of CSS. */
function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  const code = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of code.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

/** The block of `css` that opens at `selector` and ends at the first closing brace on its own line. */
function blockAt(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1)
    throw new Error(`code-themes: no "${selector}" block in gmt-tokens.css`);
  const end = css.indexOf("\n}", start);
  return css.slice(start, end);
}

/** `name` resolved through `var()` aliases to a hex value, as the browser does on one element. */
function resolve(
  vars: Map<string, string>,
  name: string,
  seen = new Set<string>(),
): string {
  const value = vars.get(name);
  if (value === undefined)
    throw new Error(`code-themes: ${name} is not declared`);
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value;
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  if (alias === null || seen.has(name)) {
    throw new Error(
      `code-themes: ${name} is "${value}"; a syntax role must be a hex value or a var() of one`,
    );
  }
  seen.add(name);
  return resolve(vars, alias[1], seen);
}

/**
 * Each role's hex value in the dark and the light theme. Line endings are read as LF first, so a
 * checkout with `core.autocrlf` (CRLF) finds the same blocks.
 */
export function syntaxPalette(
  source = readFileSync(TOKENS_CSS, "utf8"),
): Record<"dark" | "light", Record<Role, string>> {
  const { dark, light } = modeVars(source);
  const pick = (vars: Map<string, string>) =>
    Object.fromEntries(
      ROLES.map((r) => [r, resolve(vars, `--gmt-syntax-${r}`)]),
    ) as Record<Role, string>;
  return { dark: pick(dark), light: pick(light) };
}

/** The two modes' declarations: light sits on the same element as `:root`, so it overrides the rest. */
function modeVars(
  source: string,
): Record<"dark" | "light", Map<string, string>> {
  const css = source.replace(/\r\n?/g, "\n");
  const dark = declarations(blockAt(css, ":root,\n"));
  const light = new Map([
    ...dark,
    ...declarations(blockAt(css, '\n[data-theme="light"] {')),
  ]);
  return { dark, light };
}

/** A hex colour as its red, green and blue channels. */
function channels(hex: string): [number, number, number] {
  const full =
    hex.length === 4
      ? `#${hex
          .slice(1)
          .split("")
          .map((c) => c + c)
          .join("")}`
      : hex;
  return [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/**
 * `name` as an opaque hex value drawn on the page background (`--gmt-void`). The token is a hex
 * value, a `var()` of one, or a see-through wash of one: `color(from var(--x) srgb r g b / N%)`.
 */
function painted(vars: Map<string, string>, name: string): string {
  const value = vars.get(name);
  const alias = value === undefined ? null : /^var\((--[\w-]+)\)$/.exec(value);
  if (alias !== null) return painted(vars, alias[1]);
  const wash =
    value === undefined
      ? null
      : /^color\(from var\((--[\w-]+)\) srgb r g b \/ ([\d.]+)%\)$/.exec(value);
  if (wash === null) return resolve(vars, name);
  const alpha = Number(wash[2]) / 100;
  const top = channels(resolve(vars, wash[1]));
  const page = channels(resolve(vars, "--gmt-void"));
  return `#${page
    .map((p, i) => Math.round(p + (top[i] - p) * alpha))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * The code block's background in each mode (`--gmt-code-surface` on the page). Every syntax role
 * is held to the 7:1 code-frame floor against it, in `code-themes.test.ts`.
 */
export function codeSurface(
  source = readFileSync(TOKENS_CSS, "utf8"),
): Record<"dark" | "light", string> {
  const { dark, light } = modeVars(source);
  return {
    dark: painted(dark, "--gmt-code-surface"),
    light: painted(light, "--gmt-code-surface"),
  };
}

/** A VS Code theme for one mode. Starlight replaces the frame colours with its own (`useStarlightUiThemeColors`). */
function theme(type: "dark" | "light", colors: Record<Role, string>) {
  return {
    name: `gmt-${type}`,
    type,
    colors: {
      "editor.foreground": colors.text,
    },
    tokenColors: [
      { settings: { foreground: colors.text } },
      ...SCOPES.map(({ role, scope, fontStyle }) => ({
        scope,
        settings: {
          foreground: colors[role],
          ...(fontStyle ? { fontStyle } : {}),
        },
      })),
    ],
  };
}

/** The dark and the light code-block theme, for Starlight's `expressiveCode.themes`. */
export function codeThemes() {
  const palette = syntaxPalette();
  return [theme("dark", palette.dark), theme("light", palette.light)];
}
