#!/usr/bin/env python3
"""Notebook-like manual controller for a 4-mentor + 4-learner classroom run."""

from __future__ import annotations

import argparse
import copy
import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import sys
import threading
import time
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlparse
from urllib.request import Request, urlopen

from classroom_api import ClassroomApiAdapter, ClassroomApiError
from course import (
    CourseRepository,
    DEFAULT_COURSE_ID,
    LEARNER_SEAT_IDS,
    course_digest,
    deal_course_deck,
    validate_script,
)


ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DEFAULT_STATE_DIR = Path("/tmp/msv-live-run-state")
STATE_SCHEMA_VERSION = 4
CONTROL_ROLES = frozenset({"admin", "mentor"})

SEATS = [
    {"id": "mentor01", "window": "W00", "title": "主 DM · 产品导师", "kind": "mentor", "code": "P"},
    {"id": "mentor02", "window": "W01", "title": "开发导师", "kind": "mentor", "code": "D"},
    {"id": "mentor03", "window": "W02", "title": "市场导师", "kind": "mentor", "code": "M"},
    {"id": "mentor04", "window": "W03", "title": "运营导师", "kind": "mentor", "code": "O"},
    {"id": "learner01", "window": "W04", "title": "Young Builder 01", "kind": "learner", "code": "YB1"},
    {"id": "learner02", "window": "W05", "title": "Young Builder 02", "kind": "learner", "code": "YB2"},
    {"id": "learner03", "window": "W06", "title": "Young Builder 03", "kind": "learner", "code": "YB3"},
    {"id": "learner04", "window": "W07", "title": "Young Builder 04", "kind": "learner", "code": "YB4"},
]

SIM_EFFECTS = {
    "room-and-deal": {"chapterOrder": 1, "phase": "identity", "mentorCount": 4, "learnerCount": 4, "cardsPerLearner": [3, 3, 3, 3], "uniqueDealtCards": 12},
    "read-and-publish": {"phase": "intel-network", "publishedCards": 12},
    "finish-find-chapter": {"chapterOrder": 2, "phase": "lobby", "intelligenceNodes": 4, "intelligenceEdges": 2, "challengeActions": 4, "allChallengeActionsTeam": True, "historyRevealed": False},
    "prepare-decide-value": {"chapterOrder": 2, "phase": "pdmo", "publishedCards": 12, "intelligenceNodes": 4, "intelligenceEdges": 2},
    "finish-decide-chapter": {"chapterOrder": 3, "phase": "lobby", "challengeActions": 4, "teamTreasuryTenths": 65},
    "prepare-build-mvp": {"chapterOrder": 3, "phase": "pdmo", "publishedCards": 12, "intelligenceNodes": 4, "intelligenceEdges": 2},
    "run-build-pressure": {"phase": "growth", "challengeRound": 2, "challengeActions": 4, "allChallengeActionsTeam": True, "teamTreasuryTenths": 130},
    "finish-build-chapter": {"chapterOrder": 4, "phase": "lobby", "worldlineEntries": 8},
    "prepare-market": {"chapterOrder": 4, "phase": "pdmo", "publishedCards": 12, "intelligenceNodes": 4, "intelligenceEdges": 2},
    "finish-market-chapter": {"chapterOrder": 5, "phase": "lobby", "teamTreasuryTenths": 195, "worldlineEntries": 12},
    "prepare-operations": {"chapterOrder": 5, "phase": "pdmo", "publishedCards": 12, "intelligenceNodes": 4, "intelligenceEdges": 2},
    "run-operations-and-freeze": {"chapterOrder": 5, "phase": "debrief", "challengeActions": 4, "teamTreasuryTenths": 260, "historyRevealed": True, "worldlineEntries": 16},
    "submit-demo-and-complete": {"phase": "completed", "completed": True, "worldlineEntries": 17},
}


class AtomicJsonStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)

    def read(self) -> dict[str, Any] | None:
        if not self.path.exists():
            return None
        return json.loads(self.path.read_text(encoding="utf-8"))

    def write(self, value: dict[str, Any]) -> None:
        temporary = self.path.with_name(f".{self.path.name}.{os.getpid()}.{secrets.token_hex(4)}.tmp")
        payload = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, self.path)


class SessionAuthorizer:
    """Authorize controller browsers with the existing first-party RBAC session.

    The classroom cookie is forwarded only to a loopback auth endpoint.  The
    console-to-controller path uses an independent service key so the public
    Alpha console never receives a classroom cookie or the controller token.
    """

    def __init__(
        self,
        session_url: str,
        service_key_path: Path,
        *,
        cache_seconds: float = 8.0,
    ) -> None:
        parsed = urlparse(session_url)
        if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"}:
            raise ValueError("controller auth session URL must be loopback HTTP")
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("controller auth session URL may not contain credentials, query, or fragment")
        self.session_url = session_url
        self.service_key = self._read_service_key(service_key_path)
        self.cache_seconds = max(0.0, min(float(cache_seconds), 30.0))
        self.cache: dict[str, tuple[float, str | None]] = {}
        self.lock = threading.Lock()

    @staticmethod
    def _read_service_key(path: Path) -> str:
        resolved = path.expanduser().resolve()
        mode = resolved.stat().st_mode & 0o777
        if mode & 0o077:
            raise ValueError("controller service key file must not be group/world accessible")
        value = resolved.read_text(encoding="utf-8").strip()
        if len(value) < 32:
            raise ValueError("controller service key must contain at least 32 characters")
        return value

    def is_service(self, candidate: str | None) -> bool:
        return bool(candidate) and hmac.compare_digest(candidate, self.service_key)

    def role_for_cookie(self, cookie: str | None) -> str | None:
        if not cookie or len(cookie) > 8192 or "__Secure-msv_session=" not in cookie:
            return None
        cache_key = hashlib.sha256(cookie.encode("utf-8")).hexdigest()
        now = time.monotonic()
        with self.lock:
            cached = self.cache.get(cache_key)
            if cached and cached[0] > now:
                return cached[1]
        role = self._fetch_role(cookie)
        with self.lock:
            if len(self.cache) > 256:
                self.cache = {key: value for key, value in self.cache.items() if value[0] > now}
            self.cache[cache_key] = (now + self.cache_seconds, role)
        return role

    def _fetch_role(self, cookie: str) -> str | None:
        request = Request(
            self.session_url,
            method="GET",
            headers={
                "Accept": "application/json",
                "Cookie": cookie,
                "User-Agent": "MSV-Live-Run-Controller/2.0",
            },
        )
        try:
            with urlopen(request, timeout=4) as response:  # noqa: S310 - URL is loopback-validated above
                if response.status != HTTPStatus.OK:
                    return None
                payload = json.loads(response.read(32_768).decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError):
            return None
        user = (payload.get("data") or {}).get("user") if isinstance(payload, dict) else None
        role = user.get("role") if isinstance(user, dict) else None
        return role if isinstance(role, str) else None


class CourseController:
    def __init__(
        self,
        state_path: Path,
        *,
        api_factory: Callable[[dict[str, Any] | None, str], ClassroomApiAdapter] | None = None,
        course_repository: CourseRepository | None = None,
    ) -> None:
        self.repository = course_repository or CourseRepository()
        self.store = AtomicJsonStore(state_path)
        self.script_store = AtomicJsonStore(state_path.with_name("active-course.json"))
        loaded = self.store.read()
        known_courses = {item["id"] for item in self.courses}
        selected = (loaded or {}).get("courseId", DEFAULT_COURSE_ID)
        persisted_script = self.script_store.read()
        if persisted_script:
            try:
                validate_script(persisted_script)
                if persisted_script["course"]["id"] != selected:
                    persisted_script = None
            except ValueError:
                persisted_script = None
        if persisted_script is not None:
            # The Run owns the exact JSON revision it started with.  A service
            # restart must not swap new teaching copy into a half-finished class.
            self.script = persisted_script
        else:
            if selected not in known_courses:
                selected = DEFAULT_COURSE_ID
            self.script = self.repository.load(selected)
        validate_script(self.script)
        self.lock = threading.RLock()
        self.api_factory = api_factory
        self.state = loaded if self._compatible(loaded) else self._new_state()
        # Schema 1 was the original Google-only controller.  Its persisted
        # state can be migrated losslessly by making that implicit selection
        # explicit; block and classroom data are otherwise unchanged.
        self.state["schemaVersion"] = STATE_SCHEMA_VERSION
        self.state["courseId"] = self.script["course"]["id"]
        self.state["courseRevision"] = int((self.script.get("authoring") or {}).get("revision", 0))
        self.state["courseDigest"] = course_digest(self.script)
        self.state.setdefault("courseVariant", (self.script.get("authoring") or {}).get("status", "published"))
        self.state.setdefault("previewBlockIndex", self.state.get("currentBlockIndex", 0))
        self.state.setdefault("courseDeals", {})
        self.state.setdefault("refreshEpoch", 0)
        self.state.setdefault("lastRefreshAt", None)
        self.state.setdefault("lastRefreshError", None)
        for deck in self.script["decks"]:
            draw_index = next(i for i, block in enumerate(self.script["blocks"]) if block["id"] == deck["drawAtBlockId"])
            block_state = self.state.get("blocks", [])[draw_index]
            if int(block_state.get("attempts", 0)) > 0 or block_state.get("status") in {"awaiting-acceptance", "passed"}:
                self._ensure_course_deal(deck["macroStepId"])
        if self.state.get("status") == "executing":
            index = min(int(self.state.get("currentBlockIndex", 0)), len(self.script["blocks"]) - 1)
            message = "控制器上次在执行中退出；课堂可能已有部分动作。请先核对现场，再点击错误重试。"
            self.state["status"] = "error"
            self.state["error"] = message
            self.state["blocks"][index]["status"] = "error"
            self.state["blocks"][index]["error"] = message
            self._event("run.interrupted", message)
        self.adapter = self._new_adapter(self.state.get("classroom")) if api_factory else None
        if self.adapter and self.adapter.room_id:
            try:
                self.adapter.login_all()
                lead = self.script["blocks"][self.state["currentBlockIndex"]]["leadMentorId"]
                snapshot = self.adapter.snapshot(lead)
                self.state["classroom"] = {**self._empty_snapshot(), **snapshot, **self.adapter.export_refs()}
                self._overlay_course_cards(self.state["classroom"])
                self._event("classroom.snapshot.refreshed", "已从真实课堂恢复身份、私密手牌与成长状态。")
            except Exception as exc:
                self._event("classroom.snapshot.refresh-failed", f"启动时暂未刷新课堂快照：{safe_error(exc)}")
        self._hydrate_seats()
        self._save()

    @property
    def courses(self) -> list[dict[str, Any]]:
        """Published catalogue is discovered on every request.

        This makes a newly published JSON package appear in the controller
        without restarting the classroom service, while the active Run keeps
        its already-loaded immutable script object.
        """
        return self.repository.list_published()

    def _compatible(self, state: dict[str, Any] | None) -> bool:
        if not state or state.get("schemaVersion") not in {1, 2, 3, STATE_SCHEMA_VERSION}:
            return False
        expected_ids = [block["id"] for block in self.script["blocks"]]
        actual_ids = [block.get("id") for block in state.get("blocks", [])]
        index = state.get("currentBlockIndex")
        return bool(
            state.get("scriptId") == self.script["id"]
            and state.get("courseId", DEFAULT_COURSE_ID) == self.script["course"]["id"]
            and actual_ids == expected_ids
            and isinstance(index, int)
            and 0 <= index < len(expected_ids)
            and (state.get("schemaVersion") in {1, 2, 3} or state.get("courseDigest") == course_digest(self.script))
        )

    def _new_adapter(self, persisted: dict[str, Any] | None) -> ClassroomApiAdapter | None:
        return self.api_factory(persisted, self.script["case"]["campaignId"]) if self.api_factory else None

    def _new_state(self) -> dict[str, Any]:
        now = iso_now()
        classroom = self._empty_snapshot()
        classroom["apiBacked"] = bool(self.api_factory)
        return {
            "schemaVersion": STATE_SCHEMA_VERSION,
            "scriptId": self.script["id"],
            "courseId": self.script["course"]["id"],
            "courseRevision": int((self.script.get("authoring") or {}).get("revision", 0)),
            "courseDigest": course_digest(self.script),
            "courseVariant": (self.script.get("authoring") or {}).get("status", "published"),
            "runId": f"run-{time.strftime('%Y%m%d-%H%M%S')}-{secrets.token_hex(3)}",
            "createdAt": now,
            "updatedAt": now,
            "version": 1,
            "apiMode": "classroom-api" if self.api_factory else "verified-simulation",
            "status": "ready",
            "currentBlockIndex": 0,
            "previewBlockIndex": 0,
            "lastCompletedBlockIndex": -1,
            "courseDeals": {},
            "refreshEpoch": 0,
            "lastRefreshAt": None,
            "lastRefreshError": None,
            "error": None,
            "classroom": classroom,
            "blocks": [
                {"id": block["id"], "status": "ready" if index == 0 else "locked", "attempts": 0, "executedAt": None, "acceptedAt": None, "error": None}
                for index, block in enumerate(self.script["blocks"])
            ],
            "seats": [],
            "events": [{"at": now, "type": "run.created", "message": f"已选择《{self.script['course']['name']}》；控制台停在块 01，未点击不会推进。"}],
        }

    def _empty_snapshot(self) -> dict[str, Any]:
        return {
            "apiBacked": False,
            "roomId": None,
            "teamPublicId": None,
            "campaignId": self.script["case"]["campaignId"],
            "chapterOrder": 1,
            "chapterCount": self.script["course"]["macroStepCount"],
            "chapterStage": "find-problem",
            "phase": "lobby",
            "roomStatus": "not-created",
            "roomVersion": 0,
            "mentorCount": 0,
            "learnerCount": 0,
            "learnerPdmoCount": 0,
            "cardsPerLearner": [0, 0, 0, 0],
            "uniqueDealtCards": 0,
            "publishedCards": 0,
            "intelligenceNodes": 0,
            "intelligenceEdges": 0,
            "challengeRound": None,
            "challengeActions": 0,
            "allChallengeActionsTeam": True,
            "teamTreasuryTenths": 0,
            "chapterRevenueTenths": 0,
            "chapterCostTenths": 0,
            "historyRevealed": False,
            "worldlineEntries": 0,
            "completed": False,
            "learnerViews": {},
        }

    def select_course(self, course_id: str, *, confirm_reset: bool = False) -> dict[str, Any]:
        """Start a new isolated run with another registered course.

        A course switch is never an in-place mutation of a running story.  If
        any classroom side effect or block attempt exists, the caller must
        explicitly confirm that a new run is intended.  The previous API room
        is retained for audit and is never deleted by this controller action.
        """
        with self.lock:
            if course_id == self.script["course"]["id"]:
                return self.public_state()
            if self.state["status"] == "executing":
                raise ValueError("当前块仍在执行，不能切换课程。请等系统停在待验收或错误状态。")
            known = {item["id"] for item in self.courses}
            if course_id not in known:
                raise ValueError("所选课程不存在或尚未完成 LIVE RUN 接入。")
            started = bool(
                self.state.get("currentBlockIndex")
                or self.state.get("classroom", {}).get("roomId")
                or any(item.get("attempts", 0) for item in self.state.get("blocks", []))
            )
            if started and not confirm_reset:
                raise ValueError("当前课程已经开始；切换会创建一场全新的 Run，请先明确确认。")

            candidate = self.repository.load(course_id)
            validate_script(candidate)
            previous_script = self.script
            self.script = candidate
            try:
                next_state = self._new_state()
                next_adapter = self._new_adapter(None)
            except Exception:
                self.script = previous_script
                raise
            self.state = next_state
            self.adapter = next_adapter
            self._event("course.selected", f"已切换为《{self.script['course']['name']}》，并创建全新 Run。")
            self._hydrate_seats()
            self._save()
            return self.public_state()

    def reset(self) -> dict[str, Any]:
        with self.lock:
            if self.state["status"] == "executing":
                raise ValueError("当前块仍在执行，不能中途重置。请等它进入待验收或错误状态。")
            # A reset is also the explicit moment at which the currently
            # selected course may adopt a newly published JSON revision.
            self.script = self.repository.load(self.script["course"]["id"])
            self.state = self._new_state()
            self.adapter = self._new_adapter(None)
            self._hydrate_seats()
            self._save()
            return self.public_state()

    def _latest_course(self) -> dict[str, Any]:
        """Load the newest valid author copy (draft first, then published)."""
        return self.repository.load(self.script["course"]["id"], variant="draft")

    def _course_update(self) -> dict[str, Any]:
        """Return an editor/run revision comparison without mutating the Run."""
        active_revision = int(self.state.get("courseRevision", 0))
        active_digest = str(self.state.get("courseDigest") or course_digest(self.script))
        try:
            latest = self._latest_course()
            latest_revision = int((latest.get("authoring") or {}).get("revision", 0))
            latest_variant = (latest.get("authoring") or {}).get("status", "published")
            latest_digest = course_digest(latest)
            return {
                "activeRevision": active_revision,
                "activeDigest": active_digest[:16],
                "activeVariant": self.state.get("courseVariant", "published"),
                "latestRevision": latest_revision,
                "latestDigest": latest_digest[:16],
                "latestVariant": latest_variant,
                "updateAvailable": latest_digest != active_digest,
                "lastRefreshAt": self.state.get("lastRefreshAt"),
                "lastRefreshError": self.state.get("lastRefreshError"),
            }
        except Exception as exc:
            return {
                "activeRevision": active_revision,
                "activeDigest": active_digest[:16],
                "activeVariant": self.state.get("courseVariant", "published"),
                "latestRevision": None,
                "latestDigest": None,
                "latestVariant": None,
                "updateAvailable": False,
                "lastRefreshAt": self.state.get("lastRefreshAt"),
                "lastRefreshError": f"读取最新课程失败：{safe_error(exc)}",
            }

    def refresh_course(self) -> dict[str, Any]:
        """Explicitly hot-load the newest valid JSON into this Alpha Run.

        This action preserves the Run id, classroom, real execution pointer,
        submissions, money, reputation and existing deal positions.  It is
        intentionally not called by editor save/publish: formal classrooms can
        therefore never change content silently.
        """
        with self.lock:
            if self.state["status"] == "executing":
                raise ValueError("当前块仍在执行，不能刷新课程内容。")
            try:
                candidate = self._latest_course()
                validate_script(candidate)
                if candidate["course"]["id"] != self.script["course"]["id"]:
                    raise ValueError("最新修订不属于当前课程。")
                if [block["id"] for block in candidate["blocks"]] != [block["id"] for block in self.script["blocks"]]:
                    raise ValueError("热刷新必须保持 B01—B13 稳定块 ID。")
                if (
                    self.state.get("classroom", {}).get("roomId")
                    and candidate["case"]["campaignId"] != self.script["case"]["campaignId"]
                ):
                    raise ValueError("已创建真实课堂后不能更换运行流程底座；请只更新 JSON 卡组和课程内容。")

                previous_script = self.script
                previous_state = copy.deepcopy(self.state)
                self.script = candidate
                try:
                    self._reconcile_course_deals()
                    self.state["courseRevision"] = int((candidate.get("authoring") or {}).get("revision", 0))
                    self.state["courseDigest"] = course_digest(candidate)
                    self.state["courseVariant"] = (candidate.get("authoring") or {}).get("status", "published")
                    self.state["previewBlockIndex"] = self.state["currentBlockIndex"]
                    self.state["refreshEpoch"] = int(self.state.get("refreshEpoch", 0)) + 1
                    self.state["lastRefreshAt"] = iso_now()
                    self.state["lastRefreshError"] = None
                    self._overlay_course_cards(self.state["classroom"])
                    self._event("course.refreshed", f"已在原 Run 加载课程 r{self.state['courseRevision']}，真实进度与账本未回退。")
                    self._hydrate_seats()
                    self._save()
                except Exception:
                    self.script = previous_script
                    self.state = previous_state
                    raise
                return self.public_state()
            except Exception as exc:
                self.state["lastRefreshError"] = safe_error(exc)
                self._event("course.refresh.failed", f"课程刷新失败，已保留上一个完整版本：{safe_error(exc)}")
                self._hydrate_seats()
                self._save()
                raise

    def preview_back(self) -> dict[str, Any]:
        """Show the previous block everywhere without undoing side effects."""
        with self.lock:
            if self.state["status"] == "executing": raise ValueError("执行中不能切换回看位置。")
            current = int(self.state.get("previewBlockIndex", self.state["currentBlockIndex"]))
            if current <= 0: raise ValueError("已经在第一块。")
            self.state["previewBlockIndex"] = current - 1
            self._event("preview.back", f"八席调试回看 {self.script['blocks'][current - 1]['id']}；真实执行记录未撤销。")
            self._hydrate_seats(); self._save(); return self.public_state()

    def preview_forward(self) -> dict[str, Any]:
        """Move a preview back toward the real execution pointer."""
        with self.lock:
            if self.state["status"] == "executing": raise ValueError("执行中不能切换回看位置。")
            current = int(self.state.get("previewBlockIndex", self.state["currentBlockIndex"]))
            limit = int(self.state["currentBlockIndex"])
            if current >= limit: raise ValueError("已回到真实当前块；要继续课程请执行或验收。")
            self.state["previewBlockIndex"] = current + 1
            self._event("preview.forward", f"八席调试前看 {self.script['blocks'][current + 1]['id']}；未产生新系统动作。")
            self._hydrate_seats(); self._save(); return self.public_state()

    def execute_async(self) -> dict[str, Any]:
        with self.lock:
            if self.state.get("previewBlockIndex", self.state["currentBlockIndex"]) != self.state["currentBlockIndex"]:
                raise ValueError("当前在回看旧块。请先点“回看向前”返回真实当前块。")
            if self.state["status"] != "ready":
                raise ValueError("只有就绪状态可以执行当前块；出错后请先点击“错误重试”。")
            index = self.state["currentBlockIndex"]
            block_state = self.state["blocks"][index]
            block_state["status"] = "executing"
            block_state["attempts"] += 1
            block_state["error"] = None
            self.state["status"] = "executing"
            self.state["error"] = None
            self._event("block.execute.started", f"开始执行 {self.script['blocks'][index]['id']}。")
            self._hydrate_seats()
            self._save()
            thread = threading.Thread(target=self._execute_worker, args=(index,), daemon=True, name=f"live-run-{index + 1}")
            thread.start()
            return self.public_state()

    def _execute_worker(self, index: int) -> None:
        block = self.script["blocks"][index]
        try:
            if self.adapter:
                snapshot = self.adapter.execute(block["apiAction"], block)
            else:
                time.sleep(0.08)
                snapshot = copy.deepcopy(self.state["classroom"])
                snapshot.update(SIM_EFFECTS[block["apiAction"]])
                snapshot["apiBacked"] = False
                snapshot["campaignId"] = self.script["case"]["campaignId"]
                snapshot["chapterCount"] = self.script["course"]["macroStepCount"]
                snapshot["roomStatus"] = "active" if not snapshot.get("completed") else "completed"
                snapshot["roomVersion"] = int(snapshot.get("roomVersion", 0)) + 1
            with self.lock:
                if self.state["currentBlockIndex"] != index or self.state["status"] != "executing":
                    return
                self.state["classroom"] = {**self._empty_snapshot(), **snapshot}
                self._ensure_course_deal(block["macroStepId"])
                self._overlay_course_cards(self.state["classroom"], block["macroStepId"])
                if self.adapter:
                    self.state["classroom"].update(self.adapter.export_refs())
                block_state = self.state["blocks"][index]
                block_state["status"] = "awaiting-acceptance"
                block_state["executedAt"] = iso_now()
                self.state["status"] = "awaiting-acceptance"
                self._event("block.execute.passed", f"{block['id']} 系统动作已完成，等待人工验收；尚未进入下一块。")
                self._hydrate_seats()
                self._save()
        except Exception as exc:  # failure must stop, remain visible, and be retryable
            safe_message = safe_error(exc)
            log_exception_without_source(exc)
            with self.lock:
                if self.state["currentBlockIndex"] != index:
                    return
                block_state = self.state["blocks"][index]
                block_state["status"] = "error"
                block_state["error"] = safe_message
                self.state["status"] = "error"
                self.state["error"] = safe_message
                self._event("block.execute.failed", f"{block['id']} 失败：{safe_message}")
                self._hydrate_seats()
                self._save()

    def accept(self) -> dict[str, Any]:
        with self.lock:
            if self.state.get("previewBlockIndex", self.state["currentBlockIndex"]) != self.state["currentBlockIndex"]:
                raise ValueError("回看只用于检查内容，不能验收。请先返回真实当前块。")
            if self.state["status"] != "awaiting-acceptance":
                raise ValueError("当前块尚未执行成功，不能验收或前进。")
            index = self.state["currentBlockIndex"]
            block_state = self.state["blocks"][index]
            block_state["status"] = "passed"
            block_state["acceptedAt"] = iso_now()
            self.state["lastCompletedBlockIndex"] = index
            self._event("block.accepted", f"人工验收通过 {block_state['id']}。")
            if index == len(self.script["blocks"]) - 1:
                self.state["status"] = "completed"
            else:
                self.state["currentBlockIndex"] = index + 1
                self.state["blocks"][index + 1]["status"] = "ready"
                self.state["status"] = "ready"
                self._event("block.unlocked", f"已解锁 {self.state['blocks'][index + 1]['id']}；仍需手动点击执行。")
            self.state["previewBlockIndex"] = self.state["currentBlockIndex"]
            self._hydrate_seats()
            self._save()
            return self.public_state()

    def retry(self) -> dict[str, Any]:
        with self.lock:
            if self.state.get("previewBlockIndex", self.state["currentBlockIndex"]) != self.state["currentBlockIndex"]:
                raise ValueError("回看状态不能重试系统动作。")
            if self.state["status"] != "error":
                raise ValueError("只有错误状态可以重试。")
            index = self.state["currentBlockIndex"]
            self.state["blocks"][index]["status"] = "ready"
            self.state["blocks"][index]["error"] = None
            self.state["status"] = "ready"
            self.state["error"] = None
            self._event("block.retry.ready", f"{self.state['blocks'][index]['id']} 已恢复就绪；请再次点击执行。")
            self._hydrate_seats()
            self._save()
            return self.public_state()

    def _ensure_course_deal(self, macro_step_id: str) -> dict[str, list[str]]:
        deals = self.state.setdefault("courseDeals", {})
        existing = deals.get(macro_step_id)
        if isinstance(existing, dict) and set(existing) == set(LEARNER_SEAT_IDS):
            return existing
        dealt = deal_course_deck(self.script, macro_step_id)
        deal_ids = {seat_id: [card["id"] for card in cards] for seat_id, cards in dealt.items()}
        deals[macro_step_id] = deal_ids
        return deal_ids

    def _reconcile_course_deals(self) -> None:
        """Keep stable hands across content refresh, filling only removed IDs."""
        deals = self.state.setdefault("courseDeals", {})
        for macro_step_id, seat_hands in list(deals.items()):
            deck = next((item for item in self.script["decks"] if item["macroStepId"] == macro_step_id), None)
            if not deck:
                deals.pop(macro_step_id, None)
                continue
            valid_ids = {card["id"] for card in deck["cards"]}
            used: set[str] = set()
            reconciled: dict[str, list[str]] = {}
            for seat_id in LEARNER_SEAT_IDS:
                raw = seat_hands.get(seat_id, []) if isinstance(seat_hands, dict) else []
                kept = [card_id for card_id in raw if card_id in valid_ids and card_id not in used][:3]
                used.update(kept); reconciled[seat_id] = kept
            available = [card["id"] for card in deck["cards"] if card["id"] not in used]
            secrets.SystemRandom().shuffle(available)
            for seat_id in LEARNER_SEAT_IDS:
                missing = 3 - len(reconciled[seat_id])
                if missing:
                    reconciled[seat_id].extend(available[:missing]); del available[:missing]
            if any(len(hand) != 3 for hand in reconciled.values()):
                raise ValueError(f"{macro_step_id} 卡组无法在刷新后保持四人每人三张。")
            deals[macro_step_id] = reconciled

    def _overlay_course_cards(self, classroom: dict[str, Any], macro_step_id: str | None = None) -> None:
        """Project JSON-authored cards into learner-safe Alpha seat views."""
        if not self.state.get("courseDeals"):
            return
        if macro_step_id is None:
            display_index = min(int(self.state.get("previewBlockIndex", self.state["currentBlockIndex"])), len(self.script["blocks"]) - 1)
            macro_step_id = self.script["blocks"][display_index]["macroStepId"]
        hands = self.state["courseDeals"].get(macro_step_id)
        if not isinstance(hands, dict):
            return
        deck = next(item for item in self.script["decks"] if item["macroStepId"] == macro_step_id)
        by_id = {card["id"]: card for card in deck["cards"]}
        views = classroom.setdefault("learnerViews", {})
        phase = classroom.get("phase")
        state_name = "held" if phase in {"lobby", "identity", "private-read", None} else "published"
        for seat_id in LEARNER_SEAT_IDS:
            view = views.setdefault(seat_id, {
                "displayName": seat_id.replace("learner", "Young Builder "),
                "reputation": 0, "walletTenths": 0, "unlockIds": [],
                "identity": None, "scene": None, "chapterSteps": [],
                "chapterDoneWhen": None, "realityMission": None, "challenge": None,
            })
            view["cards"] = [
                {**copy.deepcopy(by_id[card_id]), "evidenceBoundary": by_id[card_id]["boundary"], "state": state_name}
                for card_id in hands.get(seat_id, []) if card_id in by_id
            ]
        classroom["cardsPerLearner"] = [len(views[seat_id].get("cards", [])) for seat_id in LEARNER_SEAT_IDS]
        classroom["uniqueDealtCards"] = len({card["id"] for seat_id in LEARNER_SEAT_IDS for card in views[seat_id].get("cards", [])})

    def public_state(self) -> dict[str, Any]:
        with self.lock:
            value = copy.deepcopy(self.state)
            value["courseUpdate"] = self._course_update()
            return value

    def _hydrate_seats(self) -> None:
        index = min(int(self.state.get("previewBlockIndex", self.state["currentBlockIndex"])), len(self.script["blocks"]) - 1)
        block = self.script["blocks"][index]
        macro = next(step for step in self.script["macroSteps"] if step["id"] == block["macroStepId"])
        status = self.state["status"]
        is_preview = index != self.state["currentBlockIndex"]
        self._overlay_course_cards(self.state["classroom"], block["macroStepId"])
        seats = []
        for definition in SEATS:
            task = block["seatTasks"][definition["id"]]
            if is_preview:
                headline = f"调试回看 {block['id']} · 不撤销真实记录"
            elif status == "awaiting-acceptance":
                headline = "本块已同步 · 等待主控验收"
            elif status == "executing":
                headline = "系统正在执行当前块"
            elif status == "error":
                headline = "当前块停住 · 查看错误并重试"
            elif status == "completed":
                headline = "本次课程完成"
            else:
                headline = "等主控点击“执行当前块”"
            seats.append({
                **definition,
                "blockId": block["id"],
                "blockOrder": block["order"],
                "blockTitle": block["title"],
                "blockCount": len(self.script["blocks"]),
                "macroStepOrder": macro["order"],
                "macroStepName": macro["name"],
                "macroStepCount": len(self.script["macroSteps"]),
                "courseId": self.script["course"]["id"],
                "caseName": self.script["case"]["name"],
                "learnerCaseName": self.script["case"]["learnerName"],
                "casePeriod": self.script["case"]["period"],
                "spotlight": task["state"],
                "badge": task["badge"],
                "task": task["task"],
                "learnerLens": copy.deepcopy(block["learnerLens"]) if definition["kind"] == "learner" else None,
                "studentPrompt": block["studentPrompt"] if definition["kind"] == "learner" else None,
                "headline": headline,
                "runStatus": status,
                "isPreview": is_preview,
                "executionBlockId": self.script["blocks"][self.state["currentBlockIndex"]]["id"],
                "courseRevision": self.state.get("courseRevision", 0),
                "courseDigest": str(self.state.get("courseDigest", ""))[:16],
                "refreshEpoch": self.state.get("refreshEpoch", 0),
            })
        self.state["seats"] = seats

    def _event(self, event_type: str, message: str) -> None:
        self.state["events"].append({"at": iso_now(), "type": event_type, "message": message})
        self.state["events"] = self.state["events"][-200:]

    def _save(self) -> None:
        self.state["updatedAt"] = iso_now()
        self.state["version"] = int(self.state.get("version", 0)) + 1
        self.script_store.write(self.script)
        self.store.write(self.state)


class LiveRunServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(
        self,
        address: tuple[str, int],
        controller: CourseController,
        token: str,
        *,
        authorizer: SessionAuthorizer | None = None,
        public_origin: str | None = None,
        public_base: str = "/control/",
        login_path: str = "/auth/login",
    ) -> None:
        super().__init__(address, LiveRunHandler)
        self.controller = controller
        self.control_token = token
        self.authorizer = authorizer
        self.port = self.server_address[1]
        self.public_origin = public_origin.rstrip("/") if public_origin else None
        self.public_host = urlparse(self.public_origin).netloc if self.public_origin else None
        self.public_base = "/" + public_base.strip("/") + "/"
        self.login_path = login_path if login_path.startswith("/") else f"/{login_path}"
        # This repository commonly lives in a cloud-synced directory. Reading
        # every tiny asset on every request can block an otherwise healthy
        # local HTTP response while the sync provider hydrates metadata. Load
        # the immutable controller bundle once before clients start polling.
        self.static_assets = {}
        for name in (
            "index.html", "styles.css", "controller.js", "editor.html", "editor.css", "editor.js",
            "seat.html", "seat.css", "seat.js",
        ):
            target = STATIC / name
            data = target.read_bytes()
            mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            self.static_assets[f"/{name}"] = (data, mime)


class LiveRunHandler(BaseHTTPRequestHandler):
    server: LiveRunServer
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/healthz":
            self._json(200, {"ok": True, "data": {"service": "msv-live-run-controller"}})
            return
        service_request = self._is_service_request()
        if not self._authorize(parsed.path, service_request=service_request):
            return
        if parsed.path == "/run-launcher.html":
            # Compatibility for bookmarks/tabs from the retired text-file
            # launcher. Letting its cached JavaScript keep polling the removed
            # run-live.txt endpoint produces a misleading NOT_FOUND console.
            self.send_response(307)
            self.send_header("Location", "/")
            self.send_header("Content-Length", "0")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if parsed.path == "/api/bootstrap":
            if service_request:
                self._json(404, {"ok": False, "error": {"code": "NOT_EXPOSED", "message": "服务身份不能读取主控令牌。"}})
                return
            self._json(200, {"ok": True, "data": {
                "token": self.server.control_token,
                "courseCatalog": self.server.controller.courses,
                "script": self.server.controller.script,
                "state": self.server.controller.public_state(),
            }})
            return
        if parsed.path == "/api/courses":
            self._json(200, {"ok": True, "data": self.server.controller.repository.list_for_editor()})
            return
        if parsed.path.startswith("/api/courses/"):
            course_id = unquote(parsed.path.removeprefix("/api/courses/"))
            variant = parse_qs(parsed.query).get("variant", ["draft"])[0]
            try:
                value = self.server.controller.repository.load(course_id, variant=variant)
            except ValueError as exc:
                self._json(404, {"ok": False, "error": {"code": "COURSE_NOT_FOUND", "message": str(exc)}})
                return
            self._json(200, {"ok": True, "data": {
                "course": value,
                "revision": int((value.get("authoring") or {}).get("revision", 0)),
                "variant": (value.get("authoring") or {}).get("status", "published"),
            }})
            return
        if parsed.path == "/api/state":
            self._json(200, {"ok": True, "data": self.server.controller.public_state()})
            return
        if parsed.path == "/api/script":
            self._json(200, {"ok": True, "data": self.server.controller.script})
            return
        if parsed.path == "/editor":
            self.send_response(308)
            self.send_header("Location", "editor/")
            self.send_header("Content-Length", "0")
            self._security_headers()
            self.end_headers()
            return
        path = "/index.html" if parsed.path == "/" else "/editor.html" if parsed.path == "/editor/" else parsed.path
        self._static(path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        allowed_paths = {"/api/control", "/api/courses/validate", "/api/courses/save", "/api/courses/clone"}
        if parsed.path not in allowed_paths:
            self._json(404, {"ok": False, "error": {"code": "NOT_FOUND", "message": "没有这个控制入口。"}})
            return
        if not self._authorize(parsed.path, service_request=self._is_service_request()):
            self.close_connection = True
            return
        if not self._same_origin() or not hmac.compare_digest(self.headers.get("X-Live-Run-Token", ""), self.server.control_token):
            # Do not leave an unread request body on a keep-alive connection;
            # otherwise BaseHTTPRequestHandler can mistake that JSON body for
            # the next HTTP request line after a deliberate 403 response.
            self.close_connection = True
            self._json(403, {"ok": False, "error": {"code": "CONTROL_FORBIDDEN", "message": "控制请求未通过本机同源校验。"}})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = -1
        max_length = 524_288 if parsed.path.startswith("/api/courses/") else 16_384
        if length < 0 or length > max_length:
            self._json(413, {"ok": False, "error": {"code": "BODY_TOO_LARGE", "message": "控制请求过大。"}})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            if parsed.path.startswith("/api/courses/"):
                data = self._course_write(parsed.path, payload)
                self._json(200, {"ok": True, "data": data})
                return
            action = payload.get("action")
            if action == "execute":
                data = self.server.controller.execute_async()
                status = 202
            elif action == "accept":
                data = self.server.controller.accept()
                status = 200
            elif action == "retry":
                data = self.server.controller.retry()
                status = 200
            elif action == "preview-back":
                data = self.server.controller.preview_back()
                status = 200
            elif action == "preview-forward":
                data = self.server.controller.preview_forward()
                status = 200
            elif action == "refresh-course":
                data = self.server.controller.refresh_course()
                status = 200
            elif action == "reset":
                data = self.server.controller.reset()
                status = 200
            elif action == "select-course":
                course_id = payload.get("courseId")
                if not isinstance(course_id, str):
                    raise ValueError("请选择有效课程。")
                data = self.server.controller.select_course(
                    course_id,
                    confirm_reset=payload.get("confirmReset") is True,
                )
                status = 200
            else:
                raise ValueError("未知控制动作。")
            self._json(status, {"ok": True, "data": data})
        except (ValueError, json.JSONDecodeError) as exc:
            self._json(409, {"ok": False, "error": {"code": "CONTROL_STATE_INVALID", "message": str(exc)}})
        except Exception as exc:
            log_exception_without_source(exc)
            self._json(500, {"ok": False, "error": {"code": "CONTROL_FAILED", "message": safe_error(exc)}})

    def _course_write(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        repository = self.server.controller.repository
        if path == "/api/courses/validate":
            value = payload.get("course")
            validate_script(value)
            return {
                "valid": True,
                "courseId": value["course"]["id"],
                "macroSteps": len(value["macroSteps"]),
                "blocks": len(value["blocks"]),
                "decks": len(value["decks"]),
                "cards": sum(len(deck["cards"]) for deck in value["decks"]),
            }
        if path == "/api/courses/save":
            value = payload.get("course")
            status = payload.get("status")
            expected = payload.get("expectedRevision")
            saved = repository.save(value, status=status, expected_revision=expected)
            return {
                "course": saved,
                "revision": saved["authoring"]["revision"],
                "status": saved["authoring"]["status"],
                "catalog": repository.list_for_editor(),
            }
        if path == "/api/courses/clone":
            cloned = repository.clone(
                payload.get("sourceCourseId"), payload.get("newCourseId"), payload.get("newName"),
            )
            return {
                "course": cloned,
                "revision": cloned["authoring"]["revision"],
                "status": "draft",
                "catalog": repository.list_for_editor(),
            }
        raise ValueError("未知课程编辑动作。")

    def _is_service_request(self) -> bool:
        authorizer = self.server.authorizer
        return bool(authorizer and authorizer.is_service(self.headers.get("X-Live-Run-Service-Key")))

    def _authorize(self, path: str, *, service_request: bool) -> bool:
        authorizer = self.server.authorizer
        if authorizer is None:
            return True
        if service_request:
            if path in {"/api/state", "/api/script"}:
                return True
            self._json(403, {"ok": False, "error": {"code": "SERVICE_SCOPE_FORBIDDEN", "message": "服务身份只能读取席位同步所需状态。"}})
            return False
        role = authorizer.role_for_cookie(self.headers.get("Cookie"))
        if role in CONTROL_ROLES:
            return True
        if path.startswith("/api/"):
            code = "CONTROL_ROLE_REQUIRED" if role else "AUTH_REQUIRED"
            status = HTTPStatus.FORBIDDEN if role else HTTPStatus.UNAUTHORIZED
            message = "只有导师或管理员可以使用 LIVE RUN 主控。" if role else "请先登录导师或管理员账号。"
            self._json(status, {"ok": False, "error": {"code": code, "message": message}})
            return False
        if not role:
            public_target = self.server.public_base
            if path in {"/editor", "/editor/", "/editor.html"}:
                public_target = f"{self.server.public_base}editor/"
            return_to = quote(public_target, safe="/")
            separator = "&" if "?" in self.server.login_path else "?"
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header("Location", f"{self.server.login_path}{separator}returnTo={return_to}")
            self.send_header("Content-Length", "0")
            self._security_headers()
            self.end_headers()
            return False
        body = (
            "<!doctype html><html lang='zh-CN'><meta charset='utf-8'><meta name='viewport' "
            "content='width=device-width,initial-scale=1'><title>需要导师权限</title>"
            "<body><main><h1>需要导师权限</h1><p>当前账号可以参与课堂，但不能操作 LIVE RUN 主控。</p>"
            "<p><a href='/classroom/'>返回课堂</a></p></main></body></html>"
        ).encode("utf-8")
        self.send_response(HTTPStatus.FORBIDDEN)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._security_headers()
        self.end_headers()
        self.wfile.write(body)
        return False

    def _same_origin(self) -> bool:
        host = self.headers.get("Host", "")
        allowed_hosts = {f"127.0.0.1:{self.server.port}", f"localhost:{self.server.port}"}
        if self.server.public_host:
            allowed_hosts.add(self.server.public_host)
        if host not in allowed_hosts:
            return False
        origin = self.headers.get("Origin")
        allowed_origins = {f"http://127.0.0.1:{self.server.port}", f"http://localhost:{self.server.port}"}
        if self.server.public_origin:
            allowed_origins.add(self.server.public_origin)
        return origin is None or origin in allowed_origins

    def _static(self, raw_path: str) -> None:
        try:
            relative = Path(unquote(raw_path).lstrip("/"))
            if any(part in {"..", "."} for part in relative.parts):
                raise ValueError
            asset = self.server.static_assets.get(f"/{relative.as_posix()}")
            if asset is None:
                raise FileNotFoundError
        except (ValueError, FileNotFoundError, OSError):
            self._json(404, {"ok": False, "error": {"code": "NOT_FOUND", "message": "页面不存在。"}})
            return
        data, mime = asset
        self.send_response(200)
        self.send_header("Content-Type", f"{mime}; charset=utf-8" if mime.startswith("text/") or mime == "application/javascript" else mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'")
        self._security_headers(include_csp=False)
        self.end_headers()
        self.wfile.write(data)

    def _json(self, status: int, value: dict[str, Any]) -> None:
        data = (json.dumps(value, ensure_ascii=False) + "\n").encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self._security_headers()
        self.end_headers()
        self.wfile.write(data)

    def _security_headers(self, *, include_csp: bool = True) -> None:
        if include_csp:
            self.send_header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")

    def log_message(self, fmt: str, *args: Any) -> None:
        # Eight seat views poll this endpoint roughly once per second.  Those
        # successful reads are expected heartbeat traffic, not useful audit
        # events; logging all of them can grow worker logs by megabytes during
        # one lesson and bury the manual control actions we actually need.
        if self.command == "GET" and urlparse(self.path).path == "/api/state":
            return
        sys.stderr.write(f"[{self.log_date_time_string()}] {fmt % args}\n")


def iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def safe_error(exc: Exception) -> str:
    if isinstance(exc, ClassroomApiError):
        suffix = f" [{exc.code}]" if exc.code else ""
        return f"{str(exc)}{suffix}"[:800]
    return f"{type(exc).__name__}: {str(exc)}"[:800]


def log_exception_without_source(exc: BaseException) -> None:
    """Log stack locations without asking a cloud provider to hydrate source lines."""
    lines = ["Traceback (most recent call last):\n"]
    trace = exc.__traceback__
    while trace is not None:
        code = trace.tb_frame.f_code
        lines.append(f'  File "{code.co_filename}", line {trace.tb_lineno}, in {code.co_name}\n')
        trace = trace.tb_next
    lines.append(f"{type(exc).__name__}: {exc}\n")
    sys.stderr.write("".join(lines))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18765)
    parser.add_argument("--state-dir", type=Path, default=DEFAULT_STATE_DIR)
    parser.add_argument("--course-dir", type=Path, help="Durable course authoring directory (drafts/published/history)")
    parser.add_argument("--api-base", help="Existing local classroom worker, for example http://127.0.0.1:18887")
    parser.add_argument("--accounts", type=Path, help="Secret local account JSON used only by the server")
    parser.add_argument("--auth-session-url", help="Loopback classroom session endpoint used for mentor/admin RBAC")
    parser.add_argument("--service-key-file", type=Path, help="0600 key used by the Alpha console for read-only state sync")
    parser.add_argument("--public-origin", help="Exact external origin accepted for control POST requests")
    parser.add_argument("--public-base", default="/control/", help="External controller path used after login")
    parser.add_argument("--login-path", default="/auth/login", help="Same-origin login page for unauthenticated controllers")
    parser.add_argument("--fresh", action="store_true", help="Start a new controller state; does not delete classroom data")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.host not in {"127.0.0.1", "localhost"}:
        raise SystemExit("LIVE RUN controller may only bind loopback")
    auth_values = (args.auth_session_url, args.service_key_file, args.public_origin)
    if any(auth_values) and not all(auth_values):
        raise SystemExit("--auth-session-url, --service-key-file and --public-origin must be provided together")
    if args.public_origin:
        parsed_origin = urlparse(args.public_origin)
        if parsed_origin.scheme != "https" or not parsed_origin.netloc or parsed_origin.path not in {"", "/"}:
            raise SystemExit("--public-origin must be an HTTPS origin without a path")
    args.state_dir.mkdir(parents=True, exist_ok=True)
    os.chmod(args.state_dir, 0o700)
    state_path = args.state_dir / "run-state.json"
    if args.fresh and state_path.exists():
        state_path.rename(args.state_dir / f"run-state-{int(time.time())}.bak.json")
    api_factory = None
    if args.api_base or args.accounts:
        if not args.api_base or not args.accounts:
            raise SystemExit("--api-base and --accounts must be provided together")
        account_path = args.accounts.resolve()
        api_factory = lambda persisted, campaign_id: ClassroomApiAdapter(  # noqa: E731
            args.api_base, account_path, persisted, campaign_id=campaign_id,
        )
    course_dir = args.course_dir or (args.state_dir.parent / "courses")
    repository = CourseRepository(user_dir=course_dir)
    controller = CourseController(state_path, api_factory=api_factory, course_repository=repository)
    token = secrets.token_urlsafe(32)
    authorizer = None
    if args.auth_session_url:
        try:
            authorizer = SessionAuthorizer(args.auth_session_url, args.service_key_file)
        except (OSError, ValueError) as exc:
            raise SystemExit(f"controller authorization configuration is invalid: {exc}") from exc
    server = LiveRunServer(
        (args.host, args.port),
        controller,
        token,
        authorizer=authorizer,
        public_origin=args.public_origin,
        public_base=args.public_base,
        login_path=args.login_path,
    )
    print(f"LIVE_RUN_READY url=http://{args.host}:{args.port}/ mode={controller.state['apiMode']} run={controller.state['runId']}", flush=True)
    try:
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
