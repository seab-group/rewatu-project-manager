#!/usr/bin/env bash
# Acceptance test for the seed generator.
#
# Order matters: conformance and coverage are meaningless if the output is not
# reproducible, because you would be checking a different artifact each time.
set -uo pipefail
cd "$(dirname "$0")"
fail=0

echo "== 1. determinism =="
rm -rf .verify-a .verify-b
node generate.mjs .verify-a >/dev/null
node generate.mjs .verify-b >/dev/null
if diff -r .verify-a .verify-b >/dev/null 2>&1; then
  echo "   PASS  two runs are byte-identical"
else
  echo "   FAIL  runs differ — this is a failed run, not a warning:"
  diff -r .verify-a .verify-b | head -20
  fail=1
fi

echo
echo "== 2. schema conformance =="
node schema-check.mjs .verify-a
rc=$?
if [ $rc -eq 0 ]; then echo "   PASS  every table and column exists in the ERD"
elif [ $rc -eq 2 ]; then echo "   WARN  conformant, but tables are declared and unseeded (above)"
else echo "   FAIL  see errors above"; fail=1
fi

echo
echo "== 3. coverage =="
if node coverage-check.mjs .verify-a; then
  echo "   PASS  every rule has data on both sides"
else
  echo "   FAIL  see failures above"; fail=1
fi

rm -rf .verify-a .verify-b
echo
if [ $fail -eq 0 ]; then echo "VERIFY: PASS"; else echo "VERIFY: FAIL"; fi
exit $fail
