#!/usr/bin/env bash
# Local dev bootstrap — certs, nginx symlinks, env check.
# Run from repo root: bun run setup:local

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bun scripts/sync-local-infra.ts

# shellcheck source=scripts/lib/report-table.sh
source "$ROOT/scripts/lib/report-table.sh"

LOCAL_BASE="$(bun -e "import { localBaseDomain } from './packages/env/src/lib/product.ts'; console.log(localBaseDomain)")"
CONSOLE_URL="https://console.${LOCAL_BASE}"

CERT_DIR="infra/certs/local"
CERT_FILE="$CERT_DIR/${LOCAL_BASE}.pem"
KEY_FILE="$CERT_DIR/${LOCAL_BASE}-key.pem"
NGINX_SITE="infra/nginx/local.conf"
HOSTS_MARKER="$LOCAL_BASE"

detect_platform() {
  if grep -qi microsoft /proc/version 2>/dev/null; then
    echo "wsl"
  elif [[ "${OSTYPE:-}" == "darwin"* ]]; then
    echo "mac"
  elif [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" || -n "${WINDIR:-}" && -z "${WSL_DISTRO_NAME:-}" ]]; then
    echo "windows"
  else
    echo "linux"
  fi
}

PLATFORM="$(detect_platform)"

echo "repro local setup — platform: $PLATFORM · local base: $LOCAL_BASE"

case "$PLATFORM" in
  windows)
    report_add "platform" "$(report_status_fail)"
    report_print "repro local setup — unsupported platform"
    echo "Use WSL2: wsl -e bash -lc 'cd $ROOT && bun run setup:local'"
    echo "Guide: infra/certs/README.md"
    exit 1
    ;;
  wsl) report_add "platform (WSL2)" "$(report_status_ok)" ;;
  mac) report_add "platform (macOS)" "$(report_status_ok)" ;;
  *) report_add "platform (Linux)" "$(report_status_ok)" ;;
esac

# --- mkcert ---
if ! command -v mkcert >/dev/null 2>&1; then
  report_add "mkcert installed" "$(report_status_fail)"
  report_print "repro local setup — failed"
  echo "Install mkcert: https://github.com/FiloSottile/mkcert"
  exit 1
fi
report_add "mkcert installed" "$(report_status_ok)"

if [[ ! -f "$CERT_FILE" || ! -f "$KEY_FILE" ]]; then
  mkdir -p "$CERT_DIR"
  mkcert -install
  mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" "*.${LOCAL_BASE}" "$LOCAL_BASE"
  report_add "TLS certs generated" "$(report_status_ok)"
else
  report_add "TLS certs" "$(report_status_ok)"
fi

# --- nginx ---
if ! command -v nginx >/dev/null 2>&1; then
  report_add "nginx symlinks" "$(report_status_skip)"
else
  # drop stale repo nginx links (e.g. old slug-specific *.conf after configure-product)
  for link in /etc/nginx/sites-enabled/*; do
    [[ -L "$link" ]] || continue
    target="$(readlink "$link")"
    case "$target" in
      "$ROOT/infra/nginx/"*)
        if [[ "$(basename "$link")" != "local.conf" ]] || [[ ! -e "$target" ]]; then
          sudo rm -f "$link"
        fi
        ;;
    esac
  done

  sudo ln -sf "$ROOT/$CERT_FILE" "/etc/ssl/certs/${LOCAL_BASE}.pem"
  sudo ln -sf "$ROOT/$KEY_FILE" "/etc/ssl/private/${LOCAL_BASE}-key.pem"
  sudo ln -sf "$ROOT/$NGINX_SITE" /etc/nginx/sites-enabled/local.conf
  sudo nginx -t
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl reload nginx
  else
    sudo nginx -s reload
  fi
  if ss -tlnp 2>/dev/null | grep -q ':443' || lsof -i :443 >/dev/null 2>&1; then
    report_add "nginx (:443)" "$(report_status_ok)"
  else
    report_add "nginx (:443)" "$(report_status_warn)"
  fi
fi

# --- hosts ---
if grep -q "$HOSTS_MARKER" /etc/hosts 2>/dev/null; then
  report_add "/etc/hosts (WSL/Linux)" "$(report_status_ok)"
else
  report_add "/etc/hosts (WSL/Linux)" "$(report_status_warn)"
fi

if [[ "$PLATFORM" == "wsl" ]]; then
  report_add "Windows hosts + CA" "manual"
fi

# --- env files ---
if [[ ! -f apps/api/.env ]]; then
  cp apps/api/.env.example apps/api/.env
  report_add "apps/api/.env created" "$(report_status_ok)"
elif grep -qE '^BETTER_AUTH_SECRET=.{32,}' apps/api/.env 2>/dev/null; then
  report_add "apps/api/.env" "$(report_status_ok)"
else
  report_add "apps/api/.env (BETTER_AUTH_SECRET)" "$(report_status_warn)"
fi

for f in apps/console/.env.development apps/marketing/.env.development apps/docs/.env.development; do
  if [[ -f "$f" ]]; then
    report_add "$f" "$(report_status_ok)"
  else
    report_add "$f" "$(report_status_warn)"
  fi
done

report_print "repro local setup — summary"

echo "Next:"
case "$PLATFORM" in
  wsl)
    echo "  • Windows hosts: infra/hosts.example → C:\\Windows\\System32\\drivers\\etc\\hosts"
    MKCERT_CA="$(mkcert -CAROOT)/rootCA.pem"
    echo "  • Windows TLS: certmgr.msc → Trusted Root → import rootCA.pem"
    echo "      WSL:     $MKCERT_CA"
    if command -v wslpath >/dev/null 2>&1; then
      WIN_CA="$(wslpath -w "$MKCERT_CA" 2>/dev/null || true)"
      if [[ -n "$WIN_CA" ]]; then
        echo "      Windows: $WIN_CA"
      fi
    fi
    echo "      Guide: infra/certs/README.md#windows-browser-wsl2"
    ;;
  mac)
    echo "  • hosts: infra/hosts.example → /etc/hosts"
    ;;
  *)
    echo "  • hosts: infra/hosts.example → /etc/hosts"
    ;;
esac
echo "  • bun run dev → $CONSOLE_URL"
