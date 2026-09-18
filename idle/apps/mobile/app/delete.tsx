// IDLE — idle.app/delete
//
// Google Play requires a publicly reachable page where an account can be deleted
// WITHOUT installing the app. Most products answer that with a form that files a
// request. We do not need one: the web build is the real app, so this page signs
// you in and hands you the same button the phone has, which deletes immediately.

import { Redirect, router } from "expo-router";
import { View } from "react-native";
import { Screen } from "@/design/Screen";
import { T, Label } from "@/design/Text";
import { Button } from "@/design/Button";
import { SPACE } from "@/design/tokens";
import { useSession } from "@/lib/session";

export default function DeletePublic() {
  const { session, profile, loading } = useSession();

  if (loading) {
    return (
      <Screen>
        <View />
      </Screen>
    );
  }

  // Signed in already: this page has nothing to add over the real one.
  if (session && profile) return <Redirect href="/(app)/settings/delete" />;

  return (
    <Screen scroll>
      <View style={{ marginTop: SPACE.xl }}>
        <Label>IDLE</Label>
        <T variant="display" style={{ marginTop: SPACE.s }}>
          Delete your account
        </T>

        <T variant="body" tone="dim" style={{ marginTop: SPACE.l, lineHeight: 24 }}>
          Sign in and the button is on the next screen. It deletes immediately —
          there is no request to file, nothing to wait for and no one to email.
        </T>

        <Label style={{ marginTop: SPACE.xl, marginBottom: SPACE.s }}>What goes</Label>
        <T variant="body" tone="dim" style={{ fontSize: 15, lineHeight: 24 }}>
          Your profile, your presence, every friendship in both directions, every
          pending request, every paired terminal and its token, your invite code
          and your push tokens. Permanently.
        </T>

        <Label style={{ marginTop: SPACE.xl, marginBottom: SPACE.s }}>What stays</Label>
        <T variant="body" tone="faint" style={{ fontSize: 15, lineHeight: 24 }}>
          Reports other people filed about your account, kept for abuse prevention
          with your identity removed from them. Nothing else survives.
        </T>

        <View style={{ marginTop: SPACE.xxl, gap: SPACE.s }}>
          <Button label="Sign in to delete" onPress={() => router.push("/(auth)/sign-in")} />
          <Button
            label="Export your data first"
            kind="quiet"
            onPress={() => router.push("/(auth)/sign-in")}
          />
        </View>

        <T variant="body" tone="faint" style={{ marginTop: SPACE.l, fontSize: 13, lineHeight: 19 }}>
          You can also do this from Settings inside the app, on any device.
        </T>
      </View>
    </Screen>
  );
}
