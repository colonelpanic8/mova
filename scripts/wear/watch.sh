#!/usr/bin/env bash
#
# Talk to a physical Wear OS watch over wireless ADB.
#
#   scripts/wear/watch.sh pair <ip:port> <code>   One-time pairing (watch shows both)
#   scripts/wear/watch.sh connect                 Find and connect to the watch
#   scripts/wear/watch.sh build                   Build a release-signed wear APK
#   scripts/wear/watch.sh push [--debug]          Build the wear APK and install it
#   scripts/wear/watch.sh shot [out.png]          Screenshot the watch face/tile
#   scripts/wear/watch.sh tile                    Reopen the Quick Capture tile
#   scripts/wear/watch.sh logcat [args...]        Tail Mova's watch logs
#   scripts/wear/watch.sh adb <args...>           Raw adb against the watch
#
# `push` builds a release-signed APK from the keystore in `pass`, so it upgrades
# the watch's existing install in place. A debug-signed APK has a different
# signature and would need an uninstall first, losing the paired credentials —
# hence --debug is opt-in.
#
# Environment:
#   MOVA_WATCH_ADDR   host:port of the watch, skipping mDNS discovery
#   MOVA_ADB_PORT     Port for our private adb server (default: 5041)
#
# We run a dedicated adb server on a non-default port using the SDK's
# platform-tools binary: nixpkgs' android-tools adb is built without mDNS, so
# it cannot discover the watch, and hijacking the default :5037 server would
# disturb anything else using it.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

pass_entry="mova-android-release-keystore"
watch_cache="$repo_root/.mova-watch"
export ANDROID_ADB_SERVER_PORT="${MOVA_ADB_PORT:-5041}"

if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "ANDROID_HOME is unset — run this inside 'nix develop --impure .#android'." >&2
  exit 1
fi

adb_bin="$ANDROID_HOME/platform-tools/adb"
[[ -x "$adb_bin" ]] || { echo "No platform-tools adb at $adb_bin" >&2; exit 1; }

adb() { "$adb_bin" "$@"; }

die() { echo "$*" >&2; exit 1; }

# The watch's wireless-debugging port is randomized per session, so resolve the
# address from mDNS every time and remember only the stable device serial.
#
# A phone with wireless debugging on advertises alongside the watch, and
# installing the wear APK onto the phone would be a confusing mess — so every
# candidate is confirmed to be a watch before we hand it a build.
mdns_candidates() {
  adb mdns services 2>/dev/null |
    awk '$2 == "_adb-tls-connect._tcp" {split($1, n, "-"); print n[2], $3}' |
    sort -u
}

is_watch() {
  [[ "$(adb -s "$1" shell getprop ro.build.characteristics 2>/dev/null)" == *watch* ]]
}

# adb connect exits 0 even when it prints "failed to connect", so read the text.
try_connect() {
  local addr="$1" out
  out="$(adb connect "$addr" 2>&1)"
  if [[ "$out" == *"failed to connect"* || "$out" == *"cannot connect"* ]]; then
    echo "  $addr: ${out##*$'\n'}" >&2
    return 1
  fi
  adb devices | grep -q "^$addr[[:space:]]*device$"
}

# Echoes the connected serial (an ip:port for a network device).
ensure_connected() {
  local addr serial cached candidates

  if [[ -n "${MOVA_WATCH_ADDR:-}" ]]; then
    try_connect "$MOVA_WATCH_ADDR" || die "Could not reach MOVA_WATCH_ADDR=$MOVA_WATCH_ADDR."
    is_watch "$MOVA_WATCH_ADDR" || die "$MOVA_WATCH_ADDR is not a watch (ro.build.characteristics)."
    echo "$MOVA_WATCH_ADDR"
    return 0
  fi

  # Reuse a live connection rather than re-dialing it.
  for serial in $(adb devices | awk '/^[0-9].*:[0-9]+\tdevice$/ {print $1}'); do
    if is_watch "$serial"; then
      echo "$serial"
      return 0
    fi
  done

  cached="$(cat "$watch_cache" 2>/dev/null || true)"
  candidates="$(mdns_candidates)"
  [[ -n "$candidates" ]] || die "No device is advertising wireless debugging. Turn on Developer options → Wireless debugging on the watch (or set MOVA_WATCH_ADDR=ip:port)."

  # Try the known watch first, then anything else that turns up.
  candidates="$(awk -v c="$cached" \
    '{ if ($1 == c) first = first $0 "\n"; else rest = rest $0 "\n" }
     END { printf "%s%s", first, rest }' <<< "$candidates")"

  while read -r serial addr; do
    [[ -n "$addr" ]] || continue
    try_connect "$addr" || continue
    if is_watch "$addr"; then
      echo "$serial" > "$watch_cache"
      echo "$addr"
      return 0
    fi
    echo "  $addr ($serial) is not a watch, skipping." >&2
    adb disconnect "$addr" >/dev/null 2>&1 || true
  done <<< "$candidates"

  die "Found $(wc -l <<<"$candidates") wireless-debugging device(s) but none usable as a watch. If it has never been paired with this machine, run: just watch pair <ip:port> <code>"
}

cmd_pair() {
  [[ $# -eq 2 ]] || die "usage: watch.sh pair <ip:port> <code>   (both shown on the watch's 'Pair new device' screen)"
  adb pair "$1" "$2"
  echo "Paired. Now run: scripts/wear/watch.sh connect"
}

cmd_connect() {
  local serial
  serial="$(ensure_connected)"
  echo "Watch connected: $serial"
  adb -s "$serial" shell getprop ro.product.model
}

build_release_apk() {
  local keystore secrets
  secrets="$(pass show "$pass_entry")" || die "Could not read '$pass_entry' from pass."
  keystore="$(mktemp -t mova-release-XXXXXX.jks)"
  chmod 600 "$keystore"
  trap 'rm -f "$keystore"' RETURN
  sed -n 's/^keystore-base64: //p' <<<"$secrets" | base64 -d > "$keystore"
  [[ -s "$keystore" ]] || die "keystore-base64 missing from '$pass_entry'."

  MOVA_UPLOAD_STORE_FILE="$keystore" \
  MOVA_UPLOAD_STORE_PASSWORD="$(head -n1 <<<"$secrets")" \
  MOVA_UPLOAD_KEY_ALIAS="$(sed -n 's/^key-alias: //p' <<<"$secrets")" \
  MOVA_UPLOAD_KEY_PASSWORD="$(sed -n 's/^key-password: //p' <<<"$secrets")" \
    android/gradlew -p android :wear:assembleRelease >&2
  echo "android/wear/build/outputs/apk/release/wear-release.apk"
}

cmd_push() {
  local debug=0 apk serial
  [[ "${1:-}" == "--debug" ]] && debug=1
  serial="$(ensure_connected)"
  if (( debug )); then
    android/gradlew -p android :wear:assembleDebug >&2
    apk="android/wear/build/outputs/apk/debug/wear-debug.apk"
  else
    apk="$(build_release_apk)"
  fi
  [[ -f "$apk" ]] || die "Build produced no APK at $apk"
  echo "Installing $apk -> $serial" >&2
  adb -s "$serial" install -r "$apk"
  cmd_tile "$serial"
}

# Tiles are only re-rendered when the system asks, so nudge the service and
# bring the tile carousel forward for a screenshot.
cmd_tile() {
  local serial="${1:-$(ensure_connected)}"
  adb -s "$serial" shell am force-stop com.colonelpanic.mova >/dev/null 2>&1 || true
  echo "Installed. Swipe to the Mova Quick Capture tile on the watch to see it." >&2
}

cmd_shot() {
  local serial out="${1:-/tmp/mova-watch.png}"
  serial="$(ensure_connected)"
  adb -s "$serial" exec-out screencap -p > "$out"
  [[ -s "$out" ]] || die "Screenshot came back empty."
  echo "$out"
}

cmd_logcat() {
  local serial
  serial="$(ensure_connected)"
  adb -s "$serial" logcat "${@:-*:W}"
}

cmd_adb() {
  local serial
  serial="$(ensure_connected)"
  adb -s "$serial" "$@"
}

case "${1:-}" in
  pair) shift; cmd_pair "$@" ;;
  build) shift; build_release_apk ;;
  connect) shift; cmd_connect "$@" ;;
  push) shift; cmd_push "$@" ;;
  shot) shift; cmd_shot "$@" ;;
  tile) shift; cmd_tile "$@" ;;
  logcat) shift; cmd_logcat "$@" ;;
  adb) shift; cmd_adb "$@" ;;
  *) sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
