/**
 * Orders two `x.y.z` release numbers, as Semantic Versioning 2.0.0 § 11 orders them: by major, then
 * minor, then patch, each compared as a number.
 */

const RELEASE = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/;

/**
 * @param {string} a  an `x.y.z` release
 * @param {string} b  an `x.y.z` release
 * @returns {-1 | 0 | 1}  -1 when `a` is older than `b`, 1 when newer, 0 when the same
 * @throws {Error} when either is not `x.y.z`
 */
export function compareReleases(a, b) {
  const pa = RELEASE.exec(a);
  const pb = RELEASE.exec(b);
  if (pa === null || pb === null) {
    throw new Error(`not a x.y.z version: ${pa === null ? a : b}`);
  }
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}
