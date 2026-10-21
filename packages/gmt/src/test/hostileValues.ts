/**
 * Hostile argument values for the no-throw harnesses. They use no Node API, so a browser run can
 * import them without loading the source scan in `noThrow.ts`.
 */

/** A proxy whose every trap throws: hostile to reads, key enumeration and `Array.isArray` alike. */
export function hostileProxy(): unknown {
  const trap = (): never => {
    throw new TypeError("hostile proxy");
  };
  return new Proxy(
    {},
    {
      get: trap,
      has: trap,
      ownKeys: trap,
      getOwnPropertyDescriptor: trap,
      getPrototypeOf: trap,
    },
  );
}

/** A revoked proxy: every internal method throws, including the ones a `typeof` guard cannot see. */
export function revokedProxy(): unknown {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  return proxy;
}
