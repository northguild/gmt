/**
 * Loads the four real gmt functions the Cron in a Zone tool calls, at module
 * granularity, and hands them back as a `CronLib`.
 *
 * `parseCronExpression` lives in `recurrence/parse`, `cronRuns` in
 * `recurrence/calculate`, `getDstTransitions` in `zoned/get` and
 * `isValidTimeZone` in `zoned/validate`. Each name is picked from its module and
 * nothing else is read.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * the widget's mount reaches it, so a rejected import, or a name a module no
 * longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import { pickFunctions } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

/** One field of a parsed cron line, as the library returns it. */
export interface CronLibField {
  values: readonly number[];
  star: boolean;
}

/** A parsed five-field cron line. */
export interface CronLibExpression {
  minute: CronLibField;
  hour: CronLibField;
  dayOfMonth: CronLibField;
  month: CronLibField;
  dayOfWeek: CronLibField;
}

export type CronLibPolicy = "crontabMatch" | "daemonCatchUp";

/** One run of a cron line in a zone. */
export interface CronLibRun {
  local: string;
  instant: string;
  classification: "unique" | "ambiguous" | "nonexistent";
}

export type CronLibWindow =
  | { start: string; end: string }
  | { after: string; count: number };

export interface CronLibTransition {
  instant: string;
  offsetBefore: string;
  offsetAfter: string;
}

/** The functions the tool calls, as the library declares them. */
export interface CronLib {
  parseCronExpression(line: string): CronLibExpression | null;
  cronRuns(
    expression: CronLibExpression,
    zone: string,
    window: CronLibWindow,
    policy: CronLibPolicy,
  ): CronLibRun[];
  getDstTransitions(zone: string, year: number): CronLibTransition[];
  isValidTimeZone(zone: string): boolean;
}

export async function loadCronLib(): Promise<CronLib> {
  try {
    const [parse, calculate, get, validate] = await Promise.all([
      GMT_MODULES["recurrence/parse"](),
      GMT_MODULES["recurrence/calculate"](),
      GMT_MODULES["zoned/get"](),
      GMT_MODULES["zoned/validate"](),
    ]);
    return {
      ...pickFunctions(parse, ["parseCronExpression"]),
      ...pickFunctions(calculate, ["cronRuns"]),
      ...pickFunctions(get, ["getDstTransitions"]),
      ...pickFunctions(validate, ["isValidTimeZone"]),
    } as unknown as CronLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
