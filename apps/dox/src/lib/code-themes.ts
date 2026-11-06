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

const TOKENS_CSS = new URL("../styles/gmt-tokens.css", import.meta.url);

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

/** Each role's hex value in the dark and the light theme. */
export function syntaxPalette(
  css = readFileSync(TOKENS_CSS, "utf8"),
): Record<"dark" | "light", Record<Role, string>> {
  const dark = declarations(blockAt(css, ":root,\n"));
  // The light block sits on the same element as `:root`, so it overrides and the rest inherits.
  const light = new Map([
    ...dark,
    ...declarations(blockAt(css, '\n[data-theme="light"] {')),
  ]);
  const pick = (vars: Map<string, string>) =>
    Object.fromEntries(
      ROLES.map((r) => [r, resolve(vars, `--gmt-syntax-${r}`)]),
    ) as Record<Role, string>;
  return { dark: pick(dark), light: pick(light) };
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
