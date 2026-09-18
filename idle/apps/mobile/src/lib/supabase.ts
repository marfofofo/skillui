// "IDLE" — the only client. The anon key is public by design: row-level
// security decides what it can reach, not secrecy.

import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Throwing here would white-screen the whole app, which is the worst possible
 * way to tell someone their environment variables are missing — particularly on
 * a fresh deploy, where it is the single likeliest thing to be wrong. The app
 * checks this and says so in words instead.
 */
export const SUPABASE_CONFIGURED = !!url && !!anonKey;

/**
 * Session tokens live in the device keychain, not AsyncStorage. SecureStore has
 * a 2048-byte limit per item, so long sessions are chunked.
 */
const CHUNK = 1800;

const secureAdapter = {
  async getItem(key: string) {
    const head = await SecureStore.getItemAsync(`${key}.0`);
    if (head === null) return null;
    let value = head;
    for (let i = 1; ; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) break;
      value += part;
    }
    return value;
  },
  async setItem(key: string, value: string) {
    const parts = value.match(new RegExp(`.{1,${CHUNK}}`, "g")) ?? [""];
    for (let i = 0; i < parts.length; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, parts[i] as string);
    }
    // Clear any chunks left by a longer previous session.
    for (let i = parts.length; i < parts.length + 4; i++) {
      await SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => {});
    }
  },
  async removeItem(key: string) {
    for (let i = 0; i < 16; i++) {
      await SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => {});
    }
  },
};

export const supabase = createClient(url ?? "https://unconfigured.invalid", anonKey ?? "unconfigured", {
  auth: {
    // Native keeps the session in the device keychain. On web there is no
    // keychain and supabase-js already defaults to localStorage, so passing
    // nothing is both simpler and correct.
    storage: Platform.OS === "web" ? undefined : secureAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 4 },
  },
});
