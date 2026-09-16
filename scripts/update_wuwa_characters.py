import json, os, re, sys
from datetime import datetime, timezone
import requests
URL='https://api.kurobbs.com/wiki/core/catalogue/item/getPage'
HEADERS={'wiki_type':'9','source':'h5','Referer':'https://wiki.kurobbs.com/','User-Agent':'Mozilla/5.0'}
r=requests.post(URL,headers=HEADERS,data={'catalogueId':'1105','page':'1','limit':'100'},timeout=30)
r.raise_for_status(); payload=r.json()
def lists(o):
    if isinstance(o,list):
        if len(o)>=10 and sum(isinstance(x,dict) for x in o)>=min(10,len(o)): yield o
        for x in o: yield from lists(x)
    elif isinstance(o,dict):
        for v in o.values(): yield from lists(v)
candidates=list(lists(payload))
records=max(candidates,key=lambda a:sum(1 for x in a if isinstance(x,dict) and ('name' in x or 'content' in x)),default=[])
url_re=re.compile(r'https?://[^\"\'<> ]+?\.(?:png|jpg|jpeg|webp)(?:\?[^\"\'<> ]*)?',re.I)
def image_from(rec):
    preferred=[]; other=[]
    def walk(o,path=''):
        if isinstance(o,dict):
            for k,v in o.items(): walk(v,path+'/'+str(k))
        elif isinstance(o,list):
            for i,v in enumerate(o): walk(v,path+'/'+str(i))
        elif isinstance(o,str):
            for u in url_re.findall(o):
                (preferred if re.search(r'icon|cover|avatar|head|role|portrait|image|img',path,re.I) else other).append(u)
    walk(rec); return (preferred+other+[""])[0]
out=[]
for rec in records:
    if not isinstance(rec,dict): continue
    name=str(rec.get('name') or '').strip()
    if not name and isinstance(rec.get('content'),dict): name=str(rec['content'].get('name') or '').strip()
    if not name: continue
    rid=str(rec.get('id') or rec.get('entryId') or rec.get('itemId') or '')
    out.append({'id':rid or name,'name':name,'image':image_from(rec),'source':'https://wiki.kurobbs.com/mc/home'})
seen=set(); out=[x for x in out if not (x['name'] in seen or seen.add(x['name']))]
if len(out)<30:
    print('Refusing to overwrite: parsed only',len(out),'records',file=sys.stderr); sys.exit(2)
os.makedirs('wuwa/data',exist_ok=True)
with open('wuwa/data/characters.json','w',encoding='utf-8') as f:
    json.dump({'source':'库街区《鸣潮》WIKI 共鸣者目录 API','updated_at':datetime.now(timezone.utc).isoformat(),'characters':out},f,ensure_ascii=False,indent=2)
print('wrote',len(out),'characters;',sum(bool(x['image']) for x in out),'with images')
