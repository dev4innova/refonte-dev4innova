#!/usr/bin/env sh
# Post-deployment smoke tests (TASK-116, TASK-123): fast, read-only checks of a deployed
# environment. Usage: infra/scripts/smoke.sh <web URL> [<API URL>]
#   infra/scripts/smoke.sh https://www.dev4innova.com https://api.dev4innova.com
# Exits non-zero at the first failure. Never sends credentials or writes data.
set -eu

WEB_URL="${1:?usage: smoke.sh <web URL> [<API URL>]}"
WEB_URL="${WEB_URL%/}"
API_URL="${2:-}"
API_URL="${API_URL%/}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAILED=0

ok() { printf '  ok    %s\n' "$1"; }
ko() { printf '  FAIL  %s\n' "$1"; FAILED=1; }

# fetch <name> <url>: stores status, headers and body; retries while the service warms up.
fetch() {
  attempt=1
  while :; do
    status="$(curl -sS -o "$TMP/$1.body" -D "$TMP/$1.headers" -w '%{http_code}' \
      --max-time 20 -A 'dev4innova-smoke' "$2" || echo 000)"
    case "$status" in 2??|3??|4??) break ;; esac
    [ "$attempt" -ge 5 ] && break
    attempt=$((attempt + 1))
    sleep 6
  done
  echo "$status"
}

expect_status() { # <label> <expected> <actual>
  if [ "$3" = "$2" ]; then ok "$1 ($3)"; else ko "$1: expected $2, got $3"; fi
}

expect_header() { # <name> <header regex> <label>
  if grep -qiE "^$2" "$TMP/$1.headers"; then ok "$3"; else ko "$3: header missing"; fi
}

expect_body() { # <name> <text> <label>
  if grep -qF "$2" "$TMP/$1.body"; then ok "$3"; else ko "$3: '$2' not found"; fi
}

echo "Web: $WEB_URL"
expect_status "health" 200 "$(fetch health "$WEB_URL/api/health")"
expect_body health '"status"' "health payload"
expect_status "home page (fr)" 200 "$(fetch home_fr "$WEB_URL/fr")"
expect_body home_fr '<html lang="fr"' "French document"
expect_status "home page (en)" 200 "$(fetch home_en "$WEB_URL/en")"
expect_body home_en '<html lang="en"' "English document"
expect_header home_fr 'strict-transport-security:' "HSTS header"
expect_header home_fr 'x-content-type-options: *nosniff' "nosniff header"
expect_header home_fr "content-security-policy:.*frame-ancestors 'none'" "framing forbidden"
expect_status "sitemap" 200 "$(fetch sitemap "$WEB_URL/sitemap.xml")"
expect_body sitemap '<urlset' "sitemap content"
expect_status "robots.txt" 200 "$(fetch robots "$WEB_URL/robots.txt")"
expect_status "unknown page" 404 "$(fetch missing "$WEB_URL/fr/smoke-test-missing-page")"

if [ -n "$API_URL" ]; then
  echo "API: $API_URL"
  expect_status "liveness" 200 "$(fetch live "$API_URL/api/v1/health/live")"
  expect_status "readiness (database, Redis)" 200 "$(fetch ready "$API_URL/api/v1/health/ready")"
  expect_header ready 'x-request-id:' "request id header"
  expect_status "public content" 200 "$(fetch content "$API_URL/api/v1/content/service?locale=fr")"
  expect_status "authentication required" 401 "$(fetch me "$API_URL/api/v1/me")"
fi

if [ "$FAILED" -ne 0 ]; then
  echo "Smoke tests failed."
  exit 1
fi
echo "Smoke tests passed."
