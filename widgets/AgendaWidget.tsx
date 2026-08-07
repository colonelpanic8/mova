import type { ColorProp } from "react-native-android-widget";
import {
  FlexWidget,
  ListWidget,
  SvgWidget,
  TextWidget,
} from "react-native-android-widget";
import { AgendaWidgetItem, buildItemRef } from "./agendaWidgetData";

/** Must match the widget registered in app.config.js and the manifest. */
export const AGENDA_WIDGET_NAME = "AgendaWidget";

/** Click action a row's check circle emits; handled by the task handler. */
export const COMPLETE_ITEM_ACTION = "COMPLETE_AGENDA_ITEM";
/** Click action the header's refresh button emits. */
export const REFRESH_AGENDA_ACTION = "REFRESH_AGENDA";

// Below this width the row's trailing metadata (time, category) is dropped so
// the title keeps a usable amount of room.
const COMPACT_WIDTH_DP = 220;

// MD3 light palette, kept coherent with the app and the quick-capture widget.
const SURFACE = "#FEF7FF"; // surface
const CONTAINER = "#F3EDF7"; // surfaceContainer
const ON_SURFACE = "#1D1B20";
const ON_SURFACE_VARIANT = "#49454F";
const PRIMARY = "#6750A4";
const ERROR = "#B3261E";
const OUTLINE = "#79747E";

const circleSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>`;

const checkCircleSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;

const refreshSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-8 8s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;

export interface AgendaWidgetProps {
  items?: AgendaWidgetItem[];
  status?: "ok" | "unauthenticated" | "error";
  /** Transient line shown in place of the item count (e.g. "Done"). */
  notice?: string;
  /** Key of the item currently being completed; its row renders as pending. */
  pendingKey?: string;
  /** Current widget size in dp, as reported by the task handler. */
  width?: number;
  height?: number;
}

function headerLabel(
  status: AgendaWidgetProps["status"],
  notice: string | undefined,
  outstanding: number,
): { text: string; color: ColorProp } {
  if (notice) return { text: notice, color: PRIMARY };
  if (status === "unauthenticated") return { text: "Log in", color: ERROR };
  if (status === "error") return { text: "Offline", color: ERROR };
  if (outstanding === 0)
    return { text: "All clear", color: ON_SURFACE_VARIANT };
  return { text: `${outstanding} left`, color: ON_SURFACE_VARIANT };
}

function emptyMessage(status: AgendaWidgetProps["status"]): string {
  switch (status) {
    case "unauthenticated":
      return "Log in to the app to see your agenda";
    case "error":
      return "Couldn't reach the server — tap ⟳ to retry";
    default:
      return "Nothing left on today's agenda";
  }
}

/** Trailing metadata for a row: time of day, or the overdue/habit marker. */
function metaLabel(item: AgendaWidgetItem): string | null {
  if (item.isOverdue) return item.timeLabel ? `! ${item.timeLabel}` : "!";
  return item.timeLabel;
}

function AgendaRow({
  item,
  pending,
  compact,
}: {
  item: AgendaWidgetItem;
  pending: boolean;
  compact: boolean;
}) {
  const done = item.completedToday;
  const meta = metaLabel(item);
  const iconColor = done || pending ? PRIMARY : OUTLINE;

  // List rows are rendered to bitmaps sized to the row's own bounds, so the
  // gap between rows has to come from padding on a transparent wrapper rather
  // than a margin on the card.
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "wrap_content",
        paddingBottom: 4,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: "mova://agenda" }}
      accessibilityLabel={item.title}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          height: "wrap_content",
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: CONTAINER,
          borderRadius: 16,
          paddingTop: 4,
          paddingBottom: 4,
          paddingRight: 10,
        }}
      >
        {/* The only completion affordance: a tap target sized for a launcher. */}
        <FlexWidget
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: "center",
            alignItems: "center",
          }}
          clickAction={COMPLETE_ITEM_ACTION}
          clickActionData={buildItemRef(item)}
          accessibilityLabel={`Complete ${item.title}`}
        >
          <SvgWidget
            svg={done ? checkCircleSvg(iconColor) : circleSvg(iconColor)}
            style={{ width: 24, height: 24 }}
          />
        </FlexWidget>

        <FlexWidget style={{ flex: 1, height: "wrap_content" }}>
          <TextWidget
            text={item.title}
            truncate="END"
            maxLines={2}
            style={{
              fontSize: 14,
              color: done || pending ? ON_SURFACE_VARIANT : ON_SURFACE,
            }}
          />
        </FlexWidget>

        {compact || !meta ? null : (
          <TextWidget
            text={meta}
            maxLines={1}
            style={{
              fontSize: 12,
              marginLeft: 6,
              color: item.isOverdue ? ERROR : ON_SURFACE_VARIANT,
            }}
          />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * Today's agenda on the home screen, built around one interaction: tap an
 * item's circle to complete it. Everything else (the title, the header) opens
 * the app, so a stray tap navigates rather than mutating org data.
 */
export function AgendaWidget({
  items = [],
  status = "ok",
  notice,
  pendingKey,
  width,
}: AgendaWidgetProps) {
  const compact = typeof width === "number" && width < COMPACT_WIDTH_DP;
  const outstanding = items.filter((item) => !item.completedToday).length;
  const label = headerLabel(status, notice, outstanding);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        backgroundColor: SURFACE,
        borderRadius: 24,
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 8,
        paddingRight: 8,
      }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          height: 32,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 8,
        }}
      >
        <FlexWidget
          style={{
            flex: 1,
            height: "match_parent",
            flexDirection: "row",
            alignItems: "center",
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "mova://agenda" }}
          accessibilityLabel="Open agenda"
        >
          <TextWidget
            text="Today"
            style={{ fontSize: 15, fontWeight: "bold", color: ON_SURFACE }}
          />
          <TextWidget
            text={label.text}
            truncate="END"
            maxLines={1}
            style={{ fontSize: 12, marginLeft: 8, color: label.color }}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            justifyContent: "center",
            alignItems: "center",
          }}
          clickAction={REFRESH_AGENDA_ACTION}
          accessibilityLabel="Refresh agenda"
        >
          <SvgWidget
            svg={refreshSvg(ON_SURFACE_VARIANT)}
            style={{ width: 18, height: 18 }}
          />
        </FlexWidget>
      </FlexWidget>

      {items.length === 0 ? (
        <FlexWidget
          style={{
            width: "match_parent",
            height: "match_parent",
            justifyContent: "center",
            alignItems: "center",
            paddingLeft: 12,
            paddingRight: 12,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "mova://agenda" }}
        >
          <TextWidget
            text={emptyMessage(status)}
            maxLines={3}
            style={{
              fontSize: 13,
              textAlign: "center",
              color: ON_SURFACE_VARIANT,
            }}
          />
        </FlexWidget>
      ) : (
        <ListWidget style={{ width: "match_parent", height: "match_parent" }}>
          {items.map((item) => (
            <AgendaRow
              key={item.key}
              item={item}
              pending={item.key === pendingKey}
              compact={compact}
            />
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}

export default AgendaWidget;
