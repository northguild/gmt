/**
 * Turning the MDX pages' JSX into the plain Markdown the text surfaces need.
 *
 * `.md`, `llms.txt`, `llms-full.txt` and the retrieval chunks are all built from the raw `.mdx`
 * source, so anything Astro would have evaluated is still JSX when they are written. Dropping it
 * would lose real content — the mistake cards alone carry most of the wrong/right code samples —
 * so each component is rendered to its Markdown equivalent instead, and only the layout and chart
 * wrappers, which hold no prose of their own, are unwrapped or dropped.
 *
 * Kept free of Astro globals so vitest can import it directly.
 */

/** A parsed JSX element: the props it was given, and the span it occupied. */
interface JsxElement {
  readonly props: Record<string, string>;
  readonly start: number;
  readonly end: number;
}

/**
 * Read `name="value"` and ``name={`value`}`` props out of a JSX open tag.
 *
 * Template-literal props hold multi-line code samples, so the scan tracks brace depth and
 * backticks rather than matching line by line.
 */
function parseProps(source: string): Record<string, string> {
  const props: Record<string, string> = {};
  const attribute = /([A-Za-z_][\w-]*)\s*=\s*/g;
  let match: RegExpExecArray | null;

  while ((match = attribute.exec(source)) !== null) {
    const name = match[1];
    let index = match.index + match[0].length;
    const opener = source[index];

    if (opener === '"' || opener === "'") {
      const close = source.indexOf(opener, index + 1);
      if (close === -1) break;
      props[name] = source.slice(index + 1, close);
      attribute.lastIndex = close + 1;
      continue;
    }

    if (opener !== "{") continue;

    // Walk to the matching `}`, ignoring braces inside backticks and strings.
    let depth = 0;
    let inBacktick = false;
    let quote = "";
    for (; index < source.length; index += 1) {
      const char = source[index];
      const escaped = index > 0 && source[index - 1] === "\\";
      if (escaped) continue;
      if (quote) {
        if (char === quote) quote = "";
        continue;
      }
      if (inBacktick) {
        if (char === "`") inBacktick = false;
        continue;
      }
      if (char === "`") {
        inBacktick = true;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    const inner = source.slice(match.index + match[0].length + 1, index).trim();
    props[name] =
      inner.startsWith("`") && inner.endsWith("`") ? inner.slice(1, -1) : inner;
    attribute.lastIndex = index + 1;
  }

  return props;
}

/** Every `<Name … />` or `<Name …>…</Name>` element in `body`, outermost first. */
function findElements(body: string, name: string): JsxElement[] {
  const found: JsxElement[] = [];
  const open = new RegExp(`<${name}(\\s|/|>)`, "g");
  let match: RegExpExecArray | null;

  while ((match = open.exec(body)) !== null) {
    const start = match.index;
    let index = start;
    let inBacktick = false;
    let quote = "";

    // Find the end of the open tag, then the element's end.
    for (; index < body.length; index += 1) {
      const char = body[index];
      if (body[index - 1] === "\\") continue;
      if (quote) {
        if (char === quote) quote = "";
        continue;
      }
      if (inBacktick) {
        if (char === "`") inBacktick = false;
        continue;
      }
      if (char === "`") inBacktick = true;
      else if (char === '"' || char === "'") quote = char;
      else if (char === ">") break;
    }

    const openTag = body.slice(start, index + 1);
    const selfClosing = openTag.trimEnd().endsWith("/>");
    const close = selfClosing ? index + 1 : body.indexOf(`</${name}>`, index);
    const end = selfClosing ? index + 1 : close + `</${name}>`.length;

    found.push({
      props: parseProps(openTag),
      start,
      end: close === -1 ? index + 1 : end,
    });
    open.lastIndex = end;
  }

  return found;
}

/** Replace every `<Name …>` element with whatever `render` makes of its props and children. */
function replaceElements(
  body: string,
  name: string,
  render: (props: Record<string, string>, children: string) => string,
): string {
  const elements = findElements(body, name);
  let out = "";
  let cursor = 0;

  for (const element of elements) {
    const slice = body.slice(element.start, element.end);
    const inner = slice.match(
      new RegExp(`^<${name}[\\s\\S]*?>([\\s\\S]*)</${name}>$`),
    );
    out += body.slice(cursor, element.start);
    out += render(element.props, inner ? inner[1] : "");
    cursor = element.end;
  }

  return out + body.slice(cursor);
}

const fence = (code: string): string =>
  code.trim() ? `\n\`\`\`js\n${code.trim()}\n\`\`\`\n` : "";

/** `<Mistake>` → heading, description, and the wrong and right samples as code blocks. */
function renderMistake(props: Record<string, string>): string {
  const parts = [`### ${props.title ?? "Mistake"}`];
  if (props.severity) parts.push(`Severity: ${props.severity}.`);
  if (props.description) parts.push(props.description);
  if (props.wrongCode) parts.push(`Wrong:${fence(props.wrongCode)}`);
  if (props.rightCode) parts.push(`Right:${fence(props.rightCode)}`);
  return `\n${parts.join("\n\n")}\n`;
}

/** `<Scenario>` → heading, the naive attempt, why it breaks, and the GMT version. */
function renderScenario(props: Record<string, string>): string {
  const parts = [`### ${props.title ?? "Scenario"}`];
  if (props.description) parts.push(props.description);
  if (props.naiveCode)
    parts.push(`The usual approach:${fence(props.naiveCode)}`);
  if (props.explanation) parts.push(props.explanation);
  if (props.gmtCode) parts.push(`With GMT:${fence(props.gmtCode)}`);
  return `\n${parts.join("\n\n")}\n`;
}

/**
 * Render the components that carry prose, and unwrap the ones that don't.
 *
 * `ChartContainer` and `TimezoneMap` draw an SVG from data that is already stated in the
 * surrounding text, and `UpstreamTracker` renders a table the `/upstream/` page's own prose
 * summarises, so their tags go and their captions stay.
 */
export function renderMdxComponents(body: string): string {
  let out = body;

  out = replaceElements(out, "Mistake", renderMistake);
  out = replaceElements(out, "Scenario", renderScenario);

  for (const wrapper of ["GridSection", "ChartContainer", "CardGrid", "Card"]) {
    out = replaceElements(out, wrapper, (props, children) => {
      const caption = [props.title, props.caption].filter(Boolean).join(" — ");
      return `${caption ? `\n**${caption}**\n` : ""}${children}`;
    });
  }

  for (const dropped of ["TimezoneMap", "UpstreamTracker", "PlaygroundForm"]) {
    out = replaceElements(out, dropped, (props) =>
      props.caption ? `\n${props.caption}\n` : "",
    );
  }

  return out;
}
