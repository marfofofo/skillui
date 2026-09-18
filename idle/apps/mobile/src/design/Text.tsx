import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { TYPE, type Variant } from "./type";
import { COLOR, type Color } from "./tokens";

export type TProps = RNTextProps & {
  variant?: Variant;
  tone?: Color;
};

export function T({ variant = "body", tone = "text", style, ...rest }: TProps) {
  return (
    <RNText
      {...rest}
      allowFontScaling
      style={[TYPE[variant], { color: COLOR[tone] }, style]}
    />
  );
}

/** A section header: the smallest type on screen, and the only shouting. */
export function Label({ tone = "faint", style, ...rest }: TProps) {
  return <T variant="label" tone={tone} style={style} {...rest} />;
}
