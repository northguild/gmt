---
name: issue-creation
description: >
  Create feature requests for missing @burglekitt/gmt functionality
  with proper context, examples, and details that help maintainers
  understand and implement the requested feature.
---

# Issue Creation

Use this skill when a user needs functionality that gmt does not currently provide.

## When to Create an Issue

- A needed date/time operation is not available in gmt
- Existing gmt methods don't handle a specific edge case
- Documentation is unclear and causes confusion
- A bug is found in existing functionality

## Required Issue Details

### 1. Problem Statement

Describe what you're trying to accomplish:

```
I need to [specific task] but gmt doesn't support this.
Current workaround: [what you currently do]
```

### 2. Expected Behavior

Show what you expect:

```js
// Input
"2024-03-15"

// Expected output
"Q1 2024"
```

### 3. Plain vs Zoned

Clarify timezone requirements:

- **Plain** (timezone-free): Operations that work regardless of timezone
- **Zoned** (timezone-aware): Operations in a specific IANA timezone

### 4. Invalid Input Handling

Specify what should happen with invalid inputs:

- String return: `""` (empty string)
- Number return: `null`
- Boolean return: `false`

### 5. Locale Requirements

If locale affects output, specify which locales need support.

## Issue Template

```markdown
## Problem
[What you need but gmt doesn't provide]

## Expected Behavior
[Code example showing input and expected output]

## Plain or Zoned?
[Does this need timezone awareness?]

## Invalid Input
[What should happen with invalid inputs?]

## Use Case
[Why do you need this? What's the business context?]
```

## Example Issues

### Good Issue

```markdown
## Problem
I need to get the ISO week number from a date string.

## Expected Behavior
getWeekOfYear("2024-01-01") // returns 1
getWeekOfYear("2024-12-31") // returns 1 (ISO weeks start Monday)

## Plain or Zoned?
Plain (no timezone needed)

## Invalid Input
Return null on invalid input
```

### What to Avoid

- "Add date formatting" (too vague)
- "Add support for [framework]" (gmt is framework-agnostic)
- "It's broken" (no reproduction steps)

## After Creating

1. Check for duplicate issues first
2. Add to existing issue if duplicates found
3. Monitor the issue for maintainer responses
4. Be ready to provide additional context

## Related Skills

- **pr-contribution**: If you want to implement the feature yourself
- **new-method-implementation**: For maintainer guidance on implementation