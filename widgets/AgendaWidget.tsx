import type { ColorProp } from "react-native-android-widget";
import {
  FlexWidget,
  ListWidget,
  SvgWidget,
  TextWidget,
} from "react-native-android-widget";
import { AgendaWidgetItem, buildItemRef } from "./agendaWidgetData";
import type { AgendaWidgetView } from "./agendaWidgetState";

/** Must match the widget registered in app.config.js and the manifest. */
export const AGENDA_WIDGET_NAME = "AgendaWidget";

/** Click action a row's check circle emits; handled by the task handler. */
export const COMPLETE_ITEM_ACTION = "COMPLETE_AGENDA_ITEM";
/** Click action the header's refresh button emits. */
export const REFRESH_AGENDA_ACTION = "REFRESH_AGENDA";
export const SHOW_AGENDA_ACTION = "SHOW_AGENDA";
export const SHOW_HABITS_ACTION = "SHOW_HABITS";

// Below this width date/time metadata is dropped so the title and controls
// keep a usable amount of room.
const COMPACT_WIDTH_DP = 220;
const TWO_COLUMN_WIDTH_DP = 420;
const HEADER_HEIGHT_DP = 32;
const SURFACE_PADDING_DP = 8;
const SURFACE_RADIUS_DP = 24;

// MD3 light palette, kept coherent with the app and the quick-capture widget.
const SURFACE = "#FEF7FF"; // surface
const CONTAINER = "#F3EDF7"; // surfaceContainer
const ON_SURFACE = "#1D1B20";
const ON_SURFACE_VARIANT = "#49454F";
const PRIMARY = "#6750A4";
const PRIMARY_CONTAINER = "#EADDFF";
const ERROR = "#B3261E";
const OUTLINE = "#79747E";

const circleSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>`;

const checkCircleSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;

const refreshSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-8 8s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;

const micSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;

const addSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;

export interface AgendaWidgetProps {
  items?: AgendaWidgetItem[];
  habits?: AgendaWidgetItem[];
  view?: AgendaWidgetView;
  status?: "ok" | "unauthenticated" | "error";
  /** Transient line shown in place of the item count (e.g. "Done"). */
  notice?: string;
  /** Key of the item currently being completed; its row renders as pending. */
  pendingKey?: string;
  /** Current widget size in dp, as reported by the task handler. */
  width?: number;
  height?: number;
}

function statusLabel(
  status: AgendaWidgetProps["status"],
  notice: string | undefined,
): { text: string; color: ColorProp } | null {
  if (notice) return { text: notice, color: PRIMARY };
  if (status === "unauthenticated") return { text: "Log in", color: ERROR };
  if (status === "error") return { text: "Offline", color: ERROR };
  return null;
}

function emptyMessage(
  status: AgendaWidgetProps["status"],
  view: AgendaWidgetView,
): string {
  switch (status) {
    case "unauthenticated":
      return "Log in to the app to see your agenda";
    case "error":
      return "Couldn't reach the server — tap ⟳ to retry";
    default:
      return view === "habits"
        ? "No habits scheduled for today"
        : "Nothing left on today's agenda";
  }
}

function metaLabel(item: AgendaWidgetItem): string | null {
  const timestamp = item.timestampLabel ?? item.timeLabel;
  if (item.isOverdue) return timestamp ? `! ${timestamp}` : "! Overdue";
  return timestamp;
}

function AgendaCard({
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

  return (
    <FlexWidget
      style={{
        flex: 1,
        width: 0,
        height: "wrap_content",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: CONTAINER,
        borderRadius: 16,
        paddingTop: 4,
        paddingBottom: 4,
        paddingRight: 10,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: "mova://agenda" }}
      accessibilityLabel={item.title}
    >
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

      <FlexWidget style={{ flex: 1, width: 0, height: "wrap_content" }}>
        <TextWidget
          text={item.title}
          truncate="END"
          maxLines={2}
          style={{
            fontSize: 14,
            color: done || pending ? ON_SURFACE_VARIANT : ON_SURFACE,
          }}
        />
        {compact || !meta ? null : (
          <TextWidget
            text={meta}
            truncate="END"
            maxLines={1}
            style={{
              fontSize: 11,
              marginTop: 2,
              color: item.isOverdue ? ERROR : ON_SURFACE_VARIANT,
            }}
          />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}

function AgendaItemsRow({
  items,
  pendingKey,
  compact,
  columns,
}: {
  items: AgendaWidgetItem[];
  pendingKey?: string;
  compact: boolean;
  columns: 1 | 2;
}) {
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "wrap_content",
        flexDirection: "row",
        flexGap: 4,
        paddingBottom: 4,
      }}
    >
      {items.map((item) => (
        <AgendaCard
          key={item.key}
          item={item}
          pending={item.key === pendingKey}
          compact={compact}
        />
      ))}
      {columns === 2 && items.length === 1 ? (
        <FlexWidget style={{ flex: 1, width: 0, height: 1 }} />
      ) : null}
    </FlexWidget>
  );
}

function groupItems(
  items: AgendaWidgetItem[],
  columns: 1 | 2,
): AgendaWidgetItem[][] {
  const rows: AgendaWidgetItem[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

/**
 * Today's tasks and habits on the home screen. Item circles complete in place,
 * while the header switches views and offers capture and refresh controls.
 */
export function AgendaWidget({
  items = [],
  habits = [],
  view = "agenda",
  status = "ok",
  notice,
  pendingKey,
  width,
  height,
}: AgendaWidgetProps) {
  const compact = typeof width === "number" && width < COMPACT_WIDTH_DP;
  const columns: 1 | 2 =
    typeof width === "number" && width >= TWO_COLUMN_WIDTH_DP ? 2 : 1;
  const listHeight =
    typeof height === "number"
      ? Math.max(
          40,
          height - SURFACE_PADDING_DP - HEADER_HEIGHT_DP - SURFACE_RADIUS_DP,
        )
      : "match_parent";
  const outstanding = items.filter((item) => !item.completedToday).length;
  const habitsLeft = habits.filter((item) => !item.completedToday).length;
  const label = statusLabel(status, notice);
  const visibleItems = view === "habits" ? habits : items;
  const rows = groupItems(visibleItems, columns);

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
          height: HEADER_HEIGHT_DP,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 8,
        }}
      >
        <FlexWidget
          style={{
            flex: 1,
            width: 0,
            height: "match_parent",
            flexDirection: "row",
            alignItems: "center",
            flexGap: 4,
          }}
        >
          <FlexWidget
            style={{
              flex: 1,
              width: 0,
              height: 28,
              borderRadius: 14,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor:
                view === "agenda" ? PRIMARY_CONTAINER : "#00000000",
            }}
            clickAction={SHOW_AGENDA_ACTION}
            accessibilityLabel={`${outstanding} tasks left`}
          >
            <TextWidget
              text={
                view === "agenda" && label
                  ? label.text
                  : compact
                    ? "T"
                    : `Tasks ${outstanding}`
              }
              truncate="END"
              maxLines={1}
              style={{
                fontSize: 12,
                fontWeight: view === "agenda" ? "bold" : "normal",
                color:
                  view === "agenda" && label
                    ? label.color
                    : view === "agenda"
                      ? PRIMARY
                      : ON_SURFACE_VARIANT,
              }}
            />
          </FlexWidget>

          <FlexWidget
            style={{
              flex: 1,
              width: 0,
              height: 28,
              borderRadius: 14,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor:
                view === "habits" ? PRIMARY_CONTAINER : "#00000000",
            }}
            clickAction={SHOW_HABITS_ACTION}
            accessibilityLabel={`${habitsLeft} habits left`}
          >
            <TextWidget
              text={
                view === "habits" && label
                  ? label.text
                  : compact
                    ? "H"
                    : `Habits ${habitsLeft}`
              }
              truncate="END"
              maxLines={1}
              style={{
                fontSize: 12,
                fontWeight: view === "habits" ? "bold" : "normal",
                color:
                  view === "habits" && label
                    ? label.color
                    : view === "habits"
                      ? PRIMARY
                      : ON_SURFACE_VARIANT,
              }}
            />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            justifyContent: "center",
            alignItems: "center",
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "mova://capture-voice" }}
          accessibilityLabel="Capture by voice"
        >
          <SvgWidget
            svg={micSvg(ON_SURFACE_VARIANT)}
            style={{ width: 18, height: 18 }}
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
          clickAction="OPEN_URI"
          clickActionData={{ uri: "mova://capture" }}
          accessibilityLabel="Quick capture"
        >
          <SvgWidget svg={addSvg(PRIMARY)} style={{ width: 20, height: 20 }} />
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

      {visibleItems.length === 0 ? (
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
            text={emptyMessage(status, view)}
            maxLines={3}
            style={{
              fontSize: 13,
              textAlign: "center",
              color: ON_SURFACE_VARIANT,
            }}
          />
        </FlexWidget>
      ) : (
        <ListWidget style={{ width: "match_parent", height: listHeight }}>
          {rows.map((row) => (
            <AgendaItemsRow
              key={row.map((item) => item.key).join(":")}
              items={row}
              pendingKey={pendingKey}
              compact={compact}
              columns={columns}
            />
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}

export default AgendaWidget;
