-- IDLE — finding friends from your contacts, without your contacts leaving the phone.
--
-- THE PROBLEM
--   Matching an address book against a user base normally means uploading the
--   address book. That is processing the personal data of people who are not
--   users and never consented — the exact thing the Belgian DPA fined Twoo
--   €50,000 for in its "tell a friend" feature, and a standing App Store 5.1.2
--   rejection. The sender's consent cannot cover their contacts' data.
--
-- THE SHAPE THAT AVOIDS IT
--   Two steps, and the server never receives a full identifier for anyone who
--   is not already a user:
--
--   1. The phone hashes each contact locally and sends only the first 4 hex
--      characters of each hash — a 16-bit bucket, one of 65,536, shared by a
--      great many possible addresses. The server returns the hashes of
--      DISCOVERABLE USERS in those buckets. Identity is not returned here.
--      The phone intersects the two sets itself.
--   2. The phone sends back only the hashes that MATCHED — which by definition
--      belong to people who are already on IDLE — and gets their profiles.
--
--   So: nothing identifying about a non-user is ever transmitted, nothing about
--   a non-user is ever stored, and we never send anything to a non-user. The
--   address book itself never leaves the device.
--
--   A user's own hash is derived SERVER-SIDE from their verified email. If the
--   client could assert its own hash, anyone could claim someone else's address
--   and be discovered in their place.

-- ---------------------------------------------------------------------------
-- THE PEPPER
-- ---------------------------------------------------------------------------

create table public.app_secrets (
  key   text primary key,
  value text not null
);

alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

-- Not a secret, and documented as such: it ships inside the app, because the
-- phone has to hash contacts with the same value. It raises the cost of a
-- generic precomputed table of email hashes. It does not make the hashes
-- irreversible, and nothing here relies on the idea that it does.
insert into public.app_secrets (key, value)
values ('contact_pepper', encode(extensions.gen_random_bytes(16), 'hex'));

create or replace function public.contact_pepper()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.app_secrets where key = 'contact_pepper';
$$;

grant execute on function public.contact_pepper() to authenticated;

-- ---------------------------------------------------------------------------
-- HASHES
-- ---------------------------------------------------------------------------

create or replace function public.normalize_email(p_email text)
returns text
language sql
immutable
as $$
  select lower(btrim(coalesce(p_email, '')));
$$;

create or replace function public.contact_hash(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_clean text := public.normalize_email(p_identifier);
begin
  if v_clean = '' then
    return null;
  end if;
  return encode(
    extensions.digest(public.contact_pepper() || v_clean, 'sha256'),
    'hex'
  );
end;
$$;

create table public.contact_hashes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('email', 'phone')),
  hash       text not null,
  created_at timestamptz not null default now(),

  primary key (kind, hash)
);

create index contact_hashes_user_idx on public.contact_hashes (user_id);
-- The lookup in step 1 is a prefix scan; this is the index that serves it.
create index contact_hashes_prefix_idx on public.contact_hashes (left(hash, 4));

alter table public.contact_hashes enable row level security;
revoke all on public.contact_hashes from anon, authenticated;

comment on table public.contact_hashes is
  'One row per verified identifier of a REGISTERED user. Never holds anything about a non-user.';

-- ---------------------------------------------------------------------------
-- DISCOVERABILITY
-- ---------------------------------------------------------------------------

alter table public.user_settings
  add column discoverable_by_contact boolean not null default true;

comment on column public.user_settings.discoverable_by_contact is
  'Whether someone who already has your email address can find you here. Yours to switch off; it is disclosed at signup.';

-- ---------------------------------------------------------------------------
-- KEEPING YOUR OWN HASH CURRENT
-- ---------------------------------------------------------------------------

create or replace function public.refresh_my_contact_hash()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_hash text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- The VERIFIED address only. An unconfirmed email must never become a way
  -- to be discovered as its owner.
  select u.email into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;

  delete from public.contact_hashes where user_id = v_uid and kind = 'email';

  if v_email is null then
    return;
  end if;

  -- Apple's private relay addresses are per-app and appear in nobody's address
  -- book, so hashing one only creates a row that can never match.
  if v_email like '%@privaterelay.appleid.com' then
    return;
  end if;

  v_hash := public.contact_hash(v_email);
  if v_hash is null then
    return;
  end if;

  insert into public.contact_hashes (user_id, kind, hash)
  values (v_uid, 'email', v_hash)
  on conflict (kind, hash) do nothing;
end;
$$;

grant execute on function public.refresh_my_contact_hash() to authenticated;

-- New accounts get one at signup.
create or replace function public.claim_handle(
  p_handle text,
  p_display_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_code text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_exists' using errcode = '23505';
  end if;

  insert into public.profiles (id, handle, display_name)
  values (
    v_uid,
    lower(btrim(p_handle)),
    nullif(btrim(coalesce(p_display_name, '')), '')
  )
  returning * into v_profile;

  loop
    v_code := public.gen_code(8);
    exit when not exists (select 1 from public.invite_codes c where c.code = v_code);
  end loop;
  insert into public.invite_codes (code, user_id) values (v_code, v_uid);

  insert into public.presence (user_id) values (v_uid);
  insert into public.user_settings (user_id) values (v_uid);

  perform public.refresh_my_contact_hash();

  return v_profile;
end;
$$;

grant execute on function public.claim_handle(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- STEP 1 — buckets in, hashes out. No identity, and no full identifier in.
-- ---------------------------------------------------------------------------

create or replace function public.contact_buckets(p_prefixes text[])
returns table (hash text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Exactly four lowercase hex characters, deduplicated, and never more than an
  -- address book's worth. A prefix longer than this would start to identify a
  -- specific address to the server.
  select array_agg(distinct p)
    into v_clean
  from unnest(coalesce(p_prefixes, '{}')) as p
  where p ~ '^[0-9a-f]{4}$';

  if v_clean is null or array_length(v_clean, 1) is null then
    return;
  end if;
  if array_length(v_clean, 1) > 1000 then
    raise exception 'too_many_prefixes' using errcode = '22023';
  end if;

  -- 5,000 buckets a day: one pass over a large address book, and nowhere near
  -- enough to sweep all 65,536 buckets before anyone notices.
  if not public.rate_limit_hit(
    'contact_buckets', v_uid::text, 5000, interval '1 day'
  ) then
    raise exception 'rate_limited' using errcode = '53400';
  end if;

  return query
  select ch.hash
  from public.contact_hashes ch
  join public.user_settings s on s.user_id = ch.user_id
  where left(ch.hash, 4) = any (v_clean)
    and s.discoverable_by_contact
    and ch.user_id <> v_uid
    and not public.blocked_either_way(v_uid, ch.user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- STEP 2 — the hashes that matched are users. Now, and only now, identity.
-- ---------------------------------------------------------------------------

create or replace function public.contact_matches(p_hashes text[])
returns table (
  hash         text,
  user_id      uuid,
  handle       text,
  display_name text,
  avatar_url   text,
  relationship text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select array_agg(distinct lower(h))
    into v_clean
  from unnest(coalesce(p_hashes, '{}')) as h
  where h ~ '^[0-9a-f]{64}$';

  if v_clean is null or array_length(v_clean, 1) is null then
    return;
  end if;
  if array_length(v_clean, 1) > 500 then
    raise exception 'too_many_hashes' using errcode = '22023';
  end if;

  -- The hash comes back so the phone can put each match next to the right name
  -- in its address book. It is a value the caller already sent us.
  return query
  select ch.hash,
         p.id,
         p.handle::text,
         p.display_name,
         p.avatar_url,
         public.relationship_to(p.id)
  from public.contact_hashes ch
  join public.user_settings s on s.user_id = ch.user_id
  join public.profiles p on p.id = ch.user_id
  where ch.hash = any (v_clean)
    and s.discoverable_by_contact
    and ch.user_id <> v_uid
    and not public.blocked_either_way(v_uid, ch.user_id)
  order by p.handle;
end;
$$;

grant execute on function public.contact_buckets(text[]) to authenticated;
grant execute on function public.contact_matches(text[]) to authenticated;

-- contact_hash is internal: exposing it would turn the server into an oracle
-- that hashes arbitrary addresses on request.
revoke all on function public.contact_hash(text) from public, anon, authenticated;
revoke all on function public.normalize_email(text) from public, anon, authenticated;
