import React, { useState } from "react";
import { TextInput, TextInputProps } from "react-native-paper";

interface PasswordInputProps extends Omit<
  TextInputProps,
  "secureTextEntry" | "right"
> {
  testID?: string;
}

export function PasswordInput({ testID, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <TextInput
      testID={testID}
      secureTextEntry={!showPassword}
      right={
        <TextInput.Icon
          testID={testID ? `${testID}-toggle` : "password-toggle"}
          icon={showPassword ? "eye-off" : "eye"}
          onPress={() => setShowPassword(!showPassword)}
        />
      }
      {...props}
    />
  );
}
