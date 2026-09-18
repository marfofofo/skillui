// "IDLE" — every mutation the app can perform. One function per RPC, nothing
// clever: the database is the API.

import { supabase } from "./supabase";
import type {
  Agent,
  Device,
  Friend,
  FriendRequest,
  Profile,
  Relationship,
  ReportReason,
  Suggestion,
} from "./types";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// --- identity ---------------------------------------------------------------

export async function getMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, bio")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, bio")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getRelationship(userId: string): Promise<Relationship> {
  return unwrap(await supabase.rpc("relationship_to", { p_other: userId }));
}

export async function claimHandle(handle: string, displayName?: string): Promise<Profile> {
  return unwrap(
    await supabase.rpc("claim_handle", {
      p_handle: handle.trim().toLowerCase(),
      p_display_name: displayName?.trim() || null,
    }),
  );
}

export async function getMyInviteCode(): Promise<string | null> {
  const { data, error } = await supabase.from("invite_codes").select("code").maybeSingle();
  if (error) throw new Error(error.message);
  return data?.code ?? null;
}

export async function rotateInviteCode(): Promise<string> {
  return unwrap(await supabase.rpc("rotate_invite_code"));
}

/** Your own row. RLS lets you read yourself; the hidden columns stay hidden. */
export async function getMyPresence(): Promise<{ is_live: boolean; agent: Agent | null } | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("presence")
    .select("is_live, agent")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

// --- the list ---------------------------------------------------------------

export async function getFriends(): Promise<Friend[]> {
  return unwrap(await supabase.rpc("friends_with_presence")) ?? [];
}

export async function getSuggestions(limit = 20): Promise<Suggestion[]> {
  return unwrap(await supabase.rpc("suggested_friends", { p_limit: limit })) ?? [];
}

// --- adding people ----------------------------------------------------------

export type ContactMatch = {
  /** The hash the caller sent, echoed so the phone can pair it with a name. */
  hash: string;
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  relationship: Relationship;
};

export type InvitePreview = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  relationship: Relationship;
};

export async function lookupInvite(code: string): Promise<InvitePreview | null> {
  const rows = unwrap<InvitePreview[]>(
    await supabase.rpc("lookup_invite", { p_code: code }),
  );
  return rows?.[0] ?? null;
}

export async function sendFriendRequest(userId: string): Promise<string> {
  return unwrap(await supabase.rpc("send_friend_request", { p_user_id: userId }));
}

export async function getIncomingRequests(): Promise<
  (FriendRequest & { sender: Pick<Profile, "id" | "handle" | "display_name"> })[]
> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, sender_id, recipient_id, status, created_at, sender:profiles!friend_requests_sender_id_fkey(id, handle, display_name)")
    .eq("recipient_id", auth.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as never;
}

export async function respondToRequest(requestId: string, accept: boolean): Promise<string> {
  return unwrap(
    await supabase.rpc("respond_friend_request", {
      p_request_id: requestId,
      p_accept: accept,
    }),
  );
}

// --- the graph --------------------------------------------------------------

export async function unfriend(userId: string): Promise<void> {
  const { error } = await supabase.rpc("unfriend", { p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("block_user", { p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("unblock_user", { p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function reportUser(
  userId: string,
  reason: ReportReason,
  detail?: string,
  alsoBlock = true,
): Promise<void> {
  const { error } = await supabase.rpc("report_user", {
    p_user_id: userId,
    p_reason: reason,
    p_detail: detail ?? null,
    p_also_block: alsoBlock,
  });
  if (error) throw new Error(error.message);
}

// --- contacts ---------------------------------------------------------------
//
// See supabase/migrations/20260918000600_contacts.sql for why this is two calls
// and not one. The short version: the first call carries 16-bit buckets, not
// addresses, so nothing identifying about a non-user ever reaches the server.

/** Not a secret — it ships in the app. It only raises the cost of a generic
 *  precomputed table of email hashes. */
export async function getContactPepper(): Promise<string> {
  return unwrap(await supabase.rpc("contact_pepper"));
}

/** Step 1: buckets in, the hashes of registered users out. No identity. */
export async function getContactBuckets(prefixes: string[]): Promise<string[]> {
  const rows = unwrap<{ hash: string }[]>(
    await supabase.rpc("contact_buckets", { p_prefixes: prefixes }),
  );
  return (rows ?? []).map((row) => row.hash);
}

/** Step 2: the hashes that matched belong to users. Now, and only now, identity. */
export async function getContactMatches(hashes: string[]): Promise<ContactMatch[]> {
  return unwrap(await supabase.rpc("contact_matches", { p_hashes: hashes })) ?? [];
}

export async function setDiscoverableByContact(value: boolean): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase
    .from("user_settings")
    .update({ discoverable_by_contact: value })
    .eq("user_id", auth.user.id);
  if (error) throw new Error(error.message);
}

// --- terminals --------------------------------------------------------------

export async function createPairingCode(): Promise<{ code: string; expires_at: string }> {
  const rows = unwrap<{ code: string; expires_at: string }[]>(
    await supabase.rpc("create_pairing_code"),
  );
  const first = rows?.[0];
  if (!first) throw new Error("could_not_create_code");
  return first;
}

export async function getDevices(): Promise<Device[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("id, label, agent, created_at, last_seen_at, revoked_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Device[];
}

export async function revokeDevice(deviceId: string): Promise<void> {
  const { error } = await supabase
    .from("devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", deviceId);
  if (error) throw new Error(error.message);
}

// --- your data --------------------------------------------------------------

export type BlockedPerson = {
  user_id: string;
  handle: string;
  display_name: string | null;
  created_at: string;
};

/**
 * Blocking hides a person from you completely — including from your own reads of
 * `profiles`. This comes from a function that can see past that policy, or there
 * would be no way to undo a block.
 */
export async function getMyBlocks(): Promise<BlockedPerson[]> {
  return unwrap(await supabase.rpc("my_blocks")) ?? [];
}

export async function updateMyProfile(fields: {
  display_name?: string | null;
  bio?: string | null;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("not_authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: fields.display_name?.trim() || null,
      bio: fields.bio?.trim() || null,
    })
    .eq("id", auth.user.id);
  if (error) throw new Error(error.message);
}

/** GDPR Art. 20: everything we hold, in one call, with no ticket and no wait. */
export async function exportMyData(): Promise<unknown> {
  return unwrap(await supabase.rpc("export_my_data"));
}

// --- erasure ----------------------------------------------------------------

/** App Store 5.1.1(v) and GDPR Art. 17 are the same button. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc("delete_account");
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
}
