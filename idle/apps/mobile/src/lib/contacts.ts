// IDLE — matching your address book without uploading it.
//
// Every address in your phone is hashed here, on the device. What goes to the
// server is the first four hex characters of each hash: a 16-bit bucket shared
// by an enormous number of possible addresses. The server answers with the
// hashes of registered users in those buckets, and the intersection is computed
// below, locally. Only the hashes that MATCHED — which therefore belong to
// people already on IDLE — are ever sent back in full.
//
// Nothing identifying about a person who is not a user leaves this file.

import * as Contacts from "expo-contacts";
import * as Crypto from "expo-crypto";
import { getContactBuckets, getContactMatches, getContactPepper, type ContactMatch } from "./api";

const BUCKET_CHARS = 4;
const MAX_PREFIXES_PER_CALL = 1000;
const MAX_HASHES_PER_CALL = 500;

export type Match = ContactMatch & {
  /** The name as it appears in your phone. Never sent anywhere. */
  localName: string | null;
};

const normalise = (email: string) => email.trim().toLowerCase();

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function requestContactsPermission(): Promise<boolean> {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === "granted";
}

/**
 * @returns the friends found, and how many addresses were looked at — so the
 *          screen can say "3 of 412" rather than implying we kept the 412.
 */
export async function findFriendsInContacts(): Promise<{
  matches: Match[];
  scanned: number;
}> {
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Emails, Contacts.Fields.Name],
  });

  const pepper = await getContactPepper();

  // hash -> the local name, kept only in this function's scope.
  const byHash = new Map<string, string | null>();

  for (const contact of data) {
    for (const entry of contact.emails ?? []) {
      const email = entry.email ? normalise(entry.email) : "";
      if (!email.includes("@")) continue;

      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pepper + email,
      );
      if (!byHash.has(hash)) byHash.set(hash, contact.name ?? null);
    }
  }

  const scanned = byHash.size;
  if (scanned === 0) return { matches: [], scanned: 0 };

  // What leaves the device: these, and nothing else.
  const prefixes = [...new Set([...byHash.keys()].map((h) => h.slice(0, BUCKET_CHARS)))];

  const registered = new Set<string>();
  for (const batch of chunk(prefixes, MAX_PREFIXES_PER_CALL)) {
    for (const hash of await getContactBuckets(batch)) registered.add(hash);
  }

  // The intersection happens here, on the phone.
  const matchedHashes = [...byHash.keys()].filter((hash) => registered.has(hash));
  if (matchedHashes.length === 0) return { matches: [], scanned };

  const matches: Match[] = [];
  for (const batch of chunk(matchedHashes, MAX_HASHES_PER_CALL)) {
    for (const match of await getContactMatches(batch)) {
      // The echoed hash is what pairs a result with the right address book entry.
      matches.push({ ...match, localName: byHash.get(match.hash) ?? null });
    }
  }

  return { matches, scanned };
}
