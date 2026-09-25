#!/usr/bin/env python3
"""Isolated browser acceptance for portable Console color tokens and contrast."""
from __future__ import annotations

import http.client
import json
import os
import secrets
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[3]
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_ready(port: int, process: subprocess.Popen[str], log: Path) -> None:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(log.read_text(errors="replace"))
        try:
            connection = http.client.HTTPConnection("127.0.0.1", port, timeout=1)
            connection.request("GET", "/api/auth/session")
            response = connection.getresponse(); response.read(); connection.close()
            if response.status in (200, 401):
                return
        except OSError:
            pass
        time.sleep(.2)
    raise TimeoutError(log.read_text(errors="replace"))


def login(page, base: str, username: str, password: str) -> None:
    destination = "/console/accounts/"
    page.goto(f"{base}/auth/login/?returnTo={quote(destination)}", wait_until="networkidle")
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(password)
    page.get_by_role("button", name="进入 Mini Silicon Valley").click()
    page.wait_for_url(f"**{destination}")
    page.wait_for_load_state("networkidle")


def severe_contrast_failures(page) -> list[dict[str, object]]:
    """Catch catastrophic pale-on-pale text while allowing muted decorative labels."""
    return page.evaluate("""() => {
      const rgb = value => {
        const match = value.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/);
        return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
      };
      const luminance = color => {
        const channels = color.slice(0, 3).map(value => {
          const normalized = value / 255;
          return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
        });
        return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
      };
      const contrast = (left, right) => {
        const a = luminance(left), b = luminance(right);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      };
      const background = element => {
        let result = [0, 0, 0, 0];
        for (let current = element; current; current = current.parentElement) {
          const behind = rgb(getComputedStyle(current).backgroundColor);
          if (!behind || behind[3] === 0) continue;
          const outAlpha = result[3] + behind[3] * (1 - result[3]);
          result = [
            (result[0] * result[3] + behind[0] * behind[3] * (1 - result[3])) / outAlpha,
            (result[1] * result[3] + behind[1] * behind[3] * (1 - result[3])) / outAlpha,
            (result[2] * result[3] + behind[2] * behind[3] * (1 - result[3])) / outAlpha,
            outAlpha,
          ];
          if (outAlpha >= .98) return result;
        }
        return result[3] ? result : [255, 255, 255, 1];
      };
      return [...document.querySelectorAll('h1,h2,h3,p,b,strong,small,span,label,code,a,button')]
        .filter(element => {
          const box = element.getBoundingClientRect(), style = getComputedStyle(element);
          return element.textContent.trim() && box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        })
        .map(element => {
          const foreground = rgb(getComputedStyle(element).color), ground = background(element);
          return foreground ? { tag: element.tagName, text: element.textContent.trim().slice(0, 80), color: foreground.slice(0, 3), background: ground.slice(0, 3), ratio: contrast(foreground, ground) } : null;
        })
        .filter(item => item && item.ratio < 2.5);
    }""")


def main() -> None:
    assert (REPO / "dist/server/wrangler.json").exists(), "run npm run build:minisv-app first"
    port, stamp = free_port(), secrets.token_hex(4)
    base = f"http://127.0.0.1:{port}"
    admin = {"username": f"contrast-admin-{stamp}", "name": "对比度管理员", "password": f"Contrast admin {secrets.token_urlsafe(18)}!"}
    mentor = {"username": f"contrast-mentor-{stamp}", "name": "对比度导师", "password": f"Contrast mentor {secrets.token_urlsafe(18)}!"}
    learner = {"username": "msv-student-01", "name": "学员 01", "password": f"Contrast learner {secrets.token_urlsafe(18)}!"}
    outsider = {"username": f"contrast-observer-{stamp}", "name": "对比度观察者", "password": f"Contrast observer {secrets.token_urlsafe(18)}!"}

    with tempfile.TemporaryDirectory(prefix="msv-console-contrast-") as temp:
        root = Path(temp); accounts = root / "accounts.json"; seed = root / "seed.sql"; log = root / "wrangler.log"
        accounts.write_text(json.dumps({"dm": admin, "mentors": [mentor], "learners": [learner], "outsider": outsider}, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1", "WRANGLER_SEND_METRICS": "false"}
        subprocess.run([str(REPO / "node_modules/.bin/tsx"), "scripts/generate-auth-seed.ts", "--accounts", str(accounts), "--output", str(seed)], cwd=REPO, env=env, check=True, capture_output=True, text=True)
        subprocess.run([str(REPO / "node_modules/.bin/wrangler"), "d1", "execute", "DB", "--yes", "--json", "--local", "--persist-to", temp, "--config", "dist/server/wrangler.json", "--file", str(seed)], cwd=REPO, env=env, check=True, capture_output=True, text=True)
        with log.open("w", encoding="utf-8") as output:
            process = subprocess.Popen([str(REPO / "node_modules/.bin/wrangler"), "dev", "--config", "wrangler.json", "--persist-to", temp, "--ip", "127.0.0.1", "--port", str(port), "--no-show-interactive-dev-session"], cwd=REPO / "dist/server", env=env, stdout=output, stderr=subprocess.STDOUT, text=True)
            try:
                wait_ready(port, process, log)
                with sync_playwright() as playwright:
                    launch = {"headless": True}
                    if CHROME.exists(): launch["executable_path"] = str(CHROME)
                    browser = playwright.chromium.launch(**launch)

                    admin_context = browser.new_context(viewport={"width": 1440, "height": 1000})
                    admin_page = admin_context.new_page(); login(admin_page, base, admin["username"], admin["password"])
                    directory = admin_page.get_by_role("heading", name="学员账号管理", exact=True)
                    expect(directory).to_be_visible()
                    toolbar = directory.locator("xpath=ancestor::header[1]")
                    expect(toolbar).to_have_css("color", "rgb(255, 249, 233)")
                    expect(toolbar).to_have_css("background-color", "rgb(16, 33, 38)")
                    row = admin_page.locator("article").filter(has_text="@msv-student-01")
                    expect(row).to_have_css("color", "rgb(23, 39, 45)")
                    expect(row).to_have_css("background-color", "rgb(255, 249, 233)")
                    badge = row.locator("span[data-status]")
                    expect(badge).to_have_css("color", "rgb(16, 33, 38)")
                    expect(badge).to_have_css("background-color", "rgb(143, 207, 195)")
                    assert not severe_contrast_failures(admin_page), severe_contrast_failures(admin_page)
                    assert admin_page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1")
                    for route in [
                        "/console/", "/console/studio/", "/console/studio/editor/", "/console/studio/preview/",
                        "/console/studio/releases/", "/console/courseware/", "/console/classrooms/",
                        "/console/homework/", "/console/qa/", "/console/archive/", "/console/settings/",
                    ]:
                        audit = admin_context.new_page()
                        audit.goto(f"{base}{route}", wait_until="networkidle")
                        failures = severe_contrast_failures(audit)
                        assert not failures, (route, failures)
                        assert audit.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), route
                        audit.close()
                    admin_context.close()

                    mentor_context = browser.new_context(viewport={"width": 1280, "height": 900})
                    mentor_page = mentor_context.new_page(); login(mentor_page, base, mentor["username"], mentor["password"])
                    assistance = mentor_page.get_by_role("heading", name="帮助课堂学员重置密码")
                    expect(assistance).to_be_visible()
                    card = assistance.locator("xpath=ancestor::section[1]")
                    expect(card).to_have_css("color", "rgb(23, 39, 45)")
                    expect(card).to_have_css("background-color", "rgb(255, 249, 233)")
                    assert not severe_contrast_failures(mentor_page), severe_contrast_failures(mentor_page)
                    mentor_context.close(); browser.close()
            finally:
                process.terminate()
                try: process.wait(timeout=5)
                except subprocess.TimeoutExpired: process.kill()
    print("CONSOLE_CONTRAST_PASS admin=directory mentor=assistance console-routes=11 severe-low-contrast=none overflow=none")


if __name__ == "__main__": main()
