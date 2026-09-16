(()=>{
  'use strict';
  const STORAGE_KEY='wuwaEchoBuildProfilesV1';
  const $=id=>document.getElementById(id);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const fire=(el,type='change')=>el&&el.dispatchEvent(new Event(type,{bubbles:true}));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const grade=s=>s>=100?'SSS':s>=90?'SS':s>=80?'S':s>=65?'A':s>=50?'B':s>=35?'C':'D';

  function readStore(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{}}catch(e){return{}}
  }
  function writeStore(v){localStorage.setItem(STORAGE_KEY,JSON.stringify(v))}
  function currentCharacter(){const n=$('characterName')?.textContent?.trim();return n&&n!=='选择角色'?n:''}
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
    const name=currentCharacter();if(!name)return null;
    const stats={};['totalAtk','totalHp','totalDef','critRate','critDmg','energyRegen','elementDmg','globalDmg','globalAmp'].forEach(id=>stats[id]=Number($(id)?.value||0));
    return{
      version:1,characterName:name,chainLevel:Number($('chainLevel')?.value||0),scaler:$('scaler')?.value||'atk',stats,
      echoes:[...document.querySelectorAll('.echo-card')].map(readEcho),savedAt:new Date().toISOString()
    };
  }
  function refreshSavedSelect(prefer=''){
    const sel=$('wuwaSavedBuilds');if(!sel)return;const store=readStore(),names=Object.keys(store).sort((a,b)=>a.localeCompare(b,'zh-CN'));
    sel.innerHTML='<option value="">— 已保存角色 —</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
    if(prefer&&store[prefer])sel.value=prefer;
    updateSaveStatus();
  }
  function updateSaveStatus(msg=''){
    const status=$('wuwaSaveStatus');if(!status)return;
    if(msg){status.textContent=msg;return}
    const name=currentCharacter(),store=readStore();
    status.textContent=name&&store[name]?'该角色已有本机保存配置':'配置仅保存在当前浏览器';
  }
  async function chooseCharacter(name){
    if(currentCharacter()===name)return true;
    $('characterPick')?.click();await wait(30);
    const search=$('characterSearch');if(search){search.value=name;fire(search,'input');await wait(30)}
    const cards=[...document.querySelectorAll('#characterGrid .character-card')];
    const btn=cards.find(b=>b.textContent.trim()===name||b.textContent.includes(name));
    if(!btn)return false;btn.click();await wait(80);return true;
  }
  async function restoreEcho(card,data){
    if(!card||!data)return;
    const cost=card.querySelector('.echo-cost');if(cost){cost.value=String(data.cost||4);fire(cost);await wait(0)}
    const main=card.querySelector('.main-primary .echo-type');if(main&&data.mainType!==undefined){main.value=data.mainType;fire(main);await wait(0)}
    const rows=[...card.querySelectorAll('.sub-rows .echo-row')];
    for(let i=0;i<rows.length;i++){
      const saved=data.sub?.[i]||{type:'',value:0};const type=rows[i].querySelector('.echo-type');if(type){type.value=saved.type||'';fire(type);await wait(0)}
      const value=rows[i].querySelector('.echo-value');if(value&&saved.type){value.value=String(saved.value||0);fire(value)}
    }
  }
  async function loadProfile(name){
    const p=readStore()[name];if(!p)return;
    updateSaveStatus('正在载入…');
    if(!(await chooseCharacter(p.characterName||name))){updateSaveStatus('找不到该角色，载入失败');return}
    const chain=$('chainLevel');if(chain){chain.value=String(p.chainLevel??0);fire(chain)}
    const scaler=$('scaler');if(scaler&&!scaler.disabled&&p.scaler){scaler.value=p.scaler;fire(scaler)}
    Object.entries(p.stats||{}).forEach(([id,v])=>{const el=$(id);if(el){el.value=String(v);fire(el,'input')}});
    const cards=[...document.querySelectorAll('.echo-card')];
    for(let i=0;i<cards.length;i++)await restoreEcho(cards[i],p.echoes?.[i]);
    $('calculateBtn')?.click();refreshSavedSelect(name);updateSaveStatus(`已载入 ${name} 的配置`);
  }
  function saveCurrent(){
    const p=snapshot();if(!p){updateSaveStatus('请先选择角色');return}
    const store=readStore();store[p.characterName]=p;writeStore(store);refreshSavedSelect(p.characterName);updateSaveStatus(`已保存 ${p.characterName} · ${p.chainLevel}链`);
  }
  function deleteSelected(){
    const name=$('wuwaSavedBuilds')?.value||currentCharacter();if(!name)return;
    const store=readStore();if(!store[name])return;delete store[name];writeStore(store);refreshSavedSelect();updateSaveStatus(`已删除 ${name} 的本机配置`);
  }
  function mountSaveUi(){
    if($('wuwaLocalSaveBar'))return;
    const host=document.querySelector('.intro-panel .profile-grid');if(!host)return;
    const box=document.createElement('div');box.id='wuwaLocalSaveBar';box.className='wuwa-local-save';box.innerHTML=`
      <div class="wuwa-save-head"><strong>角色配置保存</strong><span id="wuwaSaveStatus">配置仅保存在当前浏览器</span></div>
      <div class="wuwa-save-actions">
        <select id="wuwaSavedBuilds" aria-label="已保存角色"><option value="">— 已保存角色 —</option></select>
        <button type="button" id="wuwaSaveCurrent">保存当前配置</button>
        <button type="button" id="wuwaLoadSaved">载入</button>
        <button type="button" id="wuwaDeleteSaved" class="danger-lite">删除</button>
      </div>`;
    host.insertAdjacentElement('afterend',box);
    $('wuwaSaveCurrent').addEventListener('click',saveCurrent);
    $('wuwaLoadSaved').addEventListener('click',()=>{const n=$('wuwaSavedBuilds').value;if(n)loadProfile(n)});
    $('wuwaDeleteSaved').addEventListener('click',deleteSelected);
    $('wuwaSavedBuilds').addEventListener('dblclick',e=>{if(e.currentTarget.value)loadProfile(e.currentTarget.value)});
    refreshSavedSelect();
  }
  function mountStyles(){
    if($('wuwa-profile-save-style'))return;const s=document.createElement('style');s.id='wuwa-profile-save-style';s.textContent=`
      .wuwa-local-save{margin:12px 0 4px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--panel2)}
      .wuwa-save-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}.wuwa-save-head strong{font-size:13px}.wuwa-save-head span{font-size:11px;color:var(--muted)}
      .wuwa-save-actions{display:grid;grid-template-columns:minmax(180px,1fr) auto auto auto;gap:8px}.wuwa-save-actions select,.wuwa-save-actions button{min-height:38px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);padding:0 11px}.wuwa-save-actions button{font-weight:700;cursor:pointer}.wuwa-save-actions button:hover{border-color:var(--accent);color:var(--accent)}.wuwa-save-actions .danger-lite:hover{border-color:#d9534f;color:#d9534f}
      .wuwa-candidate-grade{display:inline-flex;align-items:center;justify-content:center;margin-top:6px;padding:3px 8px;border-radius:999px;border:1px solid var(--line);font-size:11px;font-weight:900;letter-spacing:.04em;color:var(--accent);background:var(--panel2)}
      @media(max-width:650px){.wuwa-save-head{align-items:flex-start;flex-direction:column}.wuwa-save-actions{grid-template-columns:1fr 1fr}.wuwa-save-actions select{grid-column:1/-1}}
    `;document.head.appendChild(s);
  }
  function updateGrades(){
    document.querySelectorAll('.score-card').forEach(card=>{const score=Number(card.querySelector('strong')?.textContent);const badge=card.querySelector('.grade');if(!Number.isFinite(score)||!badge)return;const g=grade(score);if(badge.textContent!==g)badge.textContent=g});
    const scoreEl=$('candidateScore');if(scoreEl){const score=Number(scoreEl.textContent);const card=scoreEl.closest('.metric-card');if(card&&Number.isFinite(score)){let b=card.querySelector('.wuwa-candidate-grade');if(!b){b=document.createElement('span');b.className='wuwa-candidate-grade';card.appendChild(b)}const t=`评级 ${grade(score)}`;if(b.textContent!==t)b.textContent=t}}
  }
  function init(){
    mountStyles();mountSaveUi();updateGrades();
    const mo=new MutationObserver(()=>{mountSaveUi();updateGrades();updateSaveStatus()});mo.observe(document.body,{childList:true,subtree:true,characterData:true});
    document.addEventListener('click',e=>{if(e.target.closest?.('.character-card'))setTimeout(()=>{updateSaveStatus();refreshSavedSelect(currentCharacter())},80)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();