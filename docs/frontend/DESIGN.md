# RefundFlow Design Direction

Use Chrome Lab light with white canvas, neutral surfaces, charcoal text, restrained blue actions, thin boundaries, modest radii, and minimal shadows.
Use Arial for product copy and standard monospace only for technical identifiers when required.
Use a 4px spacing rhythm with 8, 12, 16, 24, 32, 48, and 64px increments.
Use visible focus states, text labels with status colors, explicit field labels, and keyboard-operable controls.

Customer pages use a spacious top navigation with My claims, Start a claim, and account controls.
Customer claim submission stays focused on Order and issue, Evidence, and Review and submit.
Customer claim detail leads with a plain-language current status, next action, amounts, evidence, and recorded activity.
Approval, refund processing, refund confirmed, rejection, information request, and refund failure remain distinct states.

Staff pages use a persistent sidebar and denser workspaces.
The reviewer queue shows order reference, claim type, age, requested amount, status, and approval progress.
The reviewer case screen places assessment and decision context beside inspectable evidence or policy sources.
Operations screens lead with actionable exceptions and connect every metric to its underlying claims.

Shared product components include `ClaimSummary`, `StatusBadge`, `EvidenceUploader`, `AssessmentCriterion`, `ApprovalProgress`, and `ActivityTimeline`.
Each shared component defines loading, empty, error, disabled, and success states where applicable.
The target is WCAG 2.2 AA through semantics, contrast, visible focus, keyboard operation, descriptive errors, and responsive layouts.
