#!/usr/bin/env sh
# Enters the production secrets in Railway (ADR-0018, docs/deployment/railway.md).
#
# The list comes from .railway/railway.ts (every preserve() variable). Each value is typed
# without echo and sent through stdin: it never appears on a command line, in the shell
# history or in this repository. An empty answer keeps the value already stored.
#
# Usage: infra/railway/secrets.sh [service]     (make railway-secrets [service=api])
set -eu

cd "$(dirname "$0")/../.."
ONLY="${1:-}"

if ! command -v railway >/dev/null 2>&1; then
  echo "CLI Railway introuvable : npm install -g @railway/cli (version 5.49 ou plus)." >&2
  exit 1
fi
if ! railway whoami >/dev/null 2>&1; then
  echo "Non connecté à Railway : lancez « railway login », puis « railway link »." >&2
  exit 1
fi

LIST="$(node --experimental-strip-types --no-warnings infra/railway/secrets.mts)"

hint() {
  case "$1" in
    AUTH_SESSION_SECRET) echo "clé des cookies de session ; tapez g pour en générer une" ;;
    SENTRY_DSN) echo "DSN du projet Sentry de ce service" ;;
    MEDIA_S3_ACCESS_KEY_ID | MEDIA_S3_SECRET_ACCESS_KEY) echo "clé S3 de l'API (buckets médias et portail)" ;;
    AWS_ACCESS_KEY_ID | AWS_SECRET_ACCESS_KEY) echo "clé S3 dédiée aux sauvegardes" ;;
    ANTHROPIC_API_KEY | OPENAI_API_KEY | GEMINI_API_KEY) echo "fournisseur IA ; vide si non utilisé" ;;
    STRIPE_SECRET_KEY) echo "clé secrète Stripe live (sk_live_…)" ;;
    STRIPE_WEBHOOK_SECRET) echo "secret du webhook Stripe (whsec_…)" ;;
    BILLING_SELLER_IBAN | BILLING_SELLER_BIC) echo "coordonnées bancaires imprimées sur les factures" ;;
    *) echo "secret" ;;
  esac
}

# Restores the terminal echo even on Ctrl+C.
trap 'stty echo </dev/tty 2>/dev/null || true' EXIT INT TERM

touched=""
old_ifs="$IFS"
IFS='
'
for line in $LIST; do
  IFS="$old_ifs"
  svc="${line%% *}"
  key="${line#* }"
  if [ -n "$ONLY" ] && [ "$svc" != "$ONLY" ]; then continue; fi

  printf '%s / %s (%s) : ' "$svc" "$key" "$(hint "$key")" >/dev/tty
  stty -echo </dev/tty
  IFS= read -r value </dev/tty || value=""
  stty echo </dev/tty
  printf '\n' >/dev/tty

  if [ "$key" = "AUTH_SESSION_SECRET" ] && [ "$value" = "g" ]; then
    value="$(openssl rand -base64 48 | tr -d '\n')"
  fi
  if [ -z "$value" ]; then
    echo "  inchangé"
    continue
  fi
  printf '%s' "$value" | railway variable set "$key" --stdin --service "$svc" --skip-deploys >/dev/null
  value=""
  echo "  enregistré"
  case " $touched " in *" $svc "*) ;; *) touched="$touched $svc" ;; esac
done
IFS="$old_ifs"

# One rebuild per changed service (the web app reads NEXT_PUBLIC_SENTRY_DSN at build time).
for svc in $touched; do
  echo "Redéploiement de $svc…"
  railway redeploy --service "$svc" --from-source --yes >/dev/null
done
[ -n "$touched" ] || echo "Aucun secret modifié."
