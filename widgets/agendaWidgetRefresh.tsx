import { Platform } from "react-native";
// The library no-ops off Android, so importing it here is safe on every
// platform; the Platform guard below is about behavior, not linking.
import {
  getWidgetInfo,
  requestWidgetUpdateById,
} from "react-native-android-widget";
import { AGENDA_WIDGET_NAME, AgendaWidget } from "./AgendaWidget";
import { loadAgendaWidgetData } from "./agendaWidgetData";
import {
  agendaWidgetSignature,
  buildAgendaWidgetProps,
  getLastDrawnSignature,
  setLastDrawnSignature,
} from "./agendaWidgetDraw";
import { getAgendaWidgetView } from "./agendaWidgetState";

/**
 * Mutations arrive in bursts (a completion invalidates several queries), and
 * the launcher only needs the settled result, so coalesce them.
 */
const DEBOUNCE_MS = 1500;

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let rerunRequested = false;

async function redrawAgendaWidgets(): Promise<void> {
  // One fetch shared by every placed widget, skipped when there are none.
  const widgets = await getWidgetInfo(AGENDA_WIDGET_NAME);
  if (widgets.length === 0) return;

  const data = await loadAgendaWidgetData();

  await Promise.all(
    widgets.map(async (info) => {
      const view = await getAgendaWidgetView(info.widgetId);
      const props = buildAgendaWidgetProps(data, view, info);
      const signature = agendaWidgetSignature(props);

      // Repainting the launcher is a visible blink, so leave the widget alone
      // when this refresh wouldn't change what it shows. Unlike the task
      // handler, skipping here is safe: this path is opportunistic, and the
      // handler repaints unconditionally on every widget event.
      if (signature === (await getLastDrawnSignature(info.widgetId))) return;

      await requestWidgetUpdateById({
        widgetName: AGENDA_WIDGET_NAME,
        widgetId: info.widgetId,
        renderWidget: () => <AgendaWidget {...props} />,
      });
      await setLastDrawnSignature(info.widgetId, signature);
    }),
  );
}

async function runRedraw(): Promise<void> {
  if (running) {
    rerunRequested = true;
    return;
  }
  running = true;
  try {
    do {
      rerunRequested = false;
      await redrawAgendaWidgets();
    } while (rerunRequested);
  } catch (error) {
    console.error("[AgendaWidget] Failed to refresh widgets:", error);
  } finally {
    running = false;
  }
}

/**
 * Redraw any placed agenda widgets after org data changes in the app. Without
 * this the widget would only catch up on its 30-minute update period, so
 * completing something in the app would leave it listed on the home screen.
 *
 * Best effort and fire-and-forget: callers are mutation paths that must not
 * fail because a widget couldn't be drawn.
 */
export function refreshAgendaWidgets(): void {
  if (Platform.OS !== "android") return;

  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    void runRedraw();
  }, DEBOUNCE_MS);
}
