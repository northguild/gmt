import { Temporal } from "../internal/temporal";

/** What a test file must leave as it found it when it shares a worker with other files. */
export interface SharedState {
  /** Identity of each watched global, constructor and `Temporal.Now` member, by name. */
  readonly objects: Map<string, unknown>;
  /** Own keys of `globalThis`. */
  readonly globalKeys: Set<string>;
  /** Names in `process.env`. */
  readonly envKeys: Set<string>;
}

function watched(): Map<string, unknown> {
  const objects = new Map<string, unknown>();
  const add = (prefix: string, target: object) => {
    objects.set(prefix, target);
    for (const key of Reflect.ownKeys(target)) {
      objects.set(`${prefix}.${String(key)}`, Reflect.get(target, key));
    }
  };
  add("Intl", Intl);
  add("Temporal", Temporal);
  add("Temporal.Now", Temporal.Now);
  add("Date", Date);
  objects.set("Date.now", Date.now); // date-ban: kept to detect a file that replaces it
  return objects;
}

/** Records the watched state before a test file runs. */
export function captureSharedState(): SharedState {
  return {
    objects: watched(),
    globalKeys: new Set(Reflect.ownKeys(globalThis).map(String)),
    envKeys: new Set(Object.keys(process.env)),
  };
}

/** Describes every difference between the recorded state and the current one; empty when none. */
export function describeLeaks(before: SharedState): string[] {
  const leaks: string[] = [];
  const now = watched();
  for (const [name, value] of before.objects) {
    if (!now.has(name)) leaks.push(`${name} was removed`);
    else if (now.get(name) !== value) leaks.push(`${name} was replaced`);
  }
  for (const name of now.keys()) {
    if (!before.objects.has(name)) leaks.push(`${name} was added`);
  }
  const keys = new Set(Reflect.ownKeys(globalThis).map(String));
  for (const key of keys) {
    if (!before.globalKeys.has(key)) leaks.push(`globalThis.${key} was added`);
  }
  for (const key of before.globalKeys) {
    if (!keys.has(key)) leaks.push(`globalThis.${key} was removed`);
  }
  for (const key of Object.keys(process.env)) {
    if (!before.envKeys.has(key)) leaks.push(`process.env.${key} was added`);
  }
  for (const key of before.envKeys) {
    if (!(key in process.env)) leaks.push(`process.env.${key} was removed`);
  }
  return leaks;
}
