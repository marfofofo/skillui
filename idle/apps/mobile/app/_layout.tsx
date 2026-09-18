import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from "@expo-google-fonts/instrument-sans";
import { GeistMono_400Regular, GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import { SessionProvider } from "@/lib/session";
import { COLOR } from "@/design/tokens";

SplashScreen.preventAutoHideAsync().catch(() => {});

export const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: COLOR.canvas },
  animation: "fade",
  animationDuration: 120,
} as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // One family, or nothing. A fallback font would be a different product.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: COLOR.canvas }} />;
  }

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Stack screenOptions={SCREEN_OPTIONS} />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
