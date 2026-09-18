import { TextInput, View, type TextInputProps } from "react-native";
import { COLOR, SPACE, HAIRLINE } from "./tokens";
import { Label } from "./Text";
import { FAMILY } from "./type";

type Props = TextInputProps & {
  label: string;
  size?: "body" | "big";
  /** The lamp is not available here: amber means a person, never a valid form. */
  good?: boolean;
};

export function Field({ label, size = "body", good, style, ...rest }: Props) {
  return (
    <View>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={COLOR.faint}
        {...rest}
        style={[
          {
            borderBottomWidth: HAIRLINE,
            borderBottomColor: good ? COLOR.text : COLOR.line,
            color: COLOR.text,
            fontFamily: FAMILY.regular,
            fontSize: size === "big" ? 32 : 17,
            paddingVertical: SPACE.m,
            marginTop: SPACE.xs,
          },
          style,
        ]}
      />
    </View>
  );
}
