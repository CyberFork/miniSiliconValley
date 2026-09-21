"""Browser acceptance checks for the standalone text editor dialog."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[3]


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/courseware/shared/tests/text-editor-fixture.html":
            html = """<!doctype html><meta charset='utf-8'><link rel='stylesheet' href='../text-editor.css'><script src='../text-editor-dialog.js'></script><script>
window.__bubble=0;window.__closed=false;window.__preview='';window.__saveMode='ok';
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')window.__bubble++});
window.openEditor=()=>{window.__closed=false;MSVTextEditorDialog.open({label:'测试字段',value:'<b>原文</b>',originalValue:'<b>原文</b>',onPreview:v=>window.__preview=v,onClose:()=>window.__closed=true,onSave:v=>new Promise((resolve,reject)=>{if(window.__saveMode==='reject')reject(new Error('测试保存失败'));else if(window.__saveMode==='pending')window.__resolveSave=resolve;else resolve(v)})})};
</script>"""
            body = html.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *_args):
        pass


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 390, "height": 844})
            page.set_default_timeout(3000)
            page.goto(f"http://127.0.0.1:{server.server_port}/courseware/shared/tests/text-editor-fixture.html")
            page.evaluate("window.openEditor()")
            page.wait_for_selector(".msv-text-editor-dialog[open]")
            assert page.locator(".msv-text-editor-textarea").input_value() == "<b>原文</b>"
            assert page.locator(".msv-text-editor-dialog b").count() == 0
            assert page.locator(".msv-text-editor-dialog").bounding_box()["width"] <= 390

            page.evaluate("window.__bubble = 0")
            page.locator(".msv-text-editor-textarea").press("ArrowRight")
            assert page.evaluate("window.__bubble") == 0
            page.locator(".msv-text-editor-textarea").fill("新文字")
            page.get_by_role("button", name="预览修改").click()
            assert page.evaluate("window.__preview") == "新文字"
            page.get_by_role("button", name="恢复原文").click()
            assert page.locator(".msv-text-editor-textarea").input_value() == "<b>原文</b>"
            assert page.evaluate("window.__preview") == "<b>原文</b>"
            page.get_by_role("button", name="取消").click()
            assert page.evaluate("window.__closed") is True

            page.evaluate("window.openEditor()")
            page.locator(".msv-text-editor-textarea").fill("保留输入")
            page.evaluate("window.__saveMode = 'reject'")
            page.get_by_role("button", name="保存为新版").click()
            page.wait_for_selector(".msv-text-editor-error:not([hidden])")
            assert page.locator(".msv-text-editor-textarea").input_value() == "保留输入"

            page.evaluate("window.__saveMode = 'pending'")
            page.get_by_role("button", name="保存为新版").click()
            assert page.locator(".msv-text-editor-textarea").is_disabled()
            assert page.get_by_role("button", name="保存为新版").is_disabled()
            page.keyboard.press("Escape")
            assert page.locator(".msv-text-editor-dialog").is_visible()
            page.evaluate("window.__resolveSave()")
            page.wait_for_selector(".msv-text-editor-dialog:not([open])", state="attached")

            page.evaluate("window.openEditor()")
            page.locator(".msv-text-editor-textarea").fill("再次编辑")
            assert page.locator(".msv-text-editor-textarea").input_value() == "再次编辑"
            assert page.evaluate("window.innerWidth - document.documentElement.clientWidth") >= 0
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
    print("text editor dialog checks passed")
