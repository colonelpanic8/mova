import { NativeModules } from "react-native";
import type { AgendaWidgetProps } from "./AgendaWidget";
import type { AgendaWidgetData } from "./agendaWidgetData";
import type { AgendaWidgetView } from "./agendaWidgetState";

const { SharedStorage } = NativeModules;

const drawnKey = (widgetId: number) => `agenda_widget_${widgetId}_drawn`;

/**
 * Assemble the exact props an agenda widget renders from. Built in one place
 * so the task handler and the in-app refresh produce byte-identical
 * signatures for the same content.
 */
export function buildAgendaWidgetProps(
  data: AgendaWidgetData,
  view: AgendaWidgetView,
  size: { width: number; height: number },
  extra: { notice?: string; pendingKey?: string } = {},
): AgendaWidgetProps {
  return {
    items: data.items,
    habits: data.habits,
    view,
    status: data.status,
    width: size.width,
    height: size.height,
    ...extra,
  };
}

/**
 * Every renderWidget call replaces the widget's RemoteViews wholesale, which
 * the launcher shows as a blink — so a redraw is only worth it when these
 * props actually changed. The signature is what redraw paths compare.
 */
export function agendaWidgetSignature(props: AgendaWidgetProps): string {
  return JSON.stringify(props);
}

/**
 * Signature of the last draw, persisted so the app process can tell whether a
 * post-mutation refresh would repaint the launcher with identical content.
 * Advisory only: the launcher can lose our last draw (reboot, launcher
 * restart), so paths that must guarantee the widget isn't blank should draw
 * regardless of it.
 */
export async function getLastDrawnSignature(
  widgetId: number,
): Promise<string | null> {
  if (!SharedStorage) return null;
  try {
    return await SharedStorage.getItem(drawnKey(widgetId));
  } catch {
    return null;
  }
}

export async function setLastDrawnSignature(
  widgetId: number,
  signature: string,
): Promise<void> {
  if (!SharedStorage) return;
  try {
    await SharedStorage.setItem(drawnKey(widgetId), signature);
  } catch {
    // Losing the signature only costs an extra redraw later.
  }
}

export async function clearLastDrawnSignature(widgetId: number): Promise<void> {
  if (!SharedStorage) return;
  try {
    await SharedStorage.removeItem(drawnKey(widgetId));
  } catch {
    // Widget deletion is best effort.
  }
}
