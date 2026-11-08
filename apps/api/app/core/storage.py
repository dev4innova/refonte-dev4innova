"""S3-compatible object storage (ADR-0010). MinIO locally, any S3 provider in EU.

Two buckets: public media of the website, and private files of the client portal
(ADR-0015), only reachable through short-lived signed links issued after an access check.
"""

from functools import lru_cache
from typing import TYPE_CHECKING, Any
from urllib.parse import quote

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


class PrivateStorage:
    """Private bucket: never public, downloads through signed links only."""

    def __init__(self, client: "S3Client", bucket: str, signer: "S3Client | None" = None) -> None:
        self._client = client
        self._signer = signer or client
        self._bucket = bucket

    async def put(self, key: str, body: bytes, content_type: str) -> None:
        def _put() -> Any:
            return self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
                CacheControl="private, no-store",
            )

        await run_in_threadpool(_put)

    async def delete(self, key: str) -> None:
        await run_in_threadpool(lambda: self._client.delete_object(Bucket=self._bucket, Key=key))

    def download_url(self, key: str, *, filename: str, content_type: str, ttl: int) -> str:
        """Signed GET link, valid `ttl` seconds, always downloaded as an attachment."""
        ascii_name = filename.encode("ascii", "replace").decode().replace('"', "").replace("?", "_")
        return self._signer.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self._bucket,
                "Key": key,
                "ResponseContentDisposition": (
                    f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"
                ),
                "ResponseContentType": content_type,
            },
            ExpiresIn=ttl,
        )


def _client(endpoint_url: str | None) -> "S3Client":
    settings = get_settings()
    secret = settings.media_s3_secret_access_key
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        region_name=settings.media_s3_region,
        aws_access_key_id=settings.media_s3_access_key_id,
        aws_secret_access_key=secret.get_secret_value() if secret else None,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


@lru_cache
def get_storage() -> ObjectStorage:
    """FastAPI dependency; tests override it (moto)."""
    settings = get_settings()
    return ObjectStorage(
        _client(settings.media_s3_endpoint_url),
        settings.media_s3_bucket,
        settings.media_public_base_url,
    )


@lru_cache
def get_private_storage() -> PrivateStorage:
    """FastAPI dependency; tests override it (moto)."""
    settings = get_settings()
    client = _client(settings.media_s3_endpoint_url)
    public = settings.portal_s3_public_endpoint_url
    signer = _client(public) if public and public != settings.media_s3_endpoint_url else None
    return PrivateStorage(client, settings.portal_s3_bucket, signer)
