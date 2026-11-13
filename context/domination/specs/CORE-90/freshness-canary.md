# Slice 9 — freshness-canary: a weekly watch on federal, state and tz data

Index: [index.md](index.md). Model: `.github/workflows/leap-seconds.yml`, `scripts/leap-seconds.mjs`,
`scripts/canary-report.mjs` and `scripts/lib/canary-{issues,verdict,summary}.mjs`. Rules:
[context/canary/overview.md](../../../canary/overview.md) § Rules every canary follows. API facts
were read from the official docs on 2026-11-13. The sources are listed at the end.

## What it does

Every Monday it compares three sources with a committed snapshot. A difference opens or updates
**one issue per kind**:

| Kind (issue key) | Source | A difference means |
| ---------------- | ------ | ------------------ |
| `us-clock-watch/federal` | Congress.gov API | a federal bill on the subject appeared, or its latest action changed |
| `us-clock-watch/state` | Open States v3 API | a state bill on the subject appeared, or its latest action changed (50 states, DC, PR) |
| `us-clock-watch/tz-us-zone` | IANA tz database | a release changed the rules of a zone in `us-region-zones.json` |
| `us-clock-watch/could-not-run` | any | a source failed: a network error, an HTTP error, a 429, a body that does not parse, or a **missing secret**. Each failed source is named. The other sources still report |

- **The tz-us-zone issue is the phase-2 trigger.** Its body says: "A tz release changed a US
  zone's rules. This is the signal to build the US clock-change checker: CORE-90 phase 2, #341."
  It lists the changed zones and the release.
- **The federal and state issues are prompts for a person.** Each body lists what is new or
  changed and ends: "Review the change. Edit `sunshine-protection-act-proposals.ts` and its
  checked date by hand if a position changed, then run `node scripts/us-clock-watch.mjs
  refresh` and commit the snapshot." The canary never edits the proposal module or the
  snapshot.
- **No law in the script.** The script, the workflow and the tests hold subject keywords only:
  no bill number, title, statute or body name. Bill numbers and titles appear in the snapshot
  and in issue bodies only as data the APIs returned.
- **Exit codes**, as in `leap-seconds.mjs`: 0 when nothing differs, 1 on a difference, 2 when any
  source could not run. The verdict file is written before the exit.

## Files

| File | Role |
| ---- | ---- |
| `.github/workflows/us-clock-watch.yml` (new) | weekly cron `17 7 * * 1`, `workflow_dispatch` with input `force_difference` (dry run) |
| `scripts/us-clock-watch.mjs` (new) | `check` and `refresh`, using Node built-ins and `fetch` only, with no install |
| `scripts/us-clock-watch.snapshot.json` (new, formatted with oxfmt) | the committed snapshot |
| `scripts/lib/canary-verdict.mjs` | `usClockWatchVerdict`, plus `couldNotRunVerdict` reuse |
| `scripts/lib/canary-issues.mjs` | `WORKFLOW_SOURCES["us-clock-watch"]`, the four findings, the dry-run finding |
| `scripts/lib/canary-summary.mjs` | the job summary rows |
| `scripts/canary-report.mjs` | accept workflow `us-clock-watch` and the flag `--force-us-clock-difference` |
| `apps/dox/scripts/canary/us-clock-watch.test.ts` (new) | offline tests with recorded fixtures |
| `apps/dox/scripts/canary/fixtures/us-clock-watch/*` (new) | trimmed API responses and a `northamerica` excerpt |
| `canary-issues.test.ts`, `canary-report.test.ts`, `canary-summary.test.ts` | extended |

## Workflow — `.github/workflows/us-clock-watch.yml`

- It is built like `leap-seconds.yml`: one job, `contents: read` and `issues: write`, checkout
  with `persist-credentials: false`, and `setup-node` on 24. It runs no install and no
  third-party code.
- **Secrets go to the check step only:**
  `env: { CONGRESS_GOV_API_KEY: ${{ secrets.CONGRESS_GOV_API_KEY }}, OPEN_STATES_API_KEY: ${{ secrets.OPEN_STATES_API_KEY }} }`.
  - The report step gets `GH_TOKEN` and `FORCE_DIFFERENCE` only.
  - The script sends each key in a header (`X-Api-Key`, `X-API-KEY`), never in a URL. It never
    prints a key or a request URL that holds one.
- The report step runs with `if: ${{ !cancelled() }}` and calls
  `node scripts/canary-report.mjs us-clock-watch [--force-us-clock-difference]`.
- **Issues are filed only from `main`.** On any other branch the report lists what it would have
  filed in the job summary (the existing `GITHUB_REF_NAME` rule).
- **Dry run.** The dispatch input `force_difference` files a `[dry run]` issue with the
  `canary-dry-run` label for one synthetic federal difference. It changes no comparison and no
  exit code.
- The header comment names the retirement: [index.md](index.md) § Decisions, item 11.

## Secrets the owner registers

| Secret name | Key from | Sign-up |
| ----------- | -------- | ------- |
| `CONGRESS_GOV_API_KEY` | an api.data.gov key, which Congress.gov accepts | <https://api.congress.gov/sign-up/> |
| `OPEN_STATES_API_KEY` | an Open States (Plural Policy) account key. It must be activated before use | <https://open.pluralpolicy.com/accounts/profile/> |

A missing or empty secret makes that source "could not run", with the reason "secret
`<NAME>` is not set". It is never a silent pass, and the exit code is 2.

## Source 1 — Congress.gov API (federal)

- **Documented.**
  - The API is v3, and a key is required.
  - The limit is "5,000 requests per hour" (Congress.gov README).
  - api.data.gov accepts the key in the `X-Api-Key` header. A 429 with `OVER_RATE_LIMIT` blocks
    the key for an hour, and responses carry `X-RateLimit-Remaining` (api.data.gov developer
    manual).
  - Lists return 20 records by default and up to 250 with `limit`, paged with `offset`.
  - The bill list can be filtered by congress and bill type.
- **No keyword search.** The `/bill` list has no keyword or subject filter, so the script works
  in three steps:
  1. `GET /v3/congress/current` gives the current congress number, so no session number is
     coded into the script.
  2. `GET /v3/bill/{congress}?fromDateTime=<snapshot.federal.checkedAt>&sort=updateDate+desc&limit=250&offset=n`
     pages through every bill updated since the last snapshot.
  3. Each bill's `title` is matched against `SUBJECT_TERMS`. A match, and every bill already in
     the snapshot, gets `GET /v3/bill/{congress}/{type}/{number}` for its `latestAction`.
- **Verify at implementation.** Check `/congress/current`, and the parameter names and formats
  for `fromDateTime` and `sort`, against the OpenAPI document linked from api.congress.gov. If a
  name differs, use the documented one and note it here.
- **Budget.** At most 400 requests per run, which is under a tenth of the hourly limit. Stop and
  report could-not-run if `X-RateLimit-Remaining` falls below 100 or the budget runs out.
  Requests are sequential.

## Source 2 — Open States v3 API (states)

- **Documented.**
  - The base is `https://v3.openstates.org/`. The key goes in the `X-API-KEY` header or the
    `apikey` parameter, and keys must be activated (docs.openstates.org/api-v3).
  - `GET /bills` "must either specify a jurisdiction or a full text query (q)". It also takes
    `action_since`, `sort` (`latest_action_desc` and others), `include` (`actions`), `page`, and
    `per_page`, which defaults to 10 (OpenAPI at `v3.openstates.org/openapi.json`).
  - **No rate limit is published.** The v3 changelog says only "add rate limiting" (2020-10-13),
    and the v3 launch post says limits were "not yet determined". Third-party figures disagree,
    so the script does not rely on any of them.
- **Query.**
  - For each term in `SUBJECT_TERMS`, call
    `GET /bills?q=<term>&action_since=<snapshot.state.checkedAt>&sort=latest_action_desc&per_page=20&page=n`,
    with no jurisdiction, so every jurisdiction is searched.
  - Keep results whose jurisdiction is one of the 50 states, DC or PR, matched on the
    jurisdiction classification and id from the response, never on a hand list of names.
- **Self-imposed pacing:** one request per second, at most 60 per run, `per_page=20`. A 429 makes
  the source could-not-run and does not retry.

## Source 3 — IANA tz database

- `GET https://data.iana.org/time-zones/tzdb/version`, then `northamerica` and `australasia` from
  the same directory. These two files hold every zone in `us-region-zones.json`.
- For each zone, normalise its `Zone` block and every `Rule` line the block names: strip
  comments, collapse whitespace, keep order. Store the SHA-256 (from `node:crypto`). `Link` lines
  are followed to their target zone.
- A difference is any zone whose hash changed. A new release that changes no US zone is not a
  finding. The summary says "release X: no US zone changed".

## `SUBJECT_TERMS`

`["daylight saving time", "standard time", "time zone"]` cover the subject. They are not names.
Title matching for Congress.gov is case-insensitive on those phrases plus `"daylight time"`. No
term may be a bill's short title. The test asserts that the list holds no capitalised proper
noun.

## Snapshot — `scripts/us-clock-watch.snapshot.json`

```json
{ "federal": { "checkedAt": "…Z", "congress": 0, "bills": [{ "type": "", "number": "", "title": "", "latestAction": { "actionDate": "", "text": "" } }] },
  "state":   { "checkedAt": "…", "bills": [{ "jurisdiction": "", "session": "", "identifier": "", "title": "", "latestActionDate": "", "latestActionDescription": "" }] },
  "tz":      { "release": "2026e", "zones": { "America/New_York": "<sha256>" } } }
```

- **`refresh`** fetches all three sources in full and writes the snapshot. It is run by hand
  with both keys in the environment, and the owner commits the result.
- The first `refresh` lists the whole current congress: about 60 Congress.gov pages.
- `checkedAt` comes from the response `Date` header. The script reads no clock of its own.
- A congress number different from the snapshot's is itself a federal difference ("a new
  session began"). The next `refresh` resets the list.

## Tests — `apps/dox/scripts/canary/us-clock-watch.test.ts`

All offline: `fetch` is injected and serves fixtures. Each test restores its stubs in
`afterEach`. Tests cover:

- **Bills.** A new matching federal bill is a difference. A changed `latestAction` is a
  difference. A non-matching title is ignored. A state result outside the 50 states, DC and PR
  is ignored.
- **tz.** A changed `Rule US` line flags every zone that names it. A changed `Rule Cuba` flags
  nothing. A comment-only edit flags nothing.
- **Could not run.** A missing secret, a 429, malformed JSON and the budget running out each give
  could-not-run, the other sources still report, and the exit code is 2.
- **No key leaks.** No key value appears in stdout, stderr or the verdict file.
- **Findings.** In the `canary-issues.test.ts` additions, the four kinds key one issue each. A
  repeat comments rather than opening a second issue. The tz body names CORE-90 and #341. The dry
  run is labelled.

The canary is never wired into `ci.yml` or `validate`.

## Context doc

The canary lives in **`context/canary/overview.md`**, which already lists every canary,
including the earlier ones filed under `CORE-*` stories:

- one row in "The canaries", with its story given as
  [CORE-90](../../issues/CORE-90.md);
- a short section on its sources, secrets and the phase-2 trigger.

There is no new `CNRY-*` id and no row in `context/canary/tracker.md`. That tracker lists canary
stories, and CORE-90 is a Dox story whose row stays in `context/domination/tracker.md`. The work
lands in the CORE-90 PR.

## Sources read

- Congress.gov API README: github.com/LibraryOfCongress/api.congress.gov
- `Documentation/BillEndpoint.md` in the same repository
- api.data.gov developer manual
- docs.openstates.org/api-v3 and its changelog
- `v3.openstates.org/openapi.json`
- blog.openstates.org, "Open States API v3 beta"
