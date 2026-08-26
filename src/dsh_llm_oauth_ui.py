#!/usr/bin/env python3
"""dsh-llm-oauth-ui: inspect OAuth login state for DSH providers.

Full interactive OAuth flow will be implemented in the DSH Web UI using
ctx.authorization. This CLI provides a lightweight status view.
"""
from __future__ import annotations

import argparse
import os
import pathlib
import sys

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit("dsh-llm-oauth-ui requires PyYAML") from exc

KNOWN_OAUTH_PROVIDERS = ["openai", "xai", "github-copilot", "google", "anthropic"]


def load_credentials(dsh_home: pathlib.Path) -> dict:
    path = dsh_home / ".credentials.yaml"
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def cmd_status(dsh_home: pathlib.Path) -> int:
    creds = load_credentials(dsh_home)
    records = creds.get("records", {})
    if not isinstance(records, dict):
        records = {}
    print("OAuth provider login status (based on stored credential records):")
    found = False
    for provider in KNOWN_OAUTH_PROVIDERS:
        key = f"llm-pi-ai/{provider}"
        record = records.get(key)
        if record is not None:
            kind = record.get("kind", "unknown") if isinstance(record, dict) else "unknown"
            print(f"  {provider}: configured ({kind})")
            found = True
        else:
            print(f"  {provider}: not configured")
    if not found:
        print("\nNo OAuth grants found yet.")
        print("Use the DSH Web Models page to sign in interactively (future dsh-llm-oauth-ui feature).")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dsh-home", default=os.environ.get("DSH_HOME") or str(pathlib.Path.home() / ".dsh"))
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="show OAuth login status")
    args = ap.parse_args(argv)

    if args.command == "status":
        return cmd_status(pathlib.Path(args.dsh_home))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
