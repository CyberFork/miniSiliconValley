import json
import unittest
from pathlib import Path

from classroom_api import ClassroomApiAdapter


ROOT = Path(__file__).resolve().parents[1]


class LearnerViewContractTests(unittest.TestCase):
    def test_snapshot_keeps_growth_and_private_information_but_drops_dm_secrets(self) -> None:
        raw = {
            "viewer": {"memberId": "member-me", "nickname": "YB", "reputation": 17, "walletTenths": 25, "unlockIds": ["ask"]},
            "myIdentity": {"name": "观察员", "publicGoal": "找到卡点", "ability": "记录", "privateConcern": "样本太少"},
            "myCards": [{"id": "c1", "title": "车站排队", "body": "等了十分钟", "sharePrompt": "讲给队友", "credibility": "high", "state": "unread", "sourceIds": ["s1"]}],
            "chapter": {"studentGuide": {"scene": "现场", "steps": ["看", "问"], "doneWhen": "记下一条"}},
            "challenge": None,
            "reputationEvidence": [
                {"memberId": "member-me", "points": 1, "evidenceObjectId": "work-1", "reason": "用作品证明"},
                {"memberId": "member-me", "points": 2, "evidenceObjectId": "work-1", "reason": "用作品证明"},
                {"memberId": "teammate", "points": 9, "evidenceObjectId": "hidden", "reason": "队友私密记录"},
            ],
            "economy": {"ledger": [
                {"amountTenths": 6, "fromLabel": "团队金库", "toLabel": "我的钱包", "reason": "个人收益"},
            ]},
            "dmSecrets": {"historyReveal": "must-not-leak"},
            "auth": {"cookie": "must-not-leak"},
        }
        view = ClassroomApiAdapter._learner_view(raw)
        encoded = json.dumps(view, ensure_ascii=False)
        self.assertEqual(view["reputation"], 17)
        self.assertEqual(view["walletTenths"], 25)
        self.assertEqual(view["recentReputation"], {"points": 3, "reason": "用作品证明"})
        self.assertEqual(view["recentWallet"], {"amountTenths": 6, "direction": "in", "reason": "个人收益"})
        self.assertEqual(view["cards"][0]["title"], "车站排队")
        self.assertNotIn("must-not-leak", encoded)
        self.assertNotIn("sourceIds", encoded)

    def test_learner_views_have_stable_visible_schema_and_are_isolated(self) -> None:
        states = []
        for index in range(1, 5):
            states.append({
                "viewer": {"nickname": f"L{index}", "reputation": index, "walletTenths": index * 10,
                           "unlockIds": []},
                "myIdentity": {"name": f"身份{index}", "publicGoal": "目标", "ability": "能力",
                               "privateConcern": "顾虑"},
                "myCards": [{"id": f"c{index}", "title": "私密", "body": "正文",
                             "sharePrompt": "分享", "credibility": "high", "state": "unread",
                             "sourceIds": ["dm-secret"]}],
                "chapter": {"studentGuide": {"scene": "场景", "steps": ["做"], "doneWhen": "完成"}},
                "dmSecrets": {"answer": "hidden"}, "auth": {"cookie": "hidden"},
            })
        views = [ClassroomApiAdapter._learner_view(state) for state in states]
        required = {"displayName", "reputation", "walletTenths", "unlockIds", "recentReputation", "recentWallet", "identity", "cards",
                    "scene", "chapterSteps", "chapterDoneWhen", "realityMission", "challenge"}
        self.assertTrue(all(required <= set(view) for view in views))
        self.assertEqual([view["displayName"] for view in views], ["L1", "L2", "L3", "L4"])
        encoded = json.dumps(views, ensure_ascii=False)
        self.assertNotIn("dm-secret", encoded)
        self.assertNotIn("hidden", encoded)

    def test_learner_ui_preserves_rp_personal_wallet_team_money_and_private_cards(self) -> None:
        seat = (ROOT / "static/seat.js").read_text(encoding="utf-8")
        preview = (ROOT / "static/course-preview.js").read_text(encoding="utf-8")
        card_view = (ROOT / "static/card-view.js").read_text(encoding="utf-8")
        source = seat + preview + card_view
        for phrase in ("我的声望", "我的钱包", "团队资金", "私密卡", "我要说", "我要问", "做成的样子"):
            self.assertIn(phrase, source)
        for phrase in ("function cardBoundary(card)", "F 有来源", "R 课堂模拟", "G 我们猜的", "U 还不知道"):
            self.assertIn(phrase, source)
        learner_branch = preview[preview.index('if (view.kind === "learner")'):preview.index('kicker: view.id === "mentor01"')]
        for forbidden in ("learnerPdmoCount", "intel-network", "dm-gate", "情报节点"):
            self.assertNotIn(forbidden, learner_branch)

    def test_seat_ui_uses_selected_course_and_dynamic_progress(self) -> None:
        source = (ROOT / "static/seat.js").read_text(encoding="utf-8") + (ROOT / "static/course-preview.js").read_text(encoding="utf-8")
        css = (ROOT / "static/seat.css").read_text(encoding="utf-8")
        self.assertIn("learnerCaseName", source)
        self.assertIn("blockCount", source)
        self.assertIn("chapterCount", source)
        self.assertNotIn("GOOGLE 1995—2004", source)
        self.assertNotIn("1995 情境小队", source)
        self.assertNotIn("grid-template-columns:repeat(13", css)

    def test_remote_seat_fetch_carries_claim_capability_and_never_uses_bare_state_endpoint(self) -> None:
        source = (ROOT / "static/seat.js").read_text(encoding="utf-8")
        self.assertIn("function stateUrl()", source)
        self.assertRegex(source, r"\[\s*[\"']clientId[\"']\s*,\s*[\"']lease[\"']\s*\]")
        self.assertIn("fetch(stateUrl()", source)
        self.assertNotIn("fetch('/api/state'", source)

    def test_remote_console_identifies_browser_when_refreshing_its_claims(self) -> None:
        source = (ROOT / "remote-console/static/console.js").read_text(encoding="utf-8")
        self.assertIn("new URLSearchParams({ clientId })", source)
        self.assertIn("seat.lease", source)
        self.assertIn("每台浏览器", (ROOT / "remote-console/static/index.html").read_text(encoding="utf-8"))

    def test_visual_language_is_the_preserved_dark_mission_control(self) -> None:
        css = (ROOT / "static/seat.css").read_text(encoding="utf-8")
        self.assertRegex(css, r"--seat-bg:\s*#061720")
        self.assertRegex(css, r"--seat-warning:\s*#e8b13b")
        self.assertRegex(css, r"color-scheme:\s*dark")


if __name__ == "__main__":
    unittest.main()
