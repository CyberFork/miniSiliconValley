#!/usr/bin/env python3
"""Atomically point a MiniSV installation at a verified release directory."""
from __future__ import annotations

import argparse
import os
import re
from pathlib import Path


RELEASE_ID = re.compile(r"^[A-Za-z0-9._-]+$")


def switch_current(root: Path, release_id: str) -> None:
    if not RELEASE_ID.fullmatch(release_id):
        raise ValueError("invalid release id")
    root = root.resolve()
    target = root / "releases" / release_id
    required = (
        target / "MANIFEST.sha256",
        target / "site" / "MANIFEST.sha256",
        target / "app" / "dist" / "server" / "index.js",
        target / "app" / "dist" / "server" / "wrangler.json",
        target / "app" / "dist" / "client" / "vinext-client-entry-manifest.json",
    )
    if not target.is_dir() or any(not path.is_file() for path in required):
        raise ValueError(f"release is incomplete: {release_id}")

    temporary = root / f".current-{release_id}-{os.getpid()}"
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(f"releases/{release_id}")
    try:
        # Replace the link itself. `mv new-link current` can follow an existing
        # directory symlink on macOS and move new-link into the old release.
        os.replace(temporary, root / "current")
    finally:
        temporary.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("release_id")
    args = parser.parse_args()
    switch_current(args.root, args.release_id)


if __name__ == "__main__":
    main()
