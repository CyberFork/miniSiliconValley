"""Isolated HTTP round trip: temporary DB, never the user's preview revisions."""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import socket

ROOT = Path(__file__).resolve().parents[1]
SPEC = json.JSONDecoder().raw_decode((ROOT.parent / 'deck-data.js').read_text().split('Object.freeze(', 1)[1].lstrip())[0]


class LocalTextApiTest(unittest.TestCase):
    def test_persist_conflict_isolation_and_origin(self):
        with tempfile.TemporaryDirectory() as directory:
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            origin = f'http://127.0.0.1:{port}'
            endpoint = origin + '/api/courseware/text-editions/' + SPEC['id']
            query = '?base=' + SPEC['version']
            process = None

            def start():
                p = subprocess.Popen([sys.executable, str(ROOT / 'serve.py'), '--port', str(port), '--state-dir', directory], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                for _ in range(100):
                    try:
                        with urlopen(endpoint + query, timeout=.3) as response:
                            self.assertEqual(response.status, 200)
                            return p
                    except OSError:
                        if p.poll() is not None:
                            raise AssertionError('preview failed to start')
                        time.sleep(.03)
                p.terminate()
                raise AssertionError('preview timeout')

            def get():
                with urlopen(endpoint + query, timeout=2) as response:
                    return json.load(response)['data']

            def save(revision, value, source=origin):
                body = {'base': SPEC['version'], 'expectedRevision': revision, 'key': 'module-my-start:title', 'value': value}
                request = Request(endpoint, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'Origin': source})
                try:
                    with urlopen(request, timeout=3) as response:
                        return response.status, json.load(response)
                except HTTPError as error:
                    return error.code, json.load(error)

            try:
                process = start()
                self.assertEqual(get()['storage'], 'local-preview')
                self.assertEqual(save(0, '仅隔离测试')[0], 200)
                self.assertEqual(get()['edition']['patches']['module-my-start:title'], '仅隔离测试')
                self.assertEqual(save(1, '恶意跨站', 'https://example.invalid')[0], 403)
                with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                    results = list(pool.map(lambda text: save(1, text)[0], ['A', 'B']))
                self.assertEqual(sorted(results), [200, 409])
                process.terminate(); process.wait()
                process = start()
                self.assertEqual(get()['latestRevision'], 2)
                self.assertEqual(save(2, None)[0], 200)
                self.assertEqual(get()['edition']['patches'], {})
                with urlopen(endpoint + query + '&revision=1') as response:
                    self.assertEqual(json.load(response)['data']['edition']['patches']['module-my-start:title'], '仅隔离测试')
                with urlopen(origin + '/dist/teacher/presenter.html') as response:
                    self.assertIn(b'presenter-runtime', response.read())
            finally:
                if process is not None:
                    process.terminate(); process.wait()


if __name__ == '__main__':
    unittest.main()
