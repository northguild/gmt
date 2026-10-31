---
name: dox-full-sweep
description: Run the weekly-tier Dox gates on request with --all, in Chromium, Firefox and WebKit and both themes, and print a findings summary. Local-tier gates are left out. Files no issues. Use when the user says "full sweep", "run the full Dox sweep", "sweep every page" or "run the gates on all pages".
---

# Dox full sweep

Runs the weekly-tier Dox gates with `--all`, then prints what failed. It files no issues; the
owner decides what to do with the findings.

## 1. Warn first

Before you start anything, tell the user: **a full sweep takes 2 to 3 hours on a laptop**, and
the machine is busy until it ends. Wait for a yes. If the answer is no, stop.

## 2. Run it

From the repo root, on the Node the repo pins (`eval "$(fnm env)" && fnm use &&`):

```bash
pnpm --filter dox gates --all --tier weekly --browsers chromium,firefox,webkit --themes dark,light
```

- What it covers: the gates in tier `weekly` or below. A gate with `fullBrowsers` runs every page
  in those browsers only; the other browsers get the sample pages. A gate whose `browsers` list
  leaves out a requested browser is dropped for that browser without a message of its own.
  `globe-smoke`, `html-diff` and `visual-diff` are tier `local` and never run here; the two diff
  gates also need `--baseline`.
- The runner builds the Dox site first unless you pass `--no-build`, which needs an existing
  `apps/dox/dist`.
- The tier is named `weekly` in the gate registry. `nightly` is not a tier; the runner rejects it.
- Run it in the background and wait for it. Do not start a second run: a live `.gates/lock`
  makes the runner exit 2.
- Firefox may not launch on the author's machine. If it does not, report the Firefox legs as
  "not verified" and say why. Do not work around the sandbox.

## 3. Print the findings summary

Read `apps/dox/.gates/summary.json` (or add `--json`), not the logs. Print:

- The command, the exit code and the run time.
- One line per gate: PASS, FLAKY, FAIL or SKIP, with the row's `detail`. For a PASS or FAIL it
  names the pages, the browsers, the themes and any browser dropped, as `(no firefox)`. A FLAKY
  row replaces that text, so take its browsers from `--plan --json` with the same arguments.
- The summary's `context` line (pages and browsers actually used) and which browsers each gate
  dropped. Say plainly that local-tier gates did not run.
- For each FAIL, the gate, the page, the rule and the one log line that names it. Open a gate's
  log in `apps/dox/.gates/<gate>.log` only for a FAIL.
- A FLAKY line is a pass on the second try. List it; do not hide it.
- Anything not run, and why.

Write it for a person, following [plain-english](../plain-english/SKILL.md).

## 4. Files no issues

Do not run `gh issue create`, do not run the issue filer, and do not comment on an
existing issue. Say that no issue was filed.
