#!/usr/bin/env bash
# Demo: list OAuth flows and show login options.
set -euo pipefail

echo "==> Listing OAuth flows"
dsh --profile oauth-dev oauth list

echo
echo "==> Trying to start OpenAI Codex login (will cancel on EOF)"
dsh --profile oauth-dev oauth login openai-codex < /dev/null || true
