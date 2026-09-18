// IDLE — handing someone a file, on two very different platforms.

import { Platform } from "react-native";

/**
 * @returns how it was delivered, so the screen can say something true rather
 *          than guessing ("Saved" when the share sheet was cancelled is a lie).
 */
export async function offerFile(
  filename: string,
  contents: string,
): Promise<"shared" | "downloaded" | "unavailable"> {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  }

  // The legacy surface on purpose: it is a stable, documented two-call API for
  // exactly this, and it ships in SDK 57 alongside the newer one.
  const FileSystem = await import("expo-file-system/legacy");
  const Sharing = await import("expo-sharing");

  if (!(await Sharing.isAvailableAsync())) return "unavailable";

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, contents);
  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    dialogTitle: filename,
  });
  return "shared";
}
