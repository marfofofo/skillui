import { Stack } from "expo-router";
import { SCREEN_OPTIONS } from "../../_layout";

export default function SettingsLayout() {
  return <Stack screenOptions={SCREEN_OPTIONS} />;
}
