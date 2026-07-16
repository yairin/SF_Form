#!/usr/bin/env python3
"""Parse `sf project deploy start --json` output and print component/test failures
in a readable form. Exits nonzero if the deploy did not fully succeed, so the CI
step fails as expected. Usage: python3 scripts/print_deploy_failures.py deploy.json
"""
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "deploy.json"
try:
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
except Exception as exc:  # noqa: BLE001
    print(f"Could not parse {path}: {exc}")
    try:
        with open(path, encoding="utf-8") as fh:
            print(fh.read()[-4000:])
    except Exception:  # noqa: BLE001
        pass
    sys.exit(1)

result = data.get("result", {}) or {}
details = result.get("details", {}) or {}

comp_failures = details.get("componentFailures") or []
if isinstance(comp_failures, dict):
    comp_failures = [comp_failures]
for f in comp_failures:
    print(f"COMPONENT FAIL: {f.get('componentType')} '{f.get('fullName')}' "
          f"(line {f.get('lineNumber')}): {f.get('problem')}")

for f in (result.get("files") or []):
    if f.get("state") == "Failed":
        print(f"FILE FAIL: {f.get('type')} '{f.get('fullName')}': {f.get('error')}")

test_failures = (details.get("runTestResult", {}) or {}).get("failures") or []
if isinstance(test_failures, dict):
    test_failures = [test_failures]
for t in test_failures:
    print(f"TEST FAIL: {t.get('name')}.{t.get('methodName')}: {t.get('message')}")

status = data.get("status", 1)
success = result.get("success")
if success is True and status == 0:
    print("Deploy succeeded.")
    sys.exit(0)
print(f"Deploy failed (status={status}, success={success}).")
sys.exit(1)
