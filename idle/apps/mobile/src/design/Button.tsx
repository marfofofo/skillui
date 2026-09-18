import { Pressable, View, ActivityIndicator, type ViewStyle } from "react-native";
import { COLOR, SPACE, HAIRLINE, RADIUS } from "./tokens";
import { T, Label } from "./Text";

type Kind = "primary" | "quiet" | "destructive";

type Props = {
  label: string;
  onPress: () => void;
  kind?: Kind;
  caption?: string;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
};

/**
 * Note what is missing: the lamp colour. A button is never amber, because amber
 * means a person is awake. BRAND.md §03.
 */
export function Button({
  label,
  onPress,
  kind = "primary",
  caption,
  disabled,
  busy,
  style,
}: Props) {
  const foreground =
    kind === "destructive" ? COLOR.alarm : kind === "primary" ? COLOR.text : COLOR.dim;

  return (
    <View style={style}>
      {caption ? <Label style={{ marginBottom: SPACE.s }}>{caption}</Label> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled || !!busy }}
        disabled={disabled || busy}
        onPress={onPress}
        style={({ pressed }) => ({
          // Elevation is luminance, not a shadow. BRAND.md §06.
          backgroundColor:
            kind === "primary"
              ? pressed
                ? "rgba(255,255,255,0.10)"
                : "rgba(255,255,255,0.06)"
              : pressed
                ? COLOR.raise
                : "transparent",
          borderWidth: HAIRLINE,
          borderColor: kind === "quiet" ? COLOR.line : "transparent",
          borderRadius: RADIUS.row,
          paddingVertical: SPACE.m,
          paddingHorizontal: SPACE.l,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.35 : 1,
          minHeight: 48,
        })}
      >
        {busy ? (
          <ActivityIndicator color={foreground} />
        ) : (
          <T variant="body" style={{ color: foreground, fontSize: 17 }}>
            {label}
          </T>
        )}
      </Pressable>
    </View>
  );
}
