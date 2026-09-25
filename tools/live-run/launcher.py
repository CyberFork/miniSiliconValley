#!/usr/bin/env python3
"""Start an isolated real classroom API and the manual LIVE RUN controller.

The generated accounts and D1 database live below /tmp with mode 0700/0600.
They are intentionally ephemeral and are never printed.
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import IO

from controller import CourseController, LiveRunServer
from classroom_api import ClassroomApiAdapter


HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
DEFAULT_RUNTIME = Path("/tmp/msv-live-run-runtime")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", choices=("127.0.0.1", "localhost"))
    parser.add_argument("--controller-port", type=int, default=18765)
    parser.add_argument("--app-port", type=int, default=18887)
    parser.add_argument("--runtime-dir", type=Path, default=DEFAULT_RUNTIME)
    parser.add_argument("--project", type=Path, help="Materialized project root containing node_modules and dist/server")
    parser.add_argument("--reuse", action="store_true", help="Reuse this runtime database and controller state")
    parser.add_argument("--simulation", action="store_true", help="Run the manual controller without the classroom API")
    return parser.parse_args()


def find_project(explicit: Path | None) -> Path:
    candidates = [explicit] if explicit else [REPO_ROOT, Path("/tmp/msv-build-20260902T145752")]
    for candidate in candidates:
        if not candidate:
            continue
        root = candidate.expanduser().resolve()
        required = [
            root / "node_modules/.bin/tsx",
            root / "node_modules/.bin/wrangler",
            root / "scripts/generate-auth-seed.ts",
            root / "dist/server/wrangler.json",
        ]
        if all(path.is_file() for path in required):
            return root
    joined = "\n  - ".join(str(path) for path in candidates if path)
    raise SystemExit(
        "No materialized app build with node_modules was found. Checked:\n  - " + joined
        + "\nRun npm install and npm run build:work-app in the project, or pass --project."
    )


def ensure_port_free(host: str, port: int) -> None:
    with socket.socket() as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError as exc:
            raise SystemExit(f"Port {host}:{port} is already in use; stop the previous LIVE RUN first.") from exc


def new_accounts() -> dict:
    def account(username: str, name: str, role: str | None = None) -> dict:
        result = {"username": username, "password": secrets.token_urlsafe(24), "name": name}
        if role:
            result["role"] = role
        return result

    nonce = secrets.token_hex(3)
    return {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "target": "local-live-run-only",
        "dm": account(f"live_dm_{nonce}", "P 产品导师·主 DM", "admin"),
        "mentors": [
            account(f"live_dev_{nonce}", "D 开发导师", "mentor"),
            account(f"live_market_{nonce}", "M 市场导师", "mentor"),
            account(f"live_ops_{nonce}", "O 运营导师", "mentor"),
        ],
        "learners": [account(f"live_yb{i}_{nonce}", f"Young Builder {i}") for i in range(1, 5)],
        "outsider": account(f"live_obs_{nonce}", "本地观察员"),
    }


def write_private_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.chmod(path, 0o600)


def run_checked(command: list[str], *, cwd: Path, log: IO[str]) -> None:
    result = subprocess.run(command, cwd=cwd, text=True, stdout=log, stderr=subprocess.STDOUT, check=False)
    log.flush()
    if result.returncode:
        raise SystemExit(f"Setup command failed ({result.returncode}); inspect {log.name}")


def wait_for_port(host: str, port: int, process: subprocess.Popen, timeout: float = 40.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise SystemExit(f"Classroom worker stopped during startup with exit {process.returncode}")
        try:
            with socket.create_connection((host, port), timeout=0.3):
                return
        except OSError:
            time.sleep(0.15)
    raise SystemExit(f"Classroom worker did not listen on {host}:{port} within {timeout:g}s")


def terminate_process_group(process: subprocess.Popen | None) -> None:
    if not process or process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=8)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def main() -> None:
    args = parse_args()
    ensure_port_free(args.host, args.controller_port)
    if not args.simulation:
        ensure_port_free(args.host, args.app_port)

    runtime = args.runtime_dir.expanduser().resolve()
    if not args.reuse and runtime.exists():
        if runtime == Path("/") or not runtime.name.startswith("msv-live-run"):
            raise SystemExit("Refusing to clean an unsafe runtime directory")
        shutil.rmtree(runtime)
    runtime.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(runtime, 0o700)
    controller_state = runtime / "controller"
    controller_state.mkdir(mode=0o700, exist_ok=True)

    worker: subprocess.Popen | None = None
    log: IO[str] | None = None
    try:
        if args.simulation:
            controller = CourseController(controller_state / "run-state.json")
        else:
            project = find_project(args.project)
            accounts_path = runtime / "accounts.json"
            seed_path = runtime / "seed.sql"
            d1_path = runtime / "d1"
            if not args.reuse or not accounts_path.exists():
                write_private_json(accounts_path, new_accounts())
                run_checked(
                    [str(project / "node_modules/.bin/tsx"), "scripts/generate-auth-seed.ts", "--accounts", str(accounts_path), "--output", str(seed_path)],
                    cwd=project,
                    log=(log := (runtime / "setup.log").open("a", encoding="utf-8")),
                )
                run_checked(
                    [str(project / "node_modules/.bin/wrangler"), "d1", "execute", "DB", "--local", "--persist-to", str(d1_path), "--config", "dist/server/wrangler.json", "--file", str(seed_path)],
                    cwd=project,
                    log=log,
                )
            if log:
                log.close()
            worker_log = (runtime / "worker.log").open("a", encoding="utf-8")
            worker = subprocess.Popen(
                [
                    str(project / "node_modules/.bin/wrangler"), "dev", "--config", "wrangler.json",
                    "--persist-to", str(d1_path), "--ip", args.host, "--port", str(args.app_port),
                    "--no-show-interactive-dev-session",
                ],
                cwd=project / "dist/server",
                stdout=worker_log,
                stderr=subprocess.STDOUT,
                text=True,
                start_new_session=True,
            )
            wait_for_port(args.host, args.app_port, worker)
            factory = lambda persisted, campaign_id: ClassroomApiAdapter(  # noqa: E731
                f"http://{args.host}:{args.app_port}", accounts_path, persisted, campaign_id=campaign_id,
            )
            controller = CourseController(controller_state / "run-state.json", api_factory=factory)

        token = secrets.token_urlsafe(32)
        server = LiveRunServer((args.host, args.controller_port), controller, token)
        print(
            f"LIVE_RUN_READY url=http://{args.host}:{args.controller_port}/ "
            f"seat_url=http://{args.host}:{args.controller_port}/seat.html?seat=mentor01 "
            f"mode={controller.state['apiMode']} run={controller.state['runId']}",
            flush=True,
        )
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        pass
    finally:
        if log and not log.closed:
            log.close()
        terminate_process_group(worker)


if __name__ == "__main__":
    main()
