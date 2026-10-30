/**
 * The live playground form's behaviour: read each control, assemble the call, run the
 * real gmt function and show the result. Every edit re-runs it (debounced); there is no
 * Run button.
 *
 * The page starts it once with `startPlaygroundForms()`. It registers the kit's elements
 * first, so `<gmt-copy>` in the call frame upgrades, and returns a function that stops
 * every form it started. This module imports the library loader and `new Function`, so
 * it stays out of the chat bundle with `playground-client.ts`.
 *
 * A repeatable field (a list or a set of intervals) keeps its rows named by position,
 * "items 2" and "Remove items 2", and moves focus the way a reader expects: to the new
 * row's first control after an add, to the previous row (or the next, or the Add button)
 * after a remove.
 */
import { defineElements } from "~/widgets/define";
import { raw, setHtml } from "~/widgets/builders";
import { GMT_MODULES } from "./gmt-modules";
import {
  classifyPlaygroundResult,
  createSeedLoader,
  evaluateArg,
  renderResult,
  type SeedControl,
} from "./playground-client";
import {
  playgroundRowHtml,
  type PlaygroundRowSpec,
} from "./playground-form-template";
import { buildCall, parseCallArgs, type CallField } from "./playground-parsers";
import type { ChoiceSeed, ChoiceSeeds } from "./playground-spec";
import { codeSpan, escapeHtml } from "./widget-ui";

const DEBOUNCE_MS = 150;

/** Syntax-tint one already-formatted argument for the call line. */
function highlightArg(text: string): string {
  if (/^-?\d+(?:\.\d+)?n?$/.test(text)) return codeSpan("num", text);
  if (text.startsWith('"') && text.endsWith('"')) return codeSpan("str", text);
  if (text === "true" || text === "false") return codeSpan("num", text);
  return escapeHtml(text);
}

type Kind = CallField["kind"];

interface FieldControl extends SeedControl {
  /** The control a change event on an enum field comes from, when there is one. */
  select: HTMLSelectElement | null;
}

function scalarControl(cell: HTMLElement): FieldControl {
  const name = cell.dataset["field"] ?? "";
  const kind = (cell.dataset["kind"] ?? "string") as Kind;
  const optional = cell.dataset["optional"] === "true";

  if (kind === "units") {
    const amount = cell.querySelector<HTMLInputElement>("input")!;
    const unit = cell.querySelector<HTMLSelectElement>("select")!;
    return {
      name,
      select: null,
      read: () => ({
        name,
        kind,
        value: amount.value,
        unit: unit.value,
        optional,
      }),
      write: (seed) => {
        amount.value = seed.seed;
        if (seed.unitSeed) unit.value = seed.unitSeed;
      },
    };
  }

  const el = cell.querySelector<HTMLInputElement | HTMLSelectElement>(
    "input,select",
  )!;
  return {
    name,
    select: el instanceof HTMLSelectElement ? el : null,
    read: () => ({ name, kind, value: el.value, optional }),
    write: (seed) => {
      el.value = seed.seed;
    },
  };
}

function listControl(
  block: HTMLElement,
): FieldControl & { wire: (rerun: () => void, signal: AbortSignal) => void } {
  const name = block.dataset["field"] ?? "";
  const kind = block.dataset["kind"] as "list" | "intervals";
  const element = block.dataset["element"] || "string";
  const choices = (block.dataset["choices"] || "").split("\n").filter(Boolean);
  const optional = block.dataset["optional"] === "true";
  const rows = block.querySelector<HTMLElement>("[data-rows]")!;
  const addButton = block.querySelector<HTMLButtonElement>("[data-add]")!;

  const rowEls = (): HTMLElement[] => [
    ...rows.querySelectorAll<HTMLElement>("[data-row]"),
  ];
  const controlsOf = (row: HTMLElement) => [
    ...row.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input,select",
    ),
  ];

  const read = (): CallField => {
    if (kind === "intervals") {
      const pairs = rowEls().map((r): [string, string] => {
        const [start, end] = controlsOf(r);
        return [start?.value ?? "", end?.value ?? ""];
      });
      return { name, kind, pairs, optional };
    }
    const items = rowEls().map((r) => controlsOf(r)[0]?.value ?? "");
    return {
      name,
      kind,
      items,
      element: element as CallField["element"],
      optional,
    };
  };

  const rowHtml = (position: number, values: readonly string[]) => {
    const spec: PlaygroundRowSpec = {
      kind,
      element,
      choices,
      name,
      position,
      values,
    };
    return playgroundRowHtml(spec);
  };

  /** Names every row by its place again, so the numbers follow an add or a remove. */
  const labelRows = () => {
    rowEls().forEach((row, i) => {
      const label = `${name} ${i + 1}`;
      controlsOf(row).forEach((control, part) => {
        const suffix =
          kind === "intervals" ? (part === 0 ? " start" : " end") : "";
        control.setAttribute("aria-label", `${label}${suffix}`);
      });
      row
        .querySelector("[data-remove]")
        ?.setAttribute("aria-label", `Remove ${label}`);
    });
  };

  const fill = (rowsOfValues: readonly (readonly string[])[]) => {
    setHtml(
      rows,
      raw(rowsOfValues.map((v, i) => rowHtml(i + 1, v).value).join("")),
    );
  };

  const addRow = (): HTMLElement => {
    const holder = document.createElement("div");
    setHtml(holder, rowHtml(rowEls().length + 1, []));
    const row = holder.firstElementChild as HTMLElement;
    rows.append(row);
    labelRows();
    return row;
  };

  const removeRow = (row: HTMLElement) => {
    const all = rowEls();
    const at = all.indexOf(row);
    row.remove();
    labelRows();
    const rest = rowEls();
    const target = rest[at - 1] ?? rest[at];
    (target ? controlsOf(target)[0] : addButton)?.focus();
  };

  return {
    name,
    select: null,
    read,
    write: (seed: ChoiceSeed) => {
      fill(
        kind === "intervals"
          ? (seed.pairs ?? [])
          : (seed.items ?? []).map((item) => [item]),
      );
    },
    wire: (rerun, signal) => {
      addButton.addEventListener(
        "click",
        () => {
          addRow().querySelector<HTMLElement>("input,select")?.focus();
          rerun();
        },
        { signal },
      );
      rows.addEventListener(
        "click",
        (event) => {
          const remove = (event.target as Element).closest("[data-remove]");
          const row = remove?.closest<HTMLElement>("[data-row]");
          if (!row) return;
          removeRow(row);
          rerun();
        },
        { signal },
      );
    },
  };
}

interface FormConfig {
  modKey: string;
  fnName: string;
  returnType: string;
  allowEmptyArray: boolean;
  nullIsEmpty: boolean;
  optionsSuffix: string;
  objectArg: boolean;
}

function readConfig(form: HTMLElement): FormConfig {
  const d = form.dataset;
  return {
    modKey: d["module"] ?? "",
    fnName: d["fn"] ?? "",
    returnType: d["returnType"] ?? "string",
    allowEmptyArray: d["allowEmptyArray"] === "true",
    nullIsEmpty: d["nullIsEmpty"] === "true",
    optionsSuffix: d["optionsSuffix"] ?? "",
    objectArg: d["objectArg"] === "true",
  };
}

/** Mounts one rendered playground. Stops when `signal` aborts. */
export function mountPlayground(root: HTMLElement, signal: AbortSignal): void {
  const form = root.querySelector<HTMLElement>("[data-form]");
  const outputEl = root.querySelector<HTMLElement>("[data-result]");
  if (!form || !outputEl) return;
  const codeEl = root.querySelector<HTMLElement>("code");
  const copyEl = root.querySelector<HTMLElement>("gmt-copy");
  const config = readConfig(form);

  // One control per field, in document order = argument order.
  const cells = [...form.querySelectorAll<HTMLElement>("[data-field]")];
  const lists: ReturnType<typeof listControl>[] = [];
  const controls: FieldControl[] = cells.map((cell) => {
    if (
      cell.dataset["kind"] === "list" ||
      cell.dataset["kind"] === "intervals"
    ) {
      const control = listControl(cell);
      lists.push(control);
      return control;
    }
    return scalarControl(cell);
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Each run takes a ticket; a slow earlier run never overwrites a later one. */
  let latest = 0;

  const run = async (): Promise<void> => {
    const ticket = ++latest;
    const call = buildCall(
      config.fnName,
      controls.map((c) => c.read()),
      { optionsSuffix: config.optionsSuffix, objectArg: config.objectArg },
    );
    const args = parseCallArgs(call).map((a) => a.trim());
    if (codeEl) {
      setHtml(
        codeEl,
        raw(
          `${codeSpan("fn", config.fnName)}(${args.map(highlightArg).join(", ")})`,
        ),
      );
    }
    copyEl?.setAttribute("text", `${config.fnName}(${args.join(", ")})`);

    try {
      const mod = await GMT_MODULES[config.modKey]?.();
      if (!mod) throw new Error("module not found: " + config.modKey);
      const fn = mod[config.fnName];
      if (typeof fn !== "function")
        throw new Error("export not found: " + config.fnName);
      const result = (fn as (...a: unknown[]) => unknown)(
        ...args.map(evaluateArg),
      );
      if (signal.aborted || ticket !== latest) return;
      renderResult(outputEl, result, classifyPlaygroundResult(result, config));
    } catch {
      if (signal.aborted || ticket !== latest) return;
      renderResult(outputEl, "", "sentinel");
    }
  };

  const rerun = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), DEBOUNCE_MS);
  };
  signal.addEventListener("abort", () => clearTimeout(timer), { once: true });

  // Choosing an enum value loads that choice's example values over fields the reader has
  // not edited (see `createSeedLoader`). The change then re-runs the call as any edit does.
  let choiceSeeds: ChoiceSeeds | undefined;
  try {
    choiceSeeds = form.dataset["choiceSeeds"]
      ? (JSON.parse(form.dataset["choiceSeeds"]) as ChoiceSeeds)
      : undefined;
  } catch {
    choiceSeeds = undefined;
  }
  const loader = createSeedLoader(controls, choiceSeeds);
  loader.markLoaded();

  form.addEventListener(
    "input",
    (event) => {
      if (event.target instanceof HTMLInputElement) rerun();
    },
    { signal },
  );
  form.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const owner = controls.find((c) => c.select === target);
      if (owner && choiceSeeds?.[owner.name]) loader.onEnumChange(owner.name);
      rerun();
    },
    { signal },
  );
  for (const list of lists) list.wire(rerun, signal);

  void run();
}

/** Mounts every playground under `scope`. Returns a function that stops them all. */
export function startPlaygroundForms(scope: ParentNode = document): () => void {
  defineElements();
  const controller = new AbortController();
  for (const root of scope.querySelectorAll<HTMLElement>(
    '[data-widget="playground"]',
  )) {
    mountPlayground(root, controller.signal);
  }
  return () => controller.abort();
}
