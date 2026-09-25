#!/usr/bin/env python3
"""Real Chromium T-125 flow with isolated accounts, classroom and D1."""
from __future__ import annotations
import http.client,json,os,re,socket,subprocess,tempfile,time
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import expect,sync_playwright
REPO=Path(__file__).resolve().parents[3]; CHROME=Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
def port():
 with socket.socket() as s:s.bind(("127.0.0.1",0));return int(s.getsockname()[1])
def ready(p,proc,log):
 end=time.monotonic()+60
 while time.monotonic()<end:
  if proc.poll() is not None:raise RuntimeError(log.read_text(errors="replace"))
  try:
   c=http.client.HTTPConnection("127.0.0.1",p,timeout=1);c.request("GET","/api/auth/session");r=c.getresponse();r.read();c.close()
   if r.status in (200,401):return
  except OSError:pass
  time.sleep(.2)
 raise TimeoutError(log.read_text(errors="replace"))
def login(page,base,user,password,dest):
 page.goto(f"{base}/auth/login/?returnTo={quote(dest)}",wait_until="networkidle");page.locator('input[name="username"]').fill(user);page.locator('input[name="password"]').fill(password);page.get_by_role("button",name="进入 Mini Silicon Valley").click();page.wait_for_url(f"**{dest}")
def no_overflow(page,label):
 size=page.evaluate("()=>({w:innerWidth,b:document.body.scrollWidth,d:document.documentElement.scrollWidth})");assert size["b"]<=size["w"]+1 and size["d"]<=size["w"]+1,(label,size)
def main():
 assert(REPO/"dist/server/wrangler.json").exists()
 p=port();base=f"http://127.0.0.1:{p}";password="T125 isolated browser password 2026!"
 with tempfile.TemporaryDirectory(prefix="msv-t125-browser-") as temp:
  root=Path(temp);accounts=root/"accounts.json";seed=root/"seed.sql";room=root/"room.sql";log=root/"server.log"
  accounts.write_text(json.dumps({"dm":{"username":"t125-admin","name":"T125 Admin","password":password},"mentors":[{"username":"t125-mentor","name":"T125 导师","password":password}],"learners":[{"username":"t125-learner-a","name":"T125 学员甲","password":password},{"username":"t125-learner-b","name":"T125 学员乙","password":password}],"outsider":{"username":"t125-outsider","name":"T125 Outside","password":password}},ensure_ascii=False))
  now="2026-09-15T00:00:00.000Z";room.write_text(f"""
INSERT INTO course_versions(course_id,revision,schema_version,digest,package_json,created_at,created_by) VALUES('t125-course',1,1,'t125-digest','{{}}','{now}','t125-admin');
INSERT INTO rooms(id,code,title,campaign_id,chapter_id,phase,status,dm_profile_id,version,paused,player_timeline_frozen,history_revealed,created_at,updated_at) VALUES('t125-room','T125-ROOM','T125 创意小队','t125','B01','lobby','active','t125-mentor',1,0,0,0,'{now}','{now}');
INSERT INTO classroom_instances(room_id,environment,learner_count,lifecycle,state_machine_version,course_id,course_revision,course_digest,factory_key,reset_generation,created_at,updated_at) VALUES('t125-room','test',2,'ready',1,'t125-course',1,'t125-digest','t125-fixture',0,'{now}','{now}');
INSERT INTO memberships(id,room_id,profile_id,role,seat,status,last_seen_at,created_at,updated_at) VALUES('t125-mm','t125-room','t125-mentor','dm',NULL,'active','{now}','{now}','{now}');
INSERT INTO memberships(id,room_id,profile_id,role,seat,status,last_seen_at,created_at,updated_at) VALUES('t125-ma','t125-room','t125-learner-a','learner',1,'active','{now}','{now}','{now}');
INSERT INTO memberships(id,room_id,profile_id,role,seat,status,last_seen_at,created_at,updated_at) VALUES('t125-mb','t125-room','t125-learner-b','learner',2,'active','{now}','{now}','{now}');
""")
  env={**os.environ,"CI":"1","NO_COLOR":"1","WRANGLER_SEND_METRICS":"false"}
  subprocess.run([str(REPO/"node_modules/.bin/tsx"),"scripts/generate-auth-seed.ts","--accounts",str(accounts),"--output",str(seed)],cwd=REPO,env=env,check=True,capture_output=True,text=True)
  for sql in (seed,room):subprocess.run([str(REPO/"node_modules/.bin/wrangler"),"d1","execute","DB","--yes","--local","--persist-to",temp,"--config","dist/server/wrangler.json","--file",str(sql)],cwd=REPO,env=env,check=True,capture_output=True,text=True)
  with log.open("w") as out:
   proc=subprocess.Popen([str(REPO/"node_modules/.bin/wrangler"),"dev","--config","wrangler.json","--persist-to",temp,"--ip","127.0.0.1","--port",str(p),"--no-show-interactive-dev-session"],cwd=REPO/"dist/server",env=env,stdout=out,stderr=subprocess.STDOUT,text=True)
   try:
    ready(p,proc,log)
    with sync_playwright() as pw:
     launch={"headless":True};
     if CHROME.exists():launch["executable_path"]=str(CHROME)
     browser=pw.chromium.launch(**launch)
     mentor=browser.new_context(viewport={"width":1440,"height":1000});mp=mentor.new_page();errors=[];mp.on("pageerror",lambda e:errors.append(str(e)))
     login(mp,base,"t125-mentor",password,"/console/homework/");expect(mp.get_by_role("heading",name="课后作业")).to_be_visible();expect(mp.get_by_text("模板工坊",exact=False)).to_be_visible();no_overflow(mp,"console")
     mp.get_by_label("模板名称").fill("每周创意行动卡");mp.get_by_label("给导师看的模板说明").fill("每周可以重复使用，但每次发放保留当时版本")
     mp.get_by_label("题目文字").fill("本周最想解决的具体问题")
     mp.get_by_role("button",name="＋ 添加题目").click();mp.get_by_label("题目文字").nth(1).fill("你准备先怎么做")
     mp.get_by_label("题型").nth(1).select_option("single");mp.get_by_label("选项（每行一个）").fill("先采访\n先画图")
     mp.get_by_role("button",name="创建模板").click();expect(mp.get_by_role("status")).to_contain_text("已保存")
     mp.get_by_label("目标课堂").select_option("t125-room");mp.get_by_label("本次标题").fill("第一周：找到一个真问题");mp.get_by_label("发放说明").fill("写一个你今天真的见到的问题")
     mp.once("dialog",lambda d:d.accept());mp.get_by_role("button",name="检查收件人并发放").click();expect(mp.get_by_role("status")).to_contain_text("已发给 2 名学员")
     learner=browser.new_context(viewport={"width":390,"height":844},has_touch=True,is_mobile=True);lp=learner.new_page();lp.on("pageerror",lambda e:errors.append(str(e)))
     login(lp,base,"t125-learner-a",password,"/terminal/homework/");expect(lp.get_by_text("第一周：找到一个真问题",exact=True).first).to_be_visible();no_overflow(lp,"learner-mobile")
     clock=lp.locator("header time");expect(clock).to_have_text(re.compile(r"^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$"));assert clock.get_attribute("datetime")
     lp.evaluate("document.fonts.ready");assert lp.evaluate('document.fonts.check(\'12px "Terrarum Sans Bitmap"\')')
     families=lp.evaluate("()=>['main','header time','header details summary','button'].map(selector=>getComputedStyle(document.querySelector(selector)).fontFamily)")
     assert all("Terrarum Sans Bitmap" in family for family in families),families
     lp.get_by_label("本周最想解决的具体问题").fill("午餐时间排队太久")
     lp.get_by_text("先采访",exact=True).click();lp.get_by_role("button",name="提交给导师").click();expect(lp.get_by_text("提交成功",exact=False)).to_be_visible()
     mp.reload(wait_until="networkidle");expect(mp.get_by_text("1/2 已提交")).to_be_visible();mp.get_by_text("T125 学员甲",exact=True).click();expect(mp.get_by_text("午餐时间排队太久",exact=True)).to_be_visible();mp.get_by_label("导师反馈").fill("很好，再记录三个人各自等了多久。")
     mp.get_by_role("button",name="保存反馈").click();expect(mp.get_by_role("status")).to_contain_text("已保存给 T125 学员甲")
     lp.reload(wait_until="networkidle");expect(lp.get_by_text("很好，再记录三个人各自等了多久。",exact=True)).to_be_visible();no_overflow(lp,"learner-feedback")
     desktop=browser.new_context(viewport={"width":1440,"height":1000});dp=desktop.new_page();login(dp,base,"t125-learner-a",password,"/terminal/")
     expect(dp.locator("header time")).to_have_text(re.compile(r"^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$"));no_overflow(dp,"learner-desktop")
     status_size=dp.locator("header").first.evaluate("el=>({client:el.clientWidth,scroll:el.scrollWidth})");assert status_size["scroll"]<=status_size["client"],status_size
     desktop.close()
     assert not errors,errors;browser.close()
   finally:
    proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill()
 print("T125_BROWSER_PASS template=versioned assignment=2-recipients learner=touch-submit mentor=feedback terminal-clock=local terminal-font=terrarum d1=isolated overflow=none")
if __name__=="__main__":main()
