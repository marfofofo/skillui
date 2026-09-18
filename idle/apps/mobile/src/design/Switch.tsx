import { Pressable, View } from "react-native";
import { COLOR, SPACE, HAIRLINE } from "./tokens";
import { T } from "./Text";

/**
 * A switch, not a toggle with a lamp in it. The lamp means a person is awake and
 * never anything else, so this is plain white — BRAND.md §04.
 */
export function Switch({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: SPACE.m,
        paddingVertical: SPACE.m,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <T variant="body">{label}</T>
        {description ? (
          <T variant="body" tone="faint" style={{ fontSize: 13, lineHeight: 19, marginTop: SPACE.xs }}>
            {description}
          </T>
        ) : null}
      </View>

      <View
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          borderWidth: HAIRLINE,
          borderColor: value ? "transparent" : COLOR.line,
          backgroundColor: value ? COLOR.text : "transparent",
          padding: 3,
          marginTop: 2,
          alignItems: value ? "flex-end" : "flex-start",
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: value ? COLOR.canvas : COLOR.faint,
          }}
        />
      </View>
    </Pressable>
  );
}
