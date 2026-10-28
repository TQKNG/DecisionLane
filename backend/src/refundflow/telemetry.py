import logging
import os

from azure.monitor.opentelemetry import configure_azure_monitor
from opentelemetry import trace

LOGGER_NAME = 'refundflow'

def configure_telemetry() -> logging.Logger:
    if os.getenv("ENABLE_INSTRUMENTATION", "false").lower() == "true":
        configure_azure_monitor(
            connection_string = os.getenv(
                "APPLICATIONINSIGHTS_CONNECTION_STRING",
                logger_name = LOGGER_NAME,
                enable_live_metrics = False
            )
        )
    
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(logging.INFO)
    return logger

def get_trace_id()->str |None:
    span_context = trace.get_current_span().get_span_context()
    if not span_context.is_valid:
        return None
    return format(span_context.trace_id,"032x")

    