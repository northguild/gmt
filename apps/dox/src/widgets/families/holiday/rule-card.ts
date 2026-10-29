/**
 * ruleCard: one holiday rule as a row: its number, a name box, a kind select, the buttons
 * that move and remove it, the fields its kind reads, the policy editor, a link to compare
 * policies, and one held line for what it gave.
 *
 * The card knows nothing of what a kind reads: the caller passes the kind's fields, policy
 * and link as markup. Ids are `${id}-name`, `-kind`, `-up`, `-down`, `-remove` and
 * `-result`, so the mount reads a row by its own id. The buttons say which rule they act on
 * ("Move rule 2 up"); the first rule's up and the last rule's down are disabled.
 */
import { html, type SafeHtml } from "../../builders/html";
import { select, type SelectOption } from "../../builders/select";
import { srOnly } from "../../builders/sr-only";
import styles from "./rule-card.module.css";

export interface RuleCardOptions {
  /** The card's id (the `<li>`); every control's id begins with it. */
  id: string;
  /** The 0-based place of the rule. */
  index: number;
  total: number;
  kind: string;
  kindOptions: readonly SelectOption[];
  name: string;
  maxName: number;
  /** The kind's own fields, as `field()` markup. */
  fields: SafeHtml;
  /** The policy editor, or nothing. */
  policy?: SafeHtml;
  /** The compare link, or nothing. */
  compare?: SafeHtml;
  /** The held result line. */
  result: SafeHtml;
}

function stepButton(
  id: string,
  action: string,
  label: string,
  glyph: string,
  disabled: boolean,
): SafeHtml {
  return html`<button
    class="${styles.button}"
    type="button"
    id="${id}-${action}"
    aria-label="${label}"
    ${disabled ? html`disabled` : ""}
  >${glyph}</button>`;
}

export function ruleCard(o: RuleCardOptions): SafeHtml {
  const n = o.index + 1;
  return html`<li class="${styles.card}" id="${o.id}" data-kind="${o.kind}">
    <div class="${styles.head}">
      <span class="${styles.number}" aria-hidden="true">${String(n)}</span>
      <span class="${styles.name}"
        ><label for="${o.id}-name">${srOnly(`Rule ${n} name`)}</label
        >${html`<input
          class="${styles.nameInput}"
          type="text"
          id="${o.id}-name"
          value="${o.name}"
          maxlength="${String(o.maxName)}"
          autocomplete="off"
          spellcheck="false"
          placeholder="Name"
        />`}</span
      >
      <span class="${styles.kind}"
        ><label for="${o.id}-kind">${srOnly(`Rule ${n} kind`)}</label
        >${select({ id: `${o.id}-kind`, options: o.kindOptions, value: o.kind })}</span
      >
      <span class="${styles.buttons}"
        >${stepButton(o.id, "up", `Move rule ${n} up`, "↑", o.index === 0)}${stepButton(
          o.id,
          "down",
          `Move rule ${n} down`,
          "↓",
          o.index === o.total - 1,
        )}${stepButton(o.id, "remove", `Remove rule ${n}`, "×", false)}</span
      >
    </div>
    <div class="${styles.fields}">${o.fields}</div>
    ${o.policy ?? ""}${o.compare ?? ""}
    <div class="${styles.result}" id="${o.id}-result">${o.result}</div>
  </li>`;
}
