#!/usr/bin/env bash
#
# Assemble Mova's self-hosted F-Droid repository from signed phone APKs already
# attached to recent GitHub releases.
#
# Environment:
#   FDROID_OUT_DIR         Output directory (default: target/fdroid)
#   FDROID_RELEASE_COUNT   Number of recent releases to retain (default: 4)
#   FDROID_KEYSTORE_BASE64 Base64-encoded index signing keystore
#   FDROID_KEYSTORE_FILE   Keystore path, as an alternative to the above
#   FDROID_KEY_ALIAS
#   FDROID_KEYSTORE_PASSWORD
#   FDROID_KEY_PASSWORD
#   GH_TOKEN               Token used by `gh release`
#
# The ANDROID_* names used by Mova's release workflow are accepted as fallbacks.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

out_dir="${FDROID_OUT_DIR:-target/fdroid}"
release_count="${FDROID_RELEASE_COUNT:-4}"
app_id="com.colonelpanic.mova"
fastlane_root="fastlane/metadata/android"

if [[ -z "$out_dir" || "$out_dir" == "/" || "$out_dir" == "." || "$out_dir" == ".." || "$out_dir" == "$repo_root" ]]; then
  echo "Refusing unsafe FDROID_OUT_DIR: $out_dir" >&2
  exit 1
fi
if [[ ! "$release_count" =~ ^[1-9][0-9]*$ ]]; then
  echo "FDROID_RELEASE_COUNT must be a positive integer" >&2
  exit 1
fi

: "${FDROID_KEYSTORE_BASE64:=${ANDROID_KEYSTORE_BASE64:-}}"
: "${FDROID_KEYSTORE_FILE:=${ANDROID_KEYSTORE_FILE:-}}"
: "${FDROID_KEY_ALIAS:=${ANDROID_KEY_ALIAS:-}}"
: "${FDROID_KEYSTORE_PASSWORD:=${ANDROID_KEYSTORE_PASSWORD:-}}"
: "${FDROID_KEY_PASSWORD:=${ANDROID_KEY_PASSWORD:-}}"
export FDROID_KEY_ALIAS FDROID_KEYSTORE_PASSWORD FDROID_KEY_PASSWORD

if [[ -z "$FDROID_KEYSTORE_BASE64" && -z "$FDROID_KEYSTORE_FILE" ]]; then
  echo "Set FDROID_KEYSTORE_BASE64 or FDROID_KEYSTORE_FILE" >&2
  exit 1
fi
for var in FDROID_KEY_ALIAS FDROID_KEYSTORE_PASSWORD FDROID_KEY_PASSWORD; do
  if [[ -z "${!var}" ]]; then
    echo "Signing the repository index requires $var" >&2
    exit 1
  fi
done

for tool in fdroid gh python3; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Required tool not found on PATH: $tool" >&2
    exit 1
  fi
done

# fdroidserver signs its v2 index with apksigner. It can find SDK build tools
# through ANDROID_HOME even when the executable is not directly on PATH.
if command -v apksigner >/dev/null 2>&1; then
  apksigner_bin="$(command -v apksigner)"
else
  shopt -s nullglob
  sdk_apksigners=("${ANDROID_HOME:-/nonexistent}"/build-tools/*/apksigner)
  shopt -u nullglob
  if [[ "${#sdk_apksigners[@]}" -eq 0 ]]; then
    echo "apksigner not found; set ANDROID_HOME to an SDK with build-tools" >&2
    exit 1
  fi
  apksigner_bin="${sdk_apksigners[-1]}"
fi

echo "==> Refreshing fastlane changelogs"
python3 scripts/fdroid/changelogs.py

echo "==> Preparing $out_dir"
rm -rf -- "$out_dir"
mkdir -p "$out_dir/repo" "$out_dir/metadata"
cp fdroid/config.yml "$out_dir/config.yml"
cp fdroid/metadata/*.yml "$out_dir/metadata/"

for locale_dir in "$fastlane_root"/*/; do
  [[ -d "$locale_dir" ]] || continue
  locale="$(basename "$locale_dir")"
  mkdir -p "$out_dir/metadata/$app_id"
  cp -r "$locale_dir" "$out_dir/metadata/$app_id/$locale"
done

# The same source icon is used by Expo and the repository landing page.
cp assets/images/mova-icon-final.png "$out_dir/icon.png"

echo "==> Collecting phone APKs from the $release_count most recent releases"
mapfile -t tags < <(
  gh release list --limit "$release_count" --json tagName,isDraft,isPrerelease \
    --jq '.[] | select(.isDraft == false and .isPrerelease == false) | .tagName'
)
if [[ "${#tags[@]}" -eq 0 ]]; then
  echo "No published GitHub releases were found" >&2
  exit 1
fi

download_dir="$(mktemp -d)"
trap 'rm -rf -- "$download_dir"' EXIT

apk_count=0
apk_signer=""
for tag in "${tags[@]}"; do
  tag_dir="$download_dir/$tag"
  mkdir -p "$tag_dir"
  if ! gh release download "$tag" --pattern 'app-release.apk' --dir "$tag_dir" 2>/dev/null; then
    echo "  $tag: no phone APK asset, skipping"
    continue
  fi

  source_apk="$tag_dir/app-release.apk"
  if ! cert_output="$("$apksigner_bin" verify --print-certs "$source_apk" 2>&1)"; then
    echo "$tag: APK signature verification failed" >&2
    printf '%s\n' "$cert_output" >&2
    exit 1
  fi
  signer="$(
    printf '%s\n' "$cert_output" \
      | sed -nE 's/^.*certificate SHA-256 digest:[[:space:]]*//p' \
      | head -1
  )"
  if [[ -z "$signer" ]]; then
    echo "$tag: could not read the APK signing certificate" >&2
    printf '%s\n' "$cert_output" >&2
    exit 1
  fi
  if [[ -z "$apk_signer" ]]; then
    apk_signer="$signer"
  elif [[ "$signer" != "$apk_signer" ]]; then
    # A client cannot upgrade across an Android signing-key change. Releases
    # are newest-first, so stop at the boundary and retain one coherent upgrade
    # history rather than publishing an unusable mixed-signature sequence.
    echo "  $tag: signing key differs from the newest release; stopping at key boundary"
    break
  fi

  destination="$out_dir/repo/mova-$tag-app-release.apk"
  cp "$source_apk" "$destination"
  echo "  $tag: $(basename "$destination")"
  apk_count=$((apk_count + 1))
done

if [[ "$apk_count" -eq 0 ]]; then
  echo "No phone APKs were found in the selected releases" >&2
  exit 1
fi

echo "==> Recording collected versions"
python3 scripts/fdroid/apply-versions.py "$out_dir" "$app_id"

echo "==> Installing index signing keystore"
keystore="$out_dir/keystore.jks"
if [[ -n "$FDROID_KEYSTORE_FILE" ]]; then
  cp "$FDROID_KEYSTORE_FILE" "$keystore"
else
  printf '%s' "$FDROID_KEYSTORE_BASE64" | base64 -d > "$keystore"
fi
chmod 600 "$keystore"

echo "==> Running fdroid update ($apk_count APK(s))"
(
  cd "$out_dir"
  fdroid update --pretty --verbose
)

fingerprint=""
if command -v keytool >/dev/null 2>&1; then
  fingerprint="$(
    keytool -list -v \
      -keystore "$keystore" \
      -alias "$FDROID_KEY_ALIAS" \
      -storepass "$FDROID_KEYSTORE_PASSWORD" 2>/dev/null \
      | sed -n 's/^[[:space:]]*SHA256:[[:space:]]*//p' \
      | head -1 \
      | tr -d ':' \
      | tr '[:upper:]' '[:lower:]'
  )"
fi

# The signing key must never reach the Pages artifact.
rm -f -- "$keystore"

echo
echo "F-Droid repository built in $out_dir"
echo "  APKs indexed: $apk_count"
if [[ -n "$fingerprint" ]]; then
  echo "  Fingerprint:  $fingerprint"
  printf '%s\n' "$fingerprint" > "$out_dir/fingerprint.txt"
fi
