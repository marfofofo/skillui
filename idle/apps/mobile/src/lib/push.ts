// IDLE — the only two notifications this product sends.
//
// BRAND.md §11: a friend request, and — opt-in — a friend coming online. Nothing
// else, ever. There is no digest, no "you have not opened the app in a while",
// no re-engagement anything.

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "./supabase";

export const PUSH_SUPPORTED = Platform.OS !== "web";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * @param prompt whether to ask for permission if it has not been given. Asking
 *        on launch is the wrong moment — the only honest time is when someone
 *        switches a notification on and the reason is on screen.
 * @returns whether a token is now registered. Never throws: failing to set up
 *          notifications must not stop anyone using the app.
 */
export async function registerForPush({ prompt = true } = {}): Promise<boolean> {
  if (!PUSH_SUPPORTED || !Device.isDevice) return false;

  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      if (!prompt) return false;
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return false;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Friends",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        vibrationPattern: [0, 120],
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return false;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return false;

    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        { user_id: auth.user.id, expo_token: token, platform: Platform.OS },
        { onConflict: "expo_token" },
      );
    return !error;
  } catch {
    return false;
  }
}

/** Signing out should stop the buzzing on this device, not everywhere. */
export async function unregisterPush(): Promise<void> {
  if (!PUSH_SUPPORTED) return;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from("push_tokens").delete().eq("expo_token", token);
  } catch {
    // Nothing here is worth blocking a sign-out over.
  }
}
