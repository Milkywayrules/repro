#!/usr/bin/env bash
# Local dev status — always prints a table. Non-blocking (exit 0).
# Invoked by lefthook post-checkout; also: bash scripts/check-local-prereqs.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/report-table.sh
source "$ROOT/scripts/lib/report-table.sh"

LOCAL_BASE="$(bun -e "import { localBaseDomain } from './packages/env/src/lib/product.ts'; console.log(localBaseDomain)")"
CONSOLE_URL="https://console.${LOCAL_BASE}"

CERT_FILE="infra/certs/local/${LOCAL_BASE}.pem"
HOSTS_MARKER="$LOCAL_BASE"

if [[ -f "$CERT_FILE" ]]; then
  report_add "TLS certs (infra/certs/local)" "$(report_status_ok)"
else
  report_add "TLS certs (infra/certs/local)" "$(report_status_fail)"
fi

if grep -q "$HOSTS_MARKER" /etc/hosts 2>/dev/null; then
  report_add "/etc/hosts ($LOCAL_BASE)" "$(report_status_ok)"
else
  report_add "/etc/hosts ($LOCAL_BASE)" "$(report_status_warn)"
fi

if [[ -f apps/api/.env ]]; then
  if grep -qE '^BETTER_AUTH_SECRET=.{32,}' apps/api/.env 2>/dev/null; then
    report_add "apps/api/.env (secrets)" "$(report_status_ok)"
  else
    report_add "apps/api/.env (BETTER_AUTH_SECRET)" "$(report_status_warn)"
  fi
else
  report_add "apps/api/.env" "$(report_status_fail)"
fi

for label in "console/.env.development" "marketing/.env.development" "docs/.env.development"; do
  app="${label%%/*}"
  if [[ -f "apps/$label" ]]; then
    report_add "apps/$label" "$(report_status_ok)"
  else
    report_add "apps/$label" "$(report_status_warn)"
  fi
done

if command -v ss >/dev/null 2>&1 && ss -tlnp 2>/dev/null | grep -q ':443'; then
  report_add "nginx (:443)" "$(report_status_ok)"
elif command -v nginx >/dev/null 2>&1; then
  report_add "nginx (:443)" "$(report_status_warn)"
else
  report_add "nginx (:443)" "$(report_status_skip)"
fi

has_issue=false
for row in "${REPORT_ROWS[@]}"; do
  status="${row#*|}"
  if [[ "$status" == "fail" || "$status" == "warn" ]]; then
    has_issue=true
    break
  fi
done

if [[ "$has_issue" == true ]]; then
  report_print "repro local dev — action needed"
  echo "  Run: bun run setup:local"
  echo "  Guide: infra/certs/README.md"
else
  report_print "repro local dev — ready"
  echo "  bun run dev → $CONSOLE_URL"
fi

exit 0
