import json
import re
from pathlib import Path

ROOT = Path(__file__).parents[1]
SITE = ROOT / 'site'
JS = (SITE / 'courseware-current.js').read_text(encoding='utf-8')
RELEASE = (ROOT / 'package_release.py').read_text(encoding='utf-8')
GATEWAY = (ROOT / 'gateway/default.conf').read_text(encoding='utf-8')


def test_release_generates_latest_pointer_and_permanent_landing_pages():
    assert 'courseware-current.json' in RELEASE
    assert 'output / "courseware" / "latest" / key / "index.html"' in RELEASE
    assert 'current[key] = {"teacher": teacher + "presenter.html"' in RELEASE
    assert 'courseware-current.js' in RELEASE
    assert 'courseware/latest/' in GATEWAY


def test_navigation_uses_only_known_same_origin_courseware_targets():
    assert "fetch('/courseware-current.json'" in JS
    assert "location.replace(target + query())" in JS
    assert "target.includes('..')" in JS
    assert re.search(r"record\.teacher\.startsWith\(base\)", JS)
    assert re.search(r"startsWith\(base\).*r\\d\+", JS)
    assert 'http://' not in JS and 'https://' not in JS


def test_query_contract_excludes_legacy_digest_and_revision():
    keys = re.search(r"for \(const key of \[([^]]+)\]\)", JS).group(1)
    assert set(re.findall(r"'([^']+)'", keys)) == {'session', 'slideId', 'slide', 'step'}
    assert 'digest' not in JS
    assert 'revision' not in JS


def test_old_page_opens_new_window_and_does_not_save_or_delete_text():
    assert "link.target = '_blank'" in JS
    assert '不会关闭本页' in JS
    assert 'localStorage' not in JS
    assert 'beforeunload' not in JS and 'unload' not in JS
    assert 'writeText(input.value)' in JS


def test_teacher_authorization_contract_remains_protected():
    assert 'teacherAuthorization' in RELEASE
    assert 'server-side-admin-or-mentor' in RELEASE
    # Navigation chrome is an injected script only; it must not add auth routes.
    assert 'auth' not in JS.lower()


def test_gateway_injects_only_teacher_entry_routes_and_serves_metadata_same_origin():
    assert "<script src=\"/courseware-current.js\"></script>" in GATEWAY
    assert 'location = /courseware-current.js' in GATEWAY
    assert 'location = /courseware-current.json' in GATEWAY
    injection = re.search(r"~\^/courseware/\(([^)]*)\).*teacher/", GATEWAY)
    assert injection and 'development-mentor-module-thinking' in injection.group(1)
