from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from eval_cases import format_case_failure, select_cases


def test_selects_consecutive_rows_from_the_offset() -> None:
    assert select_cases(list(range(10)), case_count=3, offset=4) == [4, 5, 6]


def test_wraps_around_the_end_of_the_dataset() -> None:
    assert select_cases(list(range(10)), case_count=4, offset=8) == [8, 9, 0, 1]


def test_large_offsets_wrap_instead_of_failing() -> None:
    assert select_cases(list(range(10)), case_count=2, offset=1005) == [5, 6]


def test_consecutive_windows_of_the_same_size_do_not_overlap() -> None:
    rows = list(range(200))
    first = select_cases(rows, case_count=5, offset=0)
    second = select_cases(rows, case_count=5, offset=5)
    assert not set(first) & set(second)


@pytest.mark.parametrize("case_count", [0, -1, 201])
def test_rejects_case_counts_outside_the_supported_range(case_count: int) -> None:
    with pytest.raises(ValueError, match="case_count"):
        select_cases(list(range(200)), case_count=case_count, offset=0)


def test_rejects_a_case_count_larger_than_a_small_dataset() -> None:
    with pytest.raises(ValueError, match="between 1 and 3"):
        select_cases([1, 2, 3], case_count=4, offset=0)


def test_rejects_an_empty_dataset() -> None:
    with pytest.raises(ValueError, match="empty"):
        select_cases([], case_count=1, offset=0)


def test_failure_names_the_failing_evaluators_and_links_the_report() -> None:
    message = format_case_failure(
        "refund-006",
        eval_id="eval-1",
        run_id="run-1",
        status="completed",
        error=None,
        per_evaluator={
            "relevance": {"passed": 1, "failed": 0},
            "groundedness": {"passed": 0, "failed": 1},
        },
        report_url="https://example.test/report",
    )
    assert "failed evaluators: groundedness" in message
    assert "relevance" not in message
    assert "https://example.test/report" in message
    assert "not provided" not in message


def test_failure_prefers_the_service_error_when_one_is_reported() -> None:
    message = format_case_failure(
        "refund-007",
        eval_id="eval-2",
        run_id="run-2",
        status="failed",
        error="quota exceeded",
        per_evaluator={},
        report_url=None,
    )
    assert "error: quota exceeded" in message
    assert "report:" not in message


def test_failure_without_detail_says_so() -> None:
    message = format_case_failure(
        "refund-008",
        eval_id=None,
        run_id=None,
        status=None,
        error=None,
        per_evaluator=None,
        report_url=None,
    )
    assert "no passing result" in message
