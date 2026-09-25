"""Loopback-only deck preview with durable, isolated text-edit revisions."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, unquote
import argparse
import json
from local_text_store import TextStore, TextError


class FreshHandler(SimpleHTTPRequestHandler):
    store = None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def send_head(self):
        for name in ['If-Modified-Since', 'If-None-Match']:
            if name in self.headers:
                del self.headers[name]
        return super().send_head()

    def reply(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(data)

    def api(self):
        path = urlsplit(self.path)
        if not path.path.startswith('/api/'):
            return False
        try:
            port = self.server.server_port
            allowed = {f'127.0.0.1:{port}', f'localhost:{port}'}
            host, origin = self.headers.get('Host'), self.headers.get('Origin')
            if host not in allowed or (origin is not None and origin != f'http://{host}') or (self.command == 'POST' and origin != f'http://{host}'):
                raise TextError('本地编辑只接受本机同源请求。', 403)
            prefix = '/api/courseware/text-editions/'
            if not path.path.startswith(prefix) or '/' in path.path[len(prefix):]:
                raise TextError('本地预览未提供此接口。', 404)
            deck = unquote(path.path[len(prefix):])
            if self.command == 'GET':
                query = parse_qs(path.query)
                revision = int(query['revision'][0]) if 'revision' in query else None
                data = self.store.read(deck, query.get('base', [''])[0], revision)
            elif self.command == 'POST':
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise TextError('保存请求必须使用JSON。', 415)
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 16384:
                    raise TextError('请求长度无效。', 413)
                self.connection.settimeout(5)
                data = self.store.save(deck, json.loads(self.rfile.read(length)))
            else:
                raise TextError('不支持此操作。', 405)
            self.reply(200, {'ok': True, 'data': data})
        except TextError as error:
            self.reply(error.status, {'ok': False, 'error': {'message': str(error)}})
        except (ValueError, UnicodeError, TimeoutError):
            self.reply(400, {'ok': False, 'error': {'message': '请求内容无效。'}})
        return True

    def do_GET(self):
        if not self.api():
            super().do_GET()

    def do_POST(self):
        if not self.api():
            self.reply(404, {'ok': False, 'error': {'message': '本地预览未提供此接口。'}})


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=18135)
    parser.add_argument('--state-dir', type=Path, default=Path.home() / '.local/share/minisv/courseware-preview')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    FreshHandler.store = TextStore(args.state_dir / 'courseware-text.sqlite3', root / 'deck-data.js')
    print(f'Local preview + text editing: http://127.0.0.1:{args.port}/dist/teacher/presenter.html?session=games-review', flush=True)
    print(f'Local-only text data: {FreshHandler.store.path}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), partial(FreshHandler, directory=str(root))).serve_forever()
