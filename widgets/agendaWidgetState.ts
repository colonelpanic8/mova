import { NativeModules } from "react-native";

const { SharedStorage } = NativeModules;

export type AgendaWidgetView = "agenda" | "habits";

const viewKey = (widgetId: number) => `agenda_widget_${widgetId}_view`;

export async function getAgendaWidgetView(
  widgetId: number,
): Promise<AgendaWidgetView> {
  if (!SharedStorage) return "agenda";
  try {
    return (await SharedStorage.getItem(viewKey(widgetId))) === "habits"
      ? "habits"
      : "agenda";
  } catch {
    return "agenda";
  }
}

export async function setAgendaWidgetView(
  widgetId: number,
  view: AgendaWidgetView,
): Promise<void> {
  if (!SharedStorage) return;
  try {
    await SharedStorage.setItem(viewKey(widgetId), view);
  } catch {
    // A failed preference write should not prevent the widget from redrawing.
  }
}

export async function clearAgendaWidgetView(widgetId: number): Promise<void> {
  if (!SharedStorage) return;
  try {
    await SharedStorage.removeItem(viewKey(widgetId));
  } catch {
    // Widget deletion is best effort.
  }
}
