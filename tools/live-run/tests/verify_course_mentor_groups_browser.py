#!/usr/bin/env python3
"""Real /course/ grouping, keyboard/touch and launch-link checks; isolated DB by default."""
import json
import os
import secrets
import subprocess
import tempfile
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from verify_t090_development_mentor_browser import free_port, wait_ready

REPO = Path(__file__).resolve().parents[3]
OUT = Path(os.environ.get('EVIDENCE_DIR', '/tmp/msv-course-groups-browser'))
OUT.mkdir(parents=True, exist_ok=True)


def verify(base, states):
    report = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for role in ['mentor', 'learner']:
            context = browser.new_context(storage_state=states[role], viewport={'width': 1440, 'height': 1000})
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(base + '/course/', wait_until='networkidle')
            groups = page.locator('[data-mentor-group]')
            assert groups.evaluate_all('(els) => els.map(el => el.dataset.mentorGroup)') == ['P', 'D', 'M', 'O']
            titles = ['产品导师', '开发导师', '市场导师', '运营导师']
            for code, title in zip('PDMO', titles):
                section = page.locator(f'#mentor-{code}')
                expect(section.get_by_role('heading', name=title, exact=True)).to_be_visible()
                assert section.locator('article').count() == section.locator(f'article[data-role={code}]').count()
                count = section.locator('article').count()
                expect(page.get_by_role('navigation', name='按导师查找课件').locator(f'a[href="#mentor-{code}"]')).to_contain_text(f'{count} 份课件')
            cards = page.locator('#mentor-D article')
            assert cards.count() == 2
            expect(cards.nth(0)).to_contain_text('模块思维')
            expect(cards.nth(1)).to_contain_text('立棍')
            expect(page.locator('#mentor-O')).to_contain_text('暂无已发布课件')
            presenters = page.get_by_role('link', name='打开导师讲解控制台 ↗', exact=True)
            assert presenters.count() == (2 if role == 'mentor' else 0)
            library_links = page.locator('article a[href^="/course/"]')
            assert library_links.count() == 4
            for href in library_links.evaluate_all('(els) => els.map(el => el.getAttribute("href"))'):
                assert 'revision=' in href and 'digest=' in href
                if os.environ.get('LIVE_ORIGIN'):
                    response = context.request.get(base + href)
                    assert response.status == 200, (href, response.status)
            if role == 'mentor':
                assert '/r8/teacher/' in presenters.nth(0).get_attribute('href')
                assert '/r3/teacher/' in presenters.nth(1).get_attribute('href')
                if os.environ.get('LIVE_ORIGIN'):
                    with page.expect_popup() as popup_info:
                        presenters.nth(0).click()
                    popup = popup_info.value
                    popup.wait_for_load_state('domcontentloaded')
                    assert '/r8/teacher/presenter.html' in popup.url
                    popup.close()
            nav = page.get_by_role('navigation', name='按导师查找课件')
            nav.get_by_role('link', name='D 开发导师 2 份课件').click()
            assert page.url.endswith('#mentor-D')
            page.wait_for_function("Math.abs(document.querySelector('#mentor-D').getBoundingClientRect().top) < 80")
            summary = cards.nth(0).locator('summary')
            summary.focus(); page.keyboard.press('Enter')
            expect(cards.nth(0).locator('details')).to_have_attribute('open', '')
            expect(cards.nth(0)).to_contain_text('digest')
            summary.press('Enter')
            nav.locator('a[href="#mentor-P"]').focus(); page.keyboard.press('Enter')
            assert page.url.endswith('#mentor-P')
            page.screenshot(path=str(OUT / f'{role}-desktop.png'), full_page=True)
            for width in [1440, 820, 390]:
                page.set_viewport_size({'width': width, 'height': 1000})
                page.goto(base + '/course/', wait_until='networkidle')
                dims = page.evaluate('({viewport:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth})')
                assert dims['body'] <= width + 1 and dims['root'] <= width + 1, dims
                # Explicit heading colors on paper must not regress to shell white.
                for heading in page.locator('[data-mentor-group] h2, [data-mentor-group] h3').all():
                    color = heading.evaluate('(el) => getComputedStyle(el).color')
                    assert color == 'rgb(20, 37, 44)', color
                page.screenshot(path=str(OUT / f'{role}-{width}.png'), full_page=True)
            assert not errors, errors
            context.close()
            touch = browser.new_context(storage_state=states[role], viewport={'width': 820, 'height': 1180}, has_touch=True, is_mobile=True)
            pad = touch.new_page(); pad.goto(base + '/course/', wait_until='networkidle')
            pad.locator('a[href="#mentor-D"]').tap()
            assert pad.url.endswith('#mentor-D')
            pad.locator('#mentor-D summary').first.tap()
            expect(pad.locator('#mentor-D details').first).to_have_attribute('open', '')
            touch.close()
            report.append({'role': role, 'groups': 'P/D/M/O', 'order': 'P1/P2', 'mouse': 'PASS', 'keyboard': 'PASS', 'touch': 'PASS', 'widths': [1440, 820, 390], 'errors': errors})
        browser.close()
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('COURSE_MENTOR_GROUPS_BROWSER_PASS', json.dumps(report, ensure_ascii=False))


def main():
    if os.environ.get('LIVE_ORIGIN'):
        verify(os.environ['LIVE_ORIGIN'], {role: f'/tmp/minisv-{role}-qa-state.json' for role in ['mentor', 'learner']})
        return
    with tempfile.TemporaryDirectory(prefix='msv-course-groups-') as temp:
        root = Path(temp); password = secrets.token_urlsafe(20)
        fixture = {'dm': {'username': 'group-admin', 'password': password}, 'mentors': [{'username': 'group-mentor', 'password': password}], 'learners': [{'username': 'group-learner', 'password': password}], 'outsider': {'username': 'group-observer', 'password': password}}
        (root / 'accounts.json').write_text(json.dumps(fixture))
        env = {**os.environ, 'CI': '1', 'WRANGLER_SEND_METRICS': 'false'}
        subprocess.run(['node_modules/.bin/tsx', 'scripts/generate-auth-seed.ts', '--accounts', str(root / 'accounts.json'), '--output', str(root / 'seed.sql')], cwd=REPO, env=env, check=True, capture_output=True)
        subprocess.run(['node_modules/.bin/wrangler', 'd1', 'execute', 'DB', '--yes', '--json', '--local', '--persist-to', temp, '--config', 'dist/server/wrangler.json', '--file', str(root / 'seed.sql')], cwd=REPO, env=env, check=True, capture_output=True)
        port = free_port(); base = f'http://127.0.0.1:{port}'
        with (root / 'server.log').open('w') as log:
            process = subprocess.Popen([str(REPO / 'node_modules/.bin/wrangler'), 'dev', '--config', 'wrangler.json', '--persist-to', temp, '--ip', '127.0.0.1', '--port', str(port), '--no-show-interactive-dev-session'], cwd=REPO / 'dist/server', env=env, stdout=log, stderr=subprocess.STDOUT)
            try:
                wait_ready(port, process, root / 'server.log')
                states = {}
                with sync_playwright() as p:
                    for role in ['mentor', 'learner']:
                        api = p.request.new_context(base_url=base, extra_http_headers={'Origin': base})
                        response = api.post('/api/auth/login', data={'username': f'group-{role}', 'password': password})
                        assert response.status == 200, response.status
                        states[role] = api.storage_state(); api.dispose()
                verify(base, states)
            finally:
                process.terminate(); process.wait(timeout=20)


if __name__ == '__main__':
    main()
