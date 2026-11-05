from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from opentelemetry import trace

TRACER = trace.get_tracer("refundflow")


@contextmanager
def claim_span(name:str, claim_id:str, stage:str) -> Iterator[None]:
    with TRACER.start_as_current_span(name) as span:
        span.set_attribute("refundflow.claim_id", claim_id)
        span.set_attribute("refundflow.stage", stage)
        yield

