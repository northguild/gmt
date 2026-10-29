/**
 * The one way a widget makes markup: an `html` tagged template that returns
 * `SafeHtml`.
 *
 * Every interpolation that is not already `SafeHtml` is escaped, in text and in
 * quoted attributes alike, so a value a model chose or a permalink carried can
 * never end an attribute or open a tag. Arrays are joined. `null`, `undefined`
 * and `false` print nothing, which lets `${cond && html\`…\`}` work. `true` is not a
 * value: `HtmlValue` rejects it and `render` throws on it, so a bare flag cannot print as
 * nothing. Write `String(flag)` for an attribute.
 *
 * Builders stay pure string functions: Astro shells render them on the server
 * through `<Fragment set:html>`, and `MountedWidget.tsx` sets `innerHTML`.
 * `setHtml` is the one runtime `innerHTML` assignment a mount may make, so a
 * redraw can only write builder output. Attributes must be quoted.
 */

declare const safeHtmlBrand: unique symbol;

/** Markup that is safe to write as it stands. Make one with `html` or `raw`. */
export class SafeHtml {
  declare readonly [safeHtmlBrand]: true;
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString(): string {
    return this.value;
  }
}

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

/** Escape text for use between tags. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"'`]/g, (ch) => ESCAPES[ch]!);
}

/** Escape a value for a quoted attribute. The same set as `escapeHtml`. */
export function escapeAttr(text: string): string {
  return escapeHtml(text);
}

export type HtmlValue =
  | SafeHtml
  | string
  | number
  | false
  | null
  | undefined
  | readonly HtmlValue[];

function render(value: HtmlValue): string {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value))
    return (value as readonly HtmlValue[]).map(render).join("");
  if (value === (true as unknown)) {
    throw new TypeError(
      "html does not take `true`: interpolate String(flag) for an attribute",
    );
  }
  if (value === null || value === undefined || value === false) return "";
  return escapeHtml(String(value));
}

export function html(
  strings: TemplateStringsArray,
  ...values: readonly HtmlValue[]
): SafeHtml {
  let out = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) {
    out += render(values[i]!) + (strings[i + 1] ?? "");
  }
  return new SafeHtml(out);
}

/** Trust a string the author wrote (an SVG path, a constant). Never user data. */
export function raw(markup: string): SafeHtml {
  return new SafeHtml(markup);
}

/** The one runtime `innerHTML` write a mount may make. */
export function setHtml(el: Element, value: SafeHtml): void {
  if (!(value instanceof SafeHtml)) {
    throw new TypeError("setHtml takes SafeHtml from a builder");
  }
  el.innerHTML = value.value;
}
