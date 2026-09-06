#!/usr/bin/env python3
"""Export a redacted, read-only Workshop baseline from exact Released courses.

This module intentionally imports CourseRepository rather than Alpha state or a
Classroom room.  It therefore has no path that can expose leases, accounts,
dealt hands, wallets, submissions, or live progress.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from course import CourseRepository, course_manifest, validate_script

SNAPSHOT_VERSION = 1
PUBLIC_SCOPE = "public-redacted-summary"
STEP_IDS = ("find", "decide", "build", "market", "operate")
BOUNDARIES = ("F", "R", "G", "U")
MENTOR_ROLES = (
    {"id": "mentor01", "code": "P", "name": "产品导师", "responsibility": "找真问题与定真方案；主 DM 负责全场节奏。"},
    {"id": "mentor02", "code": "D", "name": "开发导师", "responsibility": "做真产品；把方案转成可测试 MVP。"},
    {"id": "mentor03", "code": "M", "name": "市场导师", "responsibility": "进真市场；验证触达、采用与交换。"},
    {"id": "mentor04", "code": "O", "name": "运营导师", "responsibility": "跑真运营；建立交付、反馈、迭代与品牌闭环。"},
)
CONFIRMED_FRAMEWORK = {
    "oneWorld": "真实科技史驱动的有限开放世界创业学习 RPG",
    "twoTracks": ["历史情境轨", "现实项目轨"],
    "threeEngines": ["毛线式：获取与交换信息", "美式：情境挑战与共同攻坚", "德式：资源经营与长期反馈"],
    "fourMentors": ["产品", "开发", "市场", "运营"],
    "fiveSteps": ["找真问题", "定真方案", "做真产品", "进真市场", "跑真运营"],
    "sixMinuteFinale": "Demo Day 是六分钟真实发布，不是笔试。",
    "learnerRole": "学员统一为 Young Builder；不固定分成 P/D/M/O。",
}
ACCEPTED_DECISIONS = (
    {"id": "T-073", "decision": "PDMO 是四类导师横向专业分工；学员不固定分角。"},
    {"id": "T-075", "decision": "Course Registry 的 exact Released revision/digest 是正式课堂唯一课程真值。"},
    {"id": "T-076", "decision": "学员界面先给具体行动；抽象方法与复杂判断留给导师分层解释。"},
    {"id": "T-080", "decision": "课程编辑只保存完整 Candidate；不会静默热更新 Alpha 或 Classroom。"},
)
ACCEPTANCE_RECEIPTS = (
    {"todoId": "T-071", "summary": "五步骤卡组进入 Course Package，并通过结构与随机发牌验收。"},
    {"todoId": "T-072", "summary": "编辑器到 Alpha 的显式刷新边界通过验收。"},
    {"todoId": "T-074", "summary": "卡组编辑、学员预览和 Alpha 同步验收通过。"},
    {"todoId": "T-075", "summary": "Candidate → Alpha exact ref → Released → Classroom 单一真值链通过测试。"},
)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def iso_timestamp(value: str | None) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _public_block(block: dict[str, Any]) -> dict[str, Any]:
    lens = block.get("learnerLens") if isinstance(block.get("learnerLens"), dict) else {}
    return {
        "id": block["id"],
        "order": block["order"],
        "macroStepId": block["macroStepId"],
        "title": block["title"],
        "leadMentorId": block["leadMentorId"],
        "suggestedMinutes": block["suggestedMinutes"],
        "gameModes": list(block["gameModes"]),
        "studentOutcome": lens.get("done") or block.get("studentPrompt", ""),
        "evidenceGate": list(block.get("evidenceGate", [])),
    }


def _deck_summary(deck: dict[str, Any], source_ids: set[str]) -> dict[str, Any]:
    counts = {key: 0 for key in BOUNDARIES}
    fact_with_sources = 0
    stable_ids: list[str] = []
    for card in deck["cards"]:
        boundary = card["boundary"]
        counts[boundary] += 1
        stable_ids.append(card["id"])
        if boundary == "F" and card.get("sourceIds") and all(source in source_ids for source in card["sourceIds"]):
            fact_with_sources += 1
    return {
        "id": deck["id"],
        "macroStepId": deck["macroStepId"],
        "drawAtBlockId": deck["drawAtBlockId"],
        "cardCount": len(deck["cards"]),
        "cardsPerLearner": deck["cardsPerLearner"],
        "boundaryCounts": counts,
        "factCardsWithSources": fact_with_sources,
        "stableCardIds": stable_ids,
    }


def project_released_course(repository: CourseRepository, course_id: str) -> dict[str, Any]:
    ref = repository.current_ref(course_id, "released")
    course = repository.load_ref(course_id, int(ref["revision"]), str(ref["digest"]))
    validate_script(course)
    manifest = course_manifest(course)
    if manifest["digest"] != ref["digest"]:
        raise ValueError(f"Released digest mismatch: {course_id} r{ref['revision']}")
    sources = course["sources"]
    source_ids = {item["id"] for item in sources}
    blocks = [_public_block(item) for item in course["blocks"]]
    decks = [_deck_summary(item, source_ids) for item in course["decks"]]
    projected = {
        "courseId": course_id,
        "schemaVersion": course["schemaVersion"],
        "revision": int(ref["revision"]),
        "digest": ref["digest"],
        "status": "released",
        "releasedAt": ref.get("releasedAt") or ref.get("createdAt"),
        "title": course["course"]["name"],
        "caseName": course["case"]["name"],
        "period": course["course"]["period"],
        "summary": course["course"]["description"],
        "macroSteps": [
            {
                "id": step["id"], "order": step["order"], "name": step["name"],
                "mentorSequence": list(step["mentorSequence"]),
                "question": step["question"], "exitGate": step["exitGate"],
                "blocks": list(step["blocks"]),
            }
            for step in course["macroSteps"]
        ],
        "blocks": blocks,
        "deckSummary": decks,
        "sourceSummary": {
            "count": len(sources),
            "organizations": sorted({item["organization"] for item in sources}),
            "kinds": sorted({item["kind"] for item in sources}),
            "factCardCount": sum(item["boundaryCounts"]["F"] for item in decks),
            "factCardsWithSources": sum(item["factCardsWithSources"] for item in decks),
        },
    }
    validate_projected_course(projected)
    return projected


def validate_projected_course(course: dict[str, Any]) -> None:
    if course.get("status") != "released" or not re.fullmatch(r"[0-9a-f]{64}", str(course.get("digest", ""))):
        raise ValueError("Workshop snapshot accepts only exact Released refs")
    steps, blocks, decks = course.get("macroSteps"), course.get("blocks"), course.get("deckSummary")
    if not isinstance(steps, list) or tuple(item.get("id") for item in steps) != STEP_IDS:
        raise ValueError(f"{course.get('courseId')}: expected the confirmed five-step order")
    if not isinstance(blocks, list) or len(blocks) != 13 or [item.get("order") for item in blocks] != list(range(1, 14)):
        raise ValueError(f"{course.get('courseId')}: expected 13 ordered blocks")
    if not isinstance(decks, list) or len(decks) != 5 or tuple(item.get("macroStepId") for item in decks) != STEP_IDS:
        raise ValueError(f"{course.get('courseId')}: expected one deck per step")
    all_ids: list[str] = []
    for deck in decks:
        if deck.get("cardCount", 0) < 12:
            raise ValueError(f"{course.get('courseId')}: each deck needs at least 12 cards")
        ids = deck.get("stableCardIds")
        if not isinstance(ids, list) or len(ids) != len(set(ids)) or not all(isinstance(item, str) and item for item in ids):
            raise ValueError(f"{course.get('courseId')}: stable card ids are invalid")
        all_ids.extend(ids)
        boundaries = deck.get("boundaryCounts", {})
        if set(boundaries) != set(BOUNDARIES) or sum(boundaries.values()) != deck["cardCount"]:
            raise ValueError(f"{course.get('courseId')}: evidence boundary counts are invalid")
        if deck.get("factCardsWithSources") != boundaries["F"]:
            raise ValueError(f"{course.get('courseId')}: every F card needs a known source")
    if len(all_ids) != len(set(all_ids)):
        raise ValueError(f"{course.get('courseId')}: card ids collide across decks")


def build_snapshot(
    repository: CourseRepository,
    course_ids: Iterable[str] | None = None,
    *,
    generated_at: str | None = None,
    actor: str = "release-exporter",
) -> dict[str, Any]:
    ids = list(course_ids or [item["id"] for item in repository.list_published()])
    if not ids or len(ids) != len(set(ids)):
        raise ValueError("Workshop snapshot needs a non-empty unique released course list")
    courses = [project_released_course(repository, course_id) for course_id in sorted(ids)]
    refs = [{key: course[key] for key in ("courseId", "schemaVersion", "revision", "digest", "status")} for course in courses]
    payload: dict[str, Any] = {
        "snapshotVersion": SNAPSHOT_VERSION,
        "generatedAt": iso_timestamp(generated_at),
        "generatedBy": actor[:80],
        "scope": PUBLIC_SCOPE,
        "source": {
            "registry": "course-registry",
            "channel": "released",
            "courseCount": len(courses),
            "aggregateDigest": sha256(refs),
        },
        "confirmedFramework": copy.deepcopy(CONFIRMED_FRAMEWORK),
        "mentorRoles": copy.deepcopy(MENTOR_ROLES),
        "courses": courses,
        "acceptedDecisions": copy.deepcopy(ACCEPTED_DECISIONS),
        "acceptanceReceipts": copy.deepcopy(ACCEPTANCE_RECEIPTS),
        "redaction": {
            "included": "公开框架、步骤、Block 目标、卡组统计、来源统计与稳定卡牌 ID",
            "excluded": "卡牌正文、导师脚本、账号、私密手牌、Run/Room 状态、RP、钱包、账本、Token 与服务器路径",
        },
    }
    payload["integrity"] = {"algorithm": "sha256", "digest": sha256(payload)}
    validate_snapshot(payload)
    return payload


def validate_snapshot(snapshot: dict[str, Any]) -> None:
    if snapshot.get("snapshotVersion") != SNAPSHOT_VERSION or snapshot.get("scope") != PUBLIC_SCOPE:
        raise ValueError("unsupported Workshop snapshot")
    integrity = snapshot.get("integrity")
    if not isinstance(integrity, dict) or integrity.get("algorithm") != "sha256":
        raise ValueError("snapshot integrity metadata is missing")
    unsigned = {key: value for key, value in snapshot.items() if key != "integrity"}
    if integrity.get("digest") != sha256(unsigned):
        raise ValueError("snapshot integrity digest mismatch")
    courses = snapshot.get("courses")
    if not isinstance(courses, list) or not courses:
        raise ValueError("snapshot has no released courses")
    for course in courses:
        validate_projected_course(course)
    refs = [{key: course[key] for key in ("courseId", "schemaVersion", "revision", "digest", "status")} for course in courses]
    if snapshot.get("source", {}).get("aggregateDigest") != sha256(refs):
        raise ValueError("snapshot aggregate digest mismatch")


def atomic_write(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry-dir", type=Path, help="Course Registry writable root; omit to export bundled Released r0")
    parser.add_argument("--course-id", action="append", dest="course_ids")
    parser.add_argument("--generated-at", help="ISO-8601 audit timestamp; supplying it makes repeat output byte-identical")
    parser.add_argument("--actor", default="release-exporter")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    repository = CourseRepository(args.registry_dir)
    snapshot = build_snapshot(repository, args.course_ids, generated_at=args.generated_at, actor=args.actor)
    atomic_write(args.output, snapshot)
    print(f"WORKSHOP_SNAPSHOT_READY {snapshot['integrity']['digest']} {args.output}")


if __name__ == "__main__":
    main()
