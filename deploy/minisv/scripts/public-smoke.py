#!/usr/bin/env python3
"""Secret-free end-to-end checks for the public MiniSV routing contract."""
from __future__ import annotations

import argparse
import http.client
import json
import ssl
from urllib.parse import parse_qs, urlsplit


EXPECTED = {
    "/": 200,
    "/world-preview.json": 200,
    "/world/": 200,
    "/course/": 307,
    "/studio/": 307,
    "/courseware/product-mentor-foundations/": 401,
    "/courseware/development-mentor-ligun/": 401,
    "/courseware/market-mentor-user-system/": 401,
    "/course/development-mentor-ligun/?revision=0&slide=6&step=2": 307,
    "/framework/": 200,
    "/parents/": 200,
    "/workshop/": 307,
    "/workshop/_source/index.html": 404,
    "/classroom/": 307,
    "/auth/login": 308,
    "/auth/login/": 200,
    "/auth/register/": 200,
    "/auth/recover/": 200,
    "/alpha/": 410,
    "/control/": 410,
    "/healthz": 200,
    "/release.json": 200,
    "/api/public/courses": 200,
    "/robots.txt": 200,
    "/sitemap.xml": 200,
    "/favicon.svg": 200,
    "/og.png": 200,
    "/workshop/confirmed-baseline.json": 307,
    "/this-worldline-does-not-exist": 404,
}

# A denied Nginx auth_request may legitimately emit its tiny generic 401
# document.  Security depends on the protected artifact not being served, not
# on every gateway implementation returning a zero-byte error body.  These
# fingerprints and the size ceiling distinguish that generic response from a
# leaked courseware document without coupling the smoke test to Nginx wording.
COURSEWARE_MARKERS = {
    "/courseware/product-mentor-foundations/": ("青少年AI创业营", "MINI硅谷"),
    "/courseware/development-mentor-ligun/": ("先立棍，再让 AI 跑", "DEVELOPMENT MENTOR"),
    "/courseware/market-mentor-user-system/": ("产品的用户体系", "USER SYSTEM"),
}
MAX_UNAUTHORIZED_BODY_BYTES = 1024

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
        if path in {"/workshop/", "/workshop/confirmed-baseline.json"}:
            location = headers.get("location", "")
            target = urlsplit(location)
            returned = parse_qs(target.query).get("returnTo", [""])[0]
            if target.path.rstrip("/") != "/auth/login" or returned != "/workshop/":
                raise SystemExit(f"FAIL {path}: internal archive auth returnTo is invalid: {location!r}")
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
            market = release.get("marketCoursewareArtifact", {})
            if market.get("transformed") is not False or market.get("mentorRole") != "M":
                raise SystemExit("FAIL release.json: M-mentor courseware artifact was transformed or misclassified")
            if market.get("sha256") != "48b01a256bd3d408a5d539f798470e6aad0058a19dcdeb8b5d212b0e64add862":
                raise SystemExit("FAIL release.json: M-mentor courseware digest is not the accepted user-system tree")
            for feature in ("shared-brand-home", "released-workshop-snapshot", "read-only-workshop-history-archive", "unified-course-factory", "course-studio"):
                if feature not in release.get("features", []):
                    raise SystemExit(f"FAIL release.json: missing {feature}")
        if path == "/world-preview.json":
            preview = json.loads(body)
            if (
                preview.get("schemaVersion") != 1
                or preview.get("source") != "historyCatalog"
                or not isinstance(preview.get("layers"), list)
                or not preview["layers"]
                or not isinstance(preview.get("events"), list)
                or not preview["events"]
            ):
                raise SystemExit("FAIL world-preview.json: homepage history catalog is incomplete")
        if path in COURSEWARE_MARKERS:
            text = body.decode("utf-8", "replace")
            if len(body) > MAX_UNAUTHORIZED_BODY_BYTES or any(marker in text for marker in COURSEWARE_MARKERS[path]):
                raise SystemExit(f"FAIL {path}: anonymous auth gate leaked courseware bytes")
            if headers.get("cache-control") != "private, no-store, no-transform":
                raise SystemExit(f"FAIL {path}: authenticated static courseware cache policy is unsafe")
        if path in {"/", "/auth/login/", "/auth/register/", "/auth/recover/"}:
            text = body.decode("utf-8", "replace")
            if 'href="/"' not in text or '/favicon.svg' not in text:
                raise SystemExit(f"FAIL {path}: shared brand/home contract is missing")
        if path == "/framework/":
            text = body.decode("utf-8", "replace")
            if "COURSE SYSTEM" not in text or "/ui-theme.js" not in text:
                raise SystemExit("FAIL /framework/: native hydrated shell or public navigation runtime is missing")
        if path == "/api/public/courses":
            envelope = json.loads(body)
            courses = envelope.get("data", {}).get("courses") if envelope.get("ok") is True else None
            if not isinstance(courses, list):
                raise SystemExit("FAIL public course catalog: invalid response envelope")
            serialized = json.dumps(courses, ensure_ascii=False)
            for forbidden in ('"mentorScript"', '"privateCards"', '"decks"', '"reviewQueue"', '"contentPackages"', '"sources"', '"fieldModel"'):
                if forbidden in serialized:
                    raise SystemExit(f"FAIL public course catalog: leaked {forbidden}")
        if path in {"/", "/world/", "/framework/", "/parents/"}:
            if headers.get("x-robots-tag") != "index, follow":
                raise SystemExit(f"FAIL {path}: public page is not indexable")
        elif headers.get("x-robots-tag") != "noindex, nofollow, noarchive":
            raise SystemExit(f"FAIL {path}: protected or operational route is indexable")
        if path == "/this-worldline-does-not-exist":
            text = body.decode("utf-8", "replace")
            if "WORLDLINE NOT FOUND" not in text or 'href="/"' not in text or "/favicon.svg" not in text:
                raise SystemExit("FAIL custom 404: branded recovery path is missing")
        print(f"OK {path} {status}")
    print("MINISV_PUBLIC_SMOKE_OK")


if __name__ == "__main__":
    main()
