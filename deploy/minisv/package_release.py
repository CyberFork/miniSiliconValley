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
DEVELOPMENT_COURSEWARE = Path("courseware/development-mentor-ligun")
MARKET_COURSEWARE = Path("courseware/market-mentor-user-system")
REQUIRED_PAGES = (
    "index.html", "404.html", "world/index.html", "framework/index.html",
    "parents/index.html", "workshop/index.html",
    "courseware/product-mentor-foundations/index.html",
    "courseware/development-mentor-ligun/index.html",
    "courseware/market-mentor-user-system/index.html",
)
PUBLIC_COURSE_NAV_PAGES = ("index.html", "world/index.html")
FORBIDDEN = ("work.cyberforker.com", "192.168.", "127.0.0.1:18765", "/msv/", r"\/msv\/")
THEME_VERSION = "20260908-10"
THEME_ASSETS = f'<link rel="stylesheet" href="/ui-theme.css?v={THEME_VERSION}"><script src="/ui-theme.js?v={THEME_VERSION}"></script>'
CHJ_COURSE_UI_SHA = "679213a61b835335016eac7649213983a0e48489"
CHJ_COURSE_UI_TREE = "3a041c4714190cc026f6de8e06e15cec0e5f765d"
WORKSHOP_OVERLAY = Path(__file__).resolve().parent / "workshop"
MAX_WORKSHOP_SNAPSHOT_BYTES = 1024 * 1024


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
    # Adventure is the sole product UI. Mark static documents before paint;
    # the shared runtime only classifies light/dark surface semantics.
    if re.search(r'<html\b[^>]*\bdata-msv-theme=', text, flags=re.IGNORECASE):
        text = re.sub(
            r'\bdata-msv-theme=(["\']).*?\1',
            'data-msv-theme="adventure"',
            text,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        text = re.sub(r'<html\b', '<html data-msv-theme="adventure"', text, count=1, flags=re.IGNORECASE)

    # Older releases declared empty header slots for the retired comparison
    # control. They must not survive when a historical static shell is reused.
    text = re.sub(r'<div\s+data-msv-theme-slot\s*>\s*</div>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s+data-msv-theme-slot(?:=(["\']).*?\1)?', '', text, flags=re.IGNORECASE)
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


def normalize_framework_brand(page: Path) -> None:
    """Upgrade only the owned framework shell; never touch opaque courseware."""
    if not page.is_file():
        return
    text = page.read_text(encoding="utf-8")
    if "COURSE SYSTEM" not in text:
        return
    text = text.replace(
        'href="#top" aria-label="返回页面顶部"',
        'href="/" aria-label="返回 Mini Silicon Valley 主页"',
        1,
    )
    text = text.replace(
        '<b>MSV</b><span>COURSE SYSTEM',
        '<img src="/favicon.svg" alt="" width="44" height="44" style="width:44px;height:44px;object-fit:contain;flex:0 0 44px"><span>COURSE SYSTEM',
        1,
    )
    page.write_text(text, encoding="utf-8")


def canonical_digest(value: object) -> str:
    body = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(body).hexdigest()


def validate_manifested_courseware(root: Path, *, label: str, slide_count: int) -> dict:
    """Verify a repo-owned static deck against its immutable content manifest."""
    manifest_path = root / "SOURCE-MANIFEST.json"
    if not manifest_path.is_file():
        raise ValueError(f"{label} courseware manifest is missing")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"{label} courseware manifest is invalid") from exc
    if manifest.get("slideCount") != slide_count or not isinstance(manifest.get("files"), list):
        raise ValueError(f"{label} courseware manifest has an invalid slide/file contract")
    canonical = []
    seen = set()
    for item in manifest["files"]:
        if not isinstance(item, dict):
            raise ValueError(f"{label} courseware manifest file record is invalid")
        relative = Path(str(item.get("path", "")))
        if relative.is_absolute() or ".." in relative.parts or relative.as_posix() in seen:
            raise ValueError(f"{label} courseware manifest contains an unsafe or duplicate path")
        seen.add(relative.as_posix())
        path = root / relative
        if not path.is_file():
            raise ValueError(f"{label} courseware file is missing: {relative.as_posix()}")
        content = path.read_bytes()
        digest = hashlib.sha256(content).hexdigest()
        if item.get("bytes") != len(content) or item.get("sha256") != digest:
            raise ValueError(f"{label} courseware digest mismatch: {relative.as_posix()}")
        canonical.append(f"{relative.as_posix()}\0{digest}\n")
    if "index.html" not in seen:
        raise ValueError(f"{label} courseware index is missing from its manifest")
    tree = hashlib.sha256("".join(canonical).encode("utf-8")).hexdigest()
    if manifest.get("contentTreeSha256") != tree:
        raise ValueError(f"{label} courseware content tree digest mismatch")
    return {"sha256": tree, "files": len(seen), "bytes": sum(int(item["bytes"]) for item in manifest["files"])}


def validate_development_courseware(root: Path) -> dict:
    return validate_manifested_courseware(root, label="D-mentor", slide_count=18)


def validate_market_courseware(root: Path) -> dict:
    return validate_manifested_courseware(root, label="M-mentor", slide_count=49)


def validate_workshop_snapshot(path: Path) -> dict:
    if not path.is_file() or path.stat().st_size > MAX_WORKSHOP_SNAPSHOT_BYTES:
        raise ValueError("Workshop snapshot is missing or exceeds 1 MiB")
    try:
        snapshot = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Workshop snapshot is not valid UTF-8 JSON") from exc
    if not isinstance(snapshot, dict) or snapshot.get("snapshotVersion") != 1 or snapshot.get("scope") != "public-redacted-summary":
        raise ValueError("Workshop snapshot is not a public-redacted v1 projection")
    source, courses = snapshot.get("source"), snapshot.get("courses")
    if not isinstance(source, dict) or source.get("registry") != "course-registry" or source.get("channel") != "released":
        raise ValueError("Workshop snapshot does not originate from Released")
    if not isinstance(courses, list) or not courses or source.get("courseCount") != len(courses):
        raise ValueError("Workshop snapshot course count is incomplete")
    refs = []
    for course in courses:
        if not isinstance(course, dict) or course.get("status") != "released" or not re.fullmatch(r"[0-9a-f]{64}", str(course.get("digest", ""))):
            raise ValueError("Workshop snapshot contains a non-Released course ref")
        if not isinstance(course.get("revision"), int) or course["revision"] < 0:
            raise ValueError("Workshop snapshot revision is invalid")
        if [item.get("id") for item in course.get("macroSteps", [])] != ["find", "decide", "build", "market", "operate"]:
            raise ValueError("Workshop snapshot does not use the confirmed five steps")
        if len(course.get("blocks", [])) != 13 or [item.get("order") for item in course["blocks"]] != list(range(1, 14)):
            raise ValueError("Workshop snapshot does not contain 13 ordered Blocks")
        decks = course.get("deckSummary", [])
        if len(decks) != 5 or any(item.get("cardCount", 0) < 12 for item in decks):
            raise ValueError("Workshop snapshot card decks are incomplete")
        refs.append({key: course[key] for key in ("courseId", "schemaVersion", "revision", "digest", "status")})
    if source.get("aggregateDigest") != canonical_digest(refs):
        raise ValueError("Workshop snapshot aggregate digest is invalid")
    integrity = snapshot.get("integrity")
    unsigned = {key: value for key, value in snapshot.items() if key != "integrity"}
    if not isinstance(integrity, dict) or integrity.get("algorithm") != "sha256" or integrity.get("digest") != canonical_digest(unsigned):
        raise ValueError("Workshop snapshot integrity digest is invalid")
    serialized = json.dumps(snapshot, ensure_ascii=False)
    for forbidden in ('"mentorScript"', '"seatTasks"', '"privateConcern"', '"walletTenths"', '"teamTreasuryTenths"', '"lease":'):
        if forbidden in serialized:
            raise ValueError(f"Workshop snapshot leaks private field {forbidden}")
    return snapshot


def apply_workshop_overlay(workshop: Path, snapshot_source: Path | None = None) -> None:
    """Add the versioned Released-baseline projection without forking Workshop state."""
    required = (
        "baseline-panel.html", "baseline.css", "baseline.js",
        "confirmed-baseline.json", "workshop-snapshot.schema.json",
    )
    source_snapshot = snapshot_source or (WORKSHOP_OVERLAY / "confirmed-baseline.json")
    missing = [name for name in required if not ((source_snapshot if name == "confirmed-baseline.json" else WORKSHOP_OVERLAY / name)).is_file()]
    if missing:
        raise ValueError(f"Workshop overlay is incomplete: {', '.join(missing)}")
    validate_workshop_snapshot(source_snapshot)
    page = workshop / "index.html"
    text = page.read_text(encoding="utf-8")
    if "msv-workshop-released-baseline" in text:
        raise ValueError("Workshop baseline overlay was applied twice")

    # The public Snapshot is same-origin and redacted; all other network and
    # embedding restrictions remain unchanged.
    text = text.replace("connect-src 'none'", "connect-src 'self'", 1)
    text = text.replace("img-src data:", "img-src 'self' data:", 1)
    if 'rel="icon"' not in text:
        text = text.replace("</title>", '</title>\n  <link rel="icon" href="/favicon.svg">', 1)

    old_brand = re.compile(
        r'<div class="brand-lockup"[^>]*>\s*<span class="brand-mark"[^>]*>MSV</span>\s*<span>(.*?)</span>\s*</div>\s*<div class="session-health">',
        re.DOTALL,
    )
    replacement = (
        '<a class="brand-lockup msv-static-brand" href="/" aria-label="返回 Mini Silicon Valley 主页">'
        '<img src="/favicon.svg" alt="" width="64" height="64"><span>\\1</span></a>'
        '\n    <div class="session-health">'
    )
    text, brand_count = old_brand.subn(replacement, text, count=1)
    if brand_count != 1:
        raise ValueError("Workshop brand shell was not recognized")

    nav_marker = '<button class="nav-item" type="button" data-section="decisions">'
    nav_item = '<button class="nav-item" type="button" data-section="baseline"><span>01A</span>已确认基线 <b id="baselineNavBadge">R</b></button>\n        '
    if nav_marker not in text:
        raise ValueError("Workshop navigation marker is missing")
    text = text.replace(nav_marker, nav_item + nav_marker, 1)

    panel = (WORKSHOP_OVERLAY / "baseline-panel.html").read_text(encoding="utf-8")
    main_end = "</main>"
    if main_end not in text:
        raise ValueError("Workshop workspace closing marker is missing")
    text = text.replace(main_end, f"      <!-- msv-workshop-released-baseline -->\n      {panel}\n    {main_end}", 1)
    text = text.replace("</head>", '  <link rel="stylesheet" href="baseline.css">\n</head>', 1)
    text = text.replace("</body>", '  <script src="baseline.js"></script>\n</body>', 1)
    page.write_text(text, encoding="utf-8")

    for name in required[1:]:
        copy_entry(source_snapshot if name == "confirmed-baseline.json" else WORKSHOP_OVERLAY / name, workshop / name)

    verified = page.read_text(encoding="utf-8")
    for marker in (
        "msv-workshop-released-baseline", 'href="/" aria-label="返回 Mini Silicon Valley 主页"',
        'src="/favicon.svg"', 'data-panel="baseline"', 'src="baseline.js"', 'href="baseline.css"',
    ):
        if marker not in verified:
            raise ValueError(f"Workshop overlay is missing marker {marker!r}")


def tree_digest(root: Path) -> tuple[str, int, int]:
    """Hash a directory without changing a byte in it."""
    digest = hashlib.sha256()
    files = 0
    total_bytes = 0
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        relative = path.relative_to(root).as_posix().encode("utf-8")
        content = path.read_bytes()
        digest.update(len(relative).to_bytes(8, "big"))
        digest.update(relative)
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
        files += 1
        total_bytes += len(content)
    return digest.hexdigest(), files, total_bytes


def build(
    legacy: Path,
    app_client: Path,
    app_static: Path,
    course_static: Path,
    portal: Path,
    output: Path,
    release_id: str,
    *,
    main_sha: str = "uncommitted",
    chj_sha: str = CHJ_COURSE_UI_SHA,
    chj_tree: str = CHJ_COURSE_UI_TREE,
    workshop_snapshot: Path | None = None,
) -> None:
    for source in (legacy, app_client, app_static, course_static, portal):
        if not source.is_dir():
            raise ValueError(f"required directory is missing: {source}")
    for label, value in (("main SHA", main_sha), ("chj SHA", chj_sha), ("chj tree", chj_tree)):
        if value != "uncommitted" and not re.fullmatch(r"[0-9a-f]{40}", value):
            raise ValueError(f"invalid {label}: {value}")
    development_courseware_source = app_client / DEVELOPMENT_COURSEWARE
    development_courseware = validate_development_courseware(development_courseware_source)
    market_courseware_source = app_client / MARKET_COURSEWARE
    market_courseware = validate_market_courseware(market_courseware_source)
    course_source_digest, course_source_files, course_source_bytes = tree_digest(course_static)
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

    # Current main owns the public world shell. /course/ is served dynamically
    # by the authenticated app; the colleague artifact is copied separately.
    copy_entry(app_static / "world" / "index.html", output / "world" / "index.html")
    # Parent Q&A must be rendered from the same current application build as
    # the authentication and classroom surfaces. Reusing legacy qa.html here
    # silently dropped the shared brand/home component from new releases.
    copy_entry(app_static / "parents" / "index.html", output / "parents" / "index.html")

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
    normalize_framework_brand(output / "framework" / "index.html")
    apply_workshop_overlay(output / "workshop", workshop_snapshot)

    # Never pass the colleague-owned build through rewrite_text() or the shared
    # theme injector. It is an independently built, immutable P-mentor
    # CoursewarePackage, not the entire course truth or /course/ library.
    courseware_output = output / "courseware" / "product-mentor-foundations"
    copy_entry(course_static, courseware_output)
    course_output_digest, course_output_files, course_output_bytes = tree_digest(courseware_output)
    if (course_output_digest, course_output_files, course_output_bytes) != (
        course_source_digest, course_source_files, course_source_bytes
    ):
        raise ValueError("opaque chj course copy changed during release assembly")

    # D is repo-owned rather than colleague-owned, but its r0 still uses an
    # exact byte manifest. Copy it after transform_tree() so the release
    # assembler cannot silently inject global theme/runtime code into the deck.
    development_courseware_output = output / DEVELOPMENT_COURSEWARE
    copy_entry(development_courseware_source, development_courseware_output)
    if validate_development_courseware(development_courseware_output) != development_courseware:
        raise ValueError("D-mentor courseware changed during release assembly")

    # M is another exact, repo-owned static deck. Keep it outside the release
    # text/theme transformer for the same reason as D: a released revision is
    # immutable classroom material, not an application shell.
    market_courseware_output = output / MARKET_COURSEWARE
    copy_entry(market_courseware_source, market_courseware_output)
    if validate_market_courseware(market_courseware_output) != market_courseware:
        raise ValueError("M-mentor courseware changed during release assembly")

    (output / "release.json").write_text(json.dumps({
        "service": "minisv", "release": release_id,
        "builtAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "origin": "hecate", "canonicalOrigin": "https://minisv.vip",
        "features": [
            "unified-course-factory",
            "dynamic-courseware-library",
            "verbatim-product-mentor-courseware",
            "exact-development-mentor-courseware",
            "exact-market-mentor-courseware",
            "opaque-courseware-bundle",
            "course-studio",
            "per-classroom-controller",
            "shared-brand-home",
            "released-workshop-snapshot",
        ],
        "sources": {
            "main": main_sha,
            "chjCourseUi": chj_sha,
            "chjCourseTree": chj_tree,
        },
        "coursewareArtifact": {
            "route": "/courseware/product-mentor-foundations/",
            "mentorRole": "P",
            "sha256": course_source_digest,
            "files": course_source_files,
            "bytes": course_source_bytes,
            "transformed": False,
        },
        "developmentCoursewareArtifact": {
            "route": "/courseware/development-mentor-ligun/",
            "mentorRole": "D",
            **development_courseware,
            "transformed": False,
        },
        "marketCoursewareArtifact": {
            "route": "/courseware/market-mentor-user-system/",
            "mentorRole": "M",
            **market_courseware,
            "transformed": False,
        },
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "sitemap.json").write_text(json.dumps({"routes": [
        "/", "/world/", "/studio/", "/studio/editor/", "/studio/preview/", "/studio/courseware/", "/studio/releases/",
        "/course/", "/courseware/product-mentor-foundations/", "/courseware/development-mentor-ligun/",
        "/courseware/market-mentor-user-system/",
        "/classroom/", "/framework/", "/parents/", "/workshop/",
    ]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    errors = []
    for relative in REQUIRED_PAGES:
        if not (output / relative).is_file(): errors.append(f"missing {relative}")
    for relative in PUBLIC_COURSE_NAV_PAGES:
        page = output / relative
        if page.is_file() and not re.search(r'href=["\']/course/', page.read_text(encoding="utf-8")):
            errors.append(f"missing stable course navigation in {relative}")
    course_page = output / "courseware" / "product-mentor-foundations" / "index.html"
    if course_page.is_file():
        course_text = course_page.read_text(encoding="utf-8")
        for marker in ("青少年AI创业营", "MINI硅谷"):
            if marker not in course_text:
                errors.append(f"opaque P-mentor courseware is missing marker {marker!r}")
        if "/ui-theme.js" in course_text or "data-course-outline-schema" in course_text:
            errors.append("opaque P-mentor courseware was replaced or decorated by the main application")
    framework_page = output / "framework" / "index.html"
    if framework_page.is_file() and "COURSE SYSTEM" in framework_page.read_text(encoding="utf-8"):
        framework_text = framework_page.read_text(encoding="utf-8")
        if 'href="/" aria-label="返回 Mini Silicon Valley 主页"' not in framework_text or 'src="/favicon.svg"' not in framework_text:
            errors.append("framework is missing the shared brand/home contract")
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
    parser.add_argument("--course-static-root", required=True, type=Path)
    parser.add_argument("--portal-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--main-sha", default="uncommitted")
    parser.add_argument("--chj-sha", default=CHJ_COURSE_UI_SHA)
    parser.add_argument("--chj-tree", default=CHJ_COURSE_UI_TREE)
    parser.add_argument("--workshop-snapshot", type=Path, help="validated public-redacted snapshot exported from the current Hecate Released registry")
    args = parser.parse_args()
    build(
        *(getattr(args, name) for name in ("legacy_root", "app_client_root", "app_static_root", "course_static_root", "portal_root", "output", "release_id")),
        main_sha=args.main_sha,
        chj_sha=args.chj_sha,
        chj_tree=args.chj_tree,
        workshop_snapshot=args.workshop_snapshot,
    )
    print(f"MINISV_RELEASE_READY {args.release_id} {args.output}")


if __name__ == "__main__":
    main()
