#!/usr/bin/env python3
"""Assemble one immutable MiniSV release containing site, app worker and ops."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import tarfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


RELEASE_ID = re.compile(r"^[A-Za-z0-9._-]+$")
MAIN_SHA = re.compile(r"^(?:uncommitted|[0-9a-f]{40})$")
APP_REQUIRED = (
    "server/index.js",
    "server/wrangler.json",
    "server/BUILD_ID",
    "client/vinext-client-entry-manifest.json",
)
OPS_ENTRIES = (
    "compose.yml",
    "gateway",
    "cloudflared",
    "launchd",
    "scripts",
    "docs",
    "package_release.py",
    "package_bundle.py",
)
SECRET_FILENAMES = {".env", ".dev.vars", "accounts.json", "classroom.env", "tunnel-credentials.json"}


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def checked_files(root: Path):
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"release input contains a symlink: {path}")
        if path.is_file():
            yield path


def tree_digest(root: Path) -> tuple[str, int, int]:
    digest = hashlib.sha256()
    count = 0
    total = 0
    for path in checked_files(root):
        relative = path.relative_to(root).as_posix().encode()
        content = path.read_bytes()
        digest.update(len(relative).to_bytes(8, "big"))
        digest.update(relative)
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
        count += 1
        total += len(content)
    return digest.hexdigest(), count, total


def verify_manifest(root: Path, manifest_name: str = "MANIFEST.sha256") -> None:
    manifest = root / manifest_name
    if not manifest.is_file():
        raise ValueError(f"missing {manifest_name} in {root}")
    expected: set[str] = set()
    for number, line in enumerate(manifest.read_text(encoding="utf-8").splitlines(), 1):
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        if not match:
            raise ValueError(f"invalid manifest line {number}")
        digest, relative = match.groups()
        pure = PurePosixPath(relative)
        if pure.is_absolute() or ".." in pure.parts or relative in expected:
            raise ValueError(f"unsafe or duplicate manifest path: {relative}")
        path = root.joinpath(*pure.parts)
        if not path.is_file() or path.is_symlink() or file_digest(path) != digest:
            raise ValueError(f"manifest mismatch: {relative}")
        expected.add(relative)
    actual = {
        path.relative_to(root).as_posix()
        for path in checked_files(root)
        if path != manifest
    }
    if expected != actual:
        missing = sorted(actual - expected)
        stale = sorted(expected - actual)
        raise ValueError(f"manifest inventory mismatch: missing={missing[:5]} stale={stale[:5]}")


def validate_app_dist(app_dist: Path) -> dict:
    if not app_dist.is_dir():
        raise ValueError(f"app dist is missing: {app_dist}")
    for relative in APP_REQUIRED:
        if not (app_dist / relative).is_file():
            raise ValueError(f"app dist is incomplete: {relative}")
    for path in checked_files(app_dist):
        if path.name in SECRET_FILENAMES or path.suffix.lower() in {".sqlite", ".sqlite3"}:
            raise ValueError(f"app dist contains forbidden runtime data or secret: {path.name}")
    config = json.loads((app_dist / "server" / "wrangler.json").read_text(encoding="utf-8"))
    if config.get("main") != "index.js" or config.get("assets", {}).get("directory") != "../client":
        raise ValueError("app wrangler config does not bind the packaged client tree")
    bindings = config.get("d1_databases", [])
    if not any(item.get("binding") == "DB" for item in bindings if isinstance(item, dict)):
        raise ValueError("app wrangler config is missing D1 binding DB")
    variables = config.get("vars", {})
    if variables.get("MSV_SELF_HOSTED_AUTH") != "app-session" or variables.get("MSV_APP_BASE_PATH") != "/":
        raise ValueError("app worker was not built for native minisv.vip session auth")
    digest, files, size = tree_digest(app_dist)
    return {"sha256": digest, "files": files, "bytes": size, "buildId": (app_dist / "server" / "BUILD_ID").read_text().strip()}


def write_manifest(root: Path) -> None:
    lines = []
    for path in checked_files(root):
        if path.parent == root and path.name == "MANIFEST.sha256":
            continue
        lines.append(f"{file_digest(path)}  {path.relative_to(root).as_posix()}")
    (root / "MANIFEST.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_bundle(
    site: Path,
    app_dist: Path,
    ops_root: Path,
    output: Path,
    release_id: str,
    *,
    main_sha: str = "uncommitted",
) -> Path:
    if not RELEASE_ID.fullmatch(release_id):
        raise ValueError("invalid release id")
    if not MAIN_SHA.fullmatch(main_sha):
        raise ValueError("invalid main SHA")
    if output.exists():
        raise ValueError(f"refusing to overwrite release output: {output}")
    verify_manifest(site)
    app = validate_app_dist(app_dist)
    required_ops = [entry for entry in OPS_ENTRIES if not (ops_root / entry).exists()]
    if required_ops:
        raise ValueError(f"ops tree is incomplete: {', '.join(required_ops)}")

    output.mkdir(parents=True)
    try:
        shutil.copytree(site, output / "site", copy_function=shutil.copy2)
        shutil.copytree(app_dist, output / "app" / "dist", copy_function=shutil.copy2)
        ops_target = output / "ops"
        ops_target.mkdir()
        for relative in OPS_ENTRIES:
            source = ops_root / relative
            target = ops_target / relative
            if source.is_dir():
                shutil.copytree(source, target, copy_function=shutil.copy2, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
            else:
                shutil.copy2(source, target)
        for path in checked_files(output):
            if path.name in SECRET_FILENAMES:
                raise ValueError(f"release bundle contains a secret filename: {path.relative_to(output)}")
        site_summary = tree_digest(output / "site")
        (output / "bundle.json").write_text(json.dumps({
            "schemaVersion": 1,
            "service": "minisv",
            "release": release_id,
            "mainSha": main_sha,
            "builtAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "units": {
                "site": {"sha256": site_summary[0], "files": site_summary[1], "bytes": site_summary[2]},
                "app": app,
                "data": {"packaged": False, "location": "~/Services/msv-classroom/data"},
            },
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        write_manifest(output)
        verify_manifest(output)
    except Exception:
        shutil.rmtree(output, ignore_errors=True)
        raise
    return output


def archive_bundle(bundle: Path, archive: Path) -> None:
    if archive.exists():
        raise ValueError(f"refusing to overwrite archive: {archive}")
    verify_manifest(bundle)
    archive.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, "w:gz", format=tarfile.PAX_FORMAT) as result:
        for path in [bundle, *sorted(bundle.rglob("*"))]:
            arcname = "." if path == bundle else path.relative_to(bundle).as_posix()
            info = result.gettarinfo(str(path), arcname=arcname)
            info.uid = info.gid = 0
            info.uname = info.gname = "root"
            if path.is_file():
                with path.open("rb") as source:
                    result.addfile(info, source)
            else:
                result.addfile(info)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-root", required=True, type=Path)
    parser.add_argument("--app-dist-root", required=True, type=Path)
    parser.add_argument("--ops-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--main-sha", default="uncommitted")
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    build_bundle(args.site_root, args.app_dist_root, args.ops_root, args.output, args.release_id, main_sha=args.main_sha)
    if args.archive:
        archive_bundle(args.output, args.archive)
    print(f"MINISV_BUNDLE_READY {args.release_id} {args.output}{f' archive={args.archive}' if args.archive else ''}")


if __name__ == "__main__":
    main()
