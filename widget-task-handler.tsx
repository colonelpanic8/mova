import { NativeModules } from "react-native";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import {
  AGENDA_WIDGET_NAME,
  AgendaWidget,
  COMPLETE_ITEM_ACTION,
  SHOW_AGENDA_ACTION,
  SHOW_HABITS_ACTION,
} from "./widgets/AgendaWidget";
import {
  AgendaWidgetData,
  AgendaWidgetItemRef,
  completeAgendaWidgetItem,
  loadAgendaWidgetData,
  readAgendaWidgetCache,
} from "./widgets/agendaWidgetData";
import {
  clearAgendaWidgetView,
  getAgendaWidgetView,
  setAgendaWidgetView,
} from "./widgets/agendaWidgetState";
import { QuickCaptureWidget } from "./widgets/QuickCaptureWidget";
import { getWidgetCredentials } from "./widgets/storage";
import { getWidgetTemplate } from "./widgets/WidgetConfigurationScreen";

const { SharedStorage } = NativeModules;

const QUICK_CAPTURE_KEY = "__quick_capture__";

/**
 * How long a cached agenda is trusted without a refetch. Resizes redraw from
 * the cache within this window so dragging a widget's handles doesn't fire a
 * request per step.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** How long the "Done" confirmation stays in the agenda widget's header. */
const NOTICE_LINGER_MS = 2000;

const nameToWidget = {
  QuickCaptureWidget: QuickCaptureWidget,
};

function ErrorWidget({ message }: { message: string }) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: "#FF0000",
        justifyContent: "center",
        alignItems: "center",
        padding: 8,
      }}
    >
      <TextWidget text={message} style={{ fontSize: 10, color: "#FFFFFF" }} />
    </FlexWidget>
  );
}

async function getTemplateName(widgetId: number): Promise<string> {
  try {
    // First try to read template name directly from SharedPreferences
    // (saved by the widget configuration screen)
    if (SharedStorage) {
      const templateName = await SharedStorage.getItem(
        `widget_${widgetId}_template_name`,
      );
      if (templateName) {
        return templateName;
      }
    }

    // Fall back to getting template key and looking up name
    const templateKey = await getWidgetTemplate(widgetId);

    if (templateKey === QUICK_CAPTURE_KEY) {
      return "Quick Capture";
    }

    // Try to get template name from API
    const { apiUrl, username, password } = await getWidgetCredentials();
    if (apiUrl && username && password) {
      const response = await fetch(`${apiUrl}/capture-templates`, {
        headers: {
          Authorization: `Basic ${btoa(`${username}:${password}`)}`,
        },
      });
      if (response.ok) {
        const templates = await response.json();
        if (templates[templateKey]) {
          return templates[templateKey].name;
        }
      }
    }

    return "Capture";
  } catch {
    return "Quick Capture";
  }
}

/**
 * The agenda widget, whose whole point is completing items in place: a tap on
 * a row's circle runs the completion here (the app never has to launch) and
 * redraws. Draws from cache first so the widget never blanks while the
 * network call is in flight.
 */
async function handleAgendaWidget(props: WidgetTaskHandlerProps) {
  const {
    widgetInfo,
    widgetAction,
    clickAction,
    clickActionData,
    renderWidget,
  } = props;

  if (widgetAction === "WIDGET_DELETED") {
    await clearAgendaWidgetView(widgetInfo.widgetId);
    return;
  }

  let view = await getAgendaWidgetView(widgetInfo.widgetId);

  const draw = (
    data: AgendaWidgetData,
    extra: { notice?: string; pendingKey?: string } = {},
  ) =>
    renderWidget(
      <AgendaWidget
        items={data.items}
        habits={data.habits}
        view={view}
        status={data.status}
        width={widgetInfo.width}
        height={widgetInfo.height}
        {...extra}
      />,
    );

  if (
    widgetAction === "WIDGET_CLICK" &&
    (clickAction === SHOW_AGENDA_ACTION || clickAction === SHOW_HABITS_ACTION)
  ) {
    view = clickAction === SHOW_HABITS_ACTION ? "habits" : "agenda";
    await setAgendaWidgetView(widgetInfo.widgetId, view);
    const cached = await readAgendaWidgetCache();
    if (cached) draw(cached);
    if (!cached || cached.fetchedAt === 0) draw(await loadAgendaWidgetData());
    return;
  }

  if (widgetAction === "WIDGET_CLICK" && clickAction === COMPLETE_ITEM_ACTION) {
    const ref = (clickActionData ?? {}) as AgendaWidgetItemRef;

    // Acknowledge the tap immediately: the headless task plus the round trip
    // to the server is far too slow to leave the row looking untouched.
    const cached = await readAgendaWidgetCache();
    if (cached) draw(cached, { pendingKey: ref.key });

    const result = await completeAgendaWidgetItem(ref);
    const refreshed = await loadAgendaWidgetData();
    draw(refreshed, { notice: result.message });

    // Confirmation is a flash, not a state: settle back to the item count.
    // A failure message stays up, since it's the only place the user sees it.
    if (result.ok) {
      await new Promise((resolve) => setTimeout(resolve, NOTICE_LINGER_MS));
      draw(refreshed);
    }
    return;
  }

  // A resize only changes layout, so reuse a recent agenda instead of
  // refetching on every drag step.
  const cached = await readAgendaWidgetCache();
  if (cached) draw(cached);
  if (
    widgetAction === "WIDGET_RESIZED" &&
    cached &&
    Date.now() - cached.fetchedAt < CACHE_TTL_MS
  ) {
    return;
  }

  draw(await loadAgendaWidgetData());
}

// Renders the home-screen widget. Tapping the quick-capture widget is handled
// natively: the OPEN_URI click action launches QuickCaptureActivity via the
// mova://capture deep link, so this handler only needs to render it.
export async function widgetTaskHandlerEntry(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, renderWidget } = props;

  console.log("[Widget] widgetTaskHandlerEntry:", {
    widgetName: widgetInfo.widgetName,
    widgetAction,
  });

  try {
    if (widgetInfo.widgetName === AGENDA_WIDGET_NAME) {
      await handleAgendaWidget(props);
      return;
    }

    const Widget =
      nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

    if (!Widget) {
      console.log("[Widget] Unknown widget:", widgetInfo.widgetName);
      renderWidget(
        <ErrorWidget message={`Unknown: ${widgetInfo.widgetName}`} />,
      );
      return;
    }

    const templateName = await getTemplateName(widgetInfo.widgetId);

    renderWidget(
      <Widget
        widgetId={widgetInfo.widgetId}
        templateName={templateName}
        width={widgetInfo.width}
        height={widgetInfo.height}
      />,
    );
  } catch (error) {
    console.error("[Widget] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    renderWidget(
      <ErrorWidget message={`Error: ${errorMessage.substring(0, 50)}`} />,
    );
  }
}
