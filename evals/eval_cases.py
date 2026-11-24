"""Pure helpers for the Foundry evaluation runner. No Azure or workflow dependencies."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import TypeVar

MAX_CASE_COUNT = 200

T = TypeVar("T")


def select_cases(rows: Sequence[T], case_count: int, offset: int) -> list[T]:
    """Pick `case_count` consecutive rows starting at `offset`, wrapping around the dataset."""
    if not rows:
        raise ValueError("The evaluation dataset is empty")
    limit = min(MAX_CASE_COUNT, len(rows))
    if not 1 <= case_count <= limit:
        raise ValueError(f"case_count must be between 1 and {limit}, received {case_count}")
    return [rows[(offset + index) % len(rows)] for index in range(case_count)]


def format_case_failure(
    case_id: str,
    *,
    eval_id: str | None,
    run_id: str | None,
    status: str | None,
    error: str | None,
    per_evaluator: Mapping[str, Mapping[str, int]] | None,
    report_url: str | None,
) -> str:
    """Describe a failed case, naming the failing evaluators and linking the Foundry report."""
    failed = sorted(name for name, counts in (per_evaluator or {}).items() if counts.get("failed"))
    if error:
        reason = f"error: {error}"
    elif failed:
        reason = f"failed evaluators: {', '.join(failed)}"
    else:
        reason = "no passing result and no failing evaluator reported"
    line = f"{case_id}: {reason} (eval {eval_id}, run {run_id}, status={status})"
    return f"{line}\n  report: {report_url}" if report_url else line
