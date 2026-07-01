import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { TextInput, TextInputProps } from "react-native-paper";

interface CursorStableTextInputProps extends Omit<
  TextInputProps,
  "defaultValue" | "value" | "onChangeText"
> {
  syncKey?: unknown;
  value: string;
  onChangeText?: (text: string) => void;
}

export function CursorStableTextInput({
  syncKey,
  value,
  onChangeText,
  ...props
}: CursorStableTextInputProps) {
  const [revision, setRevision] = useState(0);
  const [nativeDefaultValue, setNativeDefaultValue] = useState(value);
  const lastSyncKeyRef = useRef(syncKey);

  useLayoutEffect(() => {
    if (syncKey !== lastSyncKeyRef.current) {
      lastSyncKeyRef.current = syncKey;
      setNativeDefaultValue(value);
      setRevision((current) => current + 1);
    }
  }, [syncKey, value]);

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText?.(text);
    },
    [onChangeText],
  );

  return (
    <TextInput
      key={revision}
      {...props}
      defaultValue={nativeDefaultValue}
      onChangeText={handleChangeText}
    />
  );
}
