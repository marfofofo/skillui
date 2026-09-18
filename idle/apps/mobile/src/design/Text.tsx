import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { TYPE, type Variant } from "./type";
import { usePalette } from "./tokens";

type Tone = "ink" | "paper" | "concrete" | "signal" | "signalOnPaper" | "signalOnInk" | "caution";

export type TProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
};

export function T({ variant = "body", tone = "ink", style, ...rest }: TProps) {
  const palette = usePalette();
  return (
    <RNText
      {...rest}
      allowFontScaling
      style={[TYPE[variant], { color: palette[tone] }, style]}
    />
  );
}

/**
 * A meta-label: the smallest type on screen, naming what a thing literally is.
 * It never repeats the object's own visible text. See BRAND.md §04.
 */
export function Meta({ children, tone = "concrete", style, ...rest }: TProps) {
  return (
    <T variant="meta" tone={tone} style={style} {...rest}>
      {`"${String(children).toUpperCase()}"`}
    </T>
  );
}
