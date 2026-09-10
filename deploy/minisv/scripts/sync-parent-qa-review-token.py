#!/usr/bin/env python3
"""Keep the app and loopback Parent-QA review token equal without printing it."""
from __future__ import annotations

import argparse
import os
import re
import secrets
import tempfile
from pathlib import Path


KEY = "QA_INTERNAL_REVIEW_TOKEN"
LINE = re.compile(rf"^(?P<prefix>\s*(?:export\s+)?{KEY}\s*=)(?P<value>.*)$")


def decode_value(raw: str) -> str:
    value = raw.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]
    return value


def read_env(path: Path) -> tuple[str, str | None]:
    if path.is_symlink():
        raise ValueError(f"refusing symlink environment file: {path}")
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise ValueError(f"required environment file is missing: {path}") from exc
    values: list[str] = []
    for line in text.splitlines():
        match = LINE.match(line)
        if match:
            values.append(decode_value(match.group("value")))
    if len(values) > 1:
        raise ValueError(f"duplicate {KEY} in {path}")
    value = values[0] if values else None
    if value:
        if len(value) < 24 or any(ord(character) < 33 or ord(character) > 126 for character in value):
            raise ValueError(f"invalid {KEY} in {path}")
    return text, value or None


def with_value(text: str, value: str) -> str:
    replacement = f"{KEY}={value}"
    lines = text.splitlines()
    found = False
    for index, line in enumerate(lines):
        if LINE.match(line):
            lines[index] = replacement
            found = True
    if not found:
        if lines and lines[-1].strip():
            lines.append("")
        lines.append(replacement)
    return "\n".join(lines) + "\n"


def atomic_write(path: Path, text: str) -> None:
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def synchronize(app_env: Path, qa_env: Path, *, check: bool = False) -> str:
    app_text, app_value = read_env(app_env)
    qa_text, qa_value = read_env(qa_env)
    if app_value and qa_value and not secrets.compare_digest(app_value, qa_value):
        raise ValueError(f"{KEY} differs between application and Parent-QA environment files")
    if check:
        if not app_value or not qa_value:
            raise ValueError(f"{KEY} is missing from one or both environment files")
        return "verified"

    token = app_value or qa_value or secrets.token_urlsafe(48)
    mode = "preserved" if app_value and qa_value else ("copied" if app_value or qa_value else "generated")
    updates = {
        app_env: with_value(app_text, token),
        qa_env: with_value(qa_text, token),
    }
    originals = {app_env: app_text, qa_env: qa_text}
    written: list[Path] = []
    try:
        for path, text in updates.items():
            if text != originals[path]:
                atomic_write(path, text)
                written.append(path)
            else:
                os.chmod(path, 0o600)
    except Exception:
        for path in reversed(written):
            try:
                atomic_write(path, originals[path])
            except Exception:
                pass
        raise
    _, verified_app = read_env(app_env)
    _, verified_qa = read_env(qa_env)
    if not verified_app or not verified_qa or not secrets.compare_digest(verified_app, verified_qa):
        raise ValueError(f"{KEY} post-write verification failed")
    return mode


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("app_env", type=Path)
    parser.add_argument("qa_env", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        mode = synchronize(args.app_env, args.qa_env, check=args.check)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print(f"MINISV_QA_REVIEW_TOKEN_{mode.upper()}")


if __name__ == "__main__":
    main()
