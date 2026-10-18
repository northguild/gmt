/**
 * The state of a workaround group on the installed runtime (CORE-81).
 *
 * Pure, Node built-ins only, no I/O. `scripts/temporal-compat.mjs` runs its command on import, so
 * the decision lives here where a test can import it.
 */

/** A numeric identifier without a leading zero (SemVer 2.0.0 §2 and §9). */
const NUMERIC = "0|[1-9]\\d*";
const IDENTIFIER = "[0-9A-Za-z-]+";
/** `MAJOR.MINOR.PATCH[-pre-release][+build]` (SemVer 2.0.0 §2, §9, §10). */
const VERSION = new RegExp(
  `^(${NUMERIC})\\.(${NUMERIC})\\.(${NUMERIC})(?:-(${IDENTIFIER}(?:\\.${IDENTIFIER})*))?(?:\\+${IDENTIFIER}(?:\\.${IDENTIFIER})*)?$`,
);
const NUMERIC_ONLY = new RegExp(`^(?:${NUMERIC})$`);

/**
 * Parses a version string, or returns null. A numeric pre-release identifier with a leading zero
 * is invalid (SemVer 2.0.0 §9), the same rule as for the three core numbers (§2).
 */
function parseVersion(text) {
  const match = VERSION.exec(text);
  if (!match) return null;
  const pre = match[4] === undefined ? [] : match[4].split(".");
  if (pre.some((id) => /^\d+$/.test(id) && !NUMERIC_ONLY.test(id))) return null;
  return { core: [match[1], match[2], match[3]], pre };
}

const sign = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);

/**
 * Compares two digit strings with no leading zero (SemVer 2.0.0 §2, §9) as numbers: more digits is
 * greater, equal length compares lexically. Exact above 2^53, where `Number` is not.
 */
function compareDigits(a, b) {
  if (a.length !== b.length) return sign(a.length - b.length);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** SemVer 2.0.0 §11.4: numeric identifiers compare numerically and precede alphanumeric ones. */
function comparePreIdentifier(a, b) {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);
  if (aNumeric && bNumeric) return compareDigits(a, b);
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * SemVer 2.0.0 §11 precedence of two version strings.
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1 | null} null when either is not `MAJOR.MINOR.PATCH[-pre][+build]`
 */
export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (left === null || right === null) return null;

  // §11.2: major, minor and patch, numerically.
  for (let i = 0; i < 3; i++) {
    const difference = compareDigits(left.core[i], right.core[i]);
    if (difference !== 0) return difference;
  }
  // §11.3: with equal cores, a pre-release precedes the release.
  if (left.pre.length === 0 || right.pre.length === 0) {
    return left.pre.length === right.pre.length
      ? 0
      : left.pre.length === 0
        ? 1
        : -1;
  }
  // §11.4: identifier by identifier; with all equal, the longer list is greater.
  const shared = Math.min(left.pre.length, right.pre.length);
  for (let i = 0; i < shared; i++) {
    const difference = comparePreIdentifier(left.pre[i], right.pre[i]);
    if (difference !== 0) return difference;
  }
  return sign(left.pre.length - right.pre.length);
}

/**
 * A workaround group's state on the installed runtime.
 * @param {{ probes: number, failing: number,
 *           guard?: { package: string, through: string, reason: string } }} group
 * @param {string} installed  the installed version of `group.guard.package`
 * @returns {{ state: "still-needed" | "removable" | "guard", guardLapsed: boolean }}
 * @throws {Error} when the group has a guard, every probe passes and `installed` cannot be
 *   compared with `guard.through`: a guard that cannot be decided is never reported as removable,
 *   nor silently as a guard.
 */
export function workaroundState(group, installed) {
  if (group.probes === 0 || group.failing > 0) {
    return { state: "still-needed", guardLapsed: false };
  }
  if (!group.guard) return { state: "removable", guardLapsed: false };

  const order = compareVersions(installed, group.guard.through);
  if (order === null) {
    throw new Error(
      `cannot compare ${group.guard.package} ${installed} with guard ${group.guard.through}`,
    );
  }
  return order <= 0
    ? { state: "guard", guardLapsed: false }
    : { state: "removable", guardLapsed: true };
}

/**
 * One snapshot row: a workaround group, its probe counts and its state on the installed runtime.
 * Lives beside `workaroundState` because `temporal-compat.mjs` runs its command on import, so a
 * test cannot import it; this keeps the row testable without the CLI.
 * @param {{ defects: string[], title: string, trigger: string,
 *           guard?: { package: string, through: string, reason: string } }} workaround
 * @param {{ probes: number, failing: number }} counts
 * @param {string} installed  the installed version of the guard's package
 * @returns {{ defects: string[], title: string, trigger: string, probes: number, failing: number,
 *             state: "still-needed" | "removable" | "guard",
 *             guard?: { package: string, through: string, reason: string } }}
 * @throws {Error} when the workaround has a guard, every probe passes, and `installed` cannot be
 *   compared with `guard.through` (see `workaroundState`)
 */
export function snapshotRow(workaround, counts, installed) {
  const { state } = workaroundState(
    { ...counts, guard: workaround.guard },
    installed,
  );
  return {
    defects: workaround.defects,
    title: workaround.title,
    trigger: workaround.trigger,
    probes: counts.probes,
    failing: counts.failing,
    state,
    ...(workaround.guard
      ? {
          guard: {
            package: workaround.guard.package,
            through: workaround.guard.through,
            reason: workaround.guard.reason,
          },
        }
      : {}),
  };
}
