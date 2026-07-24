import { useMenuPickerWorkaround } from "@/hooks/useMenuPickerWorkaround";
import { act, renderHook } from "@testing-library/react-native";

describe("useMenuPickerWorkaround", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("closes the menu before applying a selection", () => {
    const action = jest.fn();
    const { result } = renderHook(() => useMenuPickerWorkaround());

    act(() => result.current.open());
    expect(result.current.visible).toBe(true);

    act(() => result.current.select(action));

    expect(result.current.visible).toBe(false);
    expect(action).not.toHaveBeenCalled();

    act(() => jest.runAllTimers());
    expect(action).toHaveBeenCalledTimes(1);
  });
});
