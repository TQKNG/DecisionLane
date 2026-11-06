FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src \
    PORT=8000

WORKDIR /app
RUN addgroup --system app & adduser --system --ingroup app app

COPY pyproject.toml ./
COPY src ./src
COPY api ./api
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir --pre .

USER app
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]