---
name: spec-driven-development
description: Execute PennyWorth specifications through Spec Kit-style task breakdowns and bounded agent handoffs.
---

# Spec-driven development

Use this skill when implementing or decomposing work described by a file under spec/.

## Required workflow

1. Read the complete specification.
2. Read tasks/<spec-slug>/tasks.md.
3. Identify the first unchecked task whose dependencies are complete.
4. Read that task's task.md and all relevant current code.
5. Confirm the owned files and baseline before editing.
6. Implement only the assigned task.
7. Run the task-specific verification.
8. Report the baseline, files, changes, checks, evidence, integration needs, and unresolved issues.

Use the Spec Kit checklist format:

~~~text
- [ ] T001 [P] [US1] Description with an exact file path
~~~

Use [P] only for tasks with disjoint file ownership and no unfinished dependencies.
Use story labels to connect tasks to independently testable outcomes.
Keep traceability between domain IDs in the specification and T-series task IDs.

The coordinator owns task decomposition, shared files, dependency changes, task checklist updates, integration, and final acceptance.
Workers do not change shared task checklists unless explicitly assigned.
Workers do not invent new tasks silently.
Report missing or conflicting requirements to the coordinator.

Before parallel execution, confirm that workers have a common committed baseline and disjoint ownership.
Run integrated checks only after combining accepted work.
