(()=>{
'use strict';
if(window.__wuwaRecommendationUiV2Loaded)return;
window.__wuwaRecommendationUiV2Loaded=true;

const $=id=>document.getElementById(id);
const num=id=>Number($(id)?.value||0);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const pct=x=>`${x>=0?'+':''}${x.toFixed(2)}%`;

const LABEL={
  critRate:'暴击率',critDmg:'暴击伤害',atkPct:'攻击力',flatAtk:'固定攻击',
  hpPct:'生命值',flatHp:'固定生命',defPct:'防御力',flatDef:'固定防御',
  basicDmg:'普攻伤害',heavyDmg:'重击伤害',skillDmg:'共鸣技能伤害',liberationDmg:'共鸣解放伤害'
};
const DAMAGE_KEY={basic:'basicDmg',heavy:'heavyDmg',skill:'skillDmg',liberation:'liberationDmg'};
const STANDARD={critRate:8.4,critDmg:16.8,atkPct:9,hpPct:9,defPct:11.8,flatAtk:50,flatHp:470,flatDef:60,basicDmg:9,heavyDmg:9,skillDmg:9,liberationDmg:9};
const MAIN_VALUE={4:{critRate:22,critDmg:44,atkPct:33,hpPct:33,defPct:41.8,healing:26.4},3:{elementDmg:30,energyRegen:32,atkPct:30,hpPct:30,defPct:38},1:{atkPct:18,hpPct:22.8,defPct:18}};
const FIXED_MAIN={4:{type:'flatAtk',value:150},3:{type:'flatAtk',value:100},1:{type:'flatHp',value:2280}};
const PANEL_IDS=new Set(['totalAtk','totalHp','totalDef','critRate','critDmg','energyRegen','elementDmg','globalDmg','globalAmp']);

let mechanics={characters:{}};
let baseline=null;
let renderTimer=0;
let recalTimer=0;
let suspendUntil=0;

function characterName(){
  const n=$('characterName')?.textContent?.trim()||'';
  return n&&n!=='选择角色'?n:'';
}
function emptyAgg(){return{atkPct:0,flatAtk:0,hpPct:0,flatHp:0,defPct:0,flatDef:0,critRate:0,critDmg:0,energyRegen:0,elementDmg:0,basicDmg:0,heavyDmg:0,skillDmg:0,liberationDmg:0}}
function add(a,type,value){if(Object.prototype.hasOwnProperty.call(a,type))a[type]+=Number(value||0)}
function readEchoAggregate(){
  const a=emptyAgg();
  document.querySelectorAll('.echo-card').forEach(card=>{
    const cost=Number(card.querySelector('.echo-cost')?.value||4);
    const mainType=card.querySelector('.main-primary .echo-type')?.value||'';
    if(mainType)add(a,mainType,MAIN_VALUE[cost]?.[mainType]||0);
    const fixed=FIXED_MAIN[cost];if(fixed)add(a,fixed.type,fixed.value);
    card.querySelectorAll('.sub-rows .echo-row').forEach(row=>add(a,row.querySelector('.echo-type')?.value||'',Number(row.querySelector('.echo-value')?.value||0)));
  });
  return a;
}
function buildComplete(){
  const cards=[...document.querySelectorAll('.echo-card')];
  if(cards.length!==5)return false;
  return cards.every(card=>{
    if(!card.querySelector('.main-primary .echo-type')?.value)return false;
    const rows=[...card.querySelectorAll('.sub-rows .echo-row')];
    return rows.length===5&&rows.every(r=>(r.querySelector('.echo-type')?.value||'')&&Number(r.querySelector('.echo-value')?.value||0)>0);
  });
}
function panel(){return{atk:num('totalAtk'),hp:num('totalHp'),def:num('totalDef'),critRate:num('critRate'),critDmg:num('critDmg'),energyRegen:num('energyRegen'),extraElementDmg:num('elementDmg'),globalDmg:num('globalDmg'),globalAmp:num('globalAmp')}}
function captureBaseline(){
  const name=characterName();
  if(!name||Date.now()<suspendUntil||!buildComplete())return false;
  const p=panel(),a=readEchoAggregate();
  if(!(p.atk>0&&p.hp>0&&p.def>0&&p.critDmg>0))return false;
  baseline={
    character:name,
    baseEff:{
      atk:Math.max(1,(p.atk-a.flatAtk)/Math.max(.01,1+a.atkPct/100)),
      hp:Math.max(1,(p.hp-a.flatHp)/Math.max(.01,1+a.hpPct/100)),
      def:Math.max(1,(p.def-a.flatDef)/Math.max(.01,1+a.defPct/100))
    },
    nonEcho:{critRate:p.critRate-a.critRate,critDmg:p.critDmg-a.critDmg,energyRegen:p.energyRegen-a.energyRegen},
    capturedAgg:a
  };
  return true;
}
function ensureBaseline(){
  const name=characterName();
  if(baseline&&baseline.character!==name)baseline=null;
  if(!baseline)captureBaseline();
  return baseline;
}
function autoEffects(profile){
  const out=[];
  const chain=Number($('chainLevel')?.value||0);
  (profile?.innate||[]).forEach(e=>{if(e.apply!=='panel')out.push(e)});
  (profile?.chains||[]).filter(x=>Number(x.level)<=chain).forEach(x=>(x.effects||[]).forEach(e=>{if(e.apply!=='panel')out.push(e)}));
  const sonata=$('sonataMode')?.value||'none';
  if(sonata==='eternal2')out.push({kind:'elementDmg',value:10});
  if(sonata==='eternal5')out.push({kind:'elementDmg',value:10},{kind:'critRate',value:20},{kind:'elementDmg',value:15});
  if(($('mainEchoEffect')?.value||'none')==='glory')out.push({kind:'elementDmg',value:12},{kind:'heavyDmg',value:12});
  if(($('weaponMode')?.value||'none')==='signature'){
    (profile?.signature_weapon?.effects||[]).forEach(e=>out.push(e));
  }
  const a={atkPct:0,hpPct:0,defPct:0,critRate:0,critDmg:0,elementDmg:0,globalDmg:0,globalAmp:0,basicDmg:0,heavyDmg:0,skillDmg:0,liberationDmg:0};
  out.forEach(e=>{if(Object.prototype.hasOwnProperty.call(a,e.kind))a[e.kind]+=Number(e.value||0)});
  return a;
}
function weights(profile){
  const chain=String(Number($('chainLevel')?.value||0));
  const raw=profile?.chain_type_weights?.[chain]||profile?.type_weights;
  if(!raw)return{other:1};
  const sum=Object.values(raw).reduce((s,v)=>s+Number(v||0),0)||1;
  return Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,Number(v||0)/sum]));
}
function modelFromAgg(a,extra){
  const b=ensureBaseline();if(!b)return null;
  const p=panel(),profile=mechanics.characters?.[b.character]||null,auto=autoEffects(profile);
  const x={...a}; if(extra&&x[extra.type]!==undefined)x[extra.type]+=Number(extra.value||0);
  return{
    profile,
    atk:b.baseEff.atk*(1+(x.atkPct+auto.atkPct)/100)+x.flatAtk,
    hp:b.baseEff.hp*(1+(x.hpPct+auto.hpPct)/100)+x.flatHp,
    def:b.baseEff.def*(1+(x.defPct+auto.defPct)/100)+x.flatDef,
    critRate:b.nonEcho.critRate+x.critRate+auto.critRate,
    critDmg:b.nonEcho.critDmg+x.critDmg+auto.critDmg,
    elementDmg:p.extraElementDmg+x.elementDmg+auto.elementDmg,
    globalDmg:p.globalDmg+auto.globalDmg,
    globalAmp:p.globalAmp+auto.globalAmp,
    typeDmg:{basic:x.basicDmg+auto.basicDmg,heavy:x.heavyDmg+auto.heavyDmg,skill:x.skillDmg+auto.skillDmg,liberation:x.liberationDmg+auto.liberationDmg}
  };
}
function factor(a,extra){
  const s=modelFromAgg(a,extra);if(!s)return 0;
  const scaler=$('scaler')?.value||'atk';
  const stat=Math.max(1e-6,Number(s[scaler]||0));
  const cr=clamp(s.critRate/100,0,1),cd=Math.max(1,s.critDmg/100),crit=1+cr*(cd-1);
  const amp=Math.max(1e-6,1+s.globalAmp/100);
  let dmg=0;
  for(const [k,w] of Object.entries(weights(s.profile))){
    const typeBonus=k==='other'?0:Number(s.typeDmg[k]||0);
    dmg+=w*Math.max(1e-6,1+(s.globalDmg+s.elementDmg+typeBonus)/100);
  }
  return stat*crit*amp*dmg;
}
function candidates(){
  const b=ensureBaseline();if(!b)return[];
  const a=readEchoAggregate(),base=factor(a);if(!(base>0))return[];
  const scaler=$('scaler')?.value||'atk';
  const pctType=scaler==='atk'?'atkPct':scaler==='hp'?'hpPct':'defPct';
  const flatType=scaler==='atk'?'flatAtk':scaler==='hp'?'flatHp':'flatDef';
  const rows=[['critRate',STANDARD.critRate],['critDmg',STANDARD.critDmg],[pctType,STANDARD[pctType]],[flatType,STANDARD[flatType]]];
  const p=mechanics.characters?.[b.character]||null;
  Object.entries(weights(p)).filter(([k,w])=>k!=='other'&&w>=.025).forEach(([k])=>{const t=DAMAGE_KEY[k];if(t)rows.push([t,STANDARD[t]])});
  return rows.map(([type,value])=>({type,value,label:`${LABEL[type]} ${value}${type.startsWith('flat')?'':'%'}`,gain:(factor(a,{type,value})/base-1)*100})).sort((x,y)=>y.gain-x.gain);
}
function renderBars(rows){
  const root=$('standardBars');if(!root)return;
  const mx=Math.max(.01,...rows.map(x=>Math.abs(x.gain)));
  root.innerHTML=rows.map(x=>`<div class="bar-row ${x.gain<0?'negative':''}"><div class="bar-label">${esc(x.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.abs(x.gain)/mx*100)}%"></div></div><div class="bar-value">${pct(x.gain)}</div></div>`).join('');
}
function renderRecommendation(){
  const title=$('bestStandard'),note=$('bestStandardNote');if(!title||!note)return;
  if(!ensureBaseline()){
    title.textContent='—';
    note.textContent=buildComplete()?'正在校准当前面板…':'录入完整5只声骸后生成边际推荐';
    return;
  }
  const rows=candidates();
  if(!rows.length){title.textContent='—';note.textContent='暂无可比较词条';return}
  renderBars(rows);
  const top=rows[0];
  title.textContent=LABEL[top.type]||top.type;
  note.textContent=`平均档 ${top.value}${top.type.startsWith('flat')?'':'%'} · 当前边际提升 ${pct(top.gain)}`;
}
function schedule(delay=20){clearTimeout(renderTimer);renderTimer=setTimeout(renderRecommendation,delay)}
function resetBaseline(delay=320){
  baseline=null;
  suspendUntil=Date.now()+delay;
  clearTimeout(recalTimer);
  recalTimer=setTimeout(()=>{captureBaseline();renderRecommendation()},delay+10);
}
function bind(){
  document.addEventListener('input',e=>{
    if(PANEL_IDS.has(e.target?.id)){resetBaseline(260);return}
    schedule();
  });
  document.addEventListener('change',e=>{
    if(PANEL_IDS.has(e.target?.id)){resetBaseline(260);return}
    schedule();
  });
  const pick=$('characterPick');
  if(pick)new MutationObserver(()=>{resetBaseline(500);schedule(520)}).observe(pick,{childList:true,subtree:true});
  const echoes=$('equippedEchoes');
  if(echoes)new MutationObserver(()=>schedule()).observe(echoes,{childList:true,subtree:true});
}
async function init(){
  try{
    const r=await fetch('/wuwa/data/character-mechanics.json?v=20260916-10',{cache:'no-store'});
    if(r.ok)mechanics=await r.json();
  }catch(e){}
  bind();
  setTimeout(()=>{captureBaseline();renderRecommendation()},700);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
