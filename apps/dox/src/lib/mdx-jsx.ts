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
import { dateFaults } from "../data/date-faults";
import { libraryStack } from "../data/library-stack";
import {
  compatGroups,
  groupLabel,
  groupWhatBreaks,
} from "../data/temporal-compat";
import {
  filedByUs,
  filedPrs,
  filings,
  handledInGmt,
  unaffectingGmt,
} from "../data/upstream-filings";
import { contributionClause, coverageClause } from "./upstream-summary";

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

/** `<WhyDateBug />` as a Markdown table — the home page's case against `Date`. */
function renderWhyDateBug(): string {
  const rows = dateFaults.map(
    (f) => `| \`${f.input}\` | ${f.output} | ${f.why} |`,
  );
  return [
    "",
    "| You write | You get | Why |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/** `<WhyDateAlternatives />` as a Markdown table — what each layer is built on. */
function renderWhyDateAlternatives(): string {
  const rows = libraryStack.map(
    (l) => `| **${l.name}** | ${l.foundation} | ${l.detail} |`,
  );
  return [
    "",
    "| Layer | Built on | What it is |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/**
 * `<UpstreamDefects />` as a Markdown table.
 *
 * The page's whole argument is the table — which polyfill bugs GMT works around, and whether it
 * still has to. Passing the tag through shipped a page whose prose says "each row" and "the middle
 * column" over nothing at all, and left the Dox chat with no answer to "which Temporal bugs does
 * GMT work around" (CORE-8 review, #253). Same three columns as the HTML, same source data.
 */
function renderUpstreamDefects(): string {
  const shortRef = (repo: string, number: number): string =>
    `${repo === "tc39/proposal-temporal" ? "tc39" : "polyfill"} #${number}`;

  const rows = compatGroups.map((group) => {
    const sent = filings
      .filter((f) => f.gmtGuard && group.defects.includes(f.gmtGuard))
      .map(
        (f) => `[${shortRef(f.repo, f.number)}](${f.contributionUrl ?? f.url})`,
      )
      .join(", ");
    const state =
      group.failing > 0
        ? `Yes — ${group.failing} of ${group.probes} checks fail`
        : `No — ${group.probes} of ${group.probes} checks pass`;
    return `| **${groupLabel(group)}** — ${groupWhatBreaks(group)} | ${state} | ${sent || "—"} |`;
  });

  return [
    "",
    "| What GMT works around | Still needed? | What we sent |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/**
 * `<UpstreamTracker />` keeps only its tally sentence.
 *
 * The filings table itself is a link list the prose below it already walks through, but the
 * sentence counting what we sent is stated nowhere else, and dropping the whole component took it
 * with it (CORE-8 review, #253).
 */
function renderUpstreamTracker(): string {
  return `\n**So far we have sent ${filedByUs} reports and fixes to the Temporal projects, ${filedPrs} of them as ready-to-merge code changes${contributionClause}. ${coverageClause}: ${handledInGmt} through its own built-in fix, and ${unaffectingGmt} because the bug is in code GMT doesn't use.**\n`;
}

/**
 * Render the components that carry prose, and unwrap the ones that don't.
 *
 * `ChartContainer` and `TimezoneMap` draw an SVG from data that is already stated in the
 * surrounding text, so their tags go and their captions stay. A `<Fragment slot>` is a chart
 * view's own prose, so it unwraps to its text. `UpstreamTracker` used to be dropped
 * on the same reasoning, but the prose that summarised it moved into the component, so it now keeps
 * its tally sentence.
 *
 * Adding a component here is not optional: `llms.test.ts` fails on **any** capitalised tag left in
 * a built text surface, so an unhandled one is caught rather than shipped.
 */
export function renderMdxComponents(body: string): string {
  let out = body;

  out = replaceElements(out, "Mistake", renderMistake);
  out = replaceElements(out, "Scenario", renderScenario);

  for (const wrapper of [
    "GridSection",
    "ChartContainer",
    "Fragment",
    "CardGrid",
    "Card",
  ]) {
    out = replaceElements(out, wrapper, (props, children) => {
      const caption = [props.title, props.caption].filter(Boolean).join(" — ");
      return `${caption ? `\n**${caption}**\n` : ""}${children}`;
    });
  }

  out = replaceElements(out, "UpstreamDefects", renderUpstreamDefects);
  out = replaceElements(out, "UpstreamTracker", renderUpstreamTracker);

  // `SectionHeading` is an `<h2>` around its children, so it becomes one.
  out = replaceElements(
    out,
    "SectionHeading",
    (_props, children) => `\n## ${children.trim()}\n`,
  );

  // The home page's two argument cards hold real prose — the `Date` faults and the library
  // stack — so they render rather than drop. They were invisible to the old nine-name gate.
  out = replaceElements(out, "WhyDateBug", renderWhyDateBug);
  out = replaceElements(out, "WhyDateAlternatives", renderWhyDateAlternatives);

  // Decorative or interactive, with no prose of their own: a globe, a scroll animation, and the
  // three live widgets whose surrounding text already states what they demonstrate.
  for (const dropped of [
    "TimezoneMap",
    "PlaygroundForm",
    "HeroGlobe",
    "ScrollReveal",
    "IntervalVisualizer",
    "DstInspector",
    "ConverterBench",
  ]) {
    out = replaceElements(out, dropped, (props) =>
      props.caption ? `\n${props.caption}\n` : "",
    );
  }

  return out;
}
