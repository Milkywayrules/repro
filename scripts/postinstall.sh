#!/usr/bin/env bash
# Install git hooks after bun install. Skipped in CI and non-git trees.

set -euo pipefail

if [[ -n "${CI:-}" ]]; then
  exit 0
fi

if [[ ! -d .git ]]; then
  exit 0
fi

if ! command -v lefthook >/dev/null 2>&1; then
  exit 0
fi

lefthook install
