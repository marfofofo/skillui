// "IDLE" — the door.

import { useState } from "react";
import { Platform, TextInput, View, Alert } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { Screen } from "@/design/Screen";
import { T, Meta } from "@/design/Text";
import { Button } from "@/design/Button";
import { usePalette, SPACE, HAIRLINE } from "@/design/tokens";
import { supabase } from "@/lib/supabase";

const TERMS_URL = "https://idle.app/terms";
const PRIVACY_URL = "https://idle.app/privacy";

export default function SignIn() {
  const palette = usePalette();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendLink() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert("THAT IS NOT AN EMAIL ADDRESS");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: "idle://auth-callback" },
    });
    setBusy(false);
    if (error) Alert.alert("COULD NOT SEND", error.message);
    else setSent(true);
  }

  // Sign in with Apple is required on iOS wherever another third-party
  // sign-in is offered. See docs/COMPLIANCE.md.
  async function signInWithApple() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      });
      if (!credential.identityToken) throw new Error("no_identity_token");

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown";
      if (!message.includes("ERR_REQUEST_CANCELED")) Alert.alert("SIGN IN FAILED", message);
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <T variant="display" numberOfLines={1} adjustsFontSizeToFit>
          &quot;IDLE&quot;
        </T>
        <T variant="mono" tone="concrete" style={{ marginTop: SPACE.m }}>
          &quot;SOCIAL NETWORK&quot; FOR ENGINEERS
        </T>
      </View>

      <View style={{ gap: SPACE.m }}>
        {sent ? (
          <View>
            <Meta>check your email</Meta>
            <T variant="title" style={{ marginTop: SPACE.s }}>
              LINK SENT
            </T>
            <T variant="body" tone="concrete" style={{ marginTop: SPACE.s }}>
              Open it on this device. It signs you in.
            </T>
          </View>
        ) : (
          <View>
            <Meta>email</Meta>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={palette.concrete}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              accessibilityLabel="Email address"
              style={{
                borderBottomWidth: HAIRLINE,
                borderBottomColor: palette.ink,
                color: palette.ink,
                fontFamily: "InterTight_500Medium",
                fontSize: 22,
                paddingVertical: SPACE.s,
                marginTop: SPACE.xs,
              }}
            />
          </View>
        )}

        {!sent && (
          <Button label="Send me a link" onPress={sendLink} busy={busy} meta="button" />
        )}

        {Platform.OS === "ios" && !sent && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={0}
            style={{ height: 52 }}
            onPress={signInWithApple}
          />
        )}

        <T variant="mono" tone="concrete" style={{ marginTop: SPACE.s, lineHeight: 20 }}>
          By signing in you accept the terms at {TERMS_URL} and the privacy policy at{" "}
          {PRIVACY_URL}. You must be 16 or older.
        </T>
      </View>
    </Screen>
  );
}
