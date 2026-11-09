#!/bin/sh
# Logical backup of PostgreSQL to S3-compatible storage (TASK-119, ADR-0018).
#
# Run daily by the Railway "backup" cron service (infra/railway/backup.json), on top of the
# volume backups of the Railway database. Keeps BACKUP_RETENTION_DAYS of dumps.
#
# Environment: DATABASE_URL (postgresql://...), BACKUP_S3_BUCKET, BACKUP_S3_PREFIX (default
# backups/postgres), BACKUP_S3_ENDPOINT_URL (non-AWS providers), AWS_ACCESS_KEY_ID,
# AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION, BACKUP_RETENTION_DAYS (default 30).
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
PREFIX="${BACKUP_S3_PREFIX:-backups/postgres}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
ENDPOINT="${BACKUP_S3_ENDPOINT_URL:+--endpoint-url $BACKUP_S3_ENDPOINT_URL}"
# The API uses the asyncpg driver: pg_dump wants a plain libpq URL.
URL=$(printf '%s' "$DATABASE_URL" | sed 's#^postgresql+asyncpg://#postgresql://#')
STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
KEY="$PREFIX/dev4innova-$STAMP.dump"
FILE="/tmp/dev4innova-$STAMP.dump"

log() { printf '{"timestamp":"%s","level":"%s","logger":"backup","message":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2"; }

# Custom format: compressed, restorable table by table with pg_restore.
pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$URL"
pg_restore --list "$FILE" > /dev/null  # the archive is readable
SIZE=$(wc -c < "$FILE")
# shellcheck disable=SC2086
aws s3 cp $ENDPOINT --only-show-errors "$FILE" "s3://$BACKUP_S3_BUCKET/$KEY"
rm -f "$FILE"
log INFO "backup uploaded: $KEY ($SIZE bytes)"

# Retention: delete dumps older than RETENTION days (names carry their UTC date).
LIMIT=$(date -u -d "@$(( $(date -u +%s) - RETENTION * 86400 ))" +%Y-%m-%dT%H%M%SZ)
# shellcheck disable=SC2086
aws s3 ls $ENDPOINT "s3://$BACKUP_S3_BUCKET/$PREFIX/" | awk '{print $4}' | while read -r NAME; do
  case "$NAME" in
    dev4innova-*.dump)
      DATE=${NAME#dev4innova-}
      DATE=${DATE%.dump}
      if [ "$DATE" \< "$LIMIT" ]; then
        # shellcheck disable=SC2086
        aws s3 rm $ENDPOINT --only-show-errors "s3://$BACKUP_S3_BUCKET/$PREFIX/$NAME"
        log INFO "old backup deleted: $NAME"
      fi
      ;;
  esac
done
