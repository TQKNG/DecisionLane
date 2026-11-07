import argparse
import json
import sys
from pathlib import Path
from typing import Any

from api.main import app

BACKEND_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = BACKEND_ROOT / "openapi" / "openapi.json"


def canonical_json(document: dict[str, Any]) -> str:
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Export or check the generated API schema.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if the checked-in OpenAPI document differs from the application schema.",
    )
    args = parser.parse_args()

    document = app.openapi()
    rendered = canonical_json(document)
    if args.check:
        try:
            checked_in_document = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(
                f"Cannot read checked-in OpenAPI document at {OUTPUT_PATH}: {exc}",
                file=sys.stderr,
            )
            return 1
        if checked_in_document != document:
            print(
                "OpenAPI document is stale. Regenerate it with "
                "`cd backend && .venv/bin/python -m scripts.export_openapi`.",
                file=sys.stderr,
            )
            return 1
        print(f"OpenAPI document is current: {OUTPUT_PATH}")
        return 0

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(rendered, encoding="utf-8")
    print(f"Wrote OpenAPI document: {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
