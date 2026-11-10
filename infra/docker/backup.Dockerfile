# Backup job image (TASK-119). Build context: repository root.
# pg_dump must not be older than the server: 18 dumps PostgreSQL 18 (Railway dashboard)
# and 17 (CI, Docker Compose, .railway/railway.ts) alike.
FROM postgres:18-alpine
RUN apk add --no-cache aws-cli
COPY infra/backup/backup.sh infra/backup/restore.sh /usr/local/bin/
USER postgres
CMD ["/usr/local/bin/backup.sh"]
