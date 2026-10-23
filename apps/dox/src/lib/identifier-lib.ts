/**
 * Loads the five identifier decoders the ID Timestamp Decoder needs, at module
 * granularity, and hands them back as an `IdentifierLib`.
 *
 * All five live in `precision/identifiers`. Each name is picked from that module
 * and nothing else is read. The two prefix functions are not loaded: no Dox tool
 * calls them. The Column Timestamp Bridge reuses this loader pattern with its
 * own module (`precision/convert`).
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * the widget's mount reaches it, so a rejected import, or a name a module no
 * longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import type { SnowflakeLayout } from "@northguild/gmt";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

export type { SnowflakeLayout };

/** What `fromUuidTimestamp` returns for a time-ordered UUID. */
export interface UuidTimestamp {
  instant: string;
  version: 1 | 6 | 7;
}

/** The functions the tool calls, as the library declares them. */
export interface IdentifierLib {
  fromUuidTimestamp(uuid: string): UuidTimestamp | null;
  fromUlid(ulid: string): string;
  fromObjectId(objectId: string): string;
  fromKsuid(ksuid: string): string;
  fromSnowflake(id: bigint | string, layout: SnowflakeLayout): string;
}

/** Reads each name from a module, and fails loudly on a name it lacks. */
function pick(module: Record<string, unknown>, names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => {
      if (typeof module[name] !== "function") {
        throw new Error(`The library module has no ${name}.`);
      }
      return [name, module[name]];
    }),
  );
}

export async function loadIdentifierLib(): Promise<IdentifierLib> {
  try {
    const identifiers = await GMT_MODULES["precision/identifiers"]();
    return pick(identifiers, [
      "fromUuidTimestamp",
      "fromUlid",
      "fromObjectId",
      "fromKsuid",
      "fromSnowflake",
    ]) as unknown as IdentifierLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
