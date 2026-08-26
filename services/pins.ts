import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter, NativeModules } from "react-native";

export interface Pin {
  id: string;
  title: string;
  createdAt: number;
  /** Epoch millis when the pin starts alerting, or 0 for a passive pin. */
  escalateAt: number;
  escalated: boolean;
}

export interface PinPreset {
  title: string;
  minutes: number;
}

interface MovaPinsNative {
  list(): Promise<Pin[]>;
  arm(title: string, escalateMinutes: number): Promise<Pin>;
  complete(id: string): Promise<void>;
  snooze(id: string, minutes: number): Promise<void>;
  syncPresets(presetsJson: string): Promise<void>;
}

const PIN_PRESETS_KEY = "mova_pin_presets_v1";
const PINS_CHANGED_EVENT = "movaPinsChanged";

export const DEFAULT_PIN_PRESETS: PinPreset[] = [
  { title: "Stove is on", minutes: 10 },
  { title: "Scooter in lobby", minutes: 15 },
];

function native(): MovaPinsNative | undefined {
  return NativeModules.MovaPins as MovaPinsNative | undefined;
}

/** Pins are backed by a native Android module; elsewhere the feature is off. */
export function isPinsAvailable(): boolean {
  return native() != null;
}

export async function listPins(): Promise<Pin[]> {
  const module = native();
  if (!module) return [];
  return module.list();
}

export async function armPin(
  title: string,
  escalateMinutes: number,
): Promise<Pin | null> {
  const module = native();
  if (!module) return null;
  return module.arm(title, escalateMinutes);
}

export async function completePin(id: string): Promise<void> {
  await native()?.complete(id);
}

export async function snoozePin(id: string, minutes: number): Promise<void> {
  await native()?.snooze(id, minutes);
}

/** Fires whenever native pin state changes (including from notification
 *  actions and watch-initiated arms). Returns an unsubscribe function. */
export function subscribeToPinChanges(listener: () => void): () => void {
  const subscription = DeviceEventEmitter.addListener(
    PINS_CHANGED_EVENT,
    listener,
  );
  return () => subscription.remove();
}

export async function getPinPresets(): Promise<PinPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(PIN_PRESETS_KEY);
    if (!raw) return DEFAULT_PIN_PRESETS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_PIN_PRESETS;
    return parsed.filter(
      (p): p is PinPreset =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as PinPreset).title === "string" &&
        typeof (p as PinPreset).minutes === "number",
    );
  } catch {
    return DEFAULT_PIN_PRESETS;
  }
}

export async function setPinPresets(presets: PinPreset[]): Promise<void> {
  await AsyncStorage.setItem(PIN_PRESETS_KEY, JSON.stringify(presets));
  await syncPresetsToWatch(presets);
}

/** Best-effort push of the presets to the watch's pin tile surface. */
export async function syncPresetsToWatch(presets?: PinPreset[]): Promise<void> {
  const module = native();
  if (!module) return;
  try {
    const toSync = presets ?? (await getPinPresets());
    await module.syncPresets(JSON.stringify(toSync));
  } catch {
    // No paired watch or Play Services unavailable; nothing to do.
  }
}
