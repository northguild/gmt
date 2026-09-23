---
"@northguild/gmt": patch
---

Return the sentinel for arguments that are hostile to inspection, not just hostile to `ToString` (Story CORE-8).

**What was wrong.** 221 of the 551 exports threw when an argument resisted being looked at. A revoked `Proxy` throws on `get`, `ownKeys` and `Array.isArray`; an object with a throwing getter throws when a rest-spread enumerates it. Those operations sat in the guards *above* each function's `try`, so the guard meant to reject invalid input raised instead.

```typescript
import { addDate, formatUnix } from "@northguild/gmt";

const { proxy, revoke } = Proxy.revocable({}, {});
revoke();

addDate("2024-01-01", proxy);
// ""  — was: TypeError: Cannot perform 'ownKeys' on a proxy that has been revoked

formatUnix(0, "en-US", { get length() { throw new Error("boom"); } });
// ""  — was: Error: boom
```

Every affected export now evaluates its whole body inside the `try` whose `catch` already returned its sentinel, so a guard cannot raise. Valid input is unaffected: all 36,348 tests pass unchanged.

**Why it was invisible.** The no-throw harness fed each export a list of eleven hostile values, and a list only finds what someone thought to put on it. It now also passes a proxy that throws on every trap, a revoked proxy, and an object with a throwing getter — values hostile to *any* access rather than to one named operation.
