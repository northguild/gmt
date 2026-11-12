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
import { BUNDLE_COLUMNS, bundleCells, bundleRows } from "./bundle-size";
import { KEY_POINTS } from "../data/canada-key-points";
import { keyPointsMarkdown } from "../data/clock-change-text";
import { MOROCCO_KEY_POINTS } from "../data/morocco-key-points";
import { serversMarkdown } from "./canada-clock-change";
import { serversMarkdown as moroccoServersMarkdown } from "./morocco-clock-change";
import { dateFaults } from "../data/date-faults";
import { whyGmtFigures } from "./why-gmt-figures";
import { alternativesStack } from "../data/date-alternatives";
import {
  compatGroups,
  groupLabel,
  groupWhatBreaks,
  shortRef,
  stateLine,
} from "../data/temporal-compat";
import {
  filedByUs,
  filedPrs,
  filings,
  handledInGmt,
  listings,
  unaffectingGmt,
} from "../data/upstream-filings";
import {
  compareTables,
  notesMarkdown,
  tableMarkdown,
  type CompareTableId,
} from "./library-compare-tables";
import { LISTING_COLUMNS, listingStatus } from "./upstream-status";
import { asDate, contributionClause, coverageClause } from "./upstream-summary";
import {
  diffPairs,
  libraryProp,
  mapPairs,
  matrixView,
  temporalPairs,
  type CodePairView,
} from "./migrate-view";
import { VERDICT_LABEL } from "../data/behaviour-matrix";

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

/**
 * Remove the indentation every non-blank line shares. A wrapper's children are indented for the
 * author's sake; MDX ignores it, but Markdown reads four spaces after a blank line as code.
 */
function dedent(text: string): string {
  const indents = text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => /^[ \t]*/.exec(line)?.[0].length ?? 0);
  const common = indents.length > 0 ? Math.min(...indents) : 0;
  if (common === 0) return text;
  return text
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : line.slice(common)))
    .join("\n");
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

/** The `variant` prop of `<WhyDateBug>` and `<WhyDateAlternatives>`; anything but `home` is the full one. */
const isHome = (props: Record<string, string>): boolean =>
  props.variant === "home";

/**
 * `<WhyDateBug variant="…" />` as a Markdown table, as its page shows it: the landing page's short
 * list of input and output, or every fault with its reason under the component's own heading.
 */
function renderWhyDateBug(props: Record<string, string>): string {
  if (isHome(props)) {
    const rows = dateFaults
      .filter((f) => f.home)
      .map((f) => `| \`${f.input}\` | ${f.output} |`);
    return ["", "| You write | You get |", "| --- | --- |", ...rows, ""].join(
      "\n",
    );
  }
  const rows = dateFaults.map(
    (f) => `| \`${f.input}\` | ${f.output} | ${f.why} |`,
  );
  // The heading is the page's own `##` line, so it is not repeated here.
  return [
    "",
    "Almost every date/time bug in a JavaScript codebase traces back to one type. `Date` conflates an instant with a wall-clock reading, parses two ways depending on the string, and mutates in place.",
    "",
    "| You write | You get | Why |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/** `<WhyGmtFigures />` as a Markdown list: each headline figure with what it counts. */
function renderWhyGmtFigures(): string {
  return [
    "",
    ...whyGmtFigures.map((f) => `- **${f.value}** ${f.label}`),
    "",
  ].join("\n");
}

/**
 * `<WhyDateAlternatives variant="…" />` as a Markdown table: the landing page's name and
 * foundation per library, or the full list with what each one is.
 */
function renderWhyDateAlternatives(props: Record<string, string>): string {
  if (isHome(props)) {
    const rows = alternativesStack.map(
      (l) => `| **${l.name}** | ${l.foundation} |`,
    );
    return ["", "| Layer | Built on |", "| --- | --- |", ...rows, ""].join(
      "\n",
    );
  }
  const rows = alternativesStack.map(
    (l) => `| **${l.name}** | ${l.foundation} | ${l.detail} |`,
  );
  return [
    "",
    "## The alternatives inherit it, or deviate from the standard",
    "",
    "The popular libraries do not replace `Date`; they decorate it, so the faults come along — our gmt lint packages ban the Date wrappers below outright. The one library that fixes the model does it with a non-standard API you will migrate off. GMT is Temporal — the standard — with the ergonomics added on top.",
    "",
    "| Layer | Built on | What it is |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/** `<LibraryCompare table="…" />` as a Markdown table, or the notes list; see /compare. */
function renderLibraryCompare(props: Record<string, string>): string {
  if (props.table === "notes") return notesMarkdown();
  const build = compareTables[props.table as CompareTableId];
  if (!build) throw new Error(`LibraryCompare: unknown table "${props.table}"`);
  return tableMarkdown(build());
}

/**
 * Free text for one cell of a Markdown pipe table, so it reads the way the HTML page shows it.
 *
 * A backslash goes before each character Markdown would act on inside a cell: `\`, `` ` ``, `*`,
 * `_`, `~`, `[`, `]`, `<`, `&` and the `|` that ends a cell. Without it a reason such as
 * `a_b_c` or `[x](y)` becomes emphasis or a link in the `.md`, `llms.txt` and retrieval-chunk
 * output while the page prints the same words literally. Plain prose, digits, parentheses, `.`
 * and `#` pass through unchanged.
 */
export const escapeMarkdownInline = (text: string): string =>
  text.replace(/[\\`*_~[\]<&|]/g, "\\$&");

/**
 * `<UpstreamDefects />` as a Markdown table.
 *
 * The page's whole argument is the table — which polyfill bugs GMT works around, and whether it
 * still has to. Passing the tag through shipped a page whose prose says "each row" and "the middle
 * column" over nothing at all, and left the Dox chat with no answer to "which Temporal bugs does
 * GMT work around" (CORE-8 review, #253). Same three columns as the HTML, same source data.
 */
function renderUpstreamDefects(): string {
  const rows = compatGroups.map((group) => {
    const sent = filings
      .filter((f) => f.gmtGuard && group.defects.includes(f.gmtGuard))
      .map(
        (f) => `[${shortRef(f.repo, f.number)}](${f.contributionUrl ?? f.url})`,
      )
      .join(", ");
    const { badge, count } = stateLine(group);
    // A guard row continues with why it is kept. The reason is free text, so it is escaped: a `|`
    // would end the cell early and `_` or `[` would turn into Markdown the page never shows.
    const reason =
      group.state === "guard" && group.guard
        ? `. ${escapeMarkdownInline(group.guard.reason)}`
        : "";
    const state = `${badge} — ${count}${reason}`;
    return `| **${escapeMarkdownInline(groupLabel(group))}** — ${escapeMarkdownInline(groupWhatBreaks(group))} | ${state} | ${sent || "—"} |`;
  });

  return [
    "",
    "| What GMT works around | Still needed? | What we sent |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/** `<BundleSize />` as a Markdown table of the same figures. */
function renderBundleSize(): string {
  return [
    "",
    `| ${BUNDLE_COLUMNS.join(" | ")} |`,
    `| ${BUNDLE_COLUMNS.map(() => "---").join(" | ")} |`,
    ...bundleRows().map((row) => {
      const [importLine, ...figures] = bundleCells(row);
      return `| \`${importLine}\` | ${figures.join(" | ")} |`;
    }),
    "",
  ].join("\n");
}

/** A titled fenced block: the title as a bold line, then the code. */
const titledFence = (title: string, code: string): string =>
  `**${escapeMarkdownInline(title)}**\n${fence(code)}`;

/**
 * A list of code pairs, as `CodePairs.astro` renders them: an optional heading, the facts, their
 * code and the GMT code as fenced blocks, the note, then the links. Facts and notes are written by
 * hand with backtick code spans, so they pass through as they are.
 */
function renderCodePairs(pairs: readonly CodePairView[]): string {
  const out: string[] = [""];
  for (const pair of pairs) {
    if (pair.heading) {
      const tag = pair.heading.tag ? `${pair.heading.tag}. ` : "";
      out.push(`### ${tag}${pair.heading.text}`, "");
    }
    for (const fact of pair.facts) out.push(`- ${fact.label}: ${fact.text}`);
    if (pair.facts.length > 0) out.push("");
    out.push(titledFence(pair.theirs.title, pair.theirs.code));
    out.push(titledFence(pair.gmt.title, pair.gmt.code));
    if (pair.note) out.push(pair.note, "");
    for (const group of pair.links) {
      if (group.links.length === 0) continue;
      const links = group.links.map((link) => {
        const text = link.code
          ? `\`${link.text}\``
          : escapeMarkdownInline(link.text);
        return `[${text}](${link.href})`;
      });
      out.push(`${group.label}: ${links.join(", ")}.`, "");
    }
  }
  return out.join("\n");
}

/** `<MigrationMap library="…" part="more" />`: their call beside the GMT code, one pair per call. */
function renderMigrationMap(props: Record<string, string>): string {
  const id = libraryProp(props.library, "MigrationMap");
  return renderCodePairs(mapPairs(id, props.part === "more" ? "more" : "rows"));
}

/** `<BehaviourDiffs library="…" />`: one pair per case where the library differs from Temporal. */
function renderBehaviourDiffs(props: Record<string, string>): string {
  return renderCodePairs(
    diffPairs(libraryProp(props.library, "BehaviourDiffs")),
  );
}

/** `<TemporalMap />`: each Temporal call beside the matching GMT code. */
function renderTemporalMap(): string {
  return renderCodePairs(temporalPairs());
}

/**
 * `<BehaviourMatrix />` as the page prints it: a heading per case, its facts, then GMT's result and
 * each library's as a verdict line and a code block. Facts and notes are written by hand with
 * backtick code spans, so they pass through as they are.
 */
function renderBehaviourMatrix(): string {
  const out: string[] = [""];
  for (const view of matrixView()) {
    out.push(`## ${view.id}. ${escapeMarkdownInline(view.title)}`, "");
    for (const fact of view.facts) out.push(`- ${fact.label}: ${fact.text}`);
    out.push(
      `- Specification: ${view.clauses.map((c) => `[${escapeMarkdownInline(c.label)}](${c.url})`).join(", ")}`,
      "",
    );
    for (const note of view.notes) out.push(note, "");
    for (const entry of view.entries) {
      const issues = entry.issues.length
        ? ` Upstream: ${entry.issues.map((i) => `[${i.text}](${i.url})`).join(", ")}.`
        : "";
      out.push(
        `**${escapeMarkdownInline(entry.name)}**: ${VERDICT_LABEL[entry.verdict]}.${issues}`,
        fence(entry.code),
      );
    }
  }
  return out.join("\n");
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
 * `<UpstreamListings />` as a Markdown table: the pull requests GMT opened outside Temporal, with
 * the same columns as the page. The heading and the sentence above it are in the MDX.
 */
function renderUpstreamListings(): string {
  const rows = listings.map((l) => {
    const name = `[${l.repo}#${l.number}](${l.url}) ${escapeMarkdownInline(l.title)}`;
    return `| ${name} | ${escapeMarkdownInline(l.summary)} | ${listingStatus(l)} | ${l.comments} | ${asDate(l.updatedAt)} |`;
  });
  return [
    `\n| ${LISTING_COLUMNS.join(" | ")} |`,
    `| ${LISTING_COLUMNS.map(() => "---").join(" | ")} |`,
    ...rows,
    "",
  ].join("\n");
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

  // A tool page's layout: the key point, the intro, the widget and the trailing text, each in a
  // named slot. On the page the key point is a titled aside naming its use case; here that title
  // becomes a line of text so the takeaway survives as prose. The industry is not named here: it
  // is the page's, stated under its title (`pageToMarkdown`). Run before the wrapper pass below,
  // which is what unwraps the `<Fragment slot>` children this leaves in place.
  out = replaceElements(
    out,
    "ToolLayout",
    (props, children) =>
      `\n**Key point${props.useCase ? ` — ${props.useCase}` : ""}**\n${children}`,
  );

  for (const wrapper of [
    "HeroGlobe",
    "GridSection",
    "ChartContainer",
    "Fragment",
    "CardGrid",
    "Card",
    "HomeCards",
    "HomeCard",
  ]) {
    out = replaceElements(out, wrapper, (props, children) => {
      // A template-literal title's `${expr}` becomes `{expr}`, which `stripMdx` replaces with the figure.
      const caption = [props.title, props.caption]
        .filter(Boolean)
        .join(" — ")
        .replace(/\$\{/g, "{");
      return `${caption ? `\n**${caption}**\n` : ""}${dedent(children)}`;
    });
  }

  out = replaceElements(out, "LibraryCompare", renderLibraryCompare);
  out = replaceElements(out, "UpstreamDefects", renderUpstreamDefects);
  out = replaceElements(out, "UpstreamTracker", renderUpstreamTracker);
  out = replaceElements(out, "UpstreamListings", renderUpstreamListings);
  out = replaceElements(out, "BundleSize", renderBundleSize);
  out = replaceElements(out, "MigrationMap", renderMigrationMap);
  out = replaceElements(out, "BehaviourDiffs", renderBehaviourDiffs);
  out = replaceElements(out, "TemporalMap", renderTemporalMap);
  out = replaceElements(out, "BehaviourMatrix", renderBehaviourMatrix);

  // `SectionHeading` is an `<h2>` around its children, so it becomes one.
  out = replaceElements(
    out,
    "SectionHeading",
    (_props, children) => `\n## ${children.trim()}\n`,
  );

  // The home page's two argument cards hold real prose — the `Date` faults and the library
  // stack — so they render rather than drop. They were invisible to the old nine-name gate.
  out = replaceElements(out, "WhyDateBug", renderWhyDateBug);
  // The headline figures under the /why-gmt intro, as a list.
  out = replaceElements(out, "WhyGmtFigures", renderWhyGmtFigures);
  // Key points first, then the servers card and what the library does; the live parts have no text.
  out = replaceElements(
    out,
    "CanadaClockChange",
    () => keyPointsMarkdown(KEY_POINTS) + serversMarkdown(),
  );
  // Morocco's `serversMarkdown` carries the minimums and the help card, like Canada's.
  out = replaceElements(
    out,
    "MoroccoClockChange",
    () => keyPointsMarkdown(MOROCCO_KEY_POINTS) + moroccoServersMarkdown(),
  );
  out = replaceElements(out, "WhyDateAlternatives", renderWhyDateAlternatives);

  // Decorative or interactive, with no prose of their own: a globe, a scroll animation, and the
  // live widgets, whose surrounding text already states what they demonstrate.
  //
  // Every widget, not the three this list used to hold. The other thirteen, and the two the Zone
  // Planner and Zoned Earth pages mount, were never listed, so each `/tools/*.md` shipped its
  // widget as a raw tag — `<BillingDeadlines fullbleed />` and fourteen like it. Nothing caught
  // it because the gate that should have (`scripts/llms.test.ts`, "no built text surface carries a
  // raw component tag") read only the top level of `dist`. That gate is recursive now, so a
  // widget added to a page and not to this list fails the build's tests instead of shipping.
  for (const dropped of [
    "TimezoneMap",
    "PlaygroundForm",
    "ScrollReveal",
    "CanadaProbeScript",
    "MoroccoProbeScript",
    "IntervalVisualizer",
    "DstInspector",
    "ConverterBench",
    "BillingDeadlines",
    "BlDateStamp",
    "ConnectionChecker",
    "CrossingClock",
    "CutoffCountdown",
    "CutoffRuler",
    "CutoffStack",
    "DeliveryScheduler",
    "DemurrageClock",
    "DepartureBoard",
    "DtmDecoder",
    "DwellLedger",
    "EpcisEventReader",
    "EtaDrift",
    "FhirDateChecker",
    "FreeTimeLedger",
    "Hl7TimestampReader",
    "JourneySplit",
    "PunctualityBoard",
    "TimetableReader",
    "Globe",
    "MultiZoneScrubber",
    "X12TimeReader",
    "GnssWeekDecoder",
    "SatelliteClockConverter",
    "GnssRolloverChecker",
    "LeapSecondTimeline",
    "ElapsedVsClock",
    "StoredTimeAudit",
    "Tai64nLogReader",
    "FixTimestampReader",
    "SsimDateReader",
    "ReportTimeResolver",
    "SwiftValueDateReader",
    "HolidayRuleBuilder",
    "ObservanceComparator",
    "MovingFeasts",
    "DurationParserBench",
    "IdTimestampDecoder",
    "ColumnTimestampBridge",
    "CronInAZone",
    "LeapDayBirthday",
    "ExpiryCalculator",
    "DatabaseTimestampReader",
    "TerrestrialTimeStack",
    "JulianDayCounter",
    "DoublePrecisionMeter",
    "CcsdsTimeCodeDecoder",
    "CodeBDayRuler",
  ]) {
    out = replaceElements(out, dropped, (props) =>
      props.caption ? `\n${props.caption}\n` : "",
    );
  }

  return out;
}
