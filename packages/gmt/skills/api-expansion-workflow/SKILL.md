---
name: api-expansion-workflow
description: >
  Handle feature requests for missing gmt functionality by checking existing
  APIs first, then proposing a Temporal-backed custom method path with required
  issue/PR guidance and test-backed behavioral specs.
---

# API Expansion Workflow

Use this skill when a user asks for behavior that is not currently covered by gmt.

## Decision flow

1. Check existing APIs first
- Search `packages/gmt/src/plain` and `packages/gmt/src/zoned`.
- If capability exists, use the existing method and do not add new API.

 - When evaluating whether to add a new API, enforce the library's strict input/output policy: new public methods must accept explicit shapes (ISO 8601 strings, IANA timezone ids, or numeric unix epochs) and return normalized outputs. If the requested capability implies permissive parsing, recommend implementing a small adapter outside of core gmt instead of widening gmt's surface.

2. If capability does not exist
- Tell the user it is possible with Temporal because gmt ships Temporal.
- Tell the user it requires a new custom method in gmt.

3. Ask for product feedback loop
- Recommend opening a GitHub issue requesting the method.
- Suggest they include use case, expected input/output, and timezone expectations.

4. If implementing now
- Implement method with Temporal using gmt conventions.
- Add solid unit tests in the same change.
- Suggest opening a PR against gmt or attaching exact proposal text to the issue.

## Required issue template guidance

Encourage users to include:

1. Problem statement and current workaround.
2. Proposed method name.
3. Input and output examples.
4. Invalid input behavior expectations.
5. Plain vs zoned expectations and locale/timezone constraints.

## Test requirements for expansion work

1. Happy-path coverage for core scenarios.
2. Invalid-input fallback coverage.
3. Boundary coverage for date/time edges.
4. Zoned/DST coverage when timezone logic is involved.
5. Locale matrix coverage when locale options are part of API behavior.
