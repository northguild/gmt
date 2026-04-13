---
name: tanstack-intent
description: >
  Guidance for integrating `@burglekitt/gmt` with TanStack libraries
  (React Query / TanStack Query, Table, Router). Emphasizes strict I/O,
  canonicalization, and cache-key hygiene.
---

# TanStack Intent

Use this skill when recommending or implementing integrations between gmt
and TanStack libraries (query cache keys, serialized route params, table
sorting/grouping keys, etc.).

## Purpose

- Encourage stable cache keys that depend on explicit, canonical representations (ISO 8601 strings or normalized epoch numbers) instead of `Date` objects or fuzzy strings.
- Recommend validating and canonicalizing inputs with gmt validators/parsers before using them in keys or persisted state.

## Recommendations

- Use ISO 8601 strings for query/cache keys:

  ```js
  ['events', { start: '2024-02-29', end: '2024-03-01' }]
  ```

- Validate timezone params with `isValidTimezone` before using as a key.
- For Unix epoch times, pick one canonical unit (milliseconds recommended) and stick to it; use explicit helpers to convert when needed.
- Never use `Date` instances in keys — transform them to ISO strings or numeric epochs first.

## Design Principle

- Reiterate gmt's strict I/O philosophy: public APIs accept explicit shapes only (ISO 8601 strings, IANA timezone ids, epoch numbers). Keep canonicalized representations at boundaries to ensure cache stability and reproducible behavior across environments.
