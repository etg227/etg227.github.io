(()=>{'use strict';
// 库街区账号同步：绑定 token 后按特征码 UID 导入角色与声骸。
// 接口调用方式学习自 WuwaEchoTool（GQin404，已开源停更）。
// token 仅保存在当前浏览器 localStorage，直连库街区官方接口，本站不经手、不上传。
if(window.__wuwaKuroSyncV1Loaded)return;window.__wuwaKuroSyncV1Loaded=true;

const $=id=>document.getElementById(id);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const fire=(el,type='change')=>el&&el.dispatchEvent(new Event(type,{bubbles:true}));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

const HOST='https://api.kurobbs.com';
const EP={verify:'/user/emoji/queryUsage',requestToken:'/aki/roleBox/requestToken',refresh:'/aki/roleBox/akiBox/refreshData',roleData:'/aki/roleBox/akiBox/roleData',detail:'/aki/roleBox/akiBox/getRoleDetail'};
const SERVER='76402e5b20be2c39f095a152090afddc';
const TOKEN_KEY='wuwaKuroToken',UID_KEY='wuwaKuroUid';
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const fakeIp=()=>`${rnd(100,255)}:${rnd(30,255)}:${rnd(100,200)}:${rnd(10,255)}`;

function headers(extra={}){
  const h={
    'source':'android',
    'Content-Type':'application/x-www-form-urlencoded',
    'Accept':'application/json,text/plain,*/*',
    'devCode':`${fakeIp()},Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 KuroGameBox/2.5.5`,
    ...extra
  };
  try{h.did=crypto.randomUUID().toUpperCase()}catch(e){}
  return h;
}
async function post(path,data,hdrs){
  const res=await fetch(HOST+path,{method:'POST',headers:hdrs,body:new URLSearchParams(data||{})});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 官方词条名 → 计算器内部类型
function mapAttr(name,value){
  const pct=String(value).includes('%');
  switch(name){
    case '暴击':return 'critRate';
    case '暴击伤害':return 'critDmg';
    case '攻击':return pct?'atkPct':'flatAtk';
    case '生命':return pct?'hpPct':'flatHp';
    case '防御':return pct?'defPct':'flatDef';
    case '共鸣效率':return 'energyRegen';
    case '普攻伤害加成':return 'basicDmg';
    case '重击伤害加成':return 'heavyDmg';
    case '共鸣技能伤害加成':return 'skillDmg';
    case '共鸣解放伤害加成':return 'liberationDmg';
    case '治疗效果加成':return 'healing';
    default:return /伤害加成$/.test(name||'')?'elementDmg':'';
  }
}
const numVal=v=>parseFloat(String(v).replace('%',''))||0;

function status(text,isErr=false){const el=$('kuroSyncStatus');if(el){el.textContent=text;el.style.color=isErr?'var(--danger,#d45454)':''}}
function token(){return localStorage.getItem(TOKEN_KEY)||''}

async function bindToken(){
  const t=($('kuroToken')?.value||'').trim();
  if(!t){status('请先粘贴库街区 token',true);return}
  status('正在校验 token…');
  try{
    const r=await post(EP.verify,'',headers({token:t}));
    if(r&&r.success){localStorage.setItem(TOKEN_KEY,t);$('kuroToken').value='';status('token 已绑定（仅保存在本浏览器），输入特征码后点导入')}
    else status('token 校验失败，请确认是否有效',true);
  }catch(e){status(`token 校验失败：${e.message}（可能是网络或跨域限制）`,true)}
}
function unbindToken(){localStorage.removeItem(TOKEN_KEY);status('已解绑并删除本地 token')}

let busy=false;
async function importRoles(){
  if(busy)return;
  if(!token()){status('请先绑定库街区 token',true);return}
  const uid=($('kuroUid')?.value||'').trim();
  if(!/^\d{9}$/.test(uid)){status('特征码必须是 9 位数字（游戏内个人信息页查看）',true);return}
  busy=true;
  try{
    status('正在向库街区请求授权…');
    const tk=await post(EP.requestToken,{roleId:uid,serverId:SERVER,forceRefresh:true},headers({token:token()}));
    const bat=JSON.parse(tk.data||'{}').accessToken;
    if(!bat)throw new Error('未取得访问授权，token 可能已过期');
    localStorage.setItem(UID_KEY,uid);
    const params={gameId:3,roleId:uid,serverId:SERVER};
    status('正在刷新游戏数据…');
    await post(EP.refresh,params,headers({'b-at':bat}));
    status('正在读取角色列表…');
    const rd=await post(EP.roleData,params,headers({'b-at':bat}));
    if(!(rd&&(rd.code===200||rd.code===10902)&&rd.data))throw new Error('读取角色失败，请检查库街区是否公开了角色数据');
    const roleList=JSON.parse(rd.data).roleList||[];
    if(!roleList.length)throw new Error('该 UID 下没有公开角色');
    window.__wuwaKuroBat=bat;
    renderRolePicker(roleList);
    status(`已读取 ${roleList.length} 名角色，点击头像导入`);
  }catch(e){status(`导入失败：${e.message}`,true)}
  finally{busy=false}
}
function renderRolePicker(list){
  const box=$('kuroRoleGrid');if(!box)return;
  box.hidden=false;
  box.innerHTML=list.map(r=>`<button type="button" class="kuro-role" data-rid="${esc(r.roleId)}" data-name="${esc(r.roleName)}" title="Lv.${esc(r.level)}"><img src="${esc(r.roleIconUrl)}" alt="${esc(r.roleName)}" referrerpolicy="no-referrer" onerror="this.replaceWith(this.alt)"><span>${esc(r.roleName)}</span></button>`).join('');
}
async function importDetail(rid,name){
  if(busy)return;busy=true;
  try{
    status(`正在读取 ${name} 的详情…`);
    const uid=localStorage.getItem(UID_KEY)||'';
    const params={gameId:3,roleId:uid,serverId:SERVER,channelId:19,countryCode:1,id:rid};
    const bat=window.__wuwaKuroBat;
    const res=await post(EP.detail,params,headers({'b-at':bat}));
    if(!(res&&(res.code===200||res.code===10902)&&res.data))throw new Error('读取角色详情失败');
    const d=JSON.parse(res.data);
    await applyDetail(name,d);
  }catch(e){status(`导入 ${name} 失败：${e.message}`,true)}
  finally{busy=false}
}
async function chooseCharacter(name){
  const cur=$('characterName')?.textContent?.trim();
  if(cur===name)return true;
  $('characterPick')?.click();await wait(60);
  const q=$('characterSearch');
  if(q){q.value=name;fire(q,'input');await wait(40)}
  const btn=[...document.querySelectorAll('#characterGrid .character-card')].find(b=>b.querySelector('span')?.textContent.trim()===name||b.textContent.includes(name));
  if(!btn){$('closeCharacterBrowser')?.click();return false}
  btn.click();await wait(120);return true;
}
async function applyDetail(name,d){
  if(!(await chooseCharacter(name))){status(`角色库中没有「${name}」，无法导入`,true);return}
  const chain=(d.chainList||[]).filter(x=>x.unlocked).length;
  if($('chainLevel')){$('chainLevel').value=String(Math.min(6,chain));fire($('chainLevel'))}
  const echoes=(d.phantomData?.equipPhantomList||[]).filter(Boolean).slice(0,5);
  const cards=[...document.querySelectorAll('#equippedEchoes .echo-card')];
  for(let i=0;i<cards.length;i++){
    const card=cards[i],e=echoes[i];
    const costSel=card.querySelector('.echo-cost');
    if(!e){continue}
    const cost=Number(e.phantomProp?.cost||4);
    if(costSel){costSel.value=String([4,3,1].includes(cost)?cost:4);fire(costSel);await wait(0)}
    const main=e.mainProps?.[0];
    const mainSel=card.querySelector('.main-primary .echo-type');
    if(mainSel&&main){
      const t=mapAttr(main.attributeName,main.attributeValue);
      if([...mainSel.options].some(o=>o.value===t)){mainSel.value=t;fire(mainSel);await wait(0)}
    }
    const rows=[...card.querySelectorAll('.sub-rows .echo-row')];
    const subs=e.subProps||[];
    for(let j=0;j<rows.length;j++){
      const typeSel=rows[j].querySelector('.echo-type'),valSel=rows[j].querySelector('.echo-value');
      const sp=subs[j];
      const t=sp?mapAttr(sp.attributeName,sp.attributeValue):'';
      if(typeSel){typeSel.value=t&&[...typeSel.options].some(o=>o.value===t)?t:'';fire(typeSel);await wait(0)}
      if(valSel&&sp&&typeSel.value){
        const v=numVal(sp.attributeValue);
        const opts=[...valSel.options].map(o=>Number(o.value)).filter(x=>x>0);
        if(opts.length){const nearest=opts.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a);valSel.value=String(nearest);fire(valSel)}
      }
    }
  }
  await wait(50);
  $('calculateBtn')?.click();
  $('kuroRoleGrid').hidden=true;
  status(`已导入 ${name}：${Math.min(6,chain)} 链 + ${echoes.length} 只声骸。面板数值请照游戏内角色详情页填写。`);
}

function mountUi(){
  if($('wuwaKuroSync'))return;
  const host=document.getElementById('wuwaLocalSaveBar')||document.querySelector('.intro-panel .profile-grid');
  if(!host)return;
  const box=document.createElement('details');
  box.id='wuwaKuroSync';box.className='wuwa-kuro-sync';
  box.innerHTML=`<summary>库街区账号导入（可选）</summary>
  <div class="kuro-grid">
    <input id="kuroToken" type="password" placeholder="粘贴库街区 token（仅保存在本浏览器）" autocomplete="off">
    <button type="button" id="kuroBind">绑定</button>
    <button type="button" id="kuroUnbind">解绑</button>
    <input id="kuroUid" inputmode="numeric" maxlength="9" placeholder="特征码 UID（9 位数字）">
    <button type="button" id="kuroImport">导入角色</button>
  </div>
  <div id="kuroSyncStatus" class="kuro-status">token 直连库街区官方接口，本站不上传、不经手；请勿在共享设备绑定。</div>
  <div id="kuroRoleGrid" class="kuro-role-grid" hidden></div>`;
  host.insertAdjacentElement('afterend',box);
  const st=document.createElement('style');st.id='wuwa-kuro-sync-style';
  st.textContent=`.wuwa-kuro-sync{margin:10px 0 4px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel2)}
  .wuwa-kuro-sync summary{font-size:13px}
  .kuro-grid{display:grid;grid-template-columns:minmax(180px,2.2fr) auto auto minmax(130px,1.2fr) auto;gap:8px;margin-top:10px}
  .kuro-grid input,.kuro-grid button{min-height:36px}
  .kuro-status{font-size:11px;color:var(--muted);line-height:1.6;margin-top:8px}
  .kuro-role-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;margin-top:10px;max-height:260px;overflow:auto}
  .kuro-role{display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px;border:1px solid var(--line);border-radius:11px;background:var(--panel);font-size:11px}
  .kuro-role img{width:46px;height:46px;border-radius:10px;object-fit:cover}
  .kuro-role:hover{border-color:var(--accent);color:var(--accent)}
  @media(max-width:700px){.kuro-grid{grid-template-columns:1fr 1fr}.kuro-grid input{grid-column:1/-1}}`;
  document.head.appendChild(st);
  $('kuroBind').onclick=bindToken;
  $('kuroUnbind').onclick=unbindToken;
  $('kuroImport').onclick=importRoles;
  $('kuroRoleGrid').addEventListener('click',e=>{const b=e.target.closest('.kuro-role');if(b)importDetail(b.dataset.rid,b.dataset.name)});
  if($('kuroUid'))$('kuroUid').value=localStorage.getItem(UID_KEY)||'';
  if(token())status('已绑定 token（仅保存在本浏览器），输入特征码后点导入');
}
function init(){
  mountUi();
  new MutationObserver(mountUi).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
