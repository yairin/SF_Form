#!/usr/bin/env bash
# Authenticate the Salesforce CLI to the MashamDev sandbox.
#
# Run this from a machine WITH network access to Salesforce (your laptop, or a
# Claude Code environment whose network policy allows *.salesforce.com).
# It opens a browser so you log in with your own credentials — no password is
# stored in the repo.
set -euo pipefail

ALIAS="${1:-MashamDev}"

echo "Logging in to Salesforce sandbox as alias '$ALIAS'..."
sf org login web \
  --instance-url https://test.salesforce.com \
  --alias "$ALIAS" \
  --set-default

echo
echo "Done. Verify with:"
echo "  sf org display --target-org $ALIAS"
