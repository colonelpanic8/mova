import { fireEvent, render } from "@testing-library/react-native";
import { MD3LightTheme, PaperProvider } from "react-native-paper";

import { StateChangeModal } from "../../components/todoEditing/StateChangeModal";
import { Todo } from "../../services/api";

jest.mock("../../components/PlatformDatePicker", () => ({
  PlatformDatePicker: (props: {
    visible: boolean;
    onChange: (date: Date) => void;
  }) => {
    const { Button } = require("react-native");
    return props.visible ? (
      <Button
        title="Pick date"
        onPress={() => props.onChange(new Date(2026, 7, 8))}
      />
    ) : null;
  },
}));

jest.mock("../../components/StatePill", () => ({
  StatePill: ({ state, onPress }: { state: string; onPress?: () => void }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable accessibilityLabel={`${state} state badge`} onPress={onPress}>
        <Text>{state}</Text>
      </Pressable>
    );
  },
}));

const todo: Todo = {
  todo: "TODO",
  title: "Ship the feature",
  tags: null,
  level: 1,
  scheduled: null,
  deadline: null,
  priority: null,
  file: null,
  pos: null,
  id: null,
  olpath: null,
  notifyBefore: null,
  category: null,
  effectiveCategory: null,
};

const renderModal = (onConfirm: jest.Mock) =>
  render(
    <PaperProvider theme={MD3LightTheme}>
      <StateChangeModal
        visible
        todo={todo}
        states={["TODO", "DONE"]}
        onDismiss={jest.fn()}
        onConfirm={onConfirm}
      />
    </PaperProvider>,
  );

describe("StateChangeModal", () => {
  it("quick sets a state without an effective date override", () => {
    const onConfirm = jest.fn();
    const { getByLabelText, getByText } = renderModal(onConfirm);

    fireEvent.press(getByText("Effective Date"));
    fireEvent.press(getByText("Pick date"));
    fireEvent.press(getByLabelText("DONE state badge"));

    expect(onConfirm).toHaveBeenCalledWith("DONE", null);
  });

  it("uses the radio button only to select a state", () => {
    const onConfirm = jest.fn();
    const { getAllByRole } = renderModal(onConfirm);

    fireEvent.press(getAllByRole("radio")[1]);

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
