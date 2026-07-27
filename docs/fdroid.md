# F-Droid distribution

Mova publishes a self-hosted F-Droid repository through GitHub Pages. It
indexes the signed phone APKs already attached to GitHub releases instead of
rebuilding or re-signing them, so an installation from the repository upgrades
in place from a manually installed release APK.

- Landing page: <https://colonelpanic8.github.io/mova/>
- Repository address: `https://colonelpanic8.github.io/mova/fdroid/repo`

The Wear OS APK has the same application ID and version code as the phone APK
but targets a different device type. It remains a separate download on the
GitHub releases page and is not indexed in this phone repository.

## Publication

`.github/workflows/fdroid-repo.yml` runs after **Build and Release APK**
succeeds. It:

1. Installs `fdroidserver`.
2. Regenerates fastlane changelogs from `CHANGELOG.md` and tagged
   `package.json` build numbers.
3. Downloads `app-release.apk` from the most recent GitHub releases.
4. Builds and signs the repository index.
5. Deploys the index and a fingerprint-bearing landing page to GitHub Pages.

Publishing a normal release is therefore enough to refresh the repository.

### One-time repository setup

- Enable **GitHub Pages** with _Source: GitHub Actions_.
- Keep the Android release-signing secrets configured:
  `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEYSTORE_PASSWORD`, and `ANDROID_KEY_PASSWORD`.

The same keystore signs the APKs and repository index, avoiding a second
long-lived signing secret. The APKs themselves are copied without modification;
that preserved APK signature is what makes GitHub and F-Droid installations
interchangeable.

Each deployment replaces the entire Pages site. `FDROID_RELEASE_COUNT`
defaults to four, keeping the site comfortably below GitHub Pages' size limit.
Older APKs remain on the releases page. Collection also stops at an APK
signing-key change, because Android cannot upgrade across that boundary.

### Signing migration in v6.7.0

The APKs published through v6.6.0 carry the committed Android debug
certificate. That key is public and is not suitable for future releases or a
trusted package repository. The release workflow now fails closed when its
signing secrets are missing instead of silently publishing another
debug-signed APK.

v6.7.0 establishes Mova's private production signing identity. Its keystore is
backed up in the `mova-android-release-keystore` password-store entry and
installed in the four GitHub Actions secrets listed above. The cutover
deliberately does not preserve the public debug signer, so existing
debug-signed installations must be uninstalled once before installing v6.7.0.

The repository builder detects this signer change and excludes the older
debug-signed history automatically. Private-key releases accumulate normally
from v6.7.0 onward.

## Version codes and release notes

Both Android modules derive their version code from `package.json`:

```text
major * 1,000,000 + minor * 10,000 + patch * 100 + buildNumber
```

For example, version 6.6.0 with build number 9 is `6060009`.

`scripts/fdroid/changelogs.py` reads the worktree's current package version and
historical `package.json` files from release tags, then writes the matching
version-code filenames under `fastlane/metadata/android/en-US/changelogs/`.
Entries predating Mova's current Android version-code convention are skipped.

```bash
just fdroid-changelogs
just fdroid-changelogs --check
```

CI runs the check, so a changelog or build-number change cannot silently leave
the F-Droid listing stale.

## Local repository build

Enter the repository's Android Nix shell first. `fdroidserver` currently needs
to be installed separately:

```bash
nix develop --impure .#android

python3 -m venv /tmp/mova-fdroid-venv
/tmp/mova-fdroid-venv/bin/pip install fdroidserver
export PATH="/tmp/mova-fdroid-venv/bin:$PATH"

keytool -genkeypair -keystore /tmp/mova-fdroid-test.jks \
  -alias testkey -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass testpass -keypass testpass -dname "CN=Mova F-Droid Test"

FDROID_KEYSTORE_FILE=/tmp/mova-fdroid-test.jks \
  FDROID_KEY_ALIAS=testkey \
  FDROID_KEYSTORE_PASSWORD=testpass \
  FDROID_KEY_PASSWORD=testpass \
  FDROID_RELEASE_COUNT=2 \
  just fdroid-repo
```

The generated repository lands in `target/fdroid`.

## APK size

Mova's release workflow already targets only `arm64-v8a`. Release builds now
also enable R8 code minification, unreachable-resource removal, optimized
ProGuard defaults, and compressed native-library packaging.

Against the v6.6.0 sources, the resulting phone APK is 19,396,791 bytes versus
45,732,579 bytes for the published v6.6.0 artifact: a 57.6% reduction. Native
libraries are extracted at install time, so part of the download-size saving is
traded for installed size. The release workflow records exact APK byte counts
in its job summary so regressions remain visible.

## Store metadata

`fastlane/metadata/android/` is the shared title, summary, description, and
release-note source used by the self-hosted repository and compatible external
catalogs. The listing declares `NonFreeDep` because optional Wear OS
synchronization uses the Google Play services wearable library; Mova's core
phone agenda, capture, search, and notification features do not require a
watch.
