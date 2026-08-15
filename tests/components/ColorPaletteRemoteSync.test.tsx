import { act, render, waitFor } from "@testing-library/react-native";

const mockApi = {
  getAppConfig: jest.fn(),
  putAppConfig: jest.fn(),
};

jest.mock("../../context/ApiContext", () => ({
  useApi: () => mockApi,
}));

import {
  ColorPaletteProvider,
  useColorPalette,
} from "../../context/ColorPaletteContext";
import { ColorPaletteRemoteSync } from "../../context/ColorPaletteRemoteSync";

let palette: ReturnType<typeof useColorPalette>;

function GrabPalette() {
  palette = useColorPalette();
  return null;
}

const renderSync = () =>
  render(
    <ColorPaletteProvider>
      <ColorPaletteRemoteSync />
      <GrabPalette />
    </ColorPaletteProvider>,
  );

const flushDebounce = async () => {
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
};

describe("ColorPaletteRemoteSync", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockApi.getAppConfig.mockReset();
    mockApi.putAppConfig.mockReset();
    mockApi.putAppConfig.mockResolvedValue({ status: "ok" });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("hydrates the palette from the server without echoing a push", async () => {
    mockApi.getAppConfig.mockResolvedValue({
      namespace: "mova",
      exists: true,
      config: { colorPalette: { todoStateColors: { TODO: "#123456" } } },
    });

    renderSync();

    await waitFor(() =>
      expect(palette.config.todoStateColors["TODO"]).toBe("#123456"),
    );

    await flushDebounce();
    expect(mockApi.putAppConfig).not.toHaveBeenCalled();
  });

  it("pushes local edits and preserves unrelated namespace keys", async () => {
    mockApi.getAppConfig.mockResolvedValue({
      namespace: "mova",
      exists: true,
      config: {
        colorPalette: { todoStateColors: { TODO: "#123456" } },
        otherState: { foo: 1 },
      },
    });

    renderSync();
    await waitFor(() =>
      expect(palette.config.todoStateColors["TODO"]).toBe("#123456"),
    );

    await act(async () => {
      await palette.setTodoStateColor("TODO", "#abcdef");
    });
    await flushDebounce();

    expect(mockApi.putAppConfig).toHaveBeenCalledTimes(1);
    const [namespace, blob] = mockApi.putAppConfig.mock.calls[0];
    expect(namespace).toBe("mova");
    expect(blob.otherState).toEqual({ foo: 1 });
    expect(blob.colorPalette.todoStateColors["TODO"]).toBe("#abcdef");
  });

  it("pushes the local palette when the server has no stored config", async () => {
    mockApi.getAppConfig.mockResolvedValue({
      namespace: "mova",
      exists: false,
      config: null,
    });

    renderSync();

    await waitFor(() => expect(mockApi.getAppConfig).toHaveBeenCalled());
    await flushDebounce();

    await waitFor(() => expect(mockApi.putAppConfig).toHaveBeenCalled());
    const [, blob] = mockApi.putAppConfig.mock.calls[0];
    expect(blob.colorPalette).toEqual(palette.config);
  });
});
