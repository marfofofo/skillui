#!/usr/bin/env bash
# IDLE — point the code at the hosted Supabase project.
#
#   ./scripts/setup.sh
#
# Run it from the `idle/` directory, with the Supabase CLI installed and logged
# in. It is safe to run more than once.

set -euo pipefail

PROJECT_REF="rosqtabfzpopekfdimrn"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

say() { printf "\n\033[1m%s\033[0m\n" "$*"; }

command -v supabase >/dev/null || {
  echo "The Supabase CLI is not installed."
  echo "  macOS:  brew install supabase/tap/supabase"
  echo "  other:  https://supabase.com/docs/guides/local-development"
  exit 1
}

# NOTE: no `supabase init`. This repository already has supabase/config.toml and
# supabase/migrations — init would try to create them again.

say "1/4  Linking to $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF"

say "2/4  Applying migrations"
# Six migrations. `db push` records them in the project's migration history, so
# the next one only applies the difference.
supabase db push

say "3/4  Deploying edge functions"
# Both authenticate a device token themselves rather than a user session, so
# they are deployed without JWT verification — see supabase/config.toml.
supabase functions deploy pair --no-verify-jwt
supabase functions deploy heartbeat --no-verify-jwt

say "4/4  Checking what landed"
supabase migration list

cat <<'NEXT'

Done. What is live now:
  · the schema, row-level security and every RPC
  · the pair and heartbeat endpoints

Still to do by hand, in the dashboard:
  · Authentication → Emails: connect a real SMTP provider. The built-in one is
    capped at a few messages an hour and fails SILENTLY — magic links simply
    never arrive and people think the app is broken.
  · Authentication → URL Configuration: add  idle://auth-callback  as a redirect
  · Database → Extensions: enable pg_cron, then run
        select cron.schedule('idle-presence-sweep', '* * * * *',
                             'select public.sweep_presence()');
    Without it a terminal that dies never goes dark.

Then, in apps/mobile:
    npx expo start

NEXT
