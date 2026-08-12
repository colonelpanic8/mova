// Every renderWidget call replaces the launcher's RemoteViews, which shows as
// a blink — so redraw paths skip draws whose rendered content is unchanged.
// These tests exercise that dedupe end to end through the task handler and
// the in-app refresh.

const mockStore: Record<string, string> = {};
const mockAsyncStore: Record<string, string> = {};

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
  NativeModules: {
    SharedStorage: {
      getItem: jest.fn(async (key: string) =>
        key in mockStore ? mockStore[key] : null,
      ),
      setItem: jest.fn(async (key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete mockStore[key];
      }),
    },
  },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) =>
      key in mockAsyncStore ? mockAsyncStore[key] : null,
    ),
    setItem: jest.fn(async (key: string, value: string) => {
      mockAsyncStore[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete mockAsyncStore[key];
    }),
  },
}));

jest.mock("react-native-android-widget", () => ({
  FlexWidget: () => null,
  TextWidget: () => null,
  ListWidget: () => null,
  SvgWidget: () => null,
  getWidgetInfo: jest.fn(),
  requestWidgetUpdate: jest.fn(),
  requestWidgetUpdateById: jest.fn(async () => {}),
}));

// Pulls in react-native-paper, which can't load in the Node test env; the
// agenda widget paths under test never reach it.
jest.mock("../../widgets/WidgetConfigurationScreen", () => ({
  getWidgetTemplate: jest.fn(async () => "__quick_capture__"),
  getWidgetTemplateKey: (widgetId: number) =>
    `mova_widget_template_${widgetId}`,
}));

import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import {
  getWidgetInfo,
  requestWidgetUpdateById,
} from "react-native-android-widget";
import { AgendaEntry, SingleDayAgendaResponse } from "../../services/api";
import { widgetTaskHandlerEntry } from "../../widget-task-handler";
import { refreshAgendaWidgets } from "../../widgets/agendaWidgetRefresh";

function entry(overrides: Partial<AgendaEntry> = {}): AgendaEntry {
  return {
    id: null,
    file: "/org/todo.org",
    pos: 100,
    title: "Something",
    todo: "TODO",
    tags: null,
    level: 1,
    scheduled: null,
    deadline: null,
    priority: null,
    olpath: null,
    notifyBefore: null,
    category: null,
    effectiveCategory: null,
    agendaLine: "",
    ...overrides,
  };
}

function dayResponse(entries: AgendaEntry[]): SingleDayAgendaResponse {
  return { span: "day", date: "2026-08-06", entries };
}

function mockAgendaFetch(response: SingleDayAgendaResponse) {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => response,
    text: async () => JSON.stringify(response),
  })) as unknown as typeof fetch;
}

function seedCredentials() {
  mockStore.mova_api_url = "https://org.example.com";
  mockStore.mova_username = "ivan";
  mockStore.mova_password = "hunter2";
}

function clearStores() {
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  for (const key of Object.keys(mockAsyncStore)) delete mockAsyncStore[key];
}

const widgetInfo = {
  widgetId: 5,
  widgetName: "AgendaWidget",
  width: 250,
  height: 180,
};

function handlerProps(
  renderWidget: jest.Mock,
  overrides: { widgetAction?: string; clickAction?: string } = {},
): WidgetTaskHandlerProps {
  return {
    widgetInfo,
    widgetAction: "WIDGET_UPDATE",
    renderWidget,
    clickAction: undefined,
    clickActionData: undefined,
    ...overrides,
  } as unknown as WidgetTaskHandlerProps;
}

describe("agenda widget task handler redraws", () => {
  beforeEach(() => {
    clearStores();
    seedCredentials();
    jest.clearAllMocks();
  });

  it("collapses the cached draw and an identical fresh draw into one", async () => {
    mockAgendaFetch(dayResponse([entry({ title: "Water plants" })]));

    // First update has no cache: one fresh draw, which also fills the cache.
    const firstRender = jest.fn();
    await widgetTaskHandlerEntry(handlerProps(firstRender));
    expect(firstRender).toHaveBeenCalledTimes(1);

    // Second update draws the cache, then fetches the same agenda — the
    // fresh draw is identical and must be skipped.
    const secondRender = jest.fn();
    await widgetTaskHandlerEntry(handlerProps(secondRender));
    expect(secondRender).toHaveBeenCalledTimes(1);
  });

  it("still draws the fresh agenda when it differs from the cache", async () => {
    mockAgendaFetch(dayResponse([entry({ title: "Water plants" })]));
    await widgetTaskHandlerEntry(handlerProps(jest.fn()));

    mockAgendaFetch(dayResponse([entry({ title: "Walk the dog" })]));
    const render = jest.fn();
    await widgetTaskHandlerEntry(handlerProps(render));
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("patches the live view on clicks but does full draws on lifecycle events", async () => {
    mockAgendaFetch(dayResponse([entry({ title: "Water plants" })]));

    // Lifecycle events replace the RemoteViews so the launcher always has a
    // full anchor state to merge partial updates into.
    const updateRender = jest.fn();
    await widgetTaskHandlerEntry(handlerProps(updateRender));
    expect(updateRender).toHaveBeenLastCalledWith(expect.anything(), {
      partially: false,
    });

    // A click happens on a live widget, so its redraws patch it in place —
    // this is what keeps completing an item from flashing the whole widget.
    const clickRender = jest.fn();
    await widgetTaskHandlerEntry(
      handlerProps(clickRender, {
        widgetAction: "WIDGET_CLICK",
        clickAction: "SHOW_HABITS",
      }),
    );
    expect(clickRender).toHaveBeenCalled();
    for (const call of clickRender.mock.calls) {
      expect(call[1]).toEqual({ partially: true });
    }
  });
});

describe("in-app agenda widget refresh", () => {
  beforeEach(() => {
    clearStores();
    seedCredentials();
    jest.clearAllMocks();
    jest.useFakeTimers();
    (getWidgetInfo as jest.Mock).mockResolvedValue([widgetInfo]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("skips the repaint when the widget already shows the same agenda", async () => {
    mockAgendaFetch(dayResponse([entry({ title: "Water plants" })]));

    refreshAgendaWidgets();
    await jest.runAllTimersAsync();
    expect(requestWidgetUpdateById).toHaveBeenCalledTimes(1);

    // Same agenda again: nothing on the widget would change, so no repaint.
    refreshAgendaWidgets();
    await jest.runAllTimersAsync();
    expect(requestWidgetUpdateById).toHaveBeenCalledTimes(1);

    mockAgendaFetch(dayResponse([entry({ title: "Walk the dog" })]));
    refreshAgendaWidgets();
    await jest.runAllTimersAsync();
    expect(requestWidgetUpdateById).toHaveBeenCalledTimes(2);
  });
});
