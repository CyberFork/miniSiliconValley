#!/usr/bin/env python3
"""Build a self-contained minisv.vip static release from verified Hecate artifacts."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

TEXT_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json", ".svg", ".md", ".txt", ".webmanifest"}
REQUIRED_PAGES = ("index.html", "world/index.html", "framework/index.html", "parents/index.html", "workshop/index.html")
FORBIDDEN = ("work.cyberforker.com", "192.168.", "127.0.0.1:18765", "/msv/", r"\/msv\/")


def copy_entry(source: Path, target: Path) -> None:
    if source.is_dir():
        shutil.copytree(source, target, dirs_exist_ok=True, copy_function=shutil.copy2)
    elif source.is_file():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    else:
        raise FileNotFoundError(source)


def rewrite_text(text: str) -> str:
    # Preserve human-facing semantic routes before removing the retired base path.
    replacements = (
        ("https://work.cyberforker.com/msv/demo/app/123456", "https://minisv.vip/framework/"),
        ("https://work.cyberforker.com/msv/demo/app/qa", "https://minisv.vip/parents/"),
        ("https://work.cyberforker.com/msv/demo/app", "https://minisv.vip"),
        ("https://work.cyberforker.com/msv/123456.html", "https://minisv.vip/framework/"),
        ("https://work.cyberforker.com/msv/demo.html", "https://minisv.vip/world/"),
        ("https://work.cyberforker.com/msv/qa.html", "https://minisv.vip/parents/"),
        ("https://work.cyberforker.com/msv", "https://minisv.vip"),
        ("https:\\/\\/work.cyberforker.com\\/msv\\/demo\\/app", "https:\\/\\/minisv.vip"),
        ("https:\\/\\/work.cyberforker.com\\/msv", "https:\\/\\/minisv.vip"),
        ("/msv/demo/app/123456", "/framework/"),
        ("/msv/demo/app/qa", "/parents/"),
        ("/msv/demo/app/classroom", "/classroom"),
        ("/msv/123456.html", "/framework/"),
        ("/msv/demo.html", "/world/"),
        ("/msv/qa.html", "/parents/"),
        ("/msv/launch.html", "/workshop/"),
        ("/msv/api/qa", "/api/qa"),
        ("/msv/alpha/", "/alpha/"),
        (r"\/msv\/demo\/app", ""),
        ("/msv/demo/app", ""),
        (r"\/msv\/", r"\/"),
        ("/msv/", "/"),
    )
    for old, new in replacements:
        text = text.replace(old, new)
    return text.replace("https://work.cyberforker.com", "https://minisv.vip").replace("work.cyberforker.com", "minisv.vip")


def transform_tree(root: Path) -> None:
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            original = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        changed = rewrite_text(original)
        if changed != original:
            path.write_text(changed, encoding="utf-8")


def build(legacy: Path, app_client: Path, portal: Path, output: Path, release_id: str) -> None:
    for source in (legacy, app_client, portal):
        if not source.is_dir():
            raise ValueError(f"required directory is missing: {source}")
    if output.exists():
        raise ValueError(f"refusing to overwrite release output: {output}")
    output.mkdir(parents=True)

    # Shared immutable client files. Dynamic and static builds use content hashes,
    # so their _next trees can be merged without route ambiguity.
    for name in ("_next", "assets", "favicon.svg", "og.png"):
        if (legacy / name).exists(): copy_entry(legacy / name, output / name)
    for name in ("_next", "assets", "favicon.svg", "og.png", "vinext-client-entry-manifest.json"):
        if (app_client / name).exists(): copy_entry(app_client / name, output / name)

    page_map = {
        "demo.html": "world/index.html",
        "123456.html": "framework/index.html",
        "qa.html": "parents/index.html",
    }
    for source_name, target_name in page_map.items():
        copy_entry(legacy / source_name, output / target_name)

    # Workshop remains a coherent relative-path bundle under /workshop/.
    workshop = output / "workshop"
    workshop.mkdir()
    for source_name, target_name in (
        ("launch.html", "index.html"), ("app.js", "app.js"), ("styles.css", "styles.css"),
        ("public-deploy.js", "public-deploy.js"), ("manifest.json", "manifest.json"),
    ):
        copy_entry(legacy / source_name, workshop / target_name)
    if (legacy / "assets").exists(): copy_entry(legacy / "assets", workshop / "assets")

    for item in portal.iterdir(): copy_entry(item, output / item.name)
    transform_tree(output)

    (output / "release.json").write_text(json.dumps({
        "service": "minisv", "release": release_id,
        "builtAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "origin": "hecate", "canonicalOrigin": "https://minisv.vip",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "sitemap.json").write_text(json.dumps({"routes": [
        "/", "/world/", "/classroom/", "/alpha/", "/control/", "/framework/", "/parents/", "/workshop/",
    ]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    errors = []
    for relative in REQUIRED_PAGES:
        if not (output / relative).is_file(): errors.append(f"missing {relative}")
    for path in sorted(output.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES: continue
        try: text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError: continue
        for needle in FORBIDDEN:
            if needle in text: errors.append(f"forbidden {needle!r} in {path.relative_to(output)}")
    if errors:
        raise ValueError("release validation failed:\n- " + "\n- ".join(errors[:100]))

    manifest = []
    for path in sorted(output.rglob("*")):
        if path.is_file() and path.name != "MANIFEST.sha256":
            manifest.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(output).as_posix()}")
    (output / "MANIFEST.sha256").write_text("\n".join(manifest) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--legacy-root", required=True, type=Path)
    parser.add_argument("--app-client-root", required=True, type=Path)
    parser.add_argument("--portal-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--release-id", required=True)
    args = parser.parse_args()
    build(*(getattr(args, name) for name in ("legacy_root", "app_client_root", "portal_root", "output", "release_id")))
    print(f"MINISV_RELEASE_READY {args.release_id} {args.output}")


if __name__ == "__main__":
    main()
