#!/usr/bin/env python3
"""Read-only exact-reference preflight for the MiniSV course registry."""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from urllib.parse import quote


REFERENCE_TABLES = (
    ("course_candidate_pointers", "course_id", "revision", "digest"),
    ("course_release_pointers", "course_id", "revision", "digest"),
    ("room_course_bindings", "course_id", "revision", "digest"),
    ("alpha_run_rooms", "course_id", "revision", "digest"),
    ("course_registry_events", "course_id", "revision", "digest"),
    ("course_test_receipts", "course_id", "revision", "digest"),
    ("classroom_instances", "course_id", "course_revision", "course_digest"),
    ("course_view_acceptance_receipts", "course_id", "revision", "digest"),
    ("course_ui_acceptance_receipts", "course_id", "revision", "digest"),
)


def readonly_connection(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(f"file:{quote(str(path.resolve()))}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only = ON")
    return connection


def has_registry(path: Path) -> bool:
    # A corrupt or unreadable SQLite-looking file is not the same thing as a
    # healthy first deployment.  Let the error propagate so deployment fails
    # closed instead of silently treating damaged runtime data as empty.
    with readonly_connection(path) as db:
        return db.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='course_versions'"
        ).fetchone() is not None


def discover_database(input_path: Path) -> Path | None:
    if input_path.is_file():
        return input_path if has_registry(input_path) else None
    if not input_path.exists():
        return None
    candidates = []
    for pattern in ("*.sqlite", "*.sqlite3", "*.db"):
        candidates.extend(path for path in input_path.rglob(pattern) if path.is_file())
    matches = sorted({path.resolve() for path in candidates if has_registry(path)})
    if len(matches) > 1:
        raise RuntimeError(f"found more than one course registry database under {input_path}: {matches}")
    return matches[0] if matches else None


def inspect(path: Path) -> dict:
    findings = []
    with readonly_connection(path) as db:
        table_names = {
            row["name"]
            for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        for table, course_column, revision_column, digest_column in REFERENCE_TABLES:
            if table not in table_names:
                continue
            sql = f"""
                SELECT r.{course_column} AS course_id,
                       r.{revision_column} AS revision,
                       r.{digest_column} AS digest
                FROM {table} r
                WHERE NOT EXISTS (
                  SELECT 1 FROM course_versions v
                  WHERE v.course_id = r.{course_column}
                    AND v.revision = r.{revision_column}
                    AND v.digest = r.{digest_column}
                )
                ORDER BY r.{course_column}, r.{revision_column}
                LIMIT 20
            """
            rows = [dict(row) for row in db.execute(sql).fetchall()]
            count_sql = f"SELECT COUNT(*) FROM ({sql.replace('LIMIT 20', '')})"
            count = int(db.execute(count_sql).fetchone()[0])
            if count:
                findings.append({"table": table, "count": count, "sample": rows})
    return {
        "ok": not findings,
        "mode": "sqlite-read-only",
        "database": str(path),
        "findings": findings,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path, help="SQLite database file or Wrangler data directory")
    parser.add_argument("--json-output", type=Path)
    args = parser.parse_args()
    try:
        database = discover_database(args.path)
        report = (
            {"ok": True, "mode": "no-existing-registry", "database": None, "findings": []}
            if database is None
            else inspect(database)
        )
    except (OSError, sqlite3.DatabaseError, RuntimeError) as error:
        report = {"ok": False, "mode": "preflight-error", "database": None, "findings": [], "error": str(error)}
    output = json.dumps(report, ensure_ascii=False, indent=2)
    print(output)
    if args.json_output:
        args.json_output.write_text(output + "\n", encoding="utf-8")
    if report["ok"]:
        print("MINISV_COURSE_REGISTRY_PREFLIGHT_OK")
        return 0
    print("MINISV_COURSE_REGISTRY_PREFLIGHT_FAILED", file=sys.stderr)
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
