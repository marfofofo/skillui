// IDLE — the door.

import { useState } from "react";
import { Platform, View, Alert } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { Screen } from "@/design/Screen";
import { T } from "@/design/Text";
import { Field } from "@/design/Field";
import { Button } from "@/design/Button";
import { Lamp } from "@/design/Lamp";
import { COLOR, SPACE } from "@/design/tokens";
import { supabase } from "@/lib/supabase";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  async function sendLink() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: "idle://auth-callback" },
    });
    setBusy(false);
    if (error) Alert.alert("Could not send", error.message);
    else setSent(true);
  }

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
      if (!message.includes("ERR_REQUEST_CANCELED")) Alert.alert("Sign in failed", message);
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Lamp on size={11} />
        <T variant="display" style={{ marginTop: SPACE.l }}>
          Who is awake
        </T>
        <T variant="body" tone="dim" style={{ marginTop: SPACE.m, maxWidth: 280 }}>
          A small network of people who build at night. You get in by pairing a
          terminal, so everyone here is real.
        </T>
      </View>

      <View style={{ gap: SPACE.m }}>
        {sent ? (
          <View>
            <T variant="title">Check your email</T>
            <T variant="body" tone="dim" style={{ marginTop: SPACE.s }}>
              Open the link on this device. It signs you in.
            </T>
          </View>
        ) : (
          <>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              good={valid}
            />
            <Button label="Send me a link" onPress={sendLink} busy={busy} disabled={!valid} />

            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                cornerRadius={7}
                style={{ height: 48 }}
                onPress={signInWithApple}
              />
            )}
          </>
        )}

        <T variant="body" tone="faint" style={{ fontSize: 13, lineHeight: 19 }}>
          By signing in you accept the terms at idle.app/terms and the privacy
          policy at idle.app/privacy. You must be 16 or older.
        </T>
      </View>
    </Screen>
  );
}
