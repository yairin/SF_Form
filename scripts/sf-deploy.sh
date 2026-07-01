#!/usr/bin/env bash
# Deploy local changes back to the sandbox.
#
# Usage:
#   scripts/sf-deploy.sh                 # validate-only dry run (safe, no changes)
#   scripts/sf-deploy.sh --run           # actually deploy force-app/ to the org
set -euo pipefail

ALIAS="${SF_ALIAS:-MashamDev}"

if [ "${1:-}" = "--run" ]; then
  echo "Deploying force-app/ to $ALIAS ..."
  sf project deploy start --source-dir force-app --target-org "$ALIAS"
else
  echo "DRY RUN (validate only, nothing is changed in the org) — org: $ALIAS"
  echo "Add --run to actually deploy."
  sf project deploy start --source-dir force-app --target-org "$ALIAS" --dry-run
fi
