#!/usr/bin/env python3
"""Build a self-contained minisv.vip static release from verified Hecate artifacts."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

TEXT_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json", ".svg", ".md", ".txt", ".webmanifest"}
REQUIRED_PAGES = ("index.html", "world/index.html", "course/index.html", "framework/index.html", "parents/index.html", "workshop/index.html")
PUBLIC_COURSE_NAV_PAGES = ("index.html", "world/index.html", "course/index.html")
FORBIDDEN = ("work.cyberforker.com", "192.168.", "127.0.0.1:18765", "/msv/", r"\/msv\/")
THEME_VERSION = "20260906-9"
THEME_ASSETS = f'<link rel="stylesheet" href="/ui-theme.css?v={THEME_VERSION}"><script src="/ui-theme.js?v={THEME_VERSION}"></script>'
CHJ_COURSE_UI_SHA = "679213a61b835335016eac7649213983a0e48489"


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


def inject_theme_assets(text: str) -> str:
    if "/ui-theme.js" in text:
        text = re.sub(r"/ui-theme\.css(?:\?v=[A-Za-z0-9._-]+)?", f"/ui-theme.css?v={THEME_VERSION}", text)
        text = re.sub(r"/ui-theme\.js(?:\?v=[A-Za-z0-9._-]+)?", f"/ui-theme.js?v={THEME_VERSION}", text)
        return text
    if "</head>" not in text:
        return text
    return text.replace("</head>", f"{THEME_ASSETS}</head>", 1)


def transform_tree(root: Path) -> None:
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            original = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        changed = rewrite_text(original)
        if path.suffix.lower() == ".html":
            changed = inject_theme_assets(changed)
        if changed != original:
            path.write_text(changed, encoding="utf-8")


def build(
    legacy: Path,
    app_client: Path,
    app_static: Path,
    portal: Path,
    output: Path,
    release_id: str,
    *,
    main_sha: str = "uncommitted",
    chj_sha: str = CHJ_COURSE_UI_SHA,
) -> None:
    for source in (legacy, app_client, app_static, portal):
        if not source.is_dir():
            raise ValueError(f"required directory is missing: {source}")
    for label, value in (("main SHA", main_sha), ("chj SHA", chj_sha)):
        if value != "uncommitted" and not re.fullmatch(r"[0-9a-f]{40}", value):
            raise ValueError(f"invalid {label}: {value}")
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

    # Current source owns the public world shell and the stable course route.
    # These two HTML files share the app_client asset tree copied above.
    for route in ("world", "course"):
        copy_entry(app_static / route / "index.html", output / route / "index.html")

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
        "features": ["stable-course-outline", "released-course-package-projection", "five-step-course-map"],
        "sources": {"main": main_sha, "chjCourseUi": chj_sha},
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "sitemap.json").write_text(json.dumps({"routes": [
        "/", "/world/", "/course/", "/classroom/", "/alpha/", "/control/", "/framework/", "/parents/", "/workshop/",
    ]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    errors = []
    for relative in REQUIRED_PAGES:
        if not (output / relative).is_file(): errors.append(f"missing {relative}")
    for relative in PUBLIC_COURSE_NAV_PAGES:
        page = output / relative
        if page.is_file() and not re.search(r'href=["\']/course/', page.read_text(encoding="utf-8")):
            errors.append(f"missing stable course navigation in {relative}")
    theme_script = output / "ui-theme.js"
    if theme_script.is_file():
        script_text = theme_script.read_text(encoding="utf-8")
        for route in ("/framework/", "/parents/"):
            if route not in script_text or 'href = "/course/"' not in script_text:
                errors.append(f"missing runtime course navigation for {route}")
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
    parser.add_argument("--app-static-root", required=True, type=Path)
    parser.add_argument("--portal-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--main-sha", default="uncommitted")
    parser.add_argument("--chj-sha", default=CHJ_COURSE_UI_SHA)
    args = parser.parse_args()
    build(
        *(getattr(args, name) for name in ("legacy_root", "app_client_root", "app_static_root", "portal_root", "output", "release_id")),
        main_sha=args.main_sha,
        chj_sha=args.chj_sha,
    )
    print(f"MINISV_RELEASE_READY {args.release_id} {args.output}")


if __name__ == "__main__":
    main()
