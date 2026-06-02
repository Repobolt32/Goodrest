---
name: spec-bridge
description: Handoff skill linking GSD specifications to Superpowers implementation.
---

# Spec Bridge

**The Critical Handoff Skill.** This skill bridges the gap between the GSD planning layer and the Superpowers execution layer.

## How it works
It reads the locked state from GSD:
- `.planning/phases/{N}/{padded_phase}-SPEC.md` (from gsd-spec-phase)
- `.planning/phases/{N}/{padded_phase}-CONTEXT.md` (from gsd-discuss-phase)
- `.planning/PROJECT.md` (project-level context)
- `.planning/REQUIREMENTS.md` (locked requirements)

And writes the compiled, single-source-of-truth document for Superpowers:
- `.planning/active/SPEC-CONTEXT.md`

All downstream Superpowers skills (like `brainstorming` and `writing-plans`) **must** read from `.planning/active/SPEC-CONTEXT.md`. They are not allowed to invent requirements.
