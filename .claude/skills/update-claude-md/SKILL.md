---
name: update-claude-md
description: >-
  Reviews recent changes in this repo (qa-platform) against the three
  CLAUDE.md files — root, main/, admin/ — and updates whichever ones have
  drifted out of date. Use at the end of a work session, or any time a
  change introduces a new table, a new cross-cutting pattern, a new
  convention future work should follow, or a new gotcha worth documenting
  inline. Not meant to fire on every single file edit — CLAUDE.md is a
  map/orientation doc, not a changelog, so only update it for things a
  future session would actually need to know to avoid re-deriving from
  scratch or repeating a mistake.
version: 1
---

# Keep CLAUDE.md in sync

This repo has three CLAUDE.md files: the root one (map of the two-app/
shared-database shape), `main/CLAUDE.md`, and `admin/CLAUDE.md`. They're
read at the start of every session and are the fastest way a future
session avoids re-exploring the codebase from scratch — letting them
drift out of date defeats the point of having them.

## When to actually update

Update CLAUDE.md when a change introduces one of:
- **A new table or schema concept** that other work will need to know
  about (e.g. a new tenancy/grouping layer, a new audit table).
- **A new cross-cutting pattern** worth reusing rather than
  re-inventing — e.g. a security-definer RLS helper function and its
  "mirror this shape" precedent, a shared UI primitive, a shared lib
  function multiple call sites should use.
- **A new gotcha or footgun** discovered the hard way — something that
  broke once and would break again if a future session didn't know
  about it (matches the existing style of documented incidents like the
  `supabase config push` whole-file-overwrite behavior, or the
  `main/CHANGELOG.md` copy-not-symlink requirement).
- **A new env var, external service dependency, or config section**
  that changes how the app is set up or deployed.

Do NOT update CLAUDE.md for: routine feature additions that don't
introduce a new pattern (e.g. another page following an existing
ProjectShell/getServerSideProps pattern), copy/wording changes, or
anything already fully explained by reading the code itself.

## How to do it

1. Look at what actually changed this session — `git diff`/`git log`
   against the base this session started from, or your own memory of
   what you built if the diff isn't available.
2. For each of the three CLAUDE.md files, ask: does this file's
   description of "how this app works" still match reality? Specifically
   check the sections most likely to rot:
   - Root `CLAUDE.md`: the "Shape of the repo" and "Cross-app
     touchpoints" sections — new shared tables, new middleware
     exemptions, new env vars used by both apps.
   - `main/CLAUDE.md`: "Auth & data access" (new RLS helper functions,
     new client patterns) and "Patterns that repeat everywhere" (new
     reusable lib functions, new established UI patterns).
   - `admin/CLAUDE.md`: "Access control," "Data access," and "Patterns
     that repeat everywhere" — new destructive-action routes (must call
     `logAdminAction` + get an `ACTION_LABEL` entry), new cross-tenant
     visibility added.
3. Write updates in the same terse, high-signal style already used in
   these files — short paragraphs, concrete file paths, explain *why*
   not just *what* (the existing files consistently explain the reason
   behind a pattern, not just its existence — keep that up). Don't
   turn CLAUDE.md into a changelog; it describes current state and
   durable patterns, not a history of changes.
4. If nothing meaningfully changed the mental model of the codebase,
   say so and don't edit anything — a no-op is a valid, correct outcome
   of running this skill.
