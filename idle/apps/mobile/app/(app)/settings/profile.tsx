import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/design/Screen";
import { T } from "@/design/Text";
import { Header } from "@/design/Header";
import { Field } from "@/design/Field";
import { Button } from "@/design/Button";
import { SPACE } from "@/design/tokens";
import { updateMyProfile } from "@/lib/api";
import { useSession } from "@/lib/session";

const BIO_MAX = 140;
const NAME_MAX = 40;

export default function EditProfile() {
  const { profile, refreshProfile } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setBio(profile?.bio ?? "");
  }, [profile]);

  async function save() {
    setBusy(true);
    try {
      await updateMyProfile({ display_name: displayName, bio });
      await refreshProfile();
      router.back();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Header title="Profile" />

      <T variant="display">{profile?.handle ?? "—"}</T>
      <T variant="body" tone="faint" style={{ marginTop: SPACE.s, fontSize: 13 }}>
        Your handle is fixed. Everything below is not.
      </T>

      <Field
        label="Name"
        value={displayName}
        onChangeText={(t) => setDisplayName(t.slice(0, NAME_MAX))}
        placeholder="Optional"
        autoCapitalize="words"
        style={{ marginTop: SPACE.xl }}
      />

      <Field
        label="A line about you"
        value={bio}
        onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
        placeholder="Optional"
        multiline
        style={{ marginTop: SPACE.l }}
      />
      <T variant="micro" tone="faint" style={{ marginTop: SPACE.s }}>
        {`${bio.length} / ${BIO_MAX}`}
      </T>

      <T variant="body" tone="faint" style={{ marginTop: SPACE.l, fontSize: 13, lineHeight: 19 }}>
        Your friends see these on your profile. Nobody else can.
      </T>

      <View style={{ marginTop: SPACE.xl }}>
        <Button label="Save" onPress={save} busy={busy} />
      </View>
    </Screen>
  );
}
