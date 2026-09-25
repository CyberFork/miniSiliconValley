#!/usr/bin/env python3
"""Stable text IDs. Annotate once; keep attributes when moving/rewording a field.
Never regenerate IDs from DOM paths. --check fails missing/duplicate IDs.
"""
import argparse,json,re
from pathlib import Path
from html.parser import HTMLParser
ELIGIBLE=set('h2 h3 h4 p li td th dt dd b strong em span small div figcaption label'.split())
EXCLUDED=set('button a input textarea select svg canvas'.split())
EX_ATTRS=set('data-module-3d data-transform-role data-transform-feedback data-build-feedback data-voxel-feedback data-voxel-material data-voxel-object-name data-conveyor-caption data-assembly-feedback data-relation-caption data-tradeoff-description data-blackbox-status data-blackbox-output'.split())
VOID=set('area base br col embed hr img input link meta param source track wbr'.split())
class Node:
 def __init__(self,tag='',attrs=(),parent=None,offset=0):
  self.tag=tag;self.attrs=dict(attrs);self.parent=parent;self.children=[];self.text='';self.offset=offset
class Parser(HTMLParser):
 def __init__(self,html):
  super().__init__(convert_charrefs=True);self.root=Node('root');self.cur=self.root;self.lines=[0]
  for m in re.finditer('\n',html):self.lines.append(m.end())
  self.feed(html)
 def handle_starttag(self,t,a):
  line,col=self.getpos();n=Node(t,a,self.cur,self.lines[line-1]+col+1+len(t));self.cur.children.append(n)
  if t not in VOID:self.cur=n
 def handle_startendtag(self,t,a):
  self.handle_starttag(t,a)
  if t not in VOID:self.handle_endtag(t)
 def handle_endtag(self,t):
  p=self.cur
  while p is not self.root and p.tag!=t:p=p.parent
  if p is not self.root:self.cur=p.parent
 def handle_data(self,d):self.cur.text+=d
 def eligible(self):
  out=[]
  def walk(n,blocked=False,path=()):
   blocked=blocked or n.tag in EXCLUDED or bool(EX_ATTRS.intersection(n.attrs))
   if n.tag in ELIGIBLE and not n.children and n.text.strip() and not blocked:out.append((n,path))
   for i,c in enumerate(n.children):walk(c,blocked,path+(i,))
  for i,n in enumerate(self.root.children):walk(n,False,(i,))
  return out

def load(path):return json.JSONDecoder().raw_decode(Path(path).read_text().split('Object.freeze(',1)[1].lstrip())[0]
def write(path,model):Path(path).write_text('(function () {\n "use strict";\n window.MSV_MODULE_DECK = Object.freeze('+json.dumps(model,ensure_ascii=False,indent=2)+');\n})();\n')
def annotate(model):
 for s in model['slides']:
  html=s.get('content','');nodes=Parser(html).eligible();used={n.attrs['data-msv-field'] for n,_ in nodes if 'data-msv-field' in n.attrs};serial=max(s.get('textFieldSequence',0),max([int(x[1:]) for x in used]+[0]))+1;edits=[]
  for n,_ in nodes:
   if 'data-msv-field' in n.attrs:continue
   while f'f{serial:04d}' in used:serial+=1
   value=f'f{serial:04d}';used.add(value);edits.append((n.offset,' data-msv-field="'+value+'"'))
  for pos,value in sorted(edits,reverse=True):html=html[:pos]+value+html[pos:]
  s['content']=html
  s['textFieldSequence']=max([int(x[1:]) for x in used]+[s.get('textFieldSequence',0)])
 return model

def inventory(model,require_ids=False):
 out={};ids=set()
 for s in model['slides']:
  for field in ['title','subtitle']:
   key=s['id']+':'+field;out[key]={'id':key,'original':s.get(field,'')}
  for n,path in Parser(s.get('content','')).eligible():
   raw=s['id']+':body.'+'.'.join(map(str,path));fid=n.attrs.get('data-msv-field')
   if require_ids and not fid:raise ValueError('Missing stable ID: '+raw)
   if fid and not re.fullmatch(r'f\d{4,}',fid):raise ValueError('Invalid stable ID: '+raw)
   key=s['id']+':text.'+fid if fid else raw
   if key in ids:raise ValueError('Duplicate stable ID: '+key)
   ids.add(key);out[raw]={'id':key,'original':n.text}
 return out
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('deck');p.add_argument('--annotate',action='store_true');p.add_argument('--catalog',action='store_true');p.add_argument('--check',action='store_true');a=p.parse_args();m=load(a.deck)
 if a.annotate:write(a.deck,annotate(m))
 result=inventory(m,a.check or a.annotate)
 if not a.check:print(json.dumps(result,ensure_ascii=False,indent=2))
