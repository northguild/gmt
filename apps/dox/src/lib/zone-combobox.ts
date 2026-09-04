/**
 * A small typeahead combobox over a list of IANA zone ids, used by the globe's
 * "Find a zone" and the scrubber's "Add a zone".
 *
 * Replaces the native `<datalist>`, whose suggestion popup the browser renders
 * as unstyleable chrome that can land to the *side* of the input. This one
 * renders its options in a listbox directly below, styled to match the HUD, and
 * keeps the focus "sonar" ping (the input carries `.gmt-sonar-focus`).
 *
 * Keyboard: ArrowUp/Down move the active option, Enter selects it, Escape
 * closes, Tab closes and moves on.
 */

export interface ZoneComboboxHandle {
  destroy: () => void;
}

const MAX_RESULTS = 60;

export function createZoneCombobox(
  input: HTMLInputElement,
  zones: readonly string[],
  onSelect: (zone: string) => void,
): ZoneComboboxHandle {
  input.removeAttribute("list");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.autocomplete = "off";
  input.classList.add("gmt-sonar-focus");

  const listId = input.id
    ? `${input.id}-listbox`
    : `zone-combobox-${Math.random().toString(36).slice(2, 8)}`;
  const list = document.createElement("ul");
  list.className = "gmt-combobox-list";
  list.id = listId;
  list.setAttribute("role", "listbox");
  list.hidden = true;
  input.setAttribute("aria-controls", listId);
  input.insertAdjacentElement("afterend", list);

  let options: string[] = [];
  let activeIndex = -1;
  let blurTimer: ReturnType<typeof setTimeout> | undefined;

  const zoneSet = new Set(zones);

  function filtered(query: string): string[] {
    const q = query.trim().toLowerCase();
    const matches = q
      ? zones.filter((z) => z.toLowerCase().includes(q))
      : zones.slice();
    return matches.slice(0, MAX_RESULTS);
  }

  function open(): void {
    options = filtered(input.value);
    renderOptions();
    const show = options.length > 0;
    list.hidden = !show;
    input.setAttribute("aria-expanded", String(show));
  }

  function close(): void {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  function renderOptions(): void {
    list.innerHTML = "";
    options.forEach((zone, index) => {
      const item = document.createElement("li");
      item.className = "gmt-combobox-option";
      item.id = `${listId}-opt-${index}`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === activeIndex));
      item.textContent = zone;
      item.addEventListener("mousedown", (event) => {
        event.preventDefault(); // keep focus on the input
        commit(zone);
      });
      list.appendChild(item);
    });
  }

  function setActive(index: number): void {
    if (options.length === 0) return;
    activeIndex = (index + options.length) % options.length;
    for (const [i, el] of [...list.children].entries()) {
      el.setAttribute("aria-selected", String(i === activeIndex));
    }
    const active = list.children[activeIndex] as HTMLElement | undefined;
    if (active) {
      input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    }
  }

  function commit(zone: string): void {
    input.value = zone;
    close();
    if (zoneSet.has(zone)) onSelect(zone);
  }

  function onInput(): void {
    open();
  }

  function onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (list.hidden) open();
        else setActive(activeIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!list.hidden) setActive(activeIndex - 1);
        break;
      case "Enter": {
        if (!list.hidden && activeIndex >= 0) {
          event.preventDefault();
          commit(options[activeIndex]);
        } else if (zoneSet.has(input.value.trim())) {
          commit(input.value.trim());
        }
        break;
      }
      case "Escape":
        if (!list.hidden) {
          event.preventDefault();
          close();
        }
        break;
      case "Tab":
        close();
        break;
      default:
    }
  }

  function onFocus(): void {
    if (blurTimer) clearTimeout(blurTimer);
    open();
  }

  function onBlur(): void {
    blurTimer = setTimeout(close, 120);
  }

  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("focus", onFocus);
  input.addEventListener("blur", onBlur);

  return {
    destroy() {
      if (blurTimer) clearTimeout(blurTimer);
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKeyDown);
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
      list.remove();
    },
  };
}
