"""Validated, file-backed course packages for Mini Silicon Valley LIVE RUN."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import secrets
import threading
import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
COURSE_ASSETS = ROOT / "courses"
DEFAULT_COURSE_ID = "google-1995-2004"
COURSE_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{2,63}$")
STEP_IDS = ("find", "decide", "build", "market", "operate")
STEP_BLOCKS = (("B01", "B02", "B03"), ("B04", "B05"), ("B06", "B07", "B08"), ("B09", "B10"), ("B11", "B12", "B13"))
DECK_DRAW_BLOCKS = ("B01", "B04", "B06", "B09", "B11")
LEARNER_SEAT_IDS = ("learner01", "learner02", "learner03", "learner04")
EVIDENCE_BOUNDARIES = frozenset({"F", "R", "G", "U"})
COURSE_SCHEMA_VERSION = 1
BASELINE_DECK_COUNT = len(STEP_IDS)
BASELINE_CARDS_PER_DECK = len(LEARNER_SEAT_IDS) * 3
BASELINE_CARD_COUNT = BASELINE_DECK_COUNT * BASELINE_CARDS_PER_DECK
SEAT_IDS = ("mentor01", "mentor02", "mentor03", "mentor04", "learner01", "learner02", "learner03", "learner04")
API_ACTIONS = (
    "room-and-deal", "read-and-publish", "finish-find-chapter",
    "prepare-decide-value", "finish-decide-chapter", "prepare-build-mvp",
    "run-build-pressure", "finish-build-chapter", "prepare-market",
    "finish-market-chapter", "prepare-operations", "run-operations-and-freeze",
    "submit-demo-and-complete",
)
GAME_MODES = frozenset({"yarn", "american", "euro"})
SPOTLIGHT_STATES = frozenset({"active", "support", "standby"})
AUTHORING_STATES = frozenset({"draft", "published", "candidate", "released", "retired"})
SUPPORTED_RUNTIME_CAMPAIGNS = frozenset({"google-1995-2004", "eleme-2008-find-problem"})
BUNDLED_FILES = (ROOT / "live-run-script.json", ROOT / "live-run-script-eleme.json")


def _error(path: str, message: str) -> ValueError:
    return ValueError(f"{path}: {message}")


def _object(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict): raise _error(path, "must be an object")
    return value


def _array(value: Any, path: str, *, nonempty: bool = False) -> list[Any]:
    if not isinstance(value, list): raise _error(path, "must be an array")
    if nonempty and not value: raise _error(path, "must not be empty")
    return value


def _string(value: Any, path: str, *, max_length: int = 12_000) -> str:
    if not isinstance(value, str) or not value.strip(): raise _error(path, "must be a non-empty string")
    if len(value) > max_length: raise _error(path, f"must not exceed {max_length} characters")
    return value


def _string_array(value: Any, path: str, *, nonempty: bool = True) -> list[str]:
    items = _array(value, path, nonempty=nonempty)
    for index, item in enumerate(items): _string(item, f"{path}[{index}]")
    return items


def validate_script(script: Any) -> dict[str, Any]:
    """Validate one executable five-step / thirteen-block course package."""
    script = _object(script, "$")
    for key in ("schemaVersion", "id", "title", "course", "case", "sources", "decks", "formula", "macroSteps", "blocks", "rules"):
        if key not in script: raise _error(f"$.{key}", "missing required field")
    if script["schemaVersion"] != COURSE_SCHEMA_VERSION: raise _error("$.schemaVersion", f"must equal {COURSE_SCHEMA_VERSION}")
    _string(script["id"], "$.id"); _string(script["title"], "$.title")

    course = _object(script["course"], "$.course")
    course_keys = ("id", "name", "period", "coverage", "description", "learnerName", "scriptId", "macroStepCount", "blockCount", "completeFiveStep")
    for key in course_keys:
        if key not in course: raise _error(f"$.course.{key}", "missing required field")
    course_id = _string(course["id"], "$.course.id", max_length=64)
    if not COURSE_ID_PATTERN.fullmatch(course_id): raise _error("$.course.id", "must use 3-64 lowercase letters, digits, or hyphens")
    for key in ("name", "period", "coverage", "description", "learnerName", "scriptId"): _string(course[key], f"$.course.{key}")
    if course["macroStepCount"] != 5: raise _error("$.course.macroStepCount", "must equal 5")
    if course["blockCount"] != 13: raise _error("$.course.blockCount", "must equal 13")
    if course["completeFiveStep"] is not True: raise _error("$.course.completeFiveStep", "must be true")

    case = _object(script["case"], "$.case")
    for key in ("campaignId", "name", "learnerName", "period", "why"):
        if key not in case: raise _error(f"$.case.{key}", "missing required field")
        _string(case[key], f"$.case.{key}")
    if case["campaignId"] not in SUPPORTED_RUNTIME_CAMPAIGNS:
        raise _error("$.case.campaignId", "must select an installed classroom content base: " + ", ".join(sorted(SUPPORTED_RUNTIME_CAMPAIGNS)))

    sources = _array(script["sources"], "$.sources", nonempty=True)
    source_ids: set[str] = set()
    for index, value in enumerate(sources):
        path = f"$.sources[{index}]"; source = _object(value, path)
        for key in ("id", "title", "organization", "url", "kind", "accessed"):
            _string(source.get(key), f"{path}.{key}")
        parsed_url = urlparse(source["url"])
        if parsed_url.scheme not in {"https", "http"} or not parsed_url.netloc:
            raise _error(f"{path}.url", "must be an absolute http(s) source URL")
        source_id = source["id"]
        if source_id in source_ids: raise _error(f"{path}.id", "must be unique")
        source_ids.add(source_id)

    decks = _array(script["decks"], "$.decks")
    if len(decks) != 5: raise _error("$.decks", "must contain exactly one deck for every macro step")
    global_card_ids: set[str] = set()
    for index, value in enumerate(decks):
        path = f"$.decks[{index}]"; deck = _object(value, path)
        for key in ("id", "macroStepId", "drawAtBlockId", "cardsPerLearner", "uniqueDeal", "shuffle", "cards"):
            if key not in deck: raise _error(f"{path}.{key}", "missing required field")
        _string(deck["id"], f"{path}.id")
        if deck["macroStepId"] != STEP_IDS[index]: raise _error(f"{path}.macroStepId", f"must equal {STEP_IDS[index]!r}")
        if deck["drawAtBlockId"] != DECK_DRAW_BLOCKS[index]: raise _error(f"{path}.drawAtBlockId", f"must equal {DECK_DRAW_BLOCKS[index]!r}")
        if deck["cardsPerLearner"] != 3: raise _error(f"{path}.cardsPerLearner", "must equal 3")
        if deck["uniqueDeal"] is not True: raise _error(f"{path}.uniqueDeal", "must be true")
        if deck["shuffle"] is not True: raise _error(f"{path}.shuffle", "must be true")
        cards = _array(deck["cards"], f"{path}.cards")
        required_count = len(LEARNER_SEAT_IDS) * deck["cardsPerLearner"]
        if len(cards) < required_count: raise _error(f"{path}.cards", f"must contain at least {required_count} cards for a unique 4 x 3 deal")
        local_card_ids: set[str] = set()
        for card_index, card_value in enumerate(cards):
            card_path = f"{path}.cards[{card_index}]"; card = _object(card_value, card_path)
            for key in ("id", "boundary", "title", "body", "sharePrompt", "sourceIds"):
                if key not in card: raise _error(f"{card_path}.{key}", "missing required field")
            card_id = _string(card["id"], f"{card_path}.id")
            if card_id in local_card_ids: raise _error(f"{card_path}.id", "must be unique within the deck")
            if card_id in global_card_ids: raise _error(f"{card_path}.id", "must be unique within the whole course")
            local_card_ids.add(card_id); global_card_ids.add(card_id)
            if card["boundary"] not in EVIDENCE_BOUNDARIES: raise _error(f"{card_path}.boundary", "must be F, R, G, or U")
            for key in ("title", "body", "sharePrompt"): _string(card[key], f"{card_path}.{key}")
            references = _string_array(card["sourceIds"], f"{card_path}.sourceIds", nonempty=False)
            unknown = sorted(set(references) - source_ids)
            if unknown: raise _error(f"{card_path}.sourceIds", "contains unknown sources: " + ", ".join(unknown))
            if card["boundary"] == "F" and not references: raise _error(f"{card_path}.sourceIds", "F · Fact cards must cite at least one course source")

    formula = _object(script["formula"], "$.formula")
    for key in ("oneWorld", "twoDualTracks", "threeGameModes", "fourMentors", "fiveSteps", "sixMinuteDemo"):
        if key not in formula: raise _error(f"$.formula.{key}", "missing required field")
    _string(formula["oneWorld"], "$.formula.oneWorld")
    if len(_string_array(formula["twoDualTracks"], "$.formula.twoDualTracks")) != 2: raise _error("$.formula.twoDualTracks", "must contain exactly 2 tracks")
    modes = _array(formula["threeGameModes"], "$.formula.threeGameModes")
    if [item.get("id") for item in modes if isinstance(item, dict)] != ["yarn", "american", "euro"]: raise _error("$.formula.threeGameModes", "must preserve yarn, american, euro in order")
    mentors = _array(formula["fourMentors"], "$.formula.fourMentors")
    if [item.get("id") for item in mentors if isinstance(item, dict)] != list(SEAT_IDS[:4]): raise _error("$.formula.fourMentors", "must preserve mentor01 through mentor04 in order")
    five_steps = _array(formula["fiveSteps"], "$.formula.fiveSteps")
    if [item.get("id") for item in five_steps if isinstance(item, dict)] != list(STEP_IDS): raise _error("$.formula.fiveSteps", "must preserve the complete five-step sequence")
    _string(formula["sixMinuteDemo"], "$.formula.sixMinuteDemo")

    steps = _array(script["macroSteps"], "$.macroSteps")
    blocks = _array(script["blocks"], "$.blocks")
    if len(steps) != 5: raise _error("$.macroSteps", "must contain exactly 5 items")
    if len(blocks) != 13: raise _error("$.blocks", "must contain exactly 13 items")
    for index, value in enumerate(steps):
        path = f"$.macroSteps[{index}]"; step = _object(value, path)
        for key in ("id", "order", "name", "mentorSequence", "question", "exitGate", "blocks"):
            if key not in step: raise _error(f"{path}.{key}", "missing required field")
        if step["id"] != STEP_IDS[index] or step["order"] != index + 1: raise _error(path, "must use the complete ordered five-step sequence")
        for key in ("name", "question", "exitGate"): _string(step[key], f"{path}.{key}")
        sequence = _string_array(step["mentorSequence"], f"{path}.mentorSequence")
        if any(item not in SEAT_IDS[:4] for item in sequence): raise _error(f"{path}.mentorSequence", "contains an unknown mentor seat")
        if step["blocks"] != list(STEP_BLOCKS[index]): raise _error(f"{path}.blocks", "must preserve the standard allocation and reference every block exactly once")

    for index, value in enumerate(blocks):
        path = f"$.blocks[{index}]"; block = _object(value, path)
        required = ("id", "macroStepId", "macroStepOrder", "order", "title", "leadMentorId", "suggestedMinutes", "gameModes", "apiAction", "underlyingClassroomPhases", "historyTrack", "realityTrack", "studentPrompt", "mentorScript", "studentActions", "systemActions", "props", "evidenceGate", "fallback", "manualInteraction", "learnerLens", "seatTasks")
        for key in required:
            if key not in block: raise _error(f"{path}.{key}", "missing required field")
        expected_id = f"B{index + 1:02d}"
        if block["id"] != expected_id: raise _error(f"{path}.id", f"must equal {expected_id}")
        step_index = next(i for i, group in enumerate(STEP_BLOCKS) if expected_id in group)
        if block["macroStepId"] != STEP_IDS[step_index] or block["macroStepOrder"] != step_index + 1: raise _error(f"{path}.macroStepId", "does not match the standard macro step")
        if block["order"] != index + 1: raise _error(f"{path}.order", f"must equal {index + 1}")
        if block["apiAction"] != API_ACTIONS[index]: raise _error(f"{path}.apiAction", f"must equal the safe runtime action {API_ACTIONS[index]!r}")
        if block["leadMentorId"] not in SEAT_IDS[:4]: raise _error(f"{path}.leadMentorId", "must be mentor01 through mentor04")
        if not isinstance(block["suggestedMinutes"], int) or not 1 <= block["suggestedMinutes"] <= 180: raise _error(f"{path}.suggestedMinutes", "must be an integer from 1 to 180")
        game_modes = _string_array(block["gameModes"], f"{path}.gameModes")
        if any(item not in GAME_MODES for item in game_modes) or len(set(game_modes)) != len(game_modes): raise _error(f"{path}.gameModes", "must contain unique yarn, american, and/or euro values")
        _string_array(block["underlyingClassroomPhases"], f"{path}.underlyingClassroomPhases")
        for key in ("title", "historyTrack", "realityTrack", "studentPrompt", "manualInteraction"): _string(block[key], f"{path}.{key}")
        for key in ("mentorScript", "studentActions", "systemActions", "props", "evidenceGate", "fallback"): _string_array(block[key], f"{path}.{key}")
        lens = _object(block["learnerLens"], f"{path}.learnerLens")
        for key in ("world", "say", "ask", "done"): _string(lens.get(key), f"{path}.learnerLens.{key}")
        tasks = _object(block["seatTasks"], f"{path}.seatTasks")
        missing = [seat for seat in SEAT_IDS if seat not in tasks]
        if missing: raise _error(f"{path}.seatTasks", "missing seats: " + ", ".join(missing))
        extra = sorted(set(tasks) - set(SEAT_IDS))
        if extra: raise _error(f"{path}.seatTasks", "unknown seats: " + ", ".join(extra))
        for seat_id in SEAT_IDS:
            task = _object(tasks[seat_id], f"{path}.seatTasks.{seat_id}")
            if task.get("state") not in SPOTLIGHT_STATES: raise _error(f"{path}.seatTasks.{seat_id}.state", "must be active, support, or standby")
            _string(task.get("badge"), f"{path}.seatTasks.{seat_id}.badge"); _string(task.get("task"), f"{path}.seatTasks.{seat_id}.task")
        active_mentors = [seat_id for seat_id in SEAT_IDS[:4] if tasks[seat_id]["state"] == "active"]
        if active_mentors != [block["leadMentorId"]]:
            raise _error(
                f"{path}.seatTasks",
                f"must mark exactly leadMentorId {block['leadMentorId']!r} active; got {active_mentors!r}",
            )

    flattened = [block_id for step in steps for block_id in step["blocks"]]
    if flattened != [f"B{i:02d}" for i in range(1, 14)]: raise _error("$.macroSteps[*].blocks", "must reference B01 through B13 exactly once in course order")
    rules = _object(script["rules"], "$.rules")
    required_rules = {"manualAdvance": True, "courseSwitch": "new-run-only", "studentPdmo": "none-by-default", "cardDeal": "random-independent-of-identity", "singleSpotlightMentor": True}
    for key, expected in required_rules.items():
        if rules.get(key) != expected: raise _error(f"$.rules.{key}", f"must equal {expected!r}")
    if rules.get("executionStates") != ["ready", "executing", "awaiting-acceptance", "error", "completed"]: raise _error("$.rules.executionStates", "must preserve the manual execution state machine")
    _string(rules.get("historyBoundary"), "$.rules.historyBoundary")
    if script.get("authoring") is not None:
        authoring = _object(script["authoring"], "$.authoring")
        if authoring.get("status", "draft") not in AUTHORING_STATES: raise _error("$.authoring.status", "must be draft or published")
        revision = authoring.get("revision", 0)
        if not isinstance(revision, int) or revision < 0: raise _error("$.authoring.revision", "must be a non-negative integer")
    return script


def deck_for_step(script: dict[str, Any], macro_step_id: str) -> dict[str, Any]:
    """Return one validated stage deck without consulting a campaign module."""
    validate_script(script)
    try:
        return next(deck for deck in script["decks"] if deck["macroStepId"] == macro_step_id)
    except StopIteration as exc:  # pragma: no cover - guarded by validation
        raise ValueError(f"course has no deck for macro step {macro_step_id!r}") from exc


def deal_course_deck(
    script: dict[str, Any],
    macro_step_id: str,
    *,
    rng: Any | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Deal a role-independent, non-repeating 4 x 3 learner hand.

    The caller persists the returned card IDs for the lifetime of a Run.  A
    supplied ``random.Random`` is useful for deterministic author previews;
    production defaults to the operating system's cryptographic RNG.
    """
    deck = deck_for_step(script, macro_step_id)
    cards = copy.deepcopy(deck["cards"])
    random_source = rng or secrets.SystemRandom()
    if deck["shuffle"]:
        random_source.shuffle(cards)
    hand_size = int(deck["cardsPerLearner"])
    needed = len(LEARNER_SEAT_IDS) * hand_size
    selected = cards[:needed]
    if deck["uniqueDeal"] and len({card["id"] for card in selected}) != needed:
        raise ValueError("course deck cannot produce a unique 4 x 3 deal")
    return {
        seat_id: selected[index * hand_size:(index + 1) * hand_size]
        for index, seat_id in enumerate(LEARNER_SEAT_IDS)
    }


def _canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def course_digest(value: dict[str, Any]) -> str:
    """Hash immutable teaching content, not mutable registry metadata.

    Candidate approval and Released publication must bind the exact same
    teaching bytes.  Revision, status, timestamps and the approval receipt live
    under ``authoring`` and therefore cannot be part of that content identity.
    """
    content = copy.deepcopy(value)
    content.pop("authoring", None)
    return hashlib.sha256(_canonical_bytes(content)).hexdigest()


def legacy_course_digest(value: dict[str, Any]) -> str:
    """Return the pre-T083 digest used by already-running classrooms.

    Before T-083, mutable ``authoring`` metadata participated in the digest.
    The controller accepts this value only while loading persisted Run state,
    then atomically rewrites the state with :func:`course_digest`.  Keeping the
    compatibility calculation explicit prevents a deploy from discarding an
    in-progress classroom merely because the digest contract was corrected.
    """
    return hashlib.sha256(_canonical_bytes(value)).hexdigest()


def course_manifest(value: dict[str, Any]) -> dict[str, Any]:
    """Return machine-readable package diagnostics for authoring clients.

    Callers load course values through :func:`validate_script`; this helper is
    deliberately side-effect free so the API can expose counts and the exact
    digest that the Alpha Run pins without inventing a second data model.
    """
    decks = value.get("decks") if isinstance(value, dict) else None
    decks = decks if isinstance(decks, list) else []
    card_counts = [len(deck.get("cards", [])) if isinstance(deck, dict) and isinstance(deck.get("cards"), list) else 0 for deck in decks]
    return {
        "schemaVersion": value.get("schemaVersion") if isinstance(value, dict) else None,
        "macroStepCount": len(value.get("macroSteps", [])) if isinstance(value, dict) and isinstance(value.get("macroSteps"), list) else 0,
        "blockCount": len(value.get("blocks", [])) if isinstance(value, dict) and isinstance(value.get("blocks"), list) else 0,
        "deckCount": len(decks),
        "cardCount": sum(card_counts),
        "cardsPerDeck": card_counts,
        "minimumCardsPerDeck": BASELINE_CARDS_PER_DECK,
        "minimumCardCount": BASELINE_CARD_COUNT,
        "digest": course_digest(value),
    }


def _atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{secrets.token_hex(4)}.tmp")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2); handle.write("\n"); handle.flush(); os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists(): temporary.unlink()


def _read_json(path: Path) -> dict[str, Any]:
    try: value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc: raise _error(f"file:{path.name}:{exc.lineno}:{exc.colno}", exc.msg) from exc
    return validate_script(value)


class CourseRepository:
    """Immutable Course Registry shared by authoring, Alpha and Classroom.

    Course bodies live once under ``registry/revisions``.  Candidate approval
    and production release only create metadata or move atomic pointers; they
    never rewrite an already-addressable revision.  The old ``drafts`` /
    ``published`` / ``history`` layout remains a read-compatible migration
    source, but all new writes use the registry.
    """
    def __init__(self, user_dir: Path | None = None, bundled_files: tuple[Path, ...] = BUNDLED_FILES) -> None:
        self.user_dir = user_dir.expanduser().resolve() if user_dir else None
        self.bundled_files = tuple(path.resolve() for path in bundled_files)
        self.lock = threading.RLock()
        if self.user_dir:
            for name in ("registry/revisions", "registry/pointers", "registry/approvals", "registry/events"):
                path = self.user_dir / name; path.mkdir(parents=True, exist_ok=True, mode=0o700); os.chmod(path, 0o700)
            self._migrate_legacy()

    @staticmethod
    def _valid_id(course_id: str) -> str:
        if not isinstance(course_id, str) or not COURSE_ID_PATTERN.fullmatch(course_id): raise ValueError("课程 ID 只能使用 3—64 位小写字母、数字和连字符。")
        return course_id

    def _path(self, course_id: str, variant: str) -> Path:
        self._valid_id(course_id)
        if not self.user_dir or variant not in {"drafts", "published"}: raise ValueError("课程仓库未启用可写目录。")
        path = (self.user_dir / variant / f"{course_id}.json").resolve()
        if path.parent != (self.user_dir / variant).resolve(): raise ValueError("课程文件路径越界。")
        return path

    def _revision_dir(self, course_id: str) -> Path:
        self._valid_id(course_id)
        if not self.user_dir: raise ValueError("课程仓库当前为只读。")
        path = (self.user_dir / "registry" / "revisions" / course_id).resolve()
        root = (self.user_dir / "registry" / "revisions").resolve()
        if path.parent != root: raise ValueError("课程修订路径越界。")
        return path

    def _revision_path(self, course_id: str, revision: int) -> Path:
        if not isinstance(revision, int) or revision < 1: raise ValueError("revision 必须是正整数；内置 r0 不写入用户仓库。")
        return self._revision_dir(course_id) / f"r{revision:04d}.json"

    def _pointer_path(self, course_id: str) -> Path:
        self._valid_id(course_id)
        if not self.user_dir: raise ValueError("课程仓库当前为只读。")
        return (self.user_dir / "registry" / "pointers" / f"{course_id}.json").resolve()

    def _approval_path(self, course_id: str, revision: int) -> Path:
        return (self.user_dir / "registry" / "approvals" / course_id / f"r{revision:04d}.json").resolve()  # type: ignore[operator]

    @staticmethod
    def _ref(value: dict[str, Any], *, status: str) -> dict[str, Any]:
        authoring = value.get("authoring") if isinstance(value.get("authoring"), dict) else {}
        return {
            "courseId": value["course"]["id"],
            "schemaVersion": value["schemaVersion"],
            "revision": int(authoring.get("revision", 0)),
            "digest": course_digest(value),
            "status": status,
            "createdAt": authoring.get("createdAt") or authoring.get("updatedAt"),
            "createdBy": authoring.get("createdBy"),
        }

    def _read_pointer(self, course_id: str) -> dict[str, Any]:
        if not self.user_dir: return {"schemaVersion": 1, "courseId": course_id, "candidate": None, "released": None, "retired": None}
        path = self._pointer_path(course_id)
        if not path.exists(): return {"schemaVersion": 1, "courseId": course_id, "candidate": None, "released": None, "retired": None}
        try: value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc: raise ValueError(f"课程指针损坏：{course_id}") from exc
        if value.get("courseId") != course_id: raise ValueError(f"课程指针归属错误：{course_id}")
        return value

    def _write_pointer(self, course_id: str, pointer: dict[str, Any]) -> None:
        pointer = {**pointer, "schemaVersion": 1, "courseId": course_id, "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        _atomic_json(self._pointer_path(course_id), pointer)

    def _write_event(self, event: dict[str, Any]) -> None:
        if not self.user_dir: return
        now = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        path = self.user_dir / "registry" / "events" / f"{now}-{secrets.token_hex(5)}.json"
        _atomic_json(path, {"schemaVersion": 1, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **event})

    def _write_revision_once(self, course_id: str, revision: int, value: dict[str, Any]) -> None:
        path = self._revision_path(course_id, revision)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        if path.exists():
            existing = _read_json(path)
            if _canonical_bytes(existing) != _canonical_bytes(value):
                raise ValueError(f"不可变课程修订已存在且内容不同：{course_id} r{revision}")
            return
        temporary = path.with_name(f".{path.name}.{os.getpid()}.{secrets.token_hex(4)}.tmp")
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(value, handle, ensure_ascii=False, indent=2); handle.write("\n"); handle.flush(); os.fsync(handle.fileno())
            # Link fails rather than replacing if another writer won the race.
            try: os.link(temporary, path)
            except FileExistsError:
                existing = _read_json(path)
                if _canonical_bytes(existing) != _canonical_bytes(value):
                    raise ValueError(f"并发写入产生了不同的课程修订：{course_id} r{revision}")
            finally: temporary.unlink(missing_ok=True)
        finally:
            temporary.unlink(missing_ok=True)

    def _migrate_legacy(self) -> None:
        """Import old mutable files once, preserving their revision numbers.

        Migration is deliberately idempotent.  Legacy files stay untouched for
        rollback/read compatibility, but no post-migration write targets them.
        """
        if not self.user_dir: return
        candidates: dict[str, dict[str, Any]] = {}
        released: dict[str, dict[str, Any]] = {}
        history_root = self.user_dir / "history"
        if history_root.exists():
            pattern = re.compile(r"^r(\d+)-(draft|published)\.json$")
            for path in sorted(history_root.glob("*/r*-*.json")):
                match = pattern.fullmatch(path.name)
                if not match: continue
                try: value = _read_json(path)
                except (OSError, ValueError): continue
                course_id, revision, old_status = value["course"]["id"], int(match.group(1)), match.group(2)
                if revision <= 0: continue
                try: self._write_revision_once(course_id, revision, value)
                except ValueError: continue
                ref = self._ref(value, status="candidate" if old_status == "draft" else "released")
                ref["revision"] = revision
                target = candidates if old_status == "draft" else released
                if revision >= int(target.get(course_id, {}).get("revision", -1)): target[course_id] = ref
        for folder, status, target in (("drafts", "candidate", candidates), ("published", "released", released)):
            root = self.user_dir / folder
            if not root.exists(): continue
            for path in sorted(root.glob("*.json")):
                try: value = _read_json(path)
                except (OSError, ValueError): continue
                course_id = value["course"]["id"]
                if path.stem != course_id: continue
                revision = max(1, self._revision(value))
                try: self._write_revision_once(course_id, revision, value)
                except ValueError: continue
                ref = self._ref(value, status=status); ref["revision"] = revision
                if revision >= int(target.get(course_id, {}).get("revision", -1)): target[course_id] = ref
        for course_id in sorted(set(candidates) | set(released)):
            pointer = self._read_pointer(course_id)
            changed = False
            if not pointer.get("candidate") and candidates.get(course_id): pointer["candidate"] = candidates[course_id]; changed = True
            if not pointer.get("released") and released.get(course_id): pointer["released"] = released[course_id]; changed = True
            if changed: self._write_pointer(course_id, pointer)

    def _bundled(self) -> dict[str, tuple[Path, dict[str, Any]]]:
        result = {}
        for path in self.bundled_files:
            value = _read_json(path); course_id = value["course"]["id"]
            if course_id in result: raise ValueError(f"重复的内置课程 ID：{course_id}")
            result[course_id] = (path, value)
        return result

    @staticmethod
    def _revision(value: dict[str, Any]) -> int:
        authoring = value.get("authoring")
        return int(authoring.get("revision", 0)) if isinstance(authoring, dict) else 0

    @staticmethod
    def _metadata(value: dict[str, Any], *, source: str, status: str, candidate_ref: dict[str, Any] | None = None, released_ref: dict[str, Any] | None = None, approval: dict[str, Any] | None = None) -> dict[str, Any]:
        course, case = value["course"], value["case"]
        manifest = course_manifest(value)
        cr = int(candidate_ref.get("revision", 0)) if candidate_ref else 0
        rr = int(released_ref.get("revision", 0)) if released_ref else 0
        return {"id": course["id"], "name": course["name"], "title": case["name"], "period": course["period"], "coverage": course["coverage"], "description": course["description"], "status": status, "source": source, "runtimeCampaignId": case["campaignId"], "hasDraft": bool(candidate_ref and (not released_ref or candidate_ref.get("digest") != released_ref.get("digest"))), "hasCandidate": bool(candidate_ref), "candidateRevision": cr, "releasedRevision": rr, "publishedRevision": rr, "draftRevision": cr, "latestRevision": max(cr, rr), "candidateRef": copy.deepcopy(candidate_ref), "releasedRef": copy.deepcopy(released_ref), "approval": copy.deepcopy(approval), **manifest, "digest": manifest["digest"][:16]}

    def _all_course_ids(self) -> set[str]:
        ids = set(self._bundled())
        if self.user_dir:
            ids.update(path.stem for path in (self.user_dir / "registry" / "pointers").glob("*.json"))
            ids.update(path.name for path in (self.user_dir / "registry" / "revisions").iterdir() if path.is_dir())
        return ids

    def _bundled_ref(self, course_id: str, *, status: str = "released") -> dict[str, Any] | None:
        bundled = self._bundled().get(course_id)
        if not bundled: return None
        ref = self._ref(bundled[1], status=status); ref.update({"revision": 0, "createdBy": "bundled"})
        return ref

    def current_ref(self, course_id: str, channel: str = "released") -> dict[str, Any]:
        if not isinstance(course_id, str) or not COURSE_ID_PATTERN.fullmatch(course_id):
            raise ValueError(f"未知课程 id: {course_id!r}")
        if channel in {"draft", "candidate", "alpha"}: channel = "candidate"
        elif channel in {"published", "released", "production"}: channel = "released"
        else: raise ValueError("课程通道只能是 candidate 或 released。")
        with self.lock:
            pointer = self._read_pointer(self._valid_id(course_id))
            ref = pointer.get(channel)
            if not ref and channel == "candidate": ref = pointer.get("released")
            if not ref: ref = self._bundled_ref(course_id, status=channel)
            if not ref: raise ValueError(f"未知课程 id: {course_id!r}")
            return copy.deepcopy(ref)

    def load_ref(self, course_id: str, revision: int, digest: str | None = None) -> dict[str, Any]:
        self._valid_id(course_id)
        with self.lock:
            if revision == 0:
                bundled = self._bundled().get(course_id)
                if not bundled: raise ValueError(f"课程 {course_id} 没有内置 r0。")
                value = bundled[1]
            else:
                if not self.user_dir: raise ValueError("课程仓库当前为只读。")
                path = self._revision_path(course_id, revision)
                if not path.exists(): raise ValueError(f"找不到课程 {course_id} r{revision}。")
                value = _read_json(path)
            actual = course_digest(value)
            if digest is not None and digest != actual: raise ValueError(f"课程引用 digest 不匹配：{course_id} r{revision}。")
            return copy.deepcopy(value)

    def list_published(self) -> list[dict[str, Any]]:
        with self.lock:
            result = []
            for course_id in sorted(self._all_course_ids()):
                try: released_ref = self.current_ref(course_id, "released"); value = self.load_ref(course_id, released_ref["revision"], released_ref["digest"])
                except ValueError: continue
                try: candidate_ref = self.current_ref(course_id, "candidate")
                except ValueError: candidate_ref = None
                result.append(self._metadata(value, source="bundled" if released_ref["revision"] == 0 else "authored", status="released", candidate_ref=candidate_ref, released_ref=released_ref, approval=self.approval_for_ref(released_ref)))
            return sorted(result, key=lambda item: (item["source"] != "bundled", item["name"], item["id"]))

    def list_for_editor(self) -> dict[str, Any]:
        with self.lock:
            result, diagnostics = [], []
            for course_id in sorted(self._all_course_ids()):
                try:
                    candidate_ref = self.current_ref(course_id, "candidate")
                    try: released_ref = self.current_ref(course_id, "released")
                    except ValueError: released_ref = None
                    value = self.load_ref(course_id, candidate_ref["revision"], candidate_ref["digest"])
                    status = "released" if released_ref and released_ref["digest"] == candidate_ref["digest"] and released_ref["revision"] == candidate_ref["revision"] else "candidate"
                    result.append(self._metadata(value, source="bundled" if candidate_ref["revision"] == 0 else "authored", status=status, candidate_ref=candidate_ref, released_ref=released_ref, approval=self.approval_for_ref(candidate_ref)))
                except (OSError, ValueError) as exc: diagnostics.append({"file": f"registry/{course_id}", "message": str(exc)})
            return {"courses": result, "diagnostics": diagnostics}

    def load(self, course_id: str, *, variant: str = "published") -> dict[str, Any]:
        ref = self.current_ref(course_id, variant)
        return self.load_ref(course_id, int(ref["revision"]), str(ref["digest"]))

    def describe(self, course_id: str, *, variant: str = "draft") -> dict[str, Any]:
        """Describe the exact immutable value returned to an editor."""
        with self.lock:
            channel = "candidate" if variant in {"draft", "candidate", "alpha"} else "released"
            ref = self.current_ref(course_id, channel); value = self.load_ref(course_id, ref["revision"], ref["digest"])
            try: candidate_ref = self.current_ref(course_id, "candidate")
            except ValueError: candidate_ref = None
            try: released_ref = self.current_ref(course_id, "released")
            except ValueError: released_ref = None
            manifest = course_manifest(value)
            return {
                **manifest,
                "courseId": course_id,
                "source": "bundled" if ref["revision"] == 0 else "authored",
                "variant": channel,
                "status": ref["status"],
                "revision": int(ref["revision"]),
                "publishedRevision": int(released_ref["revision"]) if released_ref else 0,
                "draftRevision": int(candidate_ref["revision"]) if candidate_ref else 0,
                "candidateRevision": int(candidate_ref["revision"]) if candidate_ref else 0,
                "releasedRevision": int(released_ref["revision"]) if released_ref else 0,
                "candidateRef": candidate_ref,
                "releasedRef": released_ref,
                "approval": self.approval_for_ref(ref),
                "digestShort": manifest["digest"][:16],
            }

    def save(self, value: dict[str, Any], *, status: str, expected_revision: int) -> dict[str, Any]:
        if status not in {"draft", "candidate"}:
            raise ValueError("保存只生成 Candidate；正式发布必须通过 exact Alpha 验收后移动 Released 指针。")
        saved = self.save_candidate(value, expected_revision=expected_revision)
        return self.load_ref(saved["courseId"], saved["revision"], saved["digest"])

    def _latest_revision(self, course_id: str) -> int:
        latest = 0
        if self.user_dir:
            root = self._revision_dir(course_id)
            if root.exists():
                for path in root.glob("r*.json"):
                    match = re.fullmatch(r"r(\d+)\.json", path.name)
                    if match: latest = max(latest, int(match.group(1)))
        return latest

    def save_candidate(self, value: dict[str, Any], expected_revision: int | None = None, *, actor: str = "course-editor") -> dict[str, Any]:
        if not self.user_dir: raise ValueError("课程仓库当前为只读。")
        candidate = copy.deepcopy(value); validate_script(candidate); course_id = self._valid_id(candidate["course"]["id"])
        with self.lock:
            latest = self._latest_revision(course_id)
            if expected_revision is not None and expected_revision != latest:
                raise ValueError(f"课程已被其他人更新：当前修订为 {latest}，你的基线为 {expected_revision}。请重新载入。")
            revision = latest + 1; now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            candidate["authoring"] = {"status": "candidate", "revision": revision, "createdAt": now, "updatedAt": now, "createdBy": actor}
            validate_script(candidate)
            self._write_revision_once(course_id, revision, candidate)
            ref = self._ref(candidate, status="candidate")
            pointer = self._read_pointer(course_id); pointer["candidate"] = ref; self._write_pointer(course_id, pointer)
            self._write_event({"type": "candidate.saved", "actor": actor, "courseRef": ref})
            return copy.deepcopy(ref)

    def approval_for_ref(self, ref: dict[str, Any] | None) -> dict[str, Any] | None:
        if not ref or not self.user_dir or int(ref.get("revision", 0)) <= 0: return None
        path = self._approval_path(str(ref["courseId"]), int(ref["revision"]))
        if not path.exists(): return None
        try: value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError): return None
        return value if value.get("digest") == ref.get("digest") else None

    def approve(self, course_id: str, revision: int, digest: str, run_id: str, run_digest: str, *, checks: dict[str, Any] | None = None, actor: str = "alpha-dm") -> dict[str, Any]:
        with self.lock:
            if revision <= 0: raise ValueError("内置 r0 已是发布基线；只有新 Candidate 可以生成 Alpha 验收回执。")
            current = self.current_ref(course_id, "candidate")
            if current["revision"] != revision or current["digest"] != digest:
                raise ValueError("Alpha 验收只能绑定当前 exact Candidate；内容变化后旧回执自动失效。")
            if run_digest != digest: raise ValueError("Alpha Run digest 与 Candidate digest 不匹配。")
            if not isinstance(run_id, str) or not run_id.strip(): raise ValueError("Alpha 验收缺少 runId。")
            value = self.load_ref(course_id, revision, digest)
            manifest = course_manifest(value); now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            approval = {
                "schemaVersion": 1, "courseId": course_id, "revision": revision, "digest": digest,
                "status": "approved", "runId": run_id, "runDigest": run_digest,
                "acceptedAt": now, "acceptedBy": actor,
                "checks": checks or {"macroSteps": manifest["macroStepCount"], "blocks": manifest["blockCount"], "decks": manifest["deckCount"], "cards": manifest["cardCount"]},
            }
            path = self._approval_path(course_id, revision); path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            if path.exists():
                existing = json.loads(path.read_text(encoding="utf-8"))
                if existing.get("digest") != digest or existing.get("runId") != run_id:
                    raise ValueError("这个 Candidate 已有另一份不可变验收回执。")
                return existing
            _atomic_json(path, approval)
            self._write_event({"type": "candidate.approved", "actor": actor, "courseRef": current, "runId": run_id})
            return copy.deepcopy(approval)

    def release(
        self,
        course_id: str,
        revision: int,
        digest: str,
        *,
        actor: str = "course-editor",
        before_pointer: Callable[[dict[str, Any], dict[str, Any], dict[str, Any]], None] | None = None,
    ) -> dict[str, Any]:
        with self.lock:
            current = self.current_ref(course_id, "candidate")
            if current["revision"] != revision or current["digest"] != digest:
                raise ValueError("正式发布目标不是当前 exact Candidate。")
            approval = self.approval_for_ref(current)
            if not approval or approval.get("status") != "approved":
                raise ValueError("正式发布需要当前 exact Candidate 的 Alpha 验收回执。")
            # Verify the immutable body before moving the production pointer.
            value = self.load_ref(course_id, revision, digest)
            released = {**current, "status": "released", "releasedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "releasedBy": actor, "approvalRunId": approval["runId"]}
            # Production Classroom must acknowledge the exact package before
            # the file registry moves its Released pointer. A network or D1
            # failure therefore leaves both production pointers on the last
            # known-good version rather than publishing a split-brain release.
            if before_pointer:
                before_pointer(copy.deepcopy(value), copy.deepcopy(released), copy.deepcopy(approval))
            pointer = self._read_pointer(course_id); previous = pointer.get("released"); pointer["released"] = released; self._write_pointer(course_id, pointer)
            self._write_event({"type": "course.released", "actor": actor, "courseRef": released, "previousReleased": previous, "approvalRunId": approval["runId"]})
            return copy.deepcopy(released)

    def list_history(self, course_id: str) -> list[dict[str, Any]]:
        """List immutable authored snapshots without exposing filesystem paths."""
        self._valid_id(course_id)
        with self.lock:
            result: list[dict[str, Any]] = []
            candidate = None; released = None
            try: candidate = self.current_ref(course_id, "candidate")
            except ValueError: pass
            try: released = self.current_ref(course_id, "released")
            except ValueError: pass
            # Revision zero is the immutable bundled baseline when one exists.
            bundled = self._bundled().get(course_id)
            if bundled:
                value = bundled[1]; manifest = course_manifest(value)
                result.append({
                    "revision": 0, "status": "released" if released and released["revision"] == 0 else "bundled", "updatedAt": None,
                    "digest": manifest["digest"], "deckCount": manifest["deckCount"],
                    "cardCount": manifest["cardCount"], "schemaVersion": manifest["schemaVersion"],
                })
            if not self.user_dir:
                return result
            history_dir = self._revision_dir(course_id)
            if not history_dir.exists():
                return result
            pattern = re.compile(r"^r(\d{4,})\.json$")
            for path in sorted(history_dir.glob("r*.json")):
                match = pattern.fullmatch(path.name)
                if not match:
                    continue
                try:
                    value = _read_json(path)
                    if value["course"]["id"] != course_id:
                        continue
                except (OSError, ValueError):
                    continue
                manifest = course_manifest(value)
                revision = int(match.group(1)); ref = {"courseId": course_id, "revision": revision, "digest": manifest["digest"]}
                is_released = bool(released and released["revision"] == revision and released["digest"] == manifest["digest"])
                is_candidate = bool(candidate and candidate["revision"] == revision and candidate["digest"] == manifest["digest"])
                result.append({
                    "revision": revision, "status": "released" if is_released else "candidate" if is_candidate else "superseded",
                    "approved": bool(self.approval_for_ref(ref)), "updatedAt": (value.get("authoring") or {}).get("updatedAt"),
                    "digest": manifest["digest"], "deckCount": manifest["deckCount"],
                    "cardCount": manifest["cardCount"], "schemaVersion": manifest["schemaVersion"],
                })
            return sorted(result, key=lambda item: item["revision"], reverse=True)

    def restore(self, course_id: str, source_revision: int, *, expected_revision: int) -> dict[str, Any]:
        """Restore an immutable snapshot as a *new* Candidate revision.

        History is never rewritten and an active Alpha Run is never touched;
        the author must explicitly use the existing refresh action afterwards.
        """
        self._valid_id(course_id)
        if not isinstance(source_revision, int) or source_revision < 0:
            raise ValueError("sourceRevision 必须是非负整数。")
        with self.lock:
            if source_revision == 0:
                bundled = self._bundled().get(course_id)
                if not bundled:
                    raise ValueError("这门课程没有可恢复的内置基线。")
                value = copy.deepcopy(bundled[1])
            else:
                if not self.user_dir:
                    raise ValueError("课程仓库当前为只读。")
                value = self.load_ref(course_id, source_revision)
            ref = self.save_candidate(value, expected_revision=expected_revision, actor="history-restore")
            return self.load_ref(course_id, ref["revision"], ref["digest"])

    def clone(self, source_course_id: str, new_course_id: str, new_name: str) -> dict[str, Any]:
        self._valid_id(new_course_id); _string(new_name, "$.course.name")
        with self.lock:
            if any(item["id"] == new_course_id for item in self.list_for_editor()["courses"]): raise ValueError("这个课程 ID 已经存在。")
            value = self.load(source_course_id, variant="released")
            value["course"].update({"id": new_course_id, "name": new_name.strip(), "scriptId": f"{new_course_id}-live-run-v1"})
            value["id"] = f"{new_course_id}-live-run-v1"; value["title"] = f"Mini Silicon Valley｜{new_name.strip()}｜LIVE RUN SCRIPT"
            value.pop("authoring", None)
            ref = self.save_candidate(value, expected_revision=0, actor="course-clone")
            return self.load_ref(new_course_id, ref["revision"], ref["digest"])


DEFAULT_REPOSITORY = CourseRepository()
def load_script(course_id: str) -> dict[str, Any]: return DEFAULT_REPOSITORY.load(course_id)
def build_script(course_id: str) -> dict[str, Any]: return load_script(course_id)
def list_courses() -> list[dict[str, Any]]: return DEFAULT_REPOSITORY.list_published()
COURSE_OPTIONS = {item["id"]: item for item in list_courses()}


def json_schema() -> dict[str, Any]:
    string = {"type": "string", "minLength": 1}
    string_array = {"type": "array", "minItems": 1, "items": string}
    source = {
        "type": "object", "additionalProperties": True,
        "required": ["id", "title", "organization", "url", "kind", "accessed"],
        "properties": {key: string for key in ("id", "title", "organization", "url", "kind", "accessed")},
    }
    deck_card = {
        "type": "object", "additionalProperties": True,
        "required": ["id", "boundary", "title", "body", "sharePrompt", "sourceIds"],
        "properties": {
            "id": string,
            "boundary": {"enum": sorted(EVIDENCE_BOUNDARIES)},
            "title": string,
            "body": string,
            "sharePrompt": string,
            "sourceIds": {"type": "array", "uniqueItems": True, "items": string},
        },
    }
    deck = {
        "type": "object", "additionalProperties": True,
        "required": ["id", "macroStepId", "drawAtBlockId", "cardsPerLearner", "uniqueDeal", "shuffle", "cards"],
        "properties": {
            "id": string,
            "macroStepId": {"enum": list(STEP_IDS)},
            "drawAtBlockId": {"enum": list(DECK_DRAW_BLOCKS)},
            "cardsPerLearner": {"const": 3},
            "uniqueDeal": {"const": True},
            "shuffle": {"const": True},
            "cards": {"type": "array", "minItems": 12, "items": deck_card},
        },
    }
    seat_task = {"type": "object", "additionalProperties": False, "required": ["state", "badge", "task"], "properties": {"state": {"enum": sorted(SPOTLIGHT_STATES)}, "badge": string, "task": string}}
    block = {"type": "object", "additionalProperties": True, "required": ["id", "macroStepId", "macroStepOrder", "order", "title", "leadMentorId", "suggestedMinutes", "gameModes", "apiAction", "underlyingClassroomPhases", "historyTrack", "realityTrack", "studentPrompt", "mentorScript", "studentActions", "systemActions", "props", "evidenceGate", "fallback", "manualInteraction", "learnerLens", "seatTasks"], "properties": {"id": {"pattern": "^B(?:0[1-9]|1[0-3])$"}, "macroStepId": {"enum": list(STEP_IDS)}, "macroStepOrder": {"type": "integer", "minimum": 1, "maximum": 5}, "order": {"type": "integer", "minimum": 1, "maximum": 13}, "title": string, "leadMentorId": {"enum": list(SEAT_IDS[:4])}, "suggestedMinutes": {"type": "integer", "minimum": 1, "maximum": 180}, "gameModes": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"enum": sorted(GAME_MODES)}}, "apiAction": {"enum": list(API_ACTIONS)}, "underlyingClassroomPhases": string_array, "historyTrack": string, "realityTrack": string, "studentPrompt": string, "mentorScript": string_array, "studentActions": string_array, "systemActions": string_array, "props": string_array, "evidenceGate": string_array, "fallback": string_array, "manualInteraction": string, "learnerLens": {"type": "object", "additionalProperties": False, "required": ["world", "say", "ask", "done"], "properties": {key: string for key in ("world", "say", "ask", "done")}}, "seatTasks": {"type": "object", "additionalProperties": False, "required": list(SEAT_IDS), "properties": {seat: seat_task for seat in SEAT_IDS}}}}
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://minisv.vip/schemas/course-package-v1.json",
        "title": "Mini Silicon Valley LIVE RUN Course Package v1",
        "type": "object", "additionalProperties": True,
        "required": ["schemaVersion", "id", "title", "course", "case", "sources", "decks", "formula", "macroSteps", "blocks", "rules"],
        "properties": {
            "schemaVersion": {"const": COURSE_SCHEMA_VERSION}, "id": string, "title": string,
            "course": {
                "type": "object", "additionalProperties": True,
                "required": ["id", "name", "period", "coverage", "description", "learnerName", "scriptId", "macroStepCount", "blockCount", "completeFiveStep"],
                "properties": {
                    "id": {"type": "string", "pattern": COURSE_ID_PATTERN.pattern},
                    "name": string, "period": string, "coverage": string,
                    "description": string, "learnerName": string, "scriptId": string,
                    "macroStepCount": {"const": 5}, "blockCount": {"const": 13},
                    "completeFiveStep": {"const": True},
                },
            },
            "case": {
                "type": "object", "additionalProperties": True,
                "required": ["campaignId", "name", "learnerName", "period", "why"],
                "properties": {
                    "campaignId": {"enum": sorted(SUPPORTED_RUNTIME_CAMPAIGNS)},
                    "name": string, "learnerName": string, "period": string, "why": string,
                },
            },
            "sources": {"type": "array", "minItems": 1, "items": source},
            "decks": {"type": "array", "minItems": 5, "maxItems": 5, "items": deck},
            "macroSteps": {"type": "array", "minItems": 5, "maxItems": 5},
            "blocks": {"type": "array", "minItems": 13, "maxItems": 13, "items": block},
            "formula": {"type": "object"}, "rules": {"type": "object"},
            "authoring": {
                "type": "object", "additionalProperties": True,
                "properties": {
                    "status": {"enum": sorted(AUTHORING_STATES)},
                    "revision": {"type": "integer", "minimum": 0},
                    "updatedAt": {"type": "string"},
                },
            },
        },
    }


def template_script() -> dict[str, Any]:
    value = load_script(DEFAULT_COURSE_ID)
    value["id"] = "new-course-template-live-run-v1"; value["title"] = "Mini Silicon Valley｜新课程模板｜LIVE RUN SCRIPT"
    value["course"].update({"id": "new-course-template", "name": "新课程模板｜五步创业闭环", "period": "填写时代", "coverage": "完整课程 · 5 步 / 13 块", "description": "填写课程的一句话简介。", "learnerName": "Young Builder 创业小队", "scriptId": "new-course-template-live-run-v1"})
    value["case"].update({"campaignId": DEFAULT_COURSE_ID, "name": "填写案例名称与时间范围", "learnerName": "Young Builder 创业小队", "period": "填写时代", "why": "填写为什么这个真实科技史案例值得进入课堂。"})
    value["sources"] = [{
        "id": "source-template-001", "title": "待替换的第一手来源",
        "organization": "填写发布机构", "url": "https://example.invalid/replace-this-source",
        "kind": "official", "accessed": "2026-01-01",
    }]
    for step_index, deck in enumerate(value["decks"], 1):
        cards = []
        for card_index in range(12):
            boundary = ("F", "R", "G", "U")[card_index % 4]
            number = card_index + 1
            labels = {"F": "有来源", "R": "课堂模拟", "G": "我们猜的", "U": "还不知道"}
            cards.append({
                "id": f"template-{STEP_IDS[step_index - 1]}-{number:03d}",
                "boundary": boundary,
                "title": f"{boundary} · 第 {step_index} 步线索 {number}",
                "body": f"用初中生能直接读懂的语言，填写一条“{labels[boundary]}”的具体信息。",
                "sharePrompt": "告诉队友：这条线索能说明什么，还不能说明什么。",
                "sourceIds": ["source-template-001"] if boundary == "F" else [],
            })
        deck["cards"] = cards
    for block in value["blocks"]:
        block.update({"title": f"{block['id']}｜填写本块标题", "historyTrack": "填写当时可知的真实历史信息与证据边界。", "realityTrack": "填写学员回到现实项目要完成的对应实践。", "studentPrompt": "用一句具体、可行动的话告诉初中生现在只需要做什么。", "mentorScript": ["填写当值导师逐句口播。"], "studentActions": ["填写学员现场可观察动作。"], "systemActions": ["填写执行本块后的系统同步结果。"], "props": ["填写本块需要的实体或数字道具。"], "evidenceGate": ["填写导师必须亲眼看见的完成证据。"], "fallback": ["填写学生卡住时的具象兜底问题。"], "manualInteraction": "填写线下互动和八席窗口如何配合。", "learnerLens": {"world": "填写学员此刻身处的具体世界。", "say": "填写学员要说的一句话。", "ask": "填写学员要问队友的问题。", "done": "填写学员如何知道自己完成了。"}})
        for task in block["seatTasks"].values(): task["task"] = "填写这个席位此刻唯一要做的动作。"
    value["authoring"] = {"status": "draft", "revision": 0}; validate_script(value); return value


def write_companion_files() -> None:
    COURSE_ASSETS.mkdir(parents=True, exist_ok=True)
    _atomic_json(COURSE_ASSETS / "course.schema.json", json_schema())
    _atomic_json(COURSE_ASSETS / "course-template.json", template_script())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-json", action="store_true")
    parser.add_argument("--validate", action="append", type=Path, default=[])
    args = parser.parse_args()
    for path in args.validate:
        value = _read_json(path); print(f"COURSE_VALID id={value['course']['id']} blocks={len(value['blocks'])} file={path}")
    if args.write_json:
        write_companion_files(); print(f"COURSE_COMPANIONS_WRITTEN dir={COURSE_ASSETS}")


if __name__ == "__main__": main()
