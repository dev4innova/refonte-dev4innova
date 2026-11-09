#!/bin/sh
# Restores a logical backup into a database (TASK-119). Restore into a NEW database first
# (staging, or a fresh Railway database), check it, then switch DATABASE_URL: never restore
# over the production database in place.
#
# Usage: restore.sh <backup key, e.g. backups/postgres/dev4innova-2026-11-09T031700Z.dump>
# Environment: TARGET_DATABASE_URL, BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT_URL, AWS_* (as backup.sh).
set -eu

KEY="${1:?usage: restore.sh <backup key>}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
ENDPOINT="${BACKUP_S3_ENDPOINT_URL:+--endpoint-url $BACKUP_S3_ENDPOINT_URL}"
URL=$(printf '%s' "$TARGET_DATABASE_URL" | sed 's#^postgresql+asyncpg://#postgresql://#')
FILE="/tmp/restore.dump"

# shellcheck disable=SC2086
aws s3 cp $ENDPOINT --only-show-errors "s3://$BACKUP_S3_BUCKET/$KEY" "$FILE"
pg_restore --no-owner --no-privileges --exit-on-error --single-transaction --dbname="$URL" "$FILE"
rm -f "$FILE"
psql "$URL" -Atc "SELECT 'alembic ' || version_num FROM alembic_version"
echo "restored $KEY"
