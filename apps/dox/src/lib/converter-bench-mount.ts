/**
 * DOX-C3b (#139) — the converter + format bench + regex tester, mountable.
 *
 * The first of the three Tier 2 widgets to be extracted, and deliberately so:
 * 135 lines of stateless script, no drag, no keyboard handling, no state held
 * across renders. It sets the pattern the harder two follow.
 *
 * ## The shape
 *
 * `renderConverterTemplate()` returns the markup as a string;
 * `mountConverterBench()` wires markup that is already there. One template,
 * two surfaces: `ConverterBench.astro` server-renders it through
 * `<Fragment set:html>`, and the chat rail assigns it to `root.innerHTML`. That
 * keeps the reference page's pre-JS readable markup — the alternative, having
 * the mount build its own DOM, would have turned server-rendered HTML into
 * client-generated HTML and broken this story's own byte-identical DoD line.
 *
 * The template is byte-checked against the built page by
 * `scripts/html-diff.mjs`, because a 0.2%-tolerance pixel diff cannot see a
 * dropped `selected` or a missing `data-role` — and every lookup below is a
 * null-tolerant `querySelector`, so a missing role makes a control inert rather
 * than throwing.
 */
import { codeFrameHtml } from "./code-frame";
import { CONVERTER_LOCALES, CURATED_TIMEZONES } from "./curated-timezones";
import { GMT_MODULES } from "./gmt-modules";
import { renderResult } from "./playground-client";
import {
  codeSpan,
  escapeAttr,
  escapeHtml,
  renderCallLine,
  wireCopyButtons,
} from "./widget-ui";
import { normaliseZonedInput } from "./zoned-input";
import { onceDestroy, type MountFn } from "./widget-mount";

const DEFAULT_VALUE = "2024-03-15T14:30:00.000-04:00[America/New_York]";
const DEFAULT_SOURCE_ZONE = "America/New_York";
const DEFAULT_TARGET_ZONE = "Europe/London";
const DEFAULT_LOCALE = "en-US";
const DEFAULT_REGEX_INPUT = "2024-03-15T14:30:00";

export interface ConverterArgs {
  value?: string;
  from?: string;
  to?: string;
  locale?: string;
}

/** Astro renders `selected={true}` as a bare attribute and `false` as nothing. */
function options(values: readonly string[], selected: string): string {
  return values
    .map(
      (v) =>
        `<option value="${escapeAttr(v)}"${v === selected ? " selected" : ""}>${escapeHtml(v)}</option>`,
    )
    .join("");
}

export function renderConverterTemplate(args: ConverterArgs = {}): string {
  const value = args.value ?? DEFAULT_VALUE;
  const from = args.from ?? DEFAULT_SOURCE_ZONE;
  const to = args.to ?? DEFAULT_TARGET_ZONE;
  const locale = args.locale ?? DEFAULT_LOCALE;

  /* Seeded zones are appended when they are outside the curated twenty, rather
     than replacing the list: the reader should still be able to pick anything
     the page normally offers after Dox seeds an unusual zone. */
  const zonesFrom = CURATED_TIMEZONES.includes(
    from as (typeof CURATED_TIMEZONES)[number],
  )
    ? CURATED_TIMEZONES
    : [...CURATED_TIMEZONES, from];
  const zonesTo = CURATED_TIMEZONES.includes(
    to as (typeof CURATED_TIMEZONES)[number],
  )
    ? CURATED_TIMEZONES
    : [...CURATED_TIMEZONES, to];
  const locales = CONVERTER_LOCALES.includes(
    locale as (typeof CONVERTER_LOCALES)[number],
  )
    ? CONVERTER_LOCALES
    : [...CONVERTER_LOCALES, locale];

  return (
    `<div class="gmt-converter gmt-widget">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>Zone conversion</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Input</span>` +
    `<input class="gmt-input" data-role="convert-value" type="text" value="${escapeAttr(value)}" spellcheck="false">` +
    `</label>` +
    `</div>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>From</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="convert-source">${options(zonesFrom, from)}</select>` +
    `</label>` +
    `<label class="gmt-label gmt-label-wide"><span>To</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="convert-target">${options(zonesTo, to)}</select>` +
    `</label>` +
    `</div>` +
    `<output class="gmt-widget-output" data-role="convert-result">&nbsp;</output>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>Format bench</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Input</span>` +
    `<input class="gmt-input" data-role="format-value" type="text" value="${escapeAttr(value)}" spellcheck="false">` +
    `</label>` +
    `<label class="gmt-label"><span>Locale</span>` +
    `<select class="gmt-select" data-role="format-locale">${options(locales, locale)}</select>` +
    `</label>` +
    `</div>` +
    `<div class="gmt-converter-results">` +
    `<div class="gmt-converter-result-row">${codeFrameHtml("format-parts")}` +
    `<output class="gmt-widget-output" data-role="format-parts">&nbsp;</output></div>` +
    `<div class="gmt-converter-result-row">${codeFrameHtml("format-relative")}` +
    `<output class="gmt-widget-output" data-role="format-relative">&nbsp;</output></div>` +
    `</div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>Regex tester</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Input</span>` +
    `<input class="gmt-input" data-role="regex-input" type="text" value="${DEFAULT_REGEX_INPUT}" spellcheck="false">` +
    `</label>` +
    `</div>` +
    `<div class="gmt-converter-chips" data-role="regex-results"></div>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

interface RegexConst {
  name: string;
  pattern: RegExp;
}

interface FormatPart {
  type: string;
  value: string;
}

async function loadModules() {
  const [convMod, fmtMod, regexMod] = await Promise.all([
    GMT_MODULES["zoned/convert"](),
    GMT_MODULES["zoned/format"](),
    GMT_MODULES["regex"](),
  ]);
  return {
    convertZonedToZoned: convMod["convertZonedToZoned"] as (
      value: string,
      timeZone: string,
    ) => string,
    formatZonedToParts: fmtMod["formatZonedToParts"] as (
      value: string,
      locale?: string,
    ) => FormatPart[],
    formatRelativeZoned: fmtMod["formatRelativeZoned"] as (
      value: string,
      locale?: string,
    ) => string,
    regexes: regexMod as Record<string, RegExp>,
  };
}

function getRegexList(regexes: Record<string, RegExp>): RegexConst[] {
  const exclude = ["__esModule"];
  return Object.keys(regexes)
    .filter((k) => !exclude.includes(k) && regexes[k] instanceof RegExp)
    .map((k) => ({ name: k, pattern: regexes[k] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function renderRegexChips(
  container: HTMLElement,
  input: string,
  regexes: RegexConst[],
): void {
  container.innerHTML = "";
  for (const { name, pattern } of regexes) {
    const match = pattern.test(input);
    const chip = document.createElement("span");
    chip.className = `gmt-converter-chip${match ? " gmt-converter-chip--match" : ""}`;
    chip.title = match ? `${name} — match` : `${name} — no match`;
    chip.textContent = name;
    container.appendChild(chip);
  }
}

/** Recompute every section from the current control values. Pure read-then-write
 *  over the DOM: no state is held between calls, which is what makes this widget
 *  the easy one. */
export async function run(
  container: HTMLElement,
  modules: Awaited<ReturnType<typeof loadModules>>,
): Promise<void> {
  const q = <T extends HTMLElement>(role: string) =>
    container.querySelector(`[data-role="${role}"]`) as T | null;

  const convertVal = q<HTMLInputElement>("convert-value");
  const convertTarget = q<HTMLSelectElement>("convert-target");
  const convertOut = q("convert-result");

  if (convertVal && convertTarget && convertOut) {
    const result = modules.convertZonedToZoned(
      convertVal.value,
      convertTarget.value,
    );
    renderResult(convertOut, result, result === "");
  }

  const fmtVal = q<HTMLInputElement>("format-value");
  const fmtLocale = q<HTMLSelectElement>("format-locale");
  const partsOut = q("format-parts");
  const relOut = q("format-relative");

  if (fmtVal && fmtLocale) {
    const locale = fmtLocale.value;
    const argsHtml = `${codeSpan("str", `"${fmtVal.value}"`)}, ${codeSpan("str", `"${locale}"`)}`;
    const argsPlain = `"${fmtVal.value}", "${locale}"`;

    if (partsOut) {
      const parts = modules.formatZonedToParts(fmtVal.value, locale);
      renderResult(partsOut, parts, parts.length === 0);
      renderCallLine(
        q("call-format-parts"),
        "formatZonedToParts",
        argsHtml,
        argsPlain,
      );
    }
    if (relOut) {
      const rel = modules.formatRelativeZoned(fmtVal.value, locale);
      renderResult(relOut, rel, rel === "");
      renderCallLine(
        q("call-format-relative"),
        "formatRelativeZoned",
        argsHtml,
        argsPlain,
      );
    }
  }

  const regexInput = q<HTMLInputElement>("regex-input");
  const regexResults = q("regex-results");
  if (regexInput && regexResults) {
    renderRegexChips(
      regexResults,
      regexInput.value,
      getRegexList(modules.regexes),
    );
  }
}

export const mountConverterBench: MountFn<ConverterArgs> = async (
  root,
  args,
  signal,
) => {
  let modules: Awaited<ReturnType<typeof loadModules>>;
  try {
    modules = await loadModules();
  } catch {
    // The page stays readable without the library; the controls simply do
    // nothing, exactly as before this was extracted.
    return onceDestroy(() => {});
  }
  if (signal.aborted) return onceDestroy(() => {});

  /* Applied before the first run, for the same reason as the DST inspector: the
     template paints these when it is given them (the chat rail), but a page
     bootstrap gets its seed from `window.location`, which Astro's frontmatter
     cannot see. One path covers both entrances. */
  const seed = (role: string, value: string | undefined) => {
    if (value === undefined) return;
    const el = root.querySelector(`[data-role="${role}"]`) as
      | HTMLSelectElement
      | HTMLInputElement
      | null;
    if (!el) return;
    if (
      el instanceof HTMLSelectElement &&
      ![...el.options].some((o) => o.value === value)
    ) {
      return;
    }
    el.value = value;
  };
  /* Same normalisation as the interval visualizer, for the same reason: these
     inputs are zoned, and a model asked to convert "2:30pm" has no zone for it.
     See zoned-input.ts. */
  const value = args.value ? normaliseZonedInput(args.value) : undefined;
  seed("convert-value", value);
  seed("format-value", value);
  seed("convert-source", args.from);
  seed("convert-target", args.to);
  seed("format-locale", args.locale);

  const rerun = () => void run(root, modules);
  for (const input of root.querySelectorAll("select, input")) {
    input.addEventListener("input", rerun);
    input.addEventListener("change", rerun);
  }

  wireCopyButtons(root);
  void run(root, modules);

  return onceDestroy(
    () => {
      /* Listeners live on elements inside `root`, and the host drops that
         subtree — see widget-mount.ts. `wireCopyButtons` is the one thing with
         a timer, and it owns its own reset. */
    },
    () => {
      const q = (role: string) =>
        root.querySelector(`[data-role="${role}"]`) as HTMLInputElement | null;
      return {
        value: q("convert-value")?.value,
        from: q("convert-source")?.value,
        to: q("convert-target")?.value,
        locale: q("format-locale")?.value,
      };
    },
  );
};
