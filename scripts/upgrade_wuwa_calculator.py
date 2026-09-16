from __future__ import annotations
import csv, io, json, re, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'tools/wuwa-echo-calculator/app.js'
INDEX = ROOT / 'tools/wuwa-echo-calculator/index.html'
SAVE = ROOT / 'wuwa/profile-save-v2.js'
MECH = ROOT / 'wuwa/data/character-mechanics.json'
ROSTER = ROOT / 'wuwa/data/characters.json'

LEGACY_URL = 'https://raw.githubusercontent.com/GQin404/WuwaEchoTool/c04432a2082103fae8324067e711db7ef9bf22d1/js/base.js'
CURRENT_URL = 'https://raw.githubusercontent.com/Kuimuztion/MingEchoAssistant_Final/main/database/character_profiles.csv'
PANEL_URL = 'https://raw.githubusercontent.com/Kuimuztion/MingEchoAssistant_Final/main/resources/Role/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.md'
WEAPON_MAP_URL = 'https://raw.githubusercontent.com/liangshi233/liangshi-calc/master/damage/liangshi-mc/data/weapon.js'
WEAPON_CALC_URLS = [
    'https://raw.githubusercontent.com/liangshi233/liangshi-calc/master/damage/liangshi-mc/weapon/broadblade/calc.js',
    'https://raw.githubusercontent.com/liangshi233/liangshi-calc/master/damage/liangshi-mc/weapon/sword/calc.js',
    'https://raw.githubusercontent.com/liangshi233/liangshi-calc/master/damage/liangshi-mc/weapon/pistols/calc.js',
    'https://raw.githubusercontent.com/liangshi233/liangshi-calc/master/damage/liangshi-mc/weapon/gauntlets/calc.js',
    'https://raw.githubusercontent.com/liangshi233/liangshi-calc/master/damage/liangshi-mc/weapon/rectifier/calc.js',
]

def get(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent':'etg227-wuwa-tool-sync/1.0'})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode('utf-8-sig')

def fnum(s, default=0.0):
    try: return float(s)
    except Exception: return default

def obj_field(obj: str, key: str, string=False):
    if string:
        m=re.search(rf'["\']{re.escape(key)}["\']\s*:\s*["\']([^"\']*)["\']', obj)
        return m.group(1) if m else None
    m=re.search(rf'["\']{re.escape(key)}["\']\s*:\s*(-?\d+(?:\.\d+)?)', obj)
    return fnum(m.group(1)) if m else None

ALIASES = {
    '雪豹':'凌阳','赤霞':'炽霞','坎特雷拉':'坎特蕾拉','清霄':'清宵',
    '光主-男':'漂泊者-男-衍射','光主-女':'漂泊者-女-衍射',
    '暗主-男':'漂泊者-男-湮灭','暗主-女':'漂泊者-女-湮灭',
    '风主男':'漂泊者-男-气动','风主女':'漂泊者-女-气动',
    '漂泊者·衍射':'__ROVER_SPECTRO__','漂泊者·湮灭':'__ROVER_HAVOC__',
    '漂泊者·气动':'__ROVER_AERO__','漂泊者·导电':'__ROVER_ELECTRO__',
}
def norm(name: str) -> str: return ALIASES.get(name, name)

def parse_legacy(text: str):
    block = text.split('const roleList = [',1)[1].split('];',1)[0]
    roles={}
    for m in re.finditer(r'\{(.*?)\}', block, re.S):
        o=m.group(1); name=obj_field(o,'name',True); rid=obj_field(o,'id')
        if not name or rid is None: continue
        rec={'legacy_id':int(rid),'name':norm(name),'rule':int(obj_field(o,'rule') or 1),'type_weights':{
            'basic':obj_field(o,'normal') or 0,'skill':obj_field(o,'skill') or 0,'heavy':obj_field(o,'heavy') or 0,
            'liberation':obj_field(o,'liberate') or 0,'other':obj_field(o,'other') or 0}}
        roles[rec['name']]=rec
    chain_by_id={}
    if 'const RoleSumProperty = [' in text:
        rb=text.split('const RoleSumProperty = [',1)[1]
        for rec in roles.values():
            rid=rec['legacy_id']
            pat=rf'\{{\s*["\']id["\']\s*:\s*{rid}\s*,.*?["\']mzProperty["\']\s*:\s*\[(.*?)\]\s*,\s*["\']mzRule["\']'
            mm=re.search(pat,rb,re.S)
            if not mm: continue
            arr=[]
            for om in re.finditer(r'\{([^{}]+)\}',mm.group(1)):
                o=om.group(1); w={'basic':obj_field(o,'normal') or 0,'skill':obj_field(o,'skill') or 0,'heavy':obj_field(o,'heavy') or 0,'liberation':obj_field(o,'liberate') or 0,'other':obj_field(o,'other') or 0}
                if sum(w.values())>0: arr.append(w)
            if arr: chain_by_id[rid]=arr[:6]
    for rec in roles.values():
        arr=chain_by_id.get(rec['legacy_id'],[])
        if arr: rec['chain_type_weights']={str(i+1):w for i,w in enumerate(arr)}
    return roles

def parse_current(text: str):
    out={}
    for row in csv.DictReader(io.StringIO(text)):
        name=norm((row.get('name') or '').strip())
        if not name: continue
        w={'basic':fnum(row.get('basic')),'heavy':fnum(row.get('heavy')),'skill':fnum(row.get('skill')),'liberation':fnum(row.get('liberation'))}
        w['other']=max(0.0,1.0-sum(w.values()))
        out[name]={'name':name,'type_weights':w,'role':row.get('role','')}
    return out

def parse_exclusive(text: str):
    m=re.search(r'export const exclusive\s*=\s*\{(.*?)\n\}',text,re.S); out={}
    if not m:return out
    for n,w in re.findall(r'["\']([^"\']+)["\']\s*:\s*["\']([^"\']+)["\']',m.group(1)):
        out[norm(n.replace('/','·'))]=w
    return out

def parse_panel_signatures(text: str):
    out={}
    for p in re.split(r'(?m)^#\s+',text)[1:]:
        title=p.splitlines()[0].strip(); m=re.search(r'(?m)^武器[：:]\s*([^\n]+)',p)
        if not m:continue
        first=re.split(r'\s*(?:>|≈|=|≥|＞|\||/|，|,)\s*',m.group(1).strip())[0].strip(' 《》「」')
        if first: out[norm(title)]=first
    return out

WEAPON_KEY_MAP={'atkPct':'atkPct','hpPct':'hpPct','defPct':'defPct','crit':'critRate','critRate':'critRate','critDamage':'critDmg','dmg':'globalDmg','aDmg':'basicDmg','a2Dmg':'heavyDmg','eDmg':'skillDmg','qDmg':'liberationDmg'}
def parse_weapon_effect(name: str, combined: str):
    if not name:return []
    pos=combined.find('"'+name+'"')
    if pos<0: pos=combined.find("'"+name+"'")
    if pos<0:return []
    tail=combined[pos:]; nxt=re.search(r'\n\s{4}["\'][^"\']+["\']\s*:',tail[10:]); seg=tail[:(10+nxt.start())] if nxt else tail[:3500]
    effects=[]
    for key,val in re.findall(r"staticStep\(\s*['\"](\w+)['\"]\s*,\s*(-?\d+(?:\.\d+)?)",seg):
        kind=WEAPON_KEY_MAP.get(key)
        if kind:effects.append({'kind':kind,'value':fnum(val),'apply':'combat','source':'weapon-static'})
    for key,val in re.findall(r'\b(\w+)\s*:\s*step\(\s*(-?\d+(?:\.\d+)?)',seg):
        kind=WEAPON_KEY_MAP.get(key)
        if kind:effects.append({'kind':kind,'value':fnum(val),'apply':'combat','source':'weapon-trigger'})
    uniq=[];seen=set()
    for e in effects:
        k=(e['kind'],e['value'],e['source'])
        if k not in seen: seen.add(k);uniq.append(e)
    return uniq

RULE_SCALER={1:'atk',2:'atk',3:'atk',4:'hp',5:'def',6:'hp',7:'atk',8:'hp',9:'atk',10:'def'}
def rover_expand(name, rec, target):
    groups={'__ROVER_SPECTRO__':['漂泊者-男-衍射','漂泊者-女-衍射'],'__ROVER_HAVOC__':['漂泊者-男-湮灭','漂泊者-女-湮灭'],'__ROVER_AERO__':['漂泊者-男-气动','漂泊者-女-气动'],'__ROVER_ELECTRO__':['漂泊者-男-导电','漂泊者-女-导电']}
    for n in groups.get(name,[name]): target[n]=json.loads(json.dumps(rec,ensure_ascii=False))

def build_mechanics():
    legacy=parse_legacy(get(LEGACY_URL)); current=parse_current(get(CURRENT_URL)); weapon_map=parse_exclusive(get(WEAPON_MAP_URL))
    try: panel_map=parse_panel_signatures(get(PANEL_URL))
    except Exception: panel_map={}
    weapon_src='\n'.join(get(u) for u in WEAPON_CALC_URLS); roster=json.loads(ROSTER.read_text(encoding='utf-8'))['characters']
    curx={}; [rover_expand(n,r,curx) for n,r in current.items()]; current=curx
    wmx={}; [rover_expand(n,{'weapon':w},wmx) for n,w in weapon_map.items()]; weapon_map={n:r['weapon'] for n,r in wmx.items()}
    legacyx={}; [rover_expand(n,r,legacyx) for n,r in legacy.items()]; legacy=legacyx
    chars={}
    for item in roster:
        name=item['name']; base=legacy.get(name) or current.get(name)
        if not base: continue
        rec={'verified':True,'scaler':RULE_SCALER.get(int(base.get('rule',1)),'atk'),'type_weights':base['type_weights'],'innate':[],'chains':[],'source_kind':'WuwaEchoTool' if name in legacy else 'MingEchoAssistant','source_url':'https://wiki.kurobbs.com/mc/home'}
        if base.get('chain_type_weights'):rec['chain_type_weights']=base['chain_type_weights']
        sig=weapon_map.get(name) or panel_map.get(name)
        if sig:
            effects=parse_weapon_effect(sig,weapon_src); rec['signature_weapon']={'name':sig,'effects':effects,'verified':bool(effects)}
        chars[name]=rec
    if '赞妮' in chars:
        z=chars['赞妮']; z.update({'scaler':'atk','defaults':{'sonata':'eternal5','main_echo':'glory','weapon':'signature'},'type_weights':{'heavy':0.76,'liberation':0.12,'basic':0.03,'skill':0.01,'other':0.09},'innate':[{'kind':'elementDmg','value':12,'apply':'combat','scope':'burst'}],'chains':[{'level':1,'effects':[{'kind':'elementDmg','value':50,'apply':'combat','scope':'burst'}]},{'level':2,'effects':[{'kind':'critRate','value':20,'apply':'combat','scope':'rotation'}]},{'level':3,'effects':[]},{'level':4,'effects':[{'kind':'atkPct','value':20,'apply':'combat','scope':'rotation'}]},{'level':5,'effects':[]},{'level':6,'effects':[]}]})
        z['signature_weapon']={'name':'焰光裁定','verified':True,'effects':[{'kind':'atkPct','value':12,'apply':'combat','source':'weapon-static'}]}
    out={'source':'WuwaEchoTool (legacy <= 陆·赫斯) + MingEchoAssistant current profiles + Kuro Wiki catalogue; signature names/effects cross-checked with liangshi-calc','updated_at':'2026-09-16','legacy_data_boundary':'陆·赫斯','characters':chars}
    MECH.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); return len(chars),len(roster)

def patch_index():
    s=INDEX.read_text(encoding='utf-8')
    s=re.sub(r'\n\s*<section class="panel">\s*<div class="panel-title-row"><div><span class="step">03</span><h2>角色伤害构成 / 共鸣链</h2>.*?</section>\s*','\n',s,flags=re.S)
    s=re.sub(r'\n\s*<h3>5 只当前声骸独立评分</h3>\s*<div id="echoScoreCards" class="score-grid"></div>','',s)
    s=re.sub(r'\n\s*<div class="score-note" id="scoreMethodNote"></div>','',s)
    if 'id="mechanicSummary"' not in s:
        s=s.replace('<div id="rollControls" hidden></div>','<div id="mechanicSummary" hidden></div><div id="mechanicTags" hidden></div><div id="chainSummary" hidden></div><div id="mechanicSource" hidden></div><div id="characterModelStatus" hidden></div><div id="echoScoreCards" hidden></div><div id="scoreMethodNote" hidden></div>\n  <div id="rollControls" hidden></div>')
    s=re.sub(r'v=20260916-\d+','v=20260916-8',s); INDEX.write_text(s,encoding='utf-8')

def patch_app():
    s=APP.read_text(encoding='utf-8'); start=s.index('function mountGearConfig(){'); end=s.index('function selectCharacter(c){')
    replacement='''function signatureInfo(){return currentProfile()?.signature_weapon||null}\nfunction mountGearConfig(){\n  if($(\'gearAutoConfig\'))return;const host=document.querySelector(\'.intro-panel .profile-grid\');if(!host)return;\n  const wrap=document.createElement(\'div\');wrap.id=\'gearAutoConfig\';wrap.className=\'gear-auto-config\';\n  wrap.innerHTML=`<div class="gear-auto-grid"><label>武器被动<select id="weaponMode"><option value="none">不计专武被动</option></select></label><label>声骸合鸣套装<select id="sonataMode">${Object.entries(SONATAS).map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join(\'\')}</select></label><label>首位声骸效果<select id="mainEchoEffect">${Object.entries(MAIN_ECHO_EFFECTS).map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join(\'\')}</select></label></div>`;host.insertAdjacentElement(\'afterend\',wrap);\n  const st=document.createElement(\'style\');st.id=\'gear-auto-style\';st.textContent=`.gear-auto-config{margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--panel2)}.gear-auto-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.gear-auto-grid label{font-size:11px;color:var(--muted);display:grid;gap:5px}.gear-auto-grid select{width:100%}.echo-mini-grade{font-size:11px;font-weight:900;border:1px solid var(--line);border-radius:999px;padding:2px 7px;margin-left:auto;color:var(--accent)}@media(max-width:760px){.gear-auto-grid{grid-template-columns:1fr}}`;document.head.appendChild(st);\n  [\'weaponMode\',\'sonataMode\',\'mainEchoEffect\'].forEach(id=>$(id).addEventListener(\'change\',()=>{gearTouched=true;calculate()}));\n}\nfunction refreshWeaponOptions(profile,applyDefault=true){const el=$(\'weaponMode\');if(!el)return;const sig=profile?.signature_weapon;el.innerHTML=\'<option value="none">不计专武被动</option>\'+(sig?.name?`<option value="signature">${esc(sig.name)}（专武）</option>`:\'\');el.value=(applyDefault&&sig?.verified)?\'signature\':\'none\'}\nfunction applyProfileDefaults(profile){refreshWeaponOptions(profile,true);if($(\'sonataMode\'))$(\'sonataMode\').value=(profile?.defaults?.sonata&&SONATAS[profile.defaults.sonata])?profile.defaults.sonata:\'none\';if($(\'mainEchoEffect\'))$(\'mainEchoEffect\').value=(profile?.defaults?.main_echo&&MAIN_ECHO_EFFECTS[profile.defaults.main_echo])?profile.defaults.main_echo:\'none\'}\nfunction clearCharacterData(){M={echoes:[blankEcho(4),blankEcho(3),blankEcho(3),blankEcho(1),blankEcho(1)],candidate:blankEcho(4)};gearTouched=false;if($(\'chainLevel\'))$(\'chainLevel\').value=\'0\';[\'totalAtk\',\'totalHp\',\'totalDef\',\'critRate\',\'critDmg\',\'energyRegen\'].forEach(id=>{if($(id))$(id).value=\'\'});[\'elementDmg\',\'globalDmg\',\'globalAmp\'].forEach(id=>{if($(id))$(id).value=\'0\'});if($(\'replaceSlot\'))$(\'replaceSlot\').value=\'0\';if($(\'candidateCost\'))$(\'candidateCost\').value=\'4\';echoCards();candidateRows();[\'overallGain\',\'candidateScore\',\'critFactor\',\'bestStandard\'].forEach(id=>{if($(id))$(id).textContent=\'—\'});if($(\'critState\'))$(\'critState\').textContent=\'—\';if($(\'lineMarginals\'))$(\'lineMarginals\').innerHTML=\'\';if($(\'standardBars\'))$(\'standardBars\').innerHTML=\'\'}\n\n'''
    s=s[:start]+replacement+s[end:]
    s=re.sub(r'function selectCharacter\(c\)\{.*?\n\}function chainEffects',"function selectCharacter(c){const changed=!selectedCharacter||selectedCharacter.id!==c.id;if(changed)clearCharacterData();selectedCharacter=c;$('characterPick').innerHTML=`${avatar(c)}<span class=\"pick-copy\"><b id=\"characterName\">${esc(c.name)}</b><small id=\"rosterSource\">角色数据已加载</small></span>`;$('characterBrowser').hidden=true;const p=currentProfile();if(p?.scaler){$('scaler').value=p.scaler;$('scaler').disabled=true}else $('scaler').disabled=false;applyProfileDefaults(p);calculate()}\nfunction chainEffects",s,flags=re.S)
    s=re.sub(r'function gearEffects\(\)\{.*?\n\}\nfunction allAutoEffects\(profile,chain\)\{return \[\.\.\.chainEffects\(profile,chain\),\.\.\.gearEffects\(\)\]\}',"function gearEffects(){const s=SONATAS[$('sonataMode')?.value]||SONATAS.none;const e=MAIN_ECHO_EFFECTS[$('mainEchoEffect')?.value]||MAIN_ECHO_EFFECTS.none;const w=($('weaponMode')?.value==='signature')?(signatureInfo()?.effects||[]):[];return [...(s.static||[]).map(x=>({...x,source:'sonata-static'})),...(s.combat||[]).map(x=>({...x,source:'sonata-combat'})),...(e.static||[]).map(x=>({...x,source:'main-echo-static'})),...(e.combat||[]).map(x=>({...x,source:'main-echo-combat'})),...w]}\nfunction allAutoEffects(profile,chain){return [...chainEffects(profile,chain),...gearEffects()]}",s,flags=re.S)
    s=re.sub(r'function renderMechanics\(\)\{.*?\n\}\n\nfunction renderMainRows','function renderMechanics(){}\n\nfunction renderMainRows',s,flags=re.S)
    s=re.sub(r"function normalizedWeights\(profile\)\{\n\s*const w=profile\?\.verified\?profile\.type_weights:null;","function normalizedWeights(profile){\n  const chain=Number($('chainLevel')?.value||0);\n  const w=profile?.verified?(profile.chain_type_weights?.[String(chain)]||profile.type_weights):null;",s)
    s=re.sub(r"\n\s*\$\('echoScoreCards'\)\.innerHTML=M\.echoes\.map\(\(e,i\)=>\{.*?\}\)\.join\(''\);","\n  M.echoes.forEach((e,i)=>{const sc=scoreEcho(ctx,e,M.echoes,i,true);if($('miniScore'+i))$('miniScore'+i).textContent=sc.score.toFixed(1);if($('miniGrade'+i))$('miniGrade'+i).textContent=grade(sc.score);});",s,flags=re.S)
    s=re.sub(r"\n\s*const typeText=.*?\n\s*\$\('scoreMethodNote'\)\.innerHTML=.*?;\n",'\n',s,flags=re.S)
    s=s.replace("if(m.status==='fulfilled'&&m.value?.characters)mechanics=m.value;","if(m.status==='fulfilled'&&m.value?.characters){mechanics=m.value;roster=roster.filter(c=>mechanics.characters?.[c.name]);}")
    s=s.replace("loadData().finally(()=>{renderMechanics();calculate()});","loadData().finally(()=>{calculate()});")
    APP.write_text(s,encoding='utf-8')

def patch_save():
    s=SAVE.read_text(encoding='utf-8').replace("const STORAGE_KEY='wuwaEchoBuildProfilesV3';\nconst LEGACY_KEY='wuwaEchoBuildProfilesV2';","const STORAGE_KEY='wuwaEchoBuildProfilesV4';\nconst LEGACY_KEYS=['wuwaEchoBuildProfilesV3','wuwaEchoBuildProfilesV2'];")
    s=s.replace("const legacy=readStore(LEGACY_KEY);\n  if(Object.keys(legacy).length){localStorage.setItem(STORAGE_KEY,JSON.stringify(legacy));return legacy}","for(const key of LEGACY_KEYS){const legacy=readStore(key);if(Object.keys(legacy).length){localStorage.setItem(STORAGE_KEY,JSON.stringify(legacy));return legacy}}")
    s=s.replace('version:3,','version:4,').replace("mainEchoEffect:$('mainEchoEffect')?.value||'none'","mainEchoEffect:$('mainEchoEffect')?.value||'none',\n      weaponMode:$('weaponMode')?.value||'none'")
    s=s.replace("if($('mainEchoEffect')&&p.gear.mainEchoEffect){$('mainEchoEffect').value=p.gear.mainEchoEffect;fire($('mainEchoEffect'))}","if($('mainEchoEffect')&&p.gear.mainEchoEffect){$('mainEchoEffect').value=p.gear.mainEchoEffect;fire($('mainEchoEffect'))}\n    if($('weaponMode')&&p.gear.weaponMode){$('weaponMode').value=p.gear.weaponMode;fire($('weaponMode'))}")
    SAVE.write_text(s,encoding='utf-8')

def main():
    n,total=build_mechanics();patch_index();patch_app();patch_save();print(f'generated mechanics for {n}/{total} catalogue entries; announced entries without public mechanics are intentionally hidden')
if __name__=='__main__':main()
