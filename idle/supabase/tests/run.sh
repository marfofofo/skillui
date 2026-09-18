#!/usr/bin/env bash
# "IDLE" — apply the schema to a throwaway PostgreSQL database and test it.
#
#   ./run.sh                      # uses $PGHOST/$PGUSER, or a local socket
#   PGHOST=/tmp/sock ./run.sh
#
# No Docker required: 00_bootstrap.sql creates the parts of the Supabase
# platform the migrations assume, including Supabase's default privileges, so
# the revokes in 000200 are genuinely exercised.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="${IDLE_TEST_DB:-idle_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q --no-psqlrc)

echo "==> rebuilding $DB"
"${PSQL[@]}" -d postgres -c "drop database if exists $DB;" >/dev/null
"${PSQL[@]}" -d postgres -c "create database $DB;" >/dev/null

echo "==> applying schema"
"${PSQL[@]}" -d "$DB" -f "$HERE/00_bootstrap.sql" >/dev/null 2>&1
for migration in "$HERE"/../migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$migration" >/dev/null 2>&1
done
"${PSQL[@]}" -d "$DB" -f "$HERE/../seed.sql" >/dev/null 2>&1
"${PSQL[@]}" -d "$DB" -f "$HERE/01_helpers.sql" >/dev/null 2>&1

failed=0
for suite in "$HERE"/0[2-9]_*.sql; do
  if ! "${PSQL[@]}" -d "$DB" -f "$suite" 2>&1 \
      | sed 's/^psql:[^ ]*: //; s/^NOTICE:  //'; then
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  echo
  echo "FAILED"
  exit 1
fi

echo
echo "ALL GREEN"
