(()=>{
'use strict';
if(window.__wuwaActionableRecommendationV1Loaded)return;
window.__wuwaActionableRecommendationV1Loaded=true;

const $=id=>document.getElementById(id);
const LABEL={
  critRate:'暴击率',critDmg:'暴击伤害',atkPct:'攻击力%',flatAtk:'固定攻击',
  hpPct:'生命值%',flatHp:'固定生命',defPct:'防御力%',flatDef:'固定防御',
  basicDmg:'普攻伤害',heavyDmg:'重击伤害',skillDmg:'共鸣技能伤害',liberationDmg:'共鸣解放伤害'
};
const ROLLS={
  critRate:[6.3,6.9,7.5,8.1,8.7,9.3,9.9,10.5],
  critDmg:[12.6,13.8,15.0,16.2,17.4,18.6,19.8,21.0],
  atkPct:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  hpPct:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  basicDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  heavyDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  skillDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  liberationDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  defPct:[8.1,9.0,10.0,10.9,11.8,12.8,13.8,14.7],
  flatHp:[320,360,390,430,470,510,540,580],
  flatAtk:[30,40,50,60],
  flatDef:[40,50,60,70]
};
const STANDARD={
  critRate:8.4,critDmg:16.8,atkPct:9,hpPct:9,defPct:11.8,
  flatAtk:50,flatHp:470,flatDef:60,basicDmg:9,heavyDmg:9,skillDmg:9,liberationDmg:9
};
const LABEL_TO_TYPE=Object.fromEntries(Object.entries(LABEL).map(([k,v])=>[v,k]));
let timer=0;

function mean(arr){return arr?.length?arr.reduce((a,b)=>a+b,0)/arr.length:0}
function resolveType(text){
  const names=Object.keys(LABEL_TO_TYPE).sort((a,b)=>b.length-a.length);
  const hit=names.find(name=>text.startsWith(name));
  return hit?LABEL_TO_TYPE[hit]:'';
}
function readPureRows(){
  const root=$('standardBars');if(!root)return[];
  return [...root.querySelectorAll('.bar-row:not([data-actionable-row="1"])')].map(row=>{
    const text=row.querySelector('.bar-label')?.textContent?.trim()||'';
    const type=resolveType(text);
    const gain=Number.parseFloat(row.querySelector('.bar-value')?.textContent||'0');
    return{type,gain:Number.isFinite(gain)?gain:0};
  }).filter(x=>x.type&&x.gain>0);
}
function readEchoes(){
  return [...document.querySelectorAll('#equippedEchoes .echo-card')].map((card,slot)=>({
    slot,
    sub:[...card.querySelectorAll('.sub-rows .echo-row')].map(row=>({
      type:row.querySelector('.echo-type')?.value||'',
      value:Number(row.querySelector('.echo-value')?.value||0)
    })).filter(x=>x.type&&x.value>0)
  }));
}
function standard(type){return Number(STANDARD[type]||mean(ROLLS[type])||1)}
function maxRoll(type){return Math.max(...(ROLLS[type]||[0]))}
function avgRoll(type){return mean(ROLLS[type])||standard(type)}
function proxyLineGain(line,pure){
  const base=pure.get(line.type)||0;
  if(!(base>0))return 0;
  return base*(line.value/standard(line.type));
}
function potentialFor(type,pure,echoes){
  const base=pure.get(type)||0;if(!(base>0))return null;
  const max=maxRoll(type),avg=avgRoll(type),std=standard(type);
  let best=null;
  for(const echo of echoes){
    const existing=echo.sub.find(x=>x.type===type);
    if(existing){
      const remain=Math.max(0,max-existing.value);
      if(remain<=1e-6)continue;
      const gain=base*(remain/std);
      if(!best||gain>best.gain)best={type,gain,slot:echo.slot,mode:'upgrade'};
      continue;
    }
    if(!echo.sub.length)continue;
    const weakest=echo.sub.map(line=>({line,cost:proxyLineGain(line,pure)})).sort((a,b)=>a.cost-b.cost)[0];
    const gain=base*(avg/std)-weakest.cost;
    if(gain>1e-6&&(!best||gain>best.gain))best={type,gain,slot:echo.slot,mode:'replace'};
  }
  return best;
}
function actionableRows(pureRows){
  const pure=new Map(pureRows.map(x=>[x.type,x.gain]));
  const echoes=readEchoes();
  return pureRows.map(row=>potentialFor(row.type,pure,echoes)).filter(Boolean).sort((a,b)=>b.gain-a.gain);
}
function render(rows){
  const root=$('standardBars'),title=$('bestStandard'),note=$('bestStandardNote');
  if(!root||!title||!note)return;
  if(!rows.length){
    title.textContent='暂无可实现升级';
    note.textContent='当前已录入词条没有可继续提升的合法空间';
    root.innerHTML='<div class="micro">当前词条已饱和或没有正收益替换项。</div>';
    return;
  }
  const mx=Math.max(.000001,...rows.map(x=>x.gain));
  root.innerHTML=rows.map(x=>`<div class="bar-row" data-actionable-row="1"><div class="bar-label">${LABEL[x.type]||x.type}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,x.gain/mx*100)}%"></div></div><div class="bar-value">${x.mode==='upgrade'?'可提档':'可替换'}</div></div>`).join('');
  const top=rows[0];
  title.textContent=LABEL[top.type]||top.type;
  note.textContent=`当前可实现边际提升最高 · 声骸 ${top.slot+1}${top.mode==='upgrade'?'仍有提档空间':'可通过替换弱词条改善'}`;
}
function sync(){
  const pure=readPureRows();
  if(!pure.length)return;
  render(actionableRows(pure));
}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,0)}
function init(){
  const root=$('standardBars');if(!root)return;
  new MutationObserver(()=>{
    if(root.querySelector('.bar-row:not([data-actionable-row="1"])'))schedule();
  }).observe(root,{childList:true,subtree:true,characterData:true});
  document.addEventListener('change',e=>{if(e.target?.closest?.('#equippedEchoes'))setTimeout(schedule,0)},true);
  document.addEventListener('input',e=>{if(e.target?.closest?.('#equippedEchoes'))setTimeout(schedule,0)},true);
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
