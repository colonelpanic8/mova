import { Platform } from "react-native";
import type { WidgetInfo } from "react-native-android-widget";
// The library no-ops off Android, so importing it here is safe on every
// platform; the Platform guard below is about behavior, not linking.
import { requestWidgetUpdate } from "react-native-android-widget";
import { AGENDA_WIDGET_NAME, AgendaWidget } from "./AgendaWidget";
import { AgendaWidgetData, loadAgendaWidgetData } from "./agendaWidgetData";

/**
 * Mutations arrive in bursts (a completion invalidates several queries), and
 * the launcher only needs the settled result, so coalesce them.
 */
const DEBOUNCE_MS = 1500;

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let rerunRequested = false;

async function redrawAgendaWidgets(): Promise<void> {
  // One fetch shared by every placed widget; skipped entirely when there are
  // none, since renderWidget is only called per existing widget.
  let data: Promise<AgendaWidgetData> | null = null;

  await requestWidgetUpdate({
    widgetName: AGENDA_WIDGET_NAME,
    renderWidget: async (info: WidgetInfo) => {
      data = data ?? loadAgendaWidgetData();
      const loaded = await data;
      return (
        <AgendaWidget
          items={loaded.items}
          status={loaded.status}
          width={info.width}
          height={info.height}
        />
      );
    },
  });
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
