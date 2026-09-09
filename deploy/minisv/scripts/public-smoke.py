#!/usr/bin/env python3
"""Secret-free end-to-end checks for the public MiniSV routing contract."""
from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import ssl
from urllib.parse import parse_qs, urlsplit


EXPECTED = {
    "/": 200,
    "/world/": 200,
    "/course/": 307,
    "/studio/": 307,
    "/courseware/product-mentor-foundations/": 401,
    "/courseware/development-mentor-ligun/": 401,
    "/course/development-mentor-ligun/?revision=0&slide=6&step=2": 307,
    "/framework/": 200,
    "/parents/": 200,
    "/workshop/": 200,
    "/classroom/": 307,
    "/auth/login": 308,
    "/auth/login/": 200,
    "/auth/register/": 200,
    "/auth/recover/": 200,
    "/alpha/": 410,
    "/control/": 410,
    "/healthz": 200,
    "/release.json": 200,
    "/favicon.svg": 200,
    "/og.png": 200,
    "/workshop/confirmed-baseline.json": 200,
    "/this-worldline-does-not-exist": 404,
}


def sha256(value: object) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


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
        if path == "/auth/login" and headers.get("location") != "/auth/login/":
            raise SystemExit("FAIL /auth/login: canonical trailing-slash redirect is invalid")
        if path.startswith("/course/development-mentor-ligun/"):
            location = headers.get("location", "")
            target = urlsplit(location)
            returned = parse_qs(target.query).get("returnTo", [""])[0]
            if target.path.rstrip("/") != "/auth/login" or returned != path:
                raise SystemExit(f"FAIL D-mentor login returnTo lost exact progress: {location!r}")
        if path == "/release.json":
            release = json.loads(body)
            if release.get("origin") != "hecate" or release.get("canonicalOrigin") != args.base:
                raise SystemExit("FAIL release.json: invalid production identity")
            if release.get("sources", {}).get("chjCourseUi") != "679213a61b835335016eac7649213983a0e48489":
                raise SystemExit("FAIL release.json: P-mentor courseware is not pinned to the approved chj commit")
            artifact = release.get("coursewareArtifact", {})
            if artifact.get("transformed") is not False or artifact.get("mentorRole") != "P":
                raise SystemExit("FAIL release.json: P-mentor courseware artifact was transformed or misclassified")
            development = release.get("developmentCoursewareArtifact", {})
            if development.get("transformed") is not False or development.get("mentorRole") != "D":
                raise SystemExit("FAIL release.json: D-mentor courseware artifact was transformed or misclassified")
            if development.get("sha256") != "ad6165eb01db16ad744bbfffba9fa016f5dc02e3abb5ad589fff68c30ab35234":
                raise SystemExit("FAIL release.json: D-mentor courseware digest is not the accepted T-093 tree")
            for feature in ("shared-brand-home", "released-workshop-snapshot", "unified-course-factory", "course-studio"):
                if feature not in release.get("features", []):
                    raise SystemExit(f"FAIL release.json: missing {feature}")
        if path in {"/courseware/product-mentor-foundations/", "/courseware/development-mentor-ligun/"}:
            if body:
                raise SystemExit(f"FAIL {path}: anonymous auth gate leaked courseware bytes")
            if headers.get("cache-control") != "private, no-store, no-transform":
                raise SystemExit(f"FAIL {path}: authenticated static courseware cache policy is unsafe")
        if path in {"/", "/framework/", "/workshop/", "/auth/login/", "/auth/register/", "/auth/recover/"}:
            text = body.decode("utf-8", "replace")
            if 'href="/"' not in text or '/favicon.svg' not in text:
                raise SystemExit(f"FAIL {path}: shared brand/home contract is missing")
        if path == "/workshop/":
            text = body.decode("utf-8", "replace")
            for marker in ("msv-workshop-released-baseline", 'data-panel="baseline"', "baseline.js", "baseline.css"):
                if marker not in text:
                    raise SystemExit(f"FAIL /workshop/: missing {marker}")
        if path == "/workshop/confirmed-baseline.json":
            snapshot = json.loads(body)
            integrity = snapshot.pop("integrity", None)
            if not isinstance(integrity, dict) or integrity.get("algorithm") != "sha256" or integrity.get("digest") != sha256(snapshot):
                raise SystemExit("FAIL Workshop snapshot: integrity mismatch")
            courses = snapshot.get("courses", [])
            if snapshot.get("scope") != "public-redacted-summary" or snapshot.get("source", {}).get("channel") != "released":
                raise SystemExit("FAIL Workshop snapshot: not a redacted Released projection")
            if not courses or any(len(course.get("macroSteps", [])) != 5 or len(course.get("blocks", [])) != 13 or len(course.get("deckSummary", [])) != 5 for course in courses):
                raise SystemExit("FAIL Workshop snapshot: incomplete five-step course projection")
            serialized = json.dumps(snapshot, ensure_ascii=False)
            for forbidden in ('"mentorScript"', '"seatTasks"', '"walletTenths"', '"teamTreasuryTenths"', '"lease":'):
                if forbidden in serialized:
                    raise SystemExit(f"FAIL Workshop snapshot: leaked {forbidden}")
        if path == "/this-worldline-does-not-exist":
            text = body.decode("utf-8", "replace")
            if "WORLDLINE NOT FOUND" not in text or 'href="/"' not in text or "/favicon.svg" not in text:
                raise SystemExit("FAIL custom 404: branded recovery path is missing")
        print(f"OK {path} {status}")
    print("MINISV_PUBLIC_SMOKE_OK")


if __name__ == "__main__":
    main()
