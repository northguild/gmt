/**
 * The live playground form's markup: the argument controls, the repeatable rows, the call
 * line and the result. `PlaygroundForm.astro` renders it on the server; the mount
 * (`playground-form-mount.ts`) renders a row with `playgroundRowHtml` when a reader adds
 * one, so a row is the same markup either way.
 *
 * Fields, selects, text inputs and the code frame come from the kit. A repeatable
 * row has no kit piece: its controls are named by their row ("items 2", "intervals 1
 * start") rather than by a visible label, so they are written here with the module's
 * classes.
 */
import {
  card,
  codeFrame,
  field,
  fieldGrid,
  html,
  idScope,
  select,
  textInput,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import styles from "~/widgets/tools/playground-form.module.css";
import { playgroundResult } from "~/widgets/tools/playground-result";
import type {
  LivePlaygroundTemplate,
  PlaygroundField,
} from "./playground-spec";

export type PlaygroundTone = "wrong" | "right";

const isList = (kind: string): boolean =>
  kind === "list" || kind === "intervals";

/** Free text, source text, amounts with a unit and repeatable rows take the whole line. */
const isWide = (kind: string): boolean =>
  isList(kind) || kind === "expr" || kind === "string" || kind === "units";

/** What a field is called to a reader and to assistive technology. */
const fieldLabel = (f: PlaygroundField): string =>
  f.optional ? `${f.name} (optional)` : f.name;

type RowKind = "list" | "intervals";

/** The text of a row's controls, in document order: one value, or a start and an end. */
export interface PlaygroundRowSpec {
  kind: RowKind;
  element: string;
  choices: readonly string[];
  /** The field's name; the row's controls are named from it. */
  name: string;
  /** 1-based position in the field. */
  position: number;
  values: readonly string[];
}

const textBox = (
  label: string,
  value: string,
  extra: SafeHtml | string = "",
): SafeHtml =>
  html`<input
    class="${styles.rowInput}"
    type="text"
    aria-label="${label}"
    value="${value}"
    spellcheck="false"
    autocapitalize="off"
    autocomplete="off"
    ${extra}
  />`;

/** One repeatable row: its control or controls, and the button that removes it. */
export function playgroundRowHtml(r: PlaygroundRowSpec): SafeHtml {
  const label = `${r.name} ${r.position}`;
  let controls: SafeHtml;
  if (r.kind === "intervals") {
    controls = html`${textBox(`${label} start`, r.values[0] ?? "", html`placeholder="start"`)}${textBox(
      `${label} end`,
      r.values[1] ?? "",
      html`placeholder="end"`,
    )}`;
  } else if (r.element === "enum") {
    const chosen = r.values[0] ?? "";
    controls = html`<select class="${styles.rowSelect}" aria-label="${label}"
      >${r.choices.map(
        (c) =>
          html`<option value="${c}" ${c === chosen ? html`selected` : ""}>${c}</option>`,
      )}</select
    >`;
  } else {
    controls = textBox(
      label,
      r.values[0] ?? "",
      r.element === "number" ? html`inputmode="decimal"` : "",
    );
  }
  return html`<div class="${styles.row}" data-row
    >${controls}<button class="${styles.remove}" type="button" data-remove aria-label="Remove ${label}"
      >×</button
    ></div
  >`;
}

function listField(
  f: PlaygroundField,
  id: (local: string) => string,
  index: number,
): SafeHtml {
  const kind: RowKind = f.kind === "intervals" ? "intervals" : "list";
  const element = f.element ?? "string";
  const choices = f.choices ?? [];
  const rows: PlaygroundRowSpec[] =
    kind === "intervals"
      ? (f.pairs ?? []).map(([s, e], i) => ({
          kind,
          element,
          choices,
          name: f.name,
          position: i + 1,
          values: [s, e],
        }))
      : (f.items ?? []).map((item, i) => ({
          kind,
          element,
          choices,
          name: f.name,
          position: i + 1,
          values: [item],
        }));
  const labelId = id(`f${index}-label`);
  return html`<div
    class="${styles.cell} ${styles.wide} ${styles.list}"
    role="group"
    aria-labelledby="${labelId}"
    data-field="${f.name}"
    data-kind="${f.kind}"
    data-element="${element}"
    data-choices="${choices.join("\n")}"
    ${f.optional ? html`data-optional="true"` : ""}
  >
    <span class="${styles.listLabel}" id="${labelId}">${fieldLabel(f)}</span>
    <div class="${styles.rows}" data-rows>${rows.map(playgroundRowHtml)}</div>
    <button class="${styles.add}" type="button" data-add>Add ${f.name}</button>
  </div>`;
}

function scalarField(
  f: PlaygroundField,
  id: (local: string) => string,
  index: number,
): SafeHtml {
  const base = id(`f${index}`);
  const cellClass = isWide(f.kind)
    ? `${styles.cell} ${styles.wide}`
    : styles.cell;
  const attrs = html`data-field="${f.name}" data-kind="${f.kind}" ${f.optional ? html`data-optional="true"` : ""}`;
  const choices = (f.choices ?? []).map((c) => ({ value: c, label: c }));

  if (f.kind === "units") {
    return html`<div class="${cellClass}" ${attrs}
      ><div class="${styles.units}" role="group" aria-label="${fieldLabel(f)}"
        >${field({
          id: `${base}-amount`,
          label: `${fieldLabel(f)} amount`,
          control: ({ id: cid }) =>
            textInput({
              id: cid,
              value: f.seed,
              inputMode: "decimal",
              autocomplete: "off",
              spellcheck: false,
            }),
        })}${field({
          id: `${base}-unit`,
          label: `${fieldLabel(f)} unit`,
          control: ({ id: cid }) =>
            select({
              id: cid,
              value: f.unitSeed ?? "",
              options: (f.unitKeys ?? []).map((u) => ({ value: u, label: u })),
            }),
        })}</div
      ></div
    >`;
  }

  const control = (cid: string): SafeHtml => {
    switch (f.kind) {
      case "enum":
        return select({
          id: cid,
          value: f.seed,
          options: f.optional
            ? [{ value: "", label: "—" }, ...choices]
            : choices,
        });
      case "boolean":
        return select({
          id: cid,
          value: f.seed,
          options: [
            { value: "true", label: "true" },
            { value: "false", label: "false" },
          ],
        });
      case "number":
        return textInput({
          id: cid,
          value: f.seed,
          inputMode: "decimal",
          autocomplete: "off",
          spellcheck: false,
        });
      case "bigint":
        return textInput({
          id: cid,
          value: f.seed,
          inputMode: "numeric",
          autocomplete: "off",
          spellcheck: false,
        });
      default:
        return textInput({
          id: cid,
          value: f.seed,
          autocomplete: "off",
          spellcheck: false,
        });
    }
  };
  return html`<div class="${cellClass}" ${attrs}
    >${field({ id: base, label: fieldLabel(f), control: ({ id: cid }) => control(cid) })}</div
  >`;
}

/**
 * The whole form for one generated template. `specId` keys it in `LIVE_PLAYGROUND_TEMPLATES`
 * and scopes its ids, so two forms on one page need two different spec ids.
 */
export function renderPlaygroundFormTemplate(
  specId: string,
  template: LivePlaygroundTemplate,
  o: { tone?: PlaygroundTone } = {},
): SafeHtml {
  const fields = template.fields ?? [];
  const scope = `pf-${specId}`;
  const id = idScope(scope);
  const outputLabel = id("output-label");
  const toneClass = o.tone === undefined ? "" : styles[o.tone];

  const body = html`<div
    class="${styles.body}"
    data-form
    data-module="${template.module}"
    data-fn="${template.fn}"
    data-return-type="${template.returnType}"
    data-allow-empty-array="${template.allowEmptyArray ? "true" : ""}"
    data-null-is-empty="${template.nullIsEmpty ? "true" : ""}"
    data-options-suffix="${template.optionsSuffix ?? ""}"
    data-object-arg="${template.objectArg ? "true" : ""}"
    ${template.choiceSeeds ? html`data-choice-seeds="${JSON.stringify(template.choiceSeeds)}"` : ""}
    >${
      fields.length > 0
        ? fieldGrid(
            html`${fields.map((f, i) =>
              isList(f.kind) ? listField(f, id, i) : scalarField(f, id, i),
            )}`,
          )
        : ""
    }${codeFrame({ label: "Call", copyLabel: "Copy call", copyText: "" })}</div
  >`;

  return widget(
    { name: "playground", label: `${template.fn} playground`, scope },
    card(html`${body}${playgroundResult(outputLabel, toneClass)}`),
  );
}
