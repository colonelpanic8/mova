#!/usr/bin/env python3
"""Write the GitHub Pages landing page for Mova's F-Droid repository.

Usage:
    scripts/fdroid/landing-page.py <fdroid-build-dir> <output-html>
"""

from __future__ import annotations

import html
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG = REPO_ROOT / "fdroid/config.yml"

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mova F-Droid Repository</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{
    margin: 0 auto;
    max-width: 44rem;
    padding: 2.5rem 1.25rem 4rem;
    font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
  }}
  h1 {{ display: flex; align-items: center; gap: 0.75rem; font-size: 1.6rem; }}
  h1 img {{ width: 3rem; height: 3rem; border-radius: 0.75rem; }}
  code, pre {{
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9em;
  }}
  pre {{
    padding: 0.85rem 1rem;
    border-radius: 0.5rem;
    background: rgba(127, 127, 127, 0.14);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }}
  .cta {{
    display: inline-block;
    margin: 0.5rem 0 1.5rem;
    padding: 0.7rem 1.2rem;
    border-radius: 0.5rem;
    background: #6750a4;
    color: #fff;
    font-weight: 600;
    text-decoration: none;
  }}
  footer {{ margin-top: 3rem; font-size: 0.9rem; opacity: 0.75; }}
</style>
</head>
<body>
<h1><img src="fdroid/repo/icons/icon.png" alt="">Mova F-Droid Repository</h1>

<p>
  Mova brings an Emacs org-mode agenda to Android. This repository contains the
  same signed phone APKs attached to
  <a href="https://github.com/colonelpanic8/mova/releases">GitHub releases</a>,
  so either source can upgrade an existing installation.
</p>

<a class="cta" href="{add_url}">Add this repository to F-Droid</a>

<p>If the button does not open your client, add this address manually:</p>
<pre>{repo_url}</pre>

<p>Verify the repository signing fingerprint (SHA-256):</p>
<pre>{fingerprint_display}</pre>

<p>
  This repository indexes the phone app. The separately installable Wear OS APK
  remains available from GitHub releases.
</p>

<footer>
  Source and issues:
  <a href="https://github.com/colonelpanic8/mova">github.com/colonelpanic8/mova</a>
</footer>
</body>
</html>
"""


def read_repo_url() -> str:
    match = re.search(
        r"^repo_url:\s*(\S+)\s*$",
        CONFIG.read_text(encoding="utf-8"),
        re.MULTILINE,
    )
    if not match:
        raise SystemExit(f"repo_url not found in {CONFIG}")
    return match.group(1)


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2

    build_dir = Path(sys.argv[1])
    output = Path(sys.argv[2])
    repo_url = read_repo_url()
    fingerprint_file = build_dir / "fingerprint.txt"
    fingerprint = (
        fingerprint_file.read_text(encoding="utf-8").strip()
        if fingerprint_file.exists()
        else ""
    )

    if fingerprint:
        add_url = f"{repo_url}?fingerprint={fingerprint}"
        fingerprint_display = " ".join(
            fingerprint[index : index + 2].upper()
            for index in range(0, len(fingerprint), 2)
        )
    else:
        add_url = repo_url
        fingerprint_display = "unavailable"

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        TEMPLATE.format(
            add_url=html.escape(add_url, quote=True),
            repo_url=html.escape(repo_url),
            fingerprint_display=html.escape(fingerprint_display),
        ),
        encoding="utf-8",
    )
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
