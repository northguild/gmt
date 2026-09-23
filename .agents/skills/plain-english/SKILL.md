---
name: plain-english
description: Write so the reader gets it the first time, following ISO 24495-1:2023. Use whenever composing prose a person will read rather than run — commit messages, changesets and CHANGELOG entries, PR titles, descriptions and review comments, issues and comments filed on upstream repos such as tc39/proposal-temporal and js-temporal/temporal-polyfill, handoff notes, and any explanation written back to the user. Applies alongside /commit-message, /pr-desc and /changelog, never instead of them.
argument-hint: "no arguments needed"
---

# Plain English

Authority: ISO 24495-1:2023, _Plain language — Part 1: Governing principles and
guidelines_ (<https://www.iso.org/standard/78907.html>).

Writing is plain when its intended reader can **find** what they need, gets
**what they need** and little they do not, **understands** it on first reading,
and can **use** it to act. Those four are the standard's governing principles.
The rest of this file is how this repo applies them.

## Where it applies

Commit messages. Changesets and CHANGELOG entries. PR titles, descriptions and
review comments. Issues and comments filed on other people's repos. Handoff
notes. Anything written back to a person in a session.

Not code, tests, identifiers or JSDoc — those follow
[coding-standards.md](../../../context/coding-standards.md) and
[jsdoc-standards.md](../../../context/jsdoc-standards.md).

## How

- **Lead with the outcome.** The first sentence says what changed, or what is
  being asked for. Background follows it and never opens.
- **One idea per sentence.** If a sentence needs a second comma to stay
  upright, split it.
- **Active voice with a named actor.** `sortUtc compares instants`, not
  `instants are compared`.
- **Familiar words.** `use` over `utilise`, `so` over `accordingly`, `before`
  over `prior to`. Domain terms stay — instant, offset, DST, nudge window — and
  you define one on first use only when the reader plausibly lacks it.
- **Concrete over abstract.** Name the function, the file, the number, the
  version. `36,348 tests pass` beats `the tests pass`.
- **Bad news gets a direct sentence.** A bug, a regression, a thing not done,
  a thing not verified. State it; do not soften it into a clause.
- **Structure anything long.** Past a few paragraphs, use headings or short
  paragraphs carrying one point each.

## Plain is not simple

Technical depth stays. This governs how something is said, not how much is
said: a commit body can be long and dense and still be plain, provided each
sentence is short, active and concrete. Never drop detail, numbers or precise
terms to sound simpler — a reader who cannot act on the text has not been
served, however easy it was to read.

## Writing for someone else's repo

An upstream issue or comment is read by maintainers with no context on GMT.
Say what was observed, on which version, with a runnable reproduction and the
expected result, before saying what you think it means. Cite the spec clause
rather than asserting the behaviour is wrong.
