import { Pressable, View, ActivityIndicator, type ViewStyle } from "react-native";
import { usePalette, RAW, SPACE, HAIRLINE } from "./tokens";
import { T, Meta } from "./Text";

type Kind = "primary" | "ghost" | "destructive";

type Props = {
  label: string;
  onPress: () => void;
  kind?: Kind;
  meta?: string;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
};

/**
 * Square. No radius, no shadow, no gradient. The press state is a cut, not a
 * fade — BRAND.md §08.
 */
export function Button({
  label,
  onPress,
  kind = "primary",
  meta,
  disabled,
  busy,
  style,
}: Props) {
  const palette = usePalette();

  const background =
    kind === "primary" ? palette.ink : kind === "destructive" ? palette.caution : "transparent";
  // A pressed primary turns SIGNAL, and PAPER on SIGNAL is only 3.1:1.
  // SIGNAL is the same colour in both modes, so its legible partner is too.
  const foreground =
    kind === "primary" ? palette.paper : palette.ink;
  const pressedForeground = RAW.ink;
  const border = kind === "ghost" ? palette.ink : background;

  return (
    <View style={style}>
      {meta ? <Meta style={{ marginBottom: SPACE.xs }}>{meta}</Meta> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled || !!busy }}
        disabled={disabled || busy}
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: pressed && kind === "primary" ? palette.signal : background,
          borderWidth: HAIRLINE,
          borderColor: pressed && kind === "primary" ? palette.signal : border,
          paddingVertical: SPACE.m,
          paddingHorizontal: SPACE.l,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.35 : 1,
          minHeight: 52,
        })}
      >
        {({ pressed }: { pressed: boolean }) => busy ? (
          <ActivityIndicator color={pressed && kind === "primary" ? pressedForeground : foreground} />
        ) : (
          <T
            variant="name"
            style={{
              color: pressed && kind === "primary" ? pressedForeground : foreground,
              fontSize: 16,
              letterSpacing: 0.5,
            }}
          >
            {label.toUpperCase()}
          </T>
        )}
      </Pressable>
    </View>
  );
}
