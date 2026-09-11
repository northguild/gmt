/**
 * The reset clock — when Dox's allowance comes back, in the reader's zone and a
 * format they choose.
 *
 * ## Why a chip and one popover
 *
 * The composer's control bar already holds the brain badge and Send. Two more
 * dropdowns would crowd it and fall apart at phone width, so the readout is
 * itself the trigger and every choice lives behind it.
 *
 * The chip sits hard left in the bar. Its readout changes width with every
 * format and every minute, so anchoring the popover to its left edge — which
 * never moves — is what keeps the panel from jumping as the reader clicks
 * through formats.
 *
 * ## Why every format is a gmt call
 *
 * This is the one real instant on screen in the chat, which makes it the
 * cheapest possible tour of the library: the reader changes zone and format,
 * sees the output change, and sees the exact call that produced it — linked to
 * that function's reference page. See `lib/reset-formats.ts`.
 *
 * ## Why Popover + cmdk, not the site's zone combobox or a Radix menu
 *
 * `lib/zone-combobox.ts` (the globe's and the scrubber's) absolutely positions
 * its list *below* the input, and its styles are code-split into the globe's
 * sheet. In a popover opening upward from the bottom of the viewport that list
 * would fall out of view. cmdk renders its list inline and scrolls it. A Radix
 * *menu* was ruled out too: its typeahead swallows the keystrokes a zone search
 * needs.
 */
import { useId, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { listResets, nextReset } from "~/lib/quota-resets";
import { RESET_FORMATS, findResetFormat } from "~/lib/reset-formats";
import type { BrainsInfo } from "./use-brains";
import type { ResetClockState } from "./use-reset-clock";

export function ResetClock({
  info,
  selectedBrainId,
  clock,
}: {
  info: BrainsInfo | null;
  /** The reader's explicit brain pick — for a dev, it decides which provider's
   * reset the chip shows. */
  selectedBrainId: string | null;
  clock: ResetClockState;
}) {
  const [open, setOpen] = useState(false);
  const formatName = useId();

  // Nothing to show before the budget has loaded or the reader's zone is known
  // (see use-reset-clock.ts on hydration).
  if (!info || !clock.ready) return null;

  const reset = nextReset(info, selectedBrainId);
  if (!reset) return null;

  const preset = findResetFormat(clock.formatId);
  const ctx = {
    timeZone: clock.zone,
    locale: clock.locale,
    now: clock.now,
  };
  const readout = preset.format(reset.resetsAt, ctx);
  if (readout === "") return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="gmt-hive-clock gmt-sonar-focus"
          aria-label={`${reset.label} reset ${readout}. Change the zone or format.`}
        >
          <span className="gmt-hive-clock-glyph" aria-hidden="true">
            ↻
          </span>
          <span className="gmt-hive-clock-readout">{readout}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        className="gmt-hive-clock-panel"
        aria-label="Quota resets"
      >
        <section className="gmt-hive-clock-section">
          <h3 className="gmt-hive-clock-heading">Resets</h3>
          <dl className="gmt-hive-clock-resets">
            {listResets(info).map((row) => (
              <div
                key={row.id}
                className="gmt-hive-clock-reset"
                data-current={row.id === reset.id ? "" : undefined}
              >
                <dt>{row.label}</dt>
                <dd>{preset.format(row.resetsAt, ctx)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Native radios: arrow keys move between them and one Tab stop covers
            the group, with nothing to reimplement. */}
        <fieldset className="gmt-hive-clock-section gmt-hive-clock-formats">
          <legend className="gmt-hive-clock-heading">Format</legend>
          {RESET_FORMATS.map((option) => (
            <label
              key={option.id}
              className="gmt-hive-clock-format"
              data-checked={option.id === preset.id ? "" : undefined}
            >
              <input
                type="radio"
                name={formatName}
                value={option.id}
                checked={option.id === preset.id}
                onChange={() => clock.setFormatId(option.id)}
              />
              <span className="gmt-hive-clock-format-label">
                {option.label}
              </span>
              <code className="gmt-hive-clock-format-fn">{option.fnName}</code>
            </label>
          ))}
        </fieldset>

        <section className="gmt-hive-clock-section">
          <h3 className="gmt-hive-clock-heading">
            Zone <span className="gmt-hive-clock-zone">{clock.zone}</span>
          </h3>
          <Command className="gmt-hive-clock-zones" label="Time zone">
            <CommandInput
              disabled={!preset.zoned}
              placeholder={
                preset.zoned ? "Search zones…" : "Same in every zone"
              }
            />
            {preset.zoned && (
              <CommandList>
                <CommandEmpty>No zone matches.</CommandEmpty>
                {clock.zones.map((zone) => (
                  <CommandItem
                    key={zone}
                    value={zone}
                    onSelect={() => clock.setZone(zone)}
                    data-current={zone === clock.zone ? "" : undefined}
                    className="gmt-hive-clock-zone-option"
                  >
                    {zone}
                  </CommandItem>
                ))}
              </CommandList>
            )}
          </Command>
        </section>

        {/* A new tab on purpose: navigating this one would throw away the
            conversation. */}
        <a
          className="gmt-hive-clock-call gmt-sonar-focus"
          href={preset.route}
          target="_blank"
          rel="noopener"
        >
          <code>{preset.call(ctx)}</code>
          <span aria-hidden="true"> ↗</span>
          <span className="sr-only"> (opens the reference in a new tab)</span>
        </a>
      </PopoverContent>
    </Popover>
  );
}
