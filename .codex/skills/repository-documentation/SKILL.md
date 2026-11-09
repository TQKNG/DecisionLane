---
name: repository-documentation
description: Create and maintain PennyWorth specifications, task breakdowns, and build documentation.
---

# Repository documentation

Use this skill for Markdown specifications, task files, GUIDE.md, architecture notes, and agent handoff documents.

## Document placement

- spec/<spec>.md: source of intent and acceptance criteria.
- tasks/<spec-slug>/tasks.md: executable Spec Kit checklist and dependency graph.
- tasks/<spec-slug>/<task>/task.md: bounded task instructions and evidence.
- GUIDE.md: broad sequential build and deployment guide.

## Specification structure

Use:

1. Metadata.
2. Context.
3. Goals and non-goals.
4. Current state and requirements.
5. Implementation plan.
6. Task breakdown.
7. Verification.
8. Acceptance criteria.
9. Risks and decisions.
10. Handoff.

Every task needs a stable ID, dependencies, owned files, acceptance criteria, verification commands, and handoff evidence.

## Markdown quality

- Put each full sentence on its own physical line in long Markdown.
- Preserve heading hierarchy.
- Use tables for mappings, inventories, and task dependencies.
- Keep deployment commands beside the resource or service they configure.
- Distinguish implemented behavior from planned behavior.
- Preserve unrelated document changes.

Run git diff --check after editing.
