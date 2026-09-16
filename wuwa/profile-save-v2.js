(()=>{
'use strict';
if(window.__wuwaProfileSaveV3Loaded)return;
window.__wuwaProfileSaveV3Loaded=true;

const STORAGE_KEY='wuwaEchoBuildProfilesV4';
const LEGACY_KEYS=['wuwaEchoBuildProfilesV3','wuwaEchoBuildProfilesV2'];
const $=id=>document.getElementById(id);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const fire=(el,type='change')=>el&&el.dispatchEvent(new Event(type,{bubbles:true}));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function readStore(key=STORAGE_KEY){try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(e){return{}}}
function store(){
  const cur=readStore();
  if(Object.keys(cur).length)return cur;
  for(const key of LEGACY_KEYS){const legacy=readStore(key);if(Object.keys(legacy).length){localStorage.setItem(STORAGE_KEY,JSON.stringify(legacy));return legacy}}
  return {};
}
function write(v){localStorage.setItem(STORAGE_KEY,JSON.stringify(v))}
function character(){const n=$('characterName')?.textContent?.trim();return n&&n!=='选择角色'?n:''}
function readEcho(card){
  return{
    cost:Number(card.querySelector('.echo-cost')?.value||4),
    mainType:card.querySelector('.main-primary .echo-type')?.value||'',
    sub:[...card.querySelectorAll('.sub-rows .echo-row')].map(r=>({
      type:r.querySelector('.echo-type')?.value||'',
      value:Number(r.querySelector('.echo-value')?.value||0)
    }))
  };
}
function snapshot(){
  const name=character();if(!name)return null;
  const stats={};
  ['totalAtk','totalHp','totalDef','critRate','critDmg','energyRegen','elementDmg','globalDmg','globalAmp','nonEchoAtkPct','nonEchoHpPct','nonEchoDefPct'].forEach(id=>stats[id]=Number($(id)?.value||0));
  return{
    version:4,
    characterName:name,
    chainLevel:Number($('chainLevel')?.value||0),
    scaler:$('scaler')?.value||'atk',
    gear:{
      sonataMode:$('sonataMode')?.value||'none',
      mainEchoEffect:$('mainEchoEffect')?.value||'none',
      weaponMode:$('weaponMode')?.value||'none'
    },
    stats,
    echoes:[...document.querySelectorAll('.echo-card')].map(readEcho),
    savedAt:new Date().toISOString()
  };
}
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function status(text){setText($('wuwaSaveStatus'),text)}
function refreshSaved(prefer=''){
  const sel=$('wuwaSavedBuilds');if(!sel)return;
  const s=store(),names=Object.keys(s).sort((a,b)=>a.localeCompare(b,'zh-CN'));
  const html='<option value="">— 已保存角色 —</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
  if(sel.innerHTML!==html)sel.innerHTML=html;
  if(prefer&&s[prefer])sel.value=prefer;
  if(!prefer)status(character()&&s[character()]?'该角色已有本机保存配置':'配置仅保存在当前浏览器');
}
async function chooseCharacter(name){
  if(character()===name)return true;
  $('characterPick')?.click();await wait(40);
  const search=$('characterSearch');
  if(search){search.value=name;fire(search,'input');await wait(40)}
  const btn=[...document.querySelectorAll('#characterGrid .character-card')].find(b=>b.textContent.trim()===name||b.textContent.includes(name));
  if(!btn)return false;
  btn.click();await wait(100);return true;
}
async function restoreEcho(card,data){
  if(!card||!data)return;
  const cost=card.querySelector('.echo-cost');
  if(cost){cost.value=String(data.cost||4);fire(cost);await wait(0)}
  const main=card.querySelector('.main-primary .echo-type');
  if(main){main.value=data.mainType||'';fire(main);await wait(0)}
  const rows=[...card.querySelectorAll('.sub-rows .echo-row')];
  for(let i=0;i<rows.length;i++){
    const saved=data.sub?.[i]||{type:'',value:0};
    const type=rows[i].querySelector('.echo-type');
    if(type){type.value=saved.type||'';fire(type);await wait(0)}
    const value=rows[i].querySelector('.echo-value');
    if(value&&saved.type){value.value=String(saved.value||0);fire(value)}
  }
}
async function loadProfile(name){
  const p=store()[name];if(!p)return;
  status('正在载入…');
  if(!(await chooseCharacter(p.characterName||name))){status('找不到该角色，载入失败');return}
  if($('chainLevel')){$('chainLevel').value=String(p.chainLevel??0);fire($('chainLevel'))}
  if($('scaler')&&!$('scaler').disabled&&p.scaler){$('scaler').value=p.scaler;fire($('scaler'))}
  if(p.gear){
    if($('sonataMode')&&p.gear.sonataMode){$('sonataMode').value=p.gear.sonataMode;fire($('sonataMode'))}
    if($('mainEchoEffect')&&p.gear.mainEchoEffect){$('mainEchoEffect').value=p.gear.mainEchoEffect;fire($('mainEchoEffect'))}
    if($('weaponMode')&&p.gear.weaponMode){$('weaponMode').value=p.gear.weaponMode;fire($('weaponMode'))}
  }
  ['nonEchoAtkPct','nonEchoHpPct','nonEchoDefPct'].forEach(id=>{if(!(id in (p.stats||{}))){const el=$(id);if(el){el.value='0';fire(el,'input')}}});
  Object.entries(p.stats||{}).forEach(([id,v])=>{const el=$(id);if(el){el.value=String(v);fire(el,'input')}});
  const cards=[...document.querySelectorAll('.echo-card')];
  for(let i=0;i<cards.length;i++)await restoreEcho(cards[i],p.echoes?.[i]);
  $('calculateBtn')?.click();
  refreshSaved(name);
  status(`已载入 ${name} 的配置`);
}
function saveCurrent(){
  const p=snapshot();if(!p){status('请先选择角色');return}
  const s=store();s[p.characterName]=p;write(s);refreshSaved(p.characterName);
  status(`已保存 ${p.characterName} · ${p.chainLevel}链`);
}
function removeSaved(){
  const name=$('wuwaSavedBuilds')?.value||character();if(!name)return;
  const s=store();if(!s[name])return;
  delete s[name];write(s);refreshSaved();status(`已删除 ${name} 的本机配置`);
}
function mountSaveUi(){
  if($('wuwaLocalSaveBar'))return;
  const host=document.querySelector('.intro-panel .profile-grid');if(!host)return;
  const box=document.createElement('div');
  box.id='wuwaLocalSaveBar';box.className='wuwa-local-save';
  box.innerHTML=`<div class="wuwa-save-head"><strong>角色配置保存</strong><span id="wuwaSaveStatus">配置仅保存在当前浏览器</span></div>
  <div class="wuwa-save-actions">
    <select id="wuwaSavedBuilds"><option value="">— 已保存角色 —</option></select>
    <button type="button" id="wuwaSaveCurrent">保存当前配置</button>
    <button type="button" id="wuwaLoadSaved">载入</button>
    <button type="button" id="wuwaDeleteSaved" class="danger-lite">删除</button>
  </div>`;
  host.insertAdjacentElement('afterend',box);
  $('wuwaSaveCurrent').onclick=saveCurrent;
  $('wuwaLoadSaved').onclick=()=>{const n=$('wuwaSavedBuilds').value;if(n)loadProfile(n)};
  $('wuwaDeleteSaved').onclick=removeSaved;
  refreshSaved();
}
function mountStyles(){
  if($('wuwa-profile-save-v3-style'))return;
  const s=document.createElement('style');s.id='wuwa-profile-save-v3-style';
  s.textContent=`.wuwa-local-save{margin:12px 0 4px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--panel2)}
  .wuwa-save-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
  .wuwa-save-head strong{font-size:13px}.wuwa-save-head span{font-size:11px;color:var(--muted)}
  .wuwa-save-actions{display:grid;grid-template-columns:minmax(180px,1fr) auto auto auto;gap:8px}
  .wuwa-save-actions select,.wuwa-save-actions button{min-height:38px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);padding:0 11px}
  .wuwa-save-actions button{font-weight:700;cursor:pointer}.wuwa-save-actions button:hover{border-color:var(--accent);color:var(--accent)}
  .wuwa-save-actions .danger-lite:hover{border-color:#d9534f;color:#d9534f}
  @media(max-width:650px){.wuwa-save-head{align-items:flex-start;flex-direction:column}.wuwa-save-actions{grid-template-columns:1fr 1fr}.wuwa-save-actions select{grid-column:1/-1}}`;
  document.head.appendChild(s);
}
function init(){
  mountStyles();mountSaveUi();
  const mo=new MutationObserver(()=>mountSaveUi());
  mo.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest?.('.character-card'))setTimeout(()=>refreshSaved(character()),100)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();