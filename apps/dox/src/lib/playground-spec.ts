/**
 * Playground spec types.
 *
 * Each spec describes one live playground: which gmt module + function it
 * calls, the template call string, and the return type (for sentinel detection).
 *
 * The `LIVE_PLAYGROUND_TEMPLATES` record is generated from the gmt source by
 * `scripts/build-reference.ts` — it is NOT hand-authored. The generator walks
 * every exported function and derives the field schema + seed values from the
 * function's first `@example`. Consumed by `components/PlaygroundForm.astro`.
 */

/**
 * One editable positional argument, rendered as a form control instead of a
 * slice of a textarea. Derived by `scripts/build-reference.ts` from the same
 * `PlaygroundSpec` the textarea template is built from.
 */
/**
 * `"expr"` is the fallback for an argument no scalar control models — an object
 * literal (`{ weekend: [6, 7], … }`), a nested array, anything the example wrote
 * as source rather than as a plain value. The control holds that source text and
 * it goes into the call verbatim, so the argument stays editable and live instead
 * of costing the function its whole widget.
 */
export type PlaygroundFieldKind =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "enum"
  | "units"
  | "list"
  | "intervals"
  | "expr";

export interface PlaygroundField {
  /** Parameter name from the signature — shown as the control label. */
  name: string;
  /** Which control to render. */
  kind: PlaygroundFieldKind;
  /**
   * Initial value (the amount, for `units`). Unused by `list` / `intervals`.
   * For `bigint`, the digits alone — the `n` suffix is re-appended on assembly.
   */
  seed: string;
  /** `x?:` in the signature — the control is cleared and the arg dropped when empty. */
  optional?: boolean;
  /** Choices for `kind: "enum"`, or the element choices for a `kind: "list"`. */
  choices?: string[];
  /** Unit names for `kind: "units"` (the `<select>` beside the amount). */
  unitKeys?: string[];
  /** Initial unit for `kind: "units"`. */
  unitSeed?: string;
  /** `kind: "list"` — element type; `enum` when `choices` is set. */
  element?: "string" | "number" | "enum" | "expr";
  /** `kind: "list"` — initial elements. */
  items?: string[];
  /** `kind: "intervals"` — initial `[start, end]` pairs. */
  pairs?: Array<[string, string]>;
}

export interface LivePlaygroundTemplate {
  module: string;
  fn: string;
  template: string;
  returnType: "string" | "number" | "bigint" | "boolean" | "array" | "object";
  allowEmptyArray?: boolean;
  /**
   * `null` can be a correct empty answer (two intervals that share no span), so
   * it renders as the empty state rather than the sentinel. Set from
   * `scripts/build-utils/null-is-empty.ts`.
   */
  nullIsEmpty?: boolean;
  /**
   * The form-control schema `<PlaygroundForm>` renders from. Present whenever the
   * first `@example` survived `buildPlaygroundFields` — an empty array is valid
   * (a no-arg function: call line + live result, nothing to edit). When absent
   * the reference page shows the static code block with no interactive widget.
   */
  fields?: PlaygroundField[];
  /**
   * A trailing options-object literal (`{ epochUnit: "milliseconds" }`) baked
   * into the call verbatim — the form does not make options editable.
   */
  optionsSuffix?: string;
  /**
   * The function takes a single destructured object (`fn({ value1, value2 })`);
   * `fields` are its properties and the call is rebuilt as an object literal.
   */
  objectArg?: boolean;
}

export { LIVE_PLAYGROUND_TEMPLATES } from "~/generated/reference/live-playground-templates";
