import { act, render, waitFor } from "@testing-library/react-native";
import { useState } from "react";

import { CursorStableTextInput } from "../../components/CursorStableTextInput";

jest.mock("react-native-paper", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    TextInput: (props: object) => <View {...props} />,
  };
});

function LocallyControlledTestField({
  initialValue,
}: {
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <CursorStableTextInput
      testID="serverUrlInput"
      value={value}
      onChangeText={setValue}
    />
  );
}

function ExternallyControlledTestField({
  syncKey,
  value,
}: {
  syncKey: string;
  value: string;
}) {
  return (
    <CursorStableTextInput
      testID="serverUrlInput"
      syncKey={syncKey}
      value={value}
      onChangeText={jest.fn()}
    />
  );
}

describe("CursorStableTextInput", () => {
  it("keeps the native default stable while text changes locally", () => {
    const { getByTestId } = render(
      <LocallyControlledTestField initialValue="https://initial.example" />,
    );

    const input = getByTestId("serverUrlInput");
    expect(input.props.defaultValue).toBe("https://initial.example");

    act(() => {
      input.props.onChangeText("https://changed.example");
    });

    expect(getByTestId("serverUrlInput").props.defaultValue).toBe(
      "https://initial.example",
    );
  });

  it("syncs external value changes into the native input", async () => {
    const { getByTestId, rerender } = render(
      <ExternallyControlledTestField
        syncKey="initial"
        value="https://initial.example"
      />,
    );

    rerender(
      <ExternallyControlledTestField
        syncKey="selected"
        value="https://selected.example"
      />,
    );

    await waitFor(() => {
      expect(getByTestId("serverUrlInput").props.defaultValue).toBe(
        "https://selected.example",
      );
    });
  });
});
