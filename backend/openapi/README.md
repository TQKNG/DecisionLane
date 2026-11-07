# OpenAPI artifacts

FastAPI generates the API contract from `api.main:app`. The running application serves the
document at `/openapi.json`, with Swagger UI at `/docs` and ReDoc at `/redoc`.
Use the OpenAPI document as the API definition when importing the API into Postman. In Postman,
select **Import**, enter the running API's `/openapi.json` URL (for example,
`http://localhost:8000/openapi.json`), or import the checked-in JSON file.

From `backend/`, regenerate and verify the checked-in JSON document:

```bash
.venv/bin/python -m scripts.export_openapi
.venv/bin/python -m scripts.export_openapi --check
```

Before submitting an API contract change, regenerate the schema and run the backend tests. CI
verifies that the committed schema matches FastAPI.
