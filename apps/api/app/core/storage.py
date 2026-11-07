"""S3-compatible object storage for media (ADR-0010). MinIO locally, any S3 provider in EU."""

from functools import lru_cache
from typing import TYPE_CHECKING, Any

import boto3
from botocore.config import Config
from fastapi.concurrency import run_in_threadpool

from app.core.config import get_settings

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


class ObjectStorage:
    def __init__(self, client: "S3Client", bucket: str, public_base_url: str) -> None:
        self._client = client
        self._bucket = bucket
        self._public_base_url = public_base_url.rstrip("/")

    def public_url(self, key: str) -> str:
        return f"{self._public_base_url}/{key}"

    async def put(self, key: str, body: bytes, content_type: str) -> None:
        def _put() -> Any:
            return self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
                CacheControl="public, max-age=31536000, immutable",
            )

        await run_in_threadpool(_put)

    async def delete(self, key: str) -> None:
        await run_in_threadpool(lambda: self._client.delete_object(Bucket=self._bucket, Key=key))


@lru_cache
def get_storage() -> ObjectStorage:
    """FastAPI dependency; tests override it (moto)."""
    settings = get_settings()
    secret = settings.media_s3_secret_access_key
    client = boto3.client(
        "s3",
        endpoint_url=settings.media_s3_endpoint_url,
        region_name=settings.media_s3_region,
        aws_access_key_id=settings.media_s3_access_key_id,
        aws_secret_access_key=secret.get_secret_value() if secret else None,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    return ObjectStorage(client, settings.media_s3_bucket, settings.media_public_base_url)
