from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'tools/wuwa-echo-calculator/app.js'
INDEX=ROOT/'tools/wuwa-echo-calculator/index.html'

s=INDEX.read_text(encoding='utf-8')
# Remove all visible/compatibility mechanism explanations; the data remains in the engine.
s=re.sub(r'\n\s*<div class="callout" id="characterModelStatus">.*?</div>','',s,flags=re.S)
s=re.sub(r'\s*<div id="mechanicSummary" hidden></div><div id="mechanicTags" hidden></div><div id="chainSummary" hidden></div><div id="mechanicSource" hidden></div><div id="characterModelStatus" hidden></div><div id="echoScoreCards" hidden></div><div id="scoreMethodNote" hidden></div>','',s)
# Keep section numbering contiguous after removing the old mechanism section.
s=s.replace('<span class="step">04</span><h2>当前 5 只声骸</h2>','<span class="step">03</span><h2>当前 5 只声骸</h2>')
s=s.replace('<span class="step">05</span><h2>候选声骸替换</h2>','<span class="step">04</span><h2>候选声骸替换</h2>')
s=s.replace('<span class="step">06</span><h2>计算结果</h2>','<span class="step">05</span><h2>计算结果</h2>')
s=re.sub(r'v=20260916-\d+','v=20260916-9',s)
INDEX.write_text(s,encoding='utf-8')

s=APP.read_text(encoding='utf-8')
new_select="""function selectCharacter(c){
  const changed=!selectedCharacter||selectedCharacter.id!==c.id;
  if(changed)clearCharacterData();
  selectedCharacter=c;
  $('characterPick').innerHTML=`${avatar(c)}<span class=\"pick-copy\"><b id=\"characterName\">${esc(c.name)}</b><small id=\"rosterSource\">角色数据已加载</small></span>`;
  $('characterBrowser').hidden=true;
  const p=currentProfile();
  if(p?.scaler){$('scaler').value=p.scaler;$('scaler').disabled=true}else $('scaler').disabled=false;
  applyProfileDefaults(p);
}
"""
s,n=re.subn(r'function selectCharacter\(c\)\{.*?\n\}\s*(?=function chainEffects)',new_select,s,flags=re.S)
if n!=1:
    raise SystemExit(f'expected to patch one selectCharacter function, patched {n}')
APP.write_text(s,encoding='utf-8')
print('WuWa UI post-fix applied')
