"""Print the OpenAPI schema (used to generate packages/api-client).

Usage: uv run python -m app.export_openapi > ../../packages/api-client/openapi.json
"""

import json
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/unused")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("APP_ENV", "local")

from app.main import create_app

if __name__ == "__main__":
    print(json.dumps(create_app().openapi(), indent=2, ensure_ascii=False))
