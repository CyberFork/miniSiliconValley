#!/usr/bin/env python3
"""Secret-free end-to-end checks for the public MiniSV routing contract."""
from __future__ import annotations

import argparse
import http.client
import json
import ssl
from urllib.parse import urlsplit


EXPECTED = {
    "/": 200,
    "/world/": 200,
    "/course/": 200,
    "/framework/": 200,
    "/parents/": 200,
    "/workshop/": 200,
    "/classroom/": 307,
    "/auth/login": 200,
    "/alpha/": 200,
    "/control/": 303,
    "/healthz": 200,
    "/release.json": 200,
}


def request(base: str, path: str) -> tuple[int, bytes, dict[str, str]]:
    target = urlsplit(base)
    if target.scheme != "https" or not target.hostname:
        raise ValueError("base URL must be HTTPS")
    connection = http.client.HTTPSConnection(
        target.hostname, target.port or 443, timeout=15, context=ssl.create_default_context()
    )
    connection.request("GET", path, headers={"User-Agent": "MiniSV-Public-Smoke/1.0"})
    response = connection.getresponse()
    body = response.read()
    headers = {name.lower(): value for name, value in response.getheaders()}
    status = response.status
    connection.close()
    return status, body, headers


def verify_cleartext_redirect(hostname: str) -> None:
    connection = http.client.HTTPConnection(hostname, 80, timeout=15)
    connection.request("GET", "/", headers={"User-Agent": "MiniSV-Public-Smoke/1.0"})
    response = connection.getresponse()
    response.read()
    location = response.getheader("Location")
    status = response.status
    connection.close()
    if status not in (301, 308) or location != f"https://{hostname}/":
        raise SystemExit(f"FAIL http redirect: status={status}, location={location!r}")
    print(f"OK http://{hostname}/ {status} -> {location}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="https://minisv.vip")
    args = parser.parse_args()
    verify_cleartext_redirect(urlsplit(args.base).hostname or "")
    for path, expected in EXPECTED.items():
        status, body, headers = request(args.base, path)
        if status != expected:
            raise SystemExit(f"FAIL {path}: expected {expected}, got {status}")
        if headers.get("x-minisv-origin") != "hecate":
            raise SystemExit(f"FAIL {path}: response did not originate at Hecate")
        if path == "/release.json":
            release = json.loads(body)
            if release.get("origin") != "hecate" or release.get("canonicalOrigin") != args.base:
                raise SystemExit("FAIL release.json: invalid production identity")
            if release.get("sources", {}).get("chjCourseUi") != "679213a61b835335016eac7649213983a0e48489":
                raise SystemExit("FAIL release.json: /course/ is not pinned to the approved chj commit")
            if release.get("courseArtifact", {}).get("transformed") is not False:
                raise SystemExit("FAIL release.json: chj course artifact was transformed")
        if path == "/course/":
            text = body.decode("utf-8", "replace")
            required = ("青少年AI创业营", "MINI硅谷", "/course/_next/", "/course/assets/home-workbench.png")
            if any(label not in text for label in required):
                raise SystemExit("FAIL /course/: incomplete colleague-owned course site")
            if "/ui-theme.js" in text or "data-course-outline-schema" in text:
                raise SystemExit("FAIL /course/: colleague-owned course site was rewritten or decorated")
        print(f"OK {path} {status}")
    print("MINISV_PUBLIC_SMOKE_OK")


if __name__ == "__main__":
    main()
