#!/usr/bin/env bash
# Shared terminal table for setup / prereq scripts.
# Usage: source scripts/lib/report-table.sh

REPORT_ROWS=()

report_add() {
  REPORT_ROWS+=("$1|$2")
}

report_print() {
  local title="${1:-Status}"
  echo ""
  echo "$title"
  echo "┌──────────────────────────────────────────┬────────────┐"
  printf "│ %-40s │ %-10s │\n" "Check" "Status"
  echo "├──────────────────────────────────────────┼────────────┤"
  local row check status
  for row in "${REPORT_ROWS[@]}"; do
    check="${row%%|*}"
    status="${row#*|}"
    printf "│ %-40s │ %-10s │\n" "$check" "$status"
  done
  echo "└──────────────────────────────────────────┴────────────┘"
  echo ""
}

report_status_ok() { echo "ok"; }
report_status_warn() { echo "warn"; }
report_status_fail() { echo "fail"; }
report_status_skip() { echo "skip"; }
