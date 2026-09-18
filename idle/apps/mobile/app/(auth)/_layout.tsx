import { Stack } from "expo-router";
import { SCREEN_OPTIONS } from "../_layout";

export default function AuthLayout() {
  return <Stack screenOptions={SCREEN_OPTIONS} />;
}
