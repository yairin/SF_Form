#!/usr/bin/env bash
# Retrieve the "מאגר חירום" module metadata from the sandbox into force-app/.
#
# Usage:
#   scripts/sf-retrieve.sh                # uses manifest/package.xml
#   scripts/sf-retrieve.sh CustomApplication   # retrieve a single type (discovery)
set -euo pipefail

ALIAS="${SF_ALIAS:-MashamDev}"

if [ "$#" -gt 0 ]; then
  echo "Retrieving metadata type(s): $* (org: $ALIAS)"
  sf project retrieve start --metadata "$@" --target-org "$ALIAS"
else
  echo "Retrieving from manifest/package.xml (org: $ALIAS)"
  sf project retrieve start --manifest manifest/package.xml --target-org "$ALIAS"
fi

echo
echo "Retrieved into force-app/. Review the diff before committing:"
echo "  git status && git diff"
