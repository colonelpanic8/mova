#!/usr/bin/env python3
"""Generate fastlane changelog files from CHANGELOG.md.

F-Droid reads release notes from
``fastlane/metadata/android/<locale>/changelogs/<versionCode>.txt``. Mova's
version code includes the package build number, so this script reads
``package.json`` from each release tag instead of trying to infer historical
codes from semantic versions alone.

The current package version is read from the worktree, allowing a release
change to pass CI before its tag exists. Older changelog entries without a tag
or ``buildNumber`` predate the current Android version convention and are
ignored.

Usage:
    scripts/fdroid/changelogs.py [--check]
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CHANGELOG = REPO_ROOT / "CHANGELOG.md"
PACKAGE_JSON = REPO_ROOT / "package.json"
OUT_DIR = REPO_ROOT / "fastlane/metadata/android/en-US/changelogs"

MAX_CHARS = 500
RELEASE_HEADING = re.compile(r"^##\s+\[(\d+)\.(\d+)\.(\d+)\]")
SECTION_HEADING = re.compile(r"^###\s+(.+?)\s*$")


def version_text(version: tuple[int, int, int]) -> str:
    return ".".join(str(part) for part in version)


def read_tag_package(version: tuple[int, int, int]) -> dict[str, object] | None:
    tag = f"v{version_text(version)}"
    result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "show", f"{tag}:package.json"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def android_version_code(
    version: tuple[int, int, int],
    current_package: dict[str, object],
) -> int | None:
    release_version = version_text(version)
    package = (
        current_package
        if current_package.get("version") == release_version
        else read_tag_package(version)
    )
    if package is None or package.get("version") != release_version:
        return None

    build_number = package.get("buildNumber")
    if build_number is None:
        return None
    try:
        build = int(str(build_number))
    except ValueError:
        raise ValueError(f"{release_version} has a non-numeric buildNumber")

    major, minor, patch = version
    if minor > 99 or patch > 99 or not 0 <= build <= 99:
        raise ValueError(
            f"{release_version} build {build} exceeds the Android version-code fields"
        )
    return major * 1_000_000 + minor * 10_000 + patch * 100 + build


def parse_releases(text: str) -> dict[tuple[int, int, int], str]:
    releases: dict[tuple[int, int, int], str] = {}
    version: tuple[int, int, int] | None = None
    section: str | None = None
    entries: list[str] = []

    def flush() -> None:
        if version is not None:
            releases[version] = render(entries)

    for line in text.splitlines():
        heading = RELEASE_HEADING.match(line)
        if heading:
            flush()
            version = tuple(int(part) for part in heading.groups())
            section = None
            entries = []
            continue

        if version is None:
            continue

        section_match = SECTION_HEADING.match(line)
        if section_match:
            section = section_match.group(1)
            continue

        if line.startswith("- "):
            entry = line[2:].strip()
            entries.append(f"{section}: {entry}" if section else entry)
        elif entries and line.startswith("  ") and line.strip():
            entries[-1] = f"{entries[-1]} {line.strip()}"

    flush()
    return releases


def render(entries: list[str]) -> str:
    if not entries:
        return "Maintenance release.\n"

    lines: list[str] = []
    used = 0
    for entry in entries:
        candidate = f"* {entry}"
        if lines and used + len(candidate) + 1 > MAX_CHARS:
            lines.append("* ...see CHANGELOG.md for the rest.")
            break
        lines.append(candidate)
        used += len(candidate) + 1
    return "\n".join(lines) + "\n"


def expected_changelogs() -> dict[int, str]:
    current_package = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    expected: dict[int, str] = {}
    for version, body in parse_releases(
        CHANGELOG.read_text(encoding="utf-8")
    ).items():
        code = android_version_code(version, current_package)
        if code is None:
            continue
        if code in expected:
            raise ValueError(f"duplicate Android versionCode {code}")
        expected[code] = body
    return expected


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify committed changelogs instead of updating them",
    )
    args = parser.parse_args()

    try:
        expected = expected_changelogs()
    except (json.JSONDecodeError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1

    if not expected:
        print("no releases with Android version codes were found", file=sys.stderr)
        return 1

    stale: list[str] = []
    for code, body in sorted(expected.items()):
        target = OUT_DIR / f"{code}.txt"
        current = target.read_text(encoding="utf-8") if target.exists() else None
        if current == body:
            continue
        if args.check:
            stale.append(target.relative_to(REPO_ROOT).as_posix())
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(body, encoding="utf-8")

    expected_names = {f"{code}.txt" for code in expected}
    if OUT_DIR.exists():
        for orphan in sorted(OUT_DIR.glob("*.txt")):
            if orphan.name in expected_names:
                continue
            if args.check:
                stale.append(orphan.relative_to(REPO_ROOT).as_posix())
            else:
                orphan.unlink()

    if stale:
        print("fastlane changelogs are out of date:", file=sys.stderr)
        for path in stale:
            print(f"  {path}", file=sys.stderr)
        print("run: scripts/fdroid/changelogs.py", file=sys.stderr)
        return 1

    if not args.check:
        print(
            f"wrote {len(expected)} changelog(s) to "
            f"{OUT_DIR.relative_to(REPO_ROOT)}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
