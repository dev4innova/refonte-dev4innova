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
    MEDIA_S3_*) echo "onglet Credentials du bucket media" ;;
    PORTAL_S3_*) echo "onglet Credentials du bucket portal" ;;
    BACKUP_S3_* | AWS_*) echo "onglet Credentials du bucket backups" ;;
    ANTHROPIC_API_KEY | OPENAI_API_KEY | GEMINI_API_KEY) echo "fournisseur IA ; vide si non utilisé" ;;
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

# One redeployment per changed service.
for svc in $touched; do
  echo "Redéploiement de $svc…"
  railway redeploy --service "$svc" --from-source --yes >/dev/null
done
[ -n "$touched" ] || echo "Aucun secret modifié."
