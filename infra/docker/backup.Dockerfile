# Backup job image (TASK-119). Build context: repository root.
# pg_dump must not be older than the server: keep this major in step with the database.
FROM postgres:17-alpine
RUN apk add --no-cache aws-cli
COPY infra/backup/backup.sh infra/backup/restore.sh /usr/local/bin/
USER postgres
CMD ["/usr/local/bin/backup.sh"]
