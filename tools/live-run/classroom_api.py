#!/usr/bin/env python3
"""Small, secret-safe client for the existing Mini Silicon Valley classroom API."""

from __future__ import annotations

import hashlib
import http.client
import json
import ssl
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


PHASES = [
    "lobby", "identity", "private-read", "intel-brief", "intel-network", "dm-gate",
    "pdmo", "challenge-one", "challenge-two", "growth", "history", "debrief", "completed",
]

# The compiled classroom Worker still validates the former build-time origin.
# These values are used only on the Hecate loopback hop to 127.0.0.1:18787;
# Gateway rewrites every browser-facing URL, redirect and Cookie to minisv.vip.
# Do not use this compatibility origin as a public entry point.
WORKER_COMPAT_ORIGIN = "https://work.cyberforker.com"
WORKER_COMPAT_HOST = "work.cyberforker.com"


def learner_evidence_boundary(card: dict[str, Any]) -> str:
    """Return the explicit F/R/G/U learner label for one dealt card."""
    title = str(card.get("title") or "").strip()
    text = f"{title} {card.get('body') or ''}"
    for code in ("F", "R", "G", "U"):
        if title.startswith((f"{code}-", f"{code} ", f"{code}·")):
            return code
    if title.startswith("C-") and card.get("sourceIds"):
        return "F"
    if any(marker in text for marker in (
        "课堂模拟", "玩家模拟", "角色模拟", "角色演练",
        "模拟用户", "模拟订单", "模拟收入", "模拟成本", "模拟投入", "模拟反馈",
    )):
        return "R"
    if card.get("kind") in {"viewpoint", "inference", "rumor"}:
        return "G"
    if card.get("sourceIds"):
        return "F"
    if any(marker in text for marker in ("当前未知", "还不知道", "暂时不知道", "现有信息无法回答")):
        return "U"
    return "U"


class ClassroomApiError(RuntimeError):
    def __init__(self, message: str, *, status: int | None = None, code: str | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code


@dataclass(frozen=True)
class Account:
    seat_id: str
    username: str
    password: str
    display_name: str
    kind: str


class HttpSession:
    def __init__(self, base_url: str, prefix: str = "/msv/demo/app") -> None:
        parsed = urlparse(base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError(f"invalid classroom base URL: {base_url}")
        self.scheme = parsed.scheme
        self.host = parsed.hostname
        self.port = parsed.port or (443 if parsed.scheme == "https" else 80)
        self.base_path = parsed.path.rstrip("/")
        self.forwarded_prefix = prefix.rstrip("/")
        self.cookie: str | None = None

    def request(self, method: str, path: str, body: Any | None = None, expected: int = 200) -> Any:
        connection_class = http.client.HTTPSConnection if self.scheme == "https" else http.client.HTTPConnection
        kwargs: dict[str, Any] = {"timeout": 25}
        if self.scheme == "https":
            kwargs["context"] = ssl.create_default_context()
        connection = connection_class(self.host, self.port, **kwargs)
        payload = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers = {
            "Accept": "application/json",
            "Host": WORKER_COMPAT_HOST,
            "X-Forwarded-Host": WORKER_COMPAT_HOST,
            "X-Forwarded-Proto": "https",
            "X-Forwarded-Prefix": self.forwarded_prefix,
            "User-Agent": "MSV-Live-Run-Controller/1.0",
        }
        if payload is not None:
            headers["Content-Type"] = "application/json"
            headers["Origin"] = WORKER_COMPAT_ORIGIN
            headers["Content-Length"] = str(len(payload))
        if self.cookie:
            headers["Cookie"] = self.cookie
        try:
            connection.request(method, f"{self.base_path}{path}", body=payload, headers=headers)
            response = connection.getresponse()
            raw = response.read()
            set_cookie = response.getheader("Set-Cookie")
            if set_cookie and set_cookie.startswith("__Secure-msv_session="):
                self.cookie = set_cookie.split(";", 1)[0]
            try:
                envelope = json.loads(raw.decode("utf-8")) if raw else {}
            except json.JSONDecodeError as exc:
                raise ClassroomApiError(
                    f"{method} {path} returned non-JSON HTTP {response.status}", status=response.status,
                ) from exc
            if response.status != expected:
                error = envelope.get("error") if isinstance(envelope, dict) else None
                code = error.get("code") if isinstance(error, dict) else None
                message = error.get("message") if isinstance(error, dict) else f"HTTP {response.status}"
                raise ClassroomApiError(f"{method} {path}: {message}", status=response.status, code=code)
            if isinstance(envelope, dict) and envelope.get("ok") is False:
                error = envelope.get("error") or {}
                raise ClassroomApiError(
                    f"{method} {path}: {error.get('message', 'API rejected request')}",
                    status=response.status,
                    code=error.get("code"),
                )
            return envelope.get("data") if isinstance(envelope, dict) else envelope
        finally:
            connection.close()


class ClassroomApiAdapter:
    """Drive one five-chapter room with four facilitator and four learner sessions."""

    def __init__(
        self,
        base_url: str,
        accounts_path: Path,
        persisted: dict[str, Any] | None = None,
        *,
        campaign_id: str = "google-1995-2004",
    ) -> None:
        self.base_url = base_url
        self.accounts_path = accounts_path
        self.campaign_id = campaign_id
        self.accounts = self._load_accounts(accounts_path)
        self.sessions = {account.seat_id: HttpSession(base_url) for account in self.accounts}
        self.room_id: str | None = (persisted or {}).get("roomId")
        self.team_public_id: str | None = (persisted or {}).get("teamPublicId")
        self.team_id: str | None = (persisted or {}).get("teamId")
        self.logged_in = False
        persisted_campaign = (persisted or {}).get("campaignId")
        if self.room_id and persisted_campaign and persisted_campaign != self.campaign_id:
            raise ValueError("persisted classroom campaign does not match selected LIVE RUN course")

    @staticmethod
    def _load_accounts(path: Path) -> list[Account]:
        data = json.loads(path.read_text(encoding="utf-8"))
        raw: list[tuple[str, dict[str, Any], str]] = [("mentor01", data["dm"], "mentor")]
        raw.extend((f"mentor{index:02d}", item, "mentor") for index, item in enumerate(data.get("mentors", []), 2))
        raw.extend((f"learner{index:02d}", item, "learner") for index, item in enumerate(data["learners"], 1))
        accounts = [
            Account(seat_id, item["username"], item["password"], item.get("name", item["username"]), kind)
            for seat_id, item, kind in raw
        ]
        if [a.seat_id for a in accounts] != [f"mentor{i:02d}" for i in range(1, 5)] + [f"learner{i:02d}" for i in range(1, 5)]:
            raise ValueError("account file must contain exactly four mentors and four learners")
        if len({a.username for a in accounts}) != 8:
            raise ValueError("account usernames must be unique")
        return accounts

    def export_refs(self) -> dict[str, Any]:
        return {"roomId": self.room_id, "teamPublicId": self.team_public_id, "teamId": self.team_id}

    def login_all(self) -> None:
        if self.logged_in:
            return
        for account in self.accounts:
            session = self.sessions[account.seat_id]
            data = session.request("POST", "/api/auth/login", {
                "mode": "password",
                "username": account.username,
                "password": account.password,
                "remember": False,
            })
            if data.get("user", {}).get("username") != account.username:
                raise ClassroomApiError(f"login identity mismatch for {account.seat_id}")
            actual_role = data.get("user", {}).get("role")
            accepted_roles = {"mentor", "admin"} if account.kind == "mentor" else {"learner"}
            if actual_role not in accepted_roles:
                raise ClassroomApiError(f"RBAC mismatch for {account.seat_id}")
        self.logged_in = True

    def execute(self, api_action: str, block: dict[str, Any]) -> dict[str, Any]:
        self.login_all()
        lead = block["leadMentorId"]
        operations = {
            "room-and-deal": lambda: self._room_and_deal(lead),
            "read-and-publish": self._read_and_publish,
            "finish-find-chapter": lambda: self._network_problem_challenge_finish(lead),
            "prepare-decide-value": lambda: self._prepare_chapter_to_pdmo(lead),
            "finish-decide-chapter": lambda: self._challenge_and_finish(lead),
            "prepare-build-mvp": lambda: self._prepare_chapter_to_pdmo(lead),
            "run-build-pressure": lambda: self._run_challenge_to_growth(lead),
            "finish-build-chapter": lambda: self._finish_from_growth(lead, advance=True),
            "prepare-market": lambda: self._prepare_chapter_to_pdmo(lead),
            "finish-market-chapter": lambda: self._challenge_and_finish(lead),
            "prepare-operations": lambda: self._prepare_chapter_to_pdmo(lead),
            "run-operations-and-freeze": lambda: self._challenge_then_finish_final(lead),
            "submit-demo-and-complete": lambda: self._submit_demo(lead),
        }
        if api_action not in operations:
            raise ClassroomApiError(f"unknown API action {api_action}")
        operations[api_action]()
        return self.snapshot(lead)

    def _session(self, seat_id: str) -> HttpSession:
        return self.sessions[seat_id]

    def _action(self, seat_id: str, body: dict[str, Any]) -> Any:
        if not self.room_id:
            raise ClassroomApiError("room has not been created")
        return self._session(seat_id).request("POST", f"/api/classroom/rooms/{self.room_id}/actions", body)

    def _key(self, label: str, chapter_order: int | None = None) -> str:
        """Return a stable idempotency key for a real classroom side effect.

        Controller retries must resume the same classroom rather than award
        money or score twice.  The room and chapter make a deterministic key
        unique without storing credentials or opaque server state.
        """
        if not self.room_id:
            raise ClassroomApiError("room has not been created")
        order = chapter_order if chapter_order is not None else self._room("mentor01")["chapter"]["order"]
        digest = hashlib.sha256(f"{self.room_id}:{order}:{label}".encode("utf-8")).hexdigest()[:32]
        return f"msvlive:{digest}"

    def _room(self, seat_id: str) -> dict[str, Any]:
        if not self.room_id:
            raise ClassroomApiError("room has not been created")
        return self._session(seat_id).request("GET", f"/api/classroom/rooms/{self.room_id}")

    def _next(self, mentor: str) -> None:
        self._action(mentor, {"type": "move-phase", "direction": "next"})

    def _room_and_deal(self, mentor: str) -> None:
        if not self.room_id:
            labels = {
                "google-1995-2004": "Google 五步创业闭环",
                "eleme-2008-find-problem": "2008 宿舍订餐五步创业闭环",
            }
            created = self._session(mentor).request("POST", "/api/classroom/rooms", {
                "title": f"LIVE RUN {labels.get(self.campaign_id, self.campaign_id)} {time.strftime('%m%d-%H%M')}",
                "campaignId": self.campaign_id,
            })
            self.room_id = created["roomId"]
            self.team_public_id = created["teamPublicId"]
            for account in self.accounts[1:4]:
                self._action(mentor, {"type": "assign-facilitator", "username": account.username})
            request_ids = []
            for learner in self.accounts[4:]:
                joined = self._session(learner.seat_id).request(
                    "POST", "/api/classroom/join", {"teamPublicId": self.team_public_id},
                )
                request_ids.append(joined["requestId"])
            for request_id in request_ids:
                self._action(mentor, {"type": "decide-join-request", "requestId": request_id, "decision": "approve"})

        room = self._room(mentor)
        self.team_id = room["room"]["teams"][0]["id"]
        if room["room"]["phase"] == "lobby":
            self._action(mentor, {"type": "assign-and-deal"})
        self._assert_roster_and_deal()

    def _assert_roster_and_deal(self) -> None:
        room = self._room("mentor01")
        members = room["members"]
        if len([m for m in members if m["role"] == "dm"]) != 4:
            raise ClassroomApiError("expected four room facilitators")
        if len([m for m in members if m["role"] == "learner"]) != 4:
            raise ClassroomApiError("expected four learners")
        if any(m.get("pdmoRole") for m in members if m["role"] == "learner"):
            raise ClassroomApiError("learners must not be assigned P/D/M/O")
        learner_rooms = [self._room(f"learner{i:02d}") for i in range(1, 5)]
        card_ids = [card["id"] for state in learner_rooms for card in state["myCards"]]
        if len(card_ids) != 12 or len(set(card_ids)) != 12:
            raise ClassroomApiError("server deal must produce twelve unique cards")
        if any(len(state["myCards"]) != 3 for state in learner_rooms):
            raise ClassroomApiError("each learner must receive three random cards")

    def _read_and_publish(self) -> None:
        room = self._room("mentor01")
        phase = room["room"]["phase"]
        if phase == "identity":
            self._next("mentor01")
        for index in range(1, 5):
            seat = f"learner{index:02d}"
            state = self._room(seat)
            for card in state["myCards"]:
                self._action(seat, {"type": "set-card-state", "cardId": card["id"], "state": "read"})
                self._action(seat, {"type": "set-card-state", "cardId": card["id"], "state": "published"})
        phase = self._room("mentor01")["room"]["phase"]
        if phase == "private-read":
            self._next("mentor01")
            phase = "intel-brief"
        if phase == "intel-brief":
            self._next("mentor01")
        if self._room("mentor01")["room"]["phase"] != "intel-network":
            raise ClassroomApiError("expected intel-network after card exchange")

    def _network_and_problem(self, mentor: str) -> None:
        state = self._room("learner01")
        if PHASES.index(state["room"]["phase"]) > PHASES.index("pdmo"):
            # A failed controller snapshot can leave the underlying classroom
            # farther ahead than its persisted public state.  Retrying must be
            # resumable rather than attempting to walk backwards.
            return
        if state["room"]["phase"] == "intel-network" and len(state["intelligence"]["nodes"]) < 4:
            cards = state["intelligence"]["publishedCards"]
            source = [card for card in cards if card.get("sourceIds")]
            selected = source[:2] + [card for card in cards if card not in source[:2]]
            selected = selected[:4]
            if len(selected) < 4 or len(source) < 2:
                raise ClassroomApiError("insufficient published source cards for intelligence gate")
            chapter_order = state["chapter"]["order"]
            definitions = [
                ("user", f"S{chapter_order} 目标用户", "一个处在具体任务场景中的明确用户"),
                ("need", f"S{chapter_order} 场景损失", "当前替代方式造成可观察的时间与质量损失"),
                ("constraint", f"S{chapter_order} 关键约束", "团队必须在有限时间、资源与信任边界内行动"),
                ("evidence", f"S{chapter_order} 来源证据", "已发布信息支持当前判断但仍需要反证"),
            ]
            for card, (kind, title, explanation) in zip(selected, definitions, strict=True):
                self._action("learner01", {
                    "type": "create-intelligence-node", "kind": kind, "title": title,
                    "explanation": explanation, "sourceCardIds": [card["id"]],
                })
            state = self._room("learner01")
            ids = {node["title"]: node["id"] for node in state["intelligence"]["nodes"]}
            self._action("learner01", {
                "type": "create-intelligence-edge", "fromNodeId": ids[f"S{chapter_order} 目标用户"],
                "toNodeId": ids[f"S{chapter_order} 场景损失"], "kind": "causes",
                "explanation": "用户任务受阻直接产生可观察损失",
            })
            self._action("learner01", {
                "type": "create-intelligence-edge", "fromNodeId": ids[f"S{chapter_order} 关键约束"],
                "toNodeId": ids[f"S{chapter_order} 场景损失"], "kind": "limits",
                "explanation": "资源与信任约束限制当前解决路径",
            })
        if self._room(mentor)["room"]["phase"] == "intel-network":
            self._next(mentor)
        if self._room(mentor)["room"]["phase"] == "dm-gate":
            order = self._room(mentor)["chapter"]["order"]
            self._action("learner01", {
                "type": "submit-problem-statement",
                "user": f"第{order}步中的具体目标用户",
                "sceneLoss": "用户在当前任务中持续付出额外时间，并承受可观察的结果质量损失",
                "evidenceSummary": "两条有来源节点与一条限制关系共同支持该判断",
                "unknown": "还不确定该损失在更大样本里是否同样频繁",
                "decisionQuestion": "下一轮哪项最小行动最能验证核心因果关系",
            })
            self._next(mentor)
        if self._room(mentor)["room"]["phase"] != "pdmo":
            raise ClassroomApiError("expected pdmo handoff phase")
        members = self._room(mentor)["members"]
        if any(member.get("pdmoRole") for member in members if member["role"] == "learner"):
            raise ClassroomApiError("student P/D/M/O must remain optional and unused in this run")

    def _prepare_chapter_to_pdmo(self, mentor: str) -> None:
        if self._room(mentor)["room"]["phase"] == "lobby":
            self._action(mentor, {"type": "assign-and-deal"})
        self._assert_roster_and_deal()
        self._read_and_publish()
        self._network_and_problem(mentor)

    def _submit_challenge_action(self, learner: str, index: int, second: bool) -> None:
        suffix = "并缩小范围" if second else ""
        self._action(learner, {
            "type": "submit-challenge-action",
            "goal": f"完成第{index}项可观察验证{suffix}",
            "method": f"{'根据压力反馈改用对照测试' if second else '用小规模原型执行测试'} {index}",
            "evidence": f"{'补充反证' if second else '引用团队节点'} {index}",
            "resource": "一小时与一份原型",
            "successSignal": f"至少获得{index + (1 if second else 0)}个可观察信号",
            "stopCondition": "达到判断阈值或连续两次无新增信号时停止",
        })

    def _run_challenge_to_growth(self, mentor: str) -> None:
        phase = self._room(mentor)["room"]["phase"]
        if phase == "pdmo":
            self._next(mentor)
            phase = "challenge-one"
        if phase == "challenge-one":
            state = self._room(mentor)
            if not state.get("challenge"):
                self._action(mentor, {
                    "type": "select-challenge", "teamId": self.team_id,
                    "challengeId": state["chapter"]["challenges"][0]["id"],
                })
                self._action(mentor, {"type": "roll-pressure", "teamId": self.team_id})
            for index in range(1, 5):
                self._submit_challenge_action(f"learner{index:02d}", index, False)
            self._next(mentor)
            phase = "challenge-two"
        if phase == "challenge-two":
            for index in range(1, 5):
                self._submit_challenge_action(f"learner{index:02d}", index, True)
            self._action(mentor, {
                "type": "score-challenge", "teamId": self.team_id,
                "rubric": {"evidence": 1, "logic": 1, "execution": 1, "collaboration": 1},
                "consequence": "", "idempotencyKey": self._key("challenge-score"),
            })
            self._next(mentor)
        state = self._room(mentor)
        if state["room"]["phase"] != "growth":
            raise ClassroomApiError("expected growth after challenge settlement")
        challenge = state.get("challenge") or {}
        current_round = challenge.get("round")
        # At growth the API intentionally returns the audit trail for both
        # rounds.  The gate concerns the four contributions in the current
        # round, not the eight historical rows across rounds one and two.
        actions = [action for action in challenge.get("actions", []) if action.get("round") == current_round]
        if len(actions) != 4 or any(action.get("pdmo_role") != "TEAM" for action in actions):
            raise ClassroomApiError("challenge contributions must be recorded as four TEAM actions")
        learner_members = [member for member in state["members"] if member["role"] == "learner"]
        for member in learner_members:
            try:
                self._action(mentor, {
                    "type": "award-reputation", "memberId": member["id"],
                    "scores": {"evidence": 1, "modeling": 0, "delivery": 1, "support": 0, "iteration": 0, "responsibility": 0},
                    "evidenceObjectId": self._key(f"team-action:{member['id']}"),
                    "reason": "引用来源并完成两轮可验证团队行动",
                })
            except ClassroomApiError as exc:
                # The reputation endpoint deliberately rejects a duplicate
                # evidence object.  Treat exactly that response as a replay;
                # every other failure must remain visible to the controller.
                if exc.code != "REPUTATION_ALREADY_AWARDED":
                    raise
        self._action(mentor, {
            "type": "record-paper-ledger", "teamId": self.team_id, "flow": "inflow",
            "category": "user-validation", "amountTenths": 10,
            "reason": "LIVE RUN 记录一项有证据的用户验证收入", "idempotencyKey": self._key("validation-income"),
        })
        self._action(mentor, {
            "type": "record-paper-ledger", "teamId": self.team_id, "flow": "outflow",
            "category": "research", "amountTenths": 5,
            "reason": "LIVE RUN 记录本轮调研材料成本", "idempotencyKey": self._key("research-cost"),
        })

    def _finish_from_growth(self, mentor: str, *, advance: bool) -> None:
        if self._room(mentor)["room"]["phase"] == "growth":
            order = self._room(mentor)["chapter"]["order"]
            self._action("learner01", {
                "type": "freeze-worldline", "teamId": self.team_id,
                "decision": f"第{order}步只执行一个最小可验证行动",
                "rationale": "团队依据来源证据、明确约束和两轮行动形成共同判断",
            })
            self._next(mentor)
        if self._room(mentor)["room"]["phase"] == "history":
            self._action(mentor, {"type": "reveal-history"})
            self._next(mentor)
        if self._room(mentor)["room"]["phase"] == "debrief":
            order = self._room(mentor)["chapter"]["order"]
            for index in range(1, 5):
                self._action(f"learner{index:02d}", {
                    "type": "submit-reflection",
                    "answers": [f"第{order}步学员{index}对复盘问题{q}的证据回答" for q in range(1, 7)],
                    "realityAction": f"学员{index}将在 48 小时内提交一份可验收现实作品",
                })
            if advance:
                self._action(mentor, {"type": "next-chapter"})

    def _challenge_and_finish(self, mentor: str) -> None:
        self._run_challenge_to_growth(mentor)
        self._finish_from_growth(mentor, advance=True)

    def _network_problem_challenge_finish(self, mentor: str) -> None:
        self._network_and_problem(mentor)
        self._challenge_and_finish(mentor)

    def _challenge_then_finish_final(self, mentor: str) -> None:
        self._run_challenge_to_growth(mentor)
        self._settle_operations_and_personal_wallets(mentor)
        self._finish_from_growth(mentor, advance=False)
        state = self._room(mentor)
        if state["chapter"]["order"] != state["campaign"]["chapterCount"] or state["room"]["phase"] != "debrief":
            raise ClassroomApiError("final operations block must stop at the final chapter debrief")

    def _settle_operations_and_personal_wallets(self, mentor: str) -> None:
        """Make B12's team money and personal money loop real and visible.

        The ordinary challenge creates a small validation income.  Operations
        also records fulfilled orders and delivery cost, then distributes 40%
        of this chapter's distributable profit.  RP remains individual social
        credit; the wallet is actual individual game currency; the remaining
        money stays in the team treasury.  No automatic purchase is made for a
        learner, so personal choice is preserved.
        """
        state = self._room(mentor)
        if state["room"]["phase"] != "growth" or state["chapter"]["order"] != state["campaign"]["chapterCount"]:
            raise ClassroomApiError("personal settlement requires final-chapter growth")
        self._action(mentor, {
            "type": "record-paper-ledger", "teamId": self.team_id, "flow": "inflow",
            "category": "asset-revenue", "amountTenths": 60,
            "reason": "B12 记录六笔已完成的模拟订单收入",
            "idempotencyKey": self._key("operations-orders"),
        })
        self._action(mentor, {
            "type": "record-paper-ledger", "teamId": self.team_id, "flow": "outflow",
            "category": "operations", "amountTenths": 10,
            "reason": "B12 记录订单交付所用的材料与现场运营成本",
            "idempotencyKey": self._key("operations-cost"),
        })
        members = [item for item in state["members"] if item["role"] == "learner"]
        for index, seat in enumerate([f"learner{i:02d}" for i in range(1, 5)]):
            target = members[(index + 1) % len(members)]
            self._action(seat, {
                "type": "gratitude-vote", "toMemberId": target["id"],
                "reason": "在 B12 交付中给出了一项可核验的团队支撑",
            })
        self._action(mentor, {
            "type": "distribute-profit", "teamId": self.team_id, "percent": 40,
            "idempotencyKey": self._key("profit-distribution-40"),
        })

    def _submit_demo(self, mentor: str) -> None:
        state = self._room(mentor)
        if state["room"]["phase"] != "debrief" or state["chapter"]["order"] != state["campaign"]["chapterCount"]:
            raise ClassroomApiError("Demo Day requires the final chapter debrief")
        segments = state["catalog"]["demoDay"]["segments"]
        title = "2008 宿舍订餐五步闭环六分钟发布" if self.campaign_id == "eleme-2008-find-problem" else "Young Builder 六分钟五步闭环发布"
        self._action("learner01", {
            "type": "submit-demo-day", "title": title,
            "segmentNotes": [f"第{index}段：引用本次战役作品证明 {segment['requirement']}" for index, segment in enumerate(segments, 1)],
        })
        self._action(mentor, {"type": "next-chapter"})
        if self._room(mentor)["room"]["phase"] != "completed":
            raise ClassroomApiError("campaign did not reach completed")

    def snapshot(self, lead: str = "mentor01") -> dict[str, Any]:
        if not self.room_id:
            return {"apiBacked": True, "roomId": None, "status": "not-created"}
        state = self._room(lead)
        if state["campaign"]["id"] != self.campaign_id:
            raise ClassroomApiError("classroom campaign does not match selected LIVE RUN course")
        learner_states = [self._room(f"learner{i:02d}") for i in range(1, 5)]
        challenge = state.get("challenge") or {}
        current_actions = [
            action for action in challenge.get("actions", [])
            if action.get("round") == challenge.get("round")
        ]
        economy = state.get("economy") or {}
        learner_views = {
            f"learner{index:02d}": self._learner_view(item)
            for index, item in enumerate(learner_states, 1)
        }
        return {
            "apiBacked": True,
            "roomId": self.room_id,
            "teamPublicId": self.team_public_id,
            "campaignId": state["campaign"]["id"],
            "chapterOrder": state["chapter"]["order"],
            "chapterCount": state["campaign"]["chapterCount"],
            "chapterStage": state["chapter"]["stage"],
            "phase": state["room"]["phase"],
            "roomStatus": state["room"]["status"],
            # Current classroom payloads do not all expose an optimistic
            # version.  Keep the controller schema stable without inventing a
            # data dependency the API never promised.
            "roomVersion": int(state["room"].get("version", 0)),
            "mentorCount": len([member for member in state["members"] if member["role"] == "dm"]),
            "learnerCount": len([member for member in state["members"] if member["role"] == "learner"]),
            "learnerPdmoCount": len([member for member in state["members"] if member["role"] == "learner" and member.get("pdmoRole")]),
            "cardsPerLearner": [len(item["myCards"]) for item in learner_states],
            "uniqueDealtCards": len({card["id"] for item in learner_states for card in item["myCards"]}),
            "publishedCards": len(state["intelligence"]["publishedCards"]),
            "intelligenceNodes": len(state["intelligence"]["nodes"]),
            "intelligenceEdges": len(state["intelligence"]["edges"]),
            "challengeRound": challenge.get("round"),
            "challengeActions": len(current_actions),
            "allChallengeActionsTeam": all(action.get("pdmo_role") == "TEAM" for action in current_actions),
            "teamTreasuryTenths": economy.get("teamTreasuryTenths", 0),
            "chapterRevenueTenths": economy.get("chapterRevenueTenths", 0),
            "chapterCostTenths": economy.get("chapterCostTenths", 0),
            # Facilitators can always inspect the answer key.  The public run
            # snapshot must reflect what learners can actually see, otherwise
            # the controller would claim history was revealed too early.
            "historyRevealed": bool(learner_states[0]["chapter"].get("historyReveal")),
            "worldlineEntries": len(state.get("worldline", [])),
            "completed": state["room"]["phase"] == "completed",
            "learnerViews": learner_views,
        }

    @staticmethod
    def _learner_view(state: dict[str, Any]) -> dict[str, Any]:
        """Copy learner-visible game data without DM secrets or auth state."""
        viewer = state.get("viewer") or {}
        identity = state.get("myIdentity") or {}
        chapter = state.get("chapter") or {}
        guide = chapter.get("studentGuide") or {}
        challenge = state.get("challenge") or {}
        selected = challenge.get("selected") or {}
        pressure = challenge.get("pressureEvent") or challenge.get("pressure") or {}
        reality = chapter.get("realityMission") or {}
        own_evidence = [
            item for item in state.get("reputationEvidence", [])
            if item.get("memberId") == viewer.get("memberId")
        ]
        recent_reputation = None
        if own_evidence:
            evidence_id = own_evidence[0].get("evidenceObjectId")
            same_work = [item for item in own_evidence if item.get("evidenceObjectId") == evidence_id]
            recent_reputation = {
                "points": sum(int(item.get("points") or 0) for item in same_work),
                "reason": same_work[0].get("reason"),
            }
        wallet_rows = [
            item for item in (state.get("economy") or {}).get("ledger", [])
            if item.get("fromLabel") == "我的钱包" or item.get("toLabel") == "我的钱包"
        ]
        recent_wallet = None
        if wallet_rows:
            item = wallet_rows[0]
            recent_wallet = {
                "amountTenths": int(item.get("amountTenths") or 0),
                "direction": "in" if item.get("toLabel") == "我的钱包" else "out",
                "reason": item.get("reason"),
            }
        return {
            "displayName": viewer.get("nickname"),
            "reputation": int(viewer.get("reputation") or 0),
            "walletTenths": int(viewer.get("walletTenths") or 0),
            "unlockIds": list(viewer.get("unlockIds") or []),
            "recentReputation": recent_reputation,
            "recentWallet": recent_wallet,
            "identity": {
                "name": identity.get("name"),
                "publicGoal": identity.get("publicGoal"),
                "ability": identity.get("ability"),
                "privateConcern": identity.get("privateConcern"),
            } if identity else None,
            "cards": [
                {
                    "id": card.get("id"),
                    "title": card.get("title"),
                    "body": card.get("body"),
                    "sharePrompt": card.get("sharePrompt"),
                    "credibility": card.get("credibility"),
                    "evidenceBoundary": learner_evidence_boundary(card),
                    "state": card.get("state"),
                }
                for card in state.get("myCards", [])
            ],
            "scene": guide.get("scene"),
            "chapterSteps": list(guide.get("steps") or []),
            "chapterDoneWhen": guide.get("doneWhen"),
            "realityMission": {
                "title": reality.get("title"),
                "deliverable": reality.get("deliverable"),
            } if reality else None,
            "challenge": {
                "round": challenge.get("round"),
                "title": challenge.get("title") or selected.get("title"),
                "prompt": challenge.get("prompt") or selected.get("prompt"),
                "pressure": pressure.get("title") or pressure.get("prompt") or pressure.get("description"),
            } if challenge else None,
        }
