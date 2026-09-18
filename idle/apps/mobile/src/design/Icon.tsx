// IDLE — the only icons in the product. Stroke, 1.5, never filled, never emoji.

import Svg, { Path, Circle, Rect } from "react-native-svg";
import { Pressable } from "react-native";
import { COLOR, type Color, SPACE } from "./tokens";

type Name = "plus" | "settings" | "close" | "qr" | "scan" | "back" | "check";

const PATHS: Record<Name, React.ReactNode> = {
  plus: <Path d="M12 5v14M5 12h14" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  back: <Path d="M15 5l-7 7 7 7" />,
  check: <Path d="M4 12.5l5 5L20 6.5" />,
  settings: (
    <>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.63.7 1.09 1.35 1.09H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  qr: (
    <>
      <Rect x={3} y={3} width={7} height={7} rx={1} />
      <Rect x={14} y={3} width={7} height={7} rx={1} />
      <Rect x={3} y={14} width={7} height={7} rx={1} />
      <Path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
    </>
  ),
  scan: <Path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" />,
};

export function Icon({
  name,
  size = 20,
  tone = "dim",
}: {
  name: Name;
  size?: number;
  tone?: Color;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={COLOR[tone]}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </Svg>
  );
}

/** An icon-only control. Always labelled, always at least a 44pt target. */
export function IconButton({
  name,
  label,
  onPress,
  tone = "dim",
  size = 20,
}: {
  name: Name;
  label: string;
  onPress: () => void;
  tone?: Color;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={SPACE.m}
      style={({ pressed }) => ({
        padding: SPACE.s,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={name} size={size} tone={tone} />
    </Pressable>
  );
}
