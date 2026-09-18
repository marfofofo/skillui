// IDLE — what a deploy with no environment variables should say.

import { View } from "react-native";
import { Screen } from "./Screen";
import { T, Label } from "./Text";
import { SPACE } from "./tokens";
import { FAMILY } from "./type";
import { COLOR, RADIUS, HAIRLINE } from "./tokens";

export function NotConfigured() {
  return (
    <Screen scroll>
      <View style={{ marginTop: SPACE.xl }}>
        <Label>IDLE</Label>
        <T variant="display" style={{ marginTop: SPACE.s }}>
          Not configured
        </T>
        <T variant="body" tone="dim" style={{ marginTop: SPACE.l, lineHeight: 24 }}>
          This build has no backend to talk to. Two environment variables are
          missing — both are public and both are in `apps/mobile/.env.example`.
        </T>

        <View
          style={{
            borderWidth: HAIRLINE,
            borderColor: COLOR.line,
            backgroundColor: COLOR.raise,
            borderRadius: RADIUS.row,
            padding: SPACE.m,
            marginTop: SPACE.l,
          }}
        >
          <T style={{ fontFamily: FAMILY.mono, fontSize: 12, color: COLOR.text, lineHeight: 20 }}>
            EXPO_PUBLIC_SUPABASE_URL{"\n"}EXPO_PUBLIC_SUPABASE_ANON_KEY
          </T>
        </View>

        <T variant="body" tone="faint" style={{ marginTop: SPACE.l, fontSize: 13, lineHeight: 20 }}>
          On Vercel: Settings → Environment Variables, then redeploy. Locally: copy
          .env.example to .env. Then run npm run preflight to check the rest.
        </T>
      </View>
    </Screen>
  );
}
