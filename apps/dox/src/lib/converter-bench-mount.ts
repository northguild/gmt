/**
 * DOX-C3b (#139) — the converter + format bench + regex tester, mountable.
 *
 * 135 lines of stateless script, no drag, no keyboard handling, no state held
 * across renders.
 *
 * ## The shape
 *
 * `renderConverterTemplate(idPrefix, args)` returns the markup as a string;
 * `mountConverterBench()` wires markup that is already there. One template,
 * two surfaces: `ConverterBench.astro` server-renders it through
 * `<Fragment set:html>`, and the chat rail assigns it to `root.innerHTML`. That
 * keeps the reference page's pre-JS readable markup.
 *
 * The template is built from the component kit, with ids from `idScope(idPrefix)`.
 * Every lookup goes through the widget's scope (`findWidget`) and throws on a
 * missing element, which `mount` reports as a `WidgetLoadError`: a broken
 * template is loud, never a control that silently does nothing. A bad input is the
 * library's sentinel (`""` or `[]`), shown as NO SIGNAL and never as a blank box.
 */
import { defineElements } from "~/widgets/define";
import {
  badge,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  raw,
  section,
  select,
  setHtml,
  srOnly,
  textInput,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { grow } from "~/widgets/primitives/grow/grow";
import styles from "~/widgets/tools/converter-bench.module.css";
import { CONVERTER_LOCALES, CURATED_TIMEZONES } from "./curated-timezones";
import { GMT_MODULES } from "./gmt-modules";
import { codeSpan } from "./widget-ui";
import { normaliseZonedInput } from "./zoned-input";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

const WIDGET_NAME = "converter-bench";

/* London and Sydney sit in opposite hemispheres, so their clocks change in
   opposite seasons. On 15 March London is on GMT and Sydney on daylight time. */
const DEFAULT_VALUE = "2024-03-15T14:30:00.000+00:00[Europe/London]";
const DEFAULT_SOURCE_ZONE = "Europe/London";
const DEFAULT_TARGET_ZONE = "Australia/Sydney";
const DEFAULT_LOCALE = "en";
const DEFAULT_REGEX_INPUT = "2024-03-15T14:30:00";

export interface ConverterArgs {
  value?: string;
  from?: string;
  to?: string;
  locale?: string;
}

/** The `<option>`s of a native select, from a list of names. */
function choices(
  values: readonly string[],
): { value: string; label: string }[] {
  return values.map((v) => ({ value: v, label: v }));
}

/** A list with the seeded value appended when the list does not hold it: the reader
 *  can still pick anything the page normally offers after Dox seeds an unusual one. */
function withSeed(values: readonly string[], seed: string): readonly string[] {
  return values.includes(seed) ? values : [...values, seed];
}

/** The output slot before the library answers: one empty box that holds its height. */
function emptyOutput(label: string): SafeHtml {
  return callOutput({ label, state: "empty", lines: [] });
}

function outputOf(label: string, text: string, lost: boolean): SafeHtml {
  return callOutput({
    label,
    state: lost ? "sentinel" : "live",
    lines: [{ text, lost }],
  });
}

function emptyFrame(label: string): SafeHtml {
  return codeFrame({
    label,
    copyLabel: `Copy ${label.toLowerCase()}`,
    copyText: "",
    gate: "codeframe",
  });
}

export function renderConverterTemplate(
  idPrefix: string,
  args: ConverterArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const value = args.value ?? DEFAULT_VALUE;
  const from = args.from ?? DEFAULT_SOURCE_ZONE;
  const to = args.to ?? DEFAULT_TARGET_ZONE;
  const locale = args.locale ?? DEFAULT_LOCALE;

  const valueField = (key: string, text: string): SafeHtml =>
    html`<div class="${styles.wide}">${field({
      id: id(key),
      label: "Input",
      control: ({ id: cid }) =>
        textInput({
          id: cid,
          value: text,
          spellcheck: false,
          autocomplete: "off",
        }),
    })}</div>`;

  const choice = (
    key: string,
    label: string,
    list: readonly string[],
    selected: string,
  ): SafeHtml =>
    field({
      id: id(key),
      label,
      control: ({ id: cid }) =>
        select({ id: cid, options: choices(list), value: selected }),
    });

  const convert = section(
    { id: id("convert"), heading: "Zone conversion", level: 4 },
    html`${fieldGrid(valueField("convert-value", value))}${fieldGrid(
      html`${choice("convert-source", "From", withSeed(CURATED_TIMEZONES, from), from)}${choice("convert-target", "To", withSeed(CURATED_TIMEZONES, to), to)}`,
    )}${grow(
      html`<div id="${id("convert-result")}">${emptyOutput("Converted value")}</div>`,
    )}`,
  );

  const format = section(
    { id: id("format"), heading: "Format bench", level: 4 },
    html`${fieldGrid(
      html`${valueField("format-value", value)}${choice("format-locale", "Locale", withSeed(CONVERTER_LOCALES, locale), locale)}`,
    )}<div class="${styles.results}">
      <div class="${styles.row}">
        ${grow(html`<div id="${id("call-format-parts")}">${emptyFrame("formatZonedToParts call")}</div>`)}
        ${grow(html`<div id="${id("format-parts")}">${emptyOutput("Format parts")}</div>`)}
      </div>
      <div class="${styles.row}">
        ${grow(html`<div id="${id("call-format-relative")}">${emptyFrame("formatRelativeZoned call")}</div>`)}
        ${grow(html`<div id="${id("format-relative")}">${emptyOutput("Relative format")}</div>`)}
      </div>
    </div>`,
  );

  const regex = section(
    { id: id("regex"), heading: "Regex tester", level: 4 },
    html`${fieldGrid(valueField("regex-input", DEFAULT_REGEX_INPUT))}${grow(
      html`<ul class="${styles.chips}" id="${id("regex-results")}" aria-label="Regex results"></ul>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Converter Bench", scope: idPrefix },
    html`${convert}${format}${regex}`,
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

type Modules = Awaited<ReturnType<typeof loadModules>>;

function getRegexList(regexes: Record<string, RegExp>): RegexConst[] {
  const exclude = ["__esModule"];
  return Object.keys(regexes)
    .filter((k) => !exclude.includes(k) && regexes[k] instanceof RegExp)
    .map((k) => ({ name: k, pattern: regexes[k] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One chip per exported pattern. A match says so in words, so it never rests on colour. */
function regexChips(input: string, regexes: RegexConst[]): SafeHtml {
  return html`${regexes.map(({ name, pattern }) => {
    const match = pattern.test(input);
    return html`<li class="${styles.chip}">${badge({
      text: match ? `${name} · match` : name,
      tone: match ? "spring" : "neutral",
      dim: !match,
    })}${match ? "" : srOnly(" — no match")}</li>`;
  })}`;
}

function callFrame(
  label: string,
  fn: string,
  value: string,
  locale: string,
): SafeHtml {
  const argsHtml = `${codeSpan("str", `"${value}"`)}, ${codeSpan("str", `"${locale}"`)}`;
  return codeFrame({
    label,
    copyLabel: `Copy ${label.toLowerCase()}`,
    copyText: `${fn}("${value}", "${locale}")`,
    code: raw(`${codeSpan("fn", fn)}(${argsHtml})`),
    gate: "codeframe",
  });
}

interface Controller {
  readState(): ConverterArgs;
  apply(args: ConverterArgs): void;
  run(): void;
}

/** Wire the template at `root`. Throws a plain `Error` on a missing element. */
function setupWidget(
  root: HTMLElement,
  modules: Modules,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const convertVal = el<HTMLInputElement>("convert-value");
  const convertSource = el<HTMLSelectElement>("convert-source");
  const convertTarget = el<HTMLSelectElement>("convert-target");
  const fmtVal = el<HTMLInputElement>("format-value");
  const fmtLocale = el<HTMLSelectElement>("format-locale");
  const regexInput = el<HTMLInputElement>("regex-input");
  // Every slot the run writes: a missing one throws now, not on the first keystroke.
  const slots = {
    convert: el("convert-result"),
    parts: el("format-parts"),
    relative: el("format-relative"),
    callParts: el("call-format-parts"),
    callRelative: el("call-format-relative"),
    chips: el("regex-results"),
  };
  const regexList = getRegexList(modules.regexes);

  function run(): void {
    const converted = modules.convertZonedToZoned(
      convertVal.value,
      convertTarget.value,
    );
    setHtml(
      slots.convert,
      outputOf("Converted value", converted, converted === ""),
    );

    const locale = fmtLocale.value;
    const parts = modules.formatZonedToParts(fmtVal.value, locale);
    setHtml(
      slots.parts,
      outputOf("Format parts", JSON.stringify(parts), parts.length === 0),
    );
    setHtml(
      slots.callParts,
      callFrame(
        "formatZonedToParts call",
        "formatZonedToParts",
        fmtVal.value,
        locale,
      ),
    );
    const relative = modules.formatRelativeZoned(fmtVal.value, locale);
    setHtml(
      slots.relative,
      outputOf("Relative format", relative, relative === ""),
    );
    setHtml(
      slots.callRelative,
      callFrame(
        "formatRelativeZoned call",
        "formatRelativeZoned",
        fmtVal.value,
        locale,
      ),
    );

    setHtml(slots.chips, regexChips(regexInput.value, regexList));
  }

  /** A zone seeded from a link or a call joins the list when it is not on it; a locale
   *  the list lacks is refused, so a seed cannot invent a choice. */
  function seedSelect(
    sel: HTMLSelectElement,
    value: string,
    open: boolean,
  ): void {
    if (![...sel.options].some((o) => o.value === value)) {
      if (!open) return;
      sel.append(new Option(value, value));
    }
    sel.value = value;
  }

  widgetEl.addEventListener("input", run, { signal });
  widgetEl.addEventListener("change", run, { signal });

  return {
    readState: () => ({
      value: convertVal.value,
      from: convertSource.value,
      to: convertTarget.value,
      locale: fmtLocale.value,
    }),
    apply(args) {
      /* Applied before the first run: the template paints these when it is given them
         (the chat rail), but a page bootstrap gets its seed from `window.location`, which
         Astro's frontmatter cannot see. One path covers both entrances. Zoned text takes
         the same normalisation as the interval visualizer (see zoned-input.ts). */
      const value = args.value ? normaliseZonedInput(args.value) : undefined;
      if (value !== undefined) {
        convertVal.value = value;
        fmtVal.value = value;
      }
      if (args.from !== undefined) seedSelect(convertSource, args.from, true);
      if (args.to !== undefined) seedSelect(convertTarget, args.to, true);
      if (args.locale !== undefined) seedSelect(fmtLocale, args.locale, false);
    },
    run,
  };
}

/** Recompute every section from the current control values. */
export function run(container: HTMLElement, modules: Modules): void {
  setupWidget(container, modules, new AbortController().signal).run();
}

export const mountConverterBench: MountFn<ConverterArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let modules: Modules;
  try {
    modules = await loadModules();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  let controller: Controller;
  try {
    controller = setupWidget(root, modules, signal);
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
  controller.apply(args);
  controller.run();

  return onceDestroy(
    () => {},
    () => ({ ...controller.readState() }),
  );
};
