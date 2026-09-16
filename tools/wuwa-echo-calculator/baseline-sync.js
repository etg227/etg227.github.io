(()=>{
'use strict';
if(window.__wuwaEchoBaselineSyncV2Loaded)return;
window.__wuwaEchoBaselineSyncV2Loaded=true;

const $=id=>document.getElementById(id);
const num=id=>Number($(id)?.value||0);
const MAIN_VALUE={4:{critRate:22,critDmg:44,atkPct:33,hpPct:33,defPct:41.8,healing:26.4},3:{elementDmg:30,energyRegen:32,atkPct:30,hpPct:30,defPct:38},1:{atkPct:18,hpPct:22.8,defPct:18}};
const FIXED_MAIN={4:{type:'flatAtk',value:150},3:{type:'flatAtk',value:100},1:{type:'flatHp',value:2280}};
const PANEL_IDS=new Set(['totalAtk','totalHp','totalDef','critRate','critDmg','energyRegen','nonEchoAtkPct','nonEchoHpPct','nonEchoDefPct']);
let baseline=null;
let suspendedUntil=0;
let internalWrite=false;
let captureTimer=0;
let loadWatchTimer=0;

function emptyAgg(){return{atkPct:0,flatAtk:0,hpPct:0,flatHp:0,defPct:0,flatDef:0,critRate:0,critDmg:0,energyRegen:0}}
function add(a,type,value){if(Object.prototype.hasOwnProperty.call(a,type))a[type]+=Number(value||0)}
function aggregate(){
  const a=emptyAgg();
  document.querySelectorAll('#equippedEchoes .echo-card').forEach(card=>{
    const cost=Number(card.querySelector('.echo-cost')?.value||4);
    const mainType=card.querySelector('.main-primary .echo-type')?.value||'';
    if(mainType)add(a,mainType,MAIN_VALUE[cost]?.[mainType]||0);
    const fixed=FIXED_MAIN[cost];if(fixed)add(a,fixed.type,fixed.value);
    card.querySelectorAll('.sub-rows .echo-row').forEach(row=>{
      add(a,row.querySelector('.echo-type')?.value||'',Number(row.querySelector('.echo-value')?.value||0));
    });
  });
  return a;
}
function character(){const n=$('characterName')?.textContent?.trim()||'';return n&&n!=='选择角色'?n:''}
function complete(){
  const cards=[...document.querySelectorAll('#equippedEchoes .echo-card')];
  if(cards.length!==5)return false;
  return cards.every(card=>{
    if(!card.querySelector('.main-primary .echo-type')?.value)return false;
    const rows=[...card.querySelectorAll('.sub-rows .echo-row')];
    return rows.length===5&&rows.every(r=>(r.querySelector('.echo-type')?.value||'')&&Number(r.querySelector('.echo-value')?.value||0)>0);
  });
}
function derive(){
  if(Date.now()<suspendedUntil||!complete())return null;
  const name=character();if(!name)return null;
  const a=aggregate();
  const p={atk:num('totalAtk'),hp:num('totalHp'),def:num('totalDef'),cr:num('critRate'),cd:num('critDmg'),er:num('energyRegen')};
  if(!(p.atk>0&&p.hp>0&&p.def>0&&p.cd>0))return null;
  const nAtk=num('nonEchoAtkPct'),nHp=num('nonEchoHpPct'),nDef=num('nonEchoDefPct');
  return{
    character:name,
    baseEff:{
      atk:Math.max(1,(p.atk-a.flatAtk)/Math.max(.01,1+(a.atkPct+nAtk)/100)),
      hp:Math.max(1,(p.hp-a.flatHp)/Math.max(.01,1+(a.hpPct+nHp)/100)),
      def:Math.max(1,(p.def-a.flatDef)/Math.max(.01,1+(a.defPct+nDef)/100))
    },
    nonEcho:{critRate:p.cr-a.critRate,critDmg:p.cd-a.critDmg,energyRegen:p.er-a.energyRegen}
  };
}
function capture(){const b=derive();if(b)baseline=b;return !!b}
function scheduleCapture(delay=80){
  clearTimeout(captureTimer);
  const remaining=Math.max(0,suspendedUntil-Date.now());
  captureTimer=setTimeout(()=>capture(),Math.max(delay,remaining+30));
}
function setVal(id,v){const el=$(id);if(!el)return;el.value=Number(v.toFixed(3)).toString()}
function syncPanelToEchoes(){
  if(Date.now()<suspendedUntil)return;
  const name=character();
  if(!baseline||baseline.character!==name){capture();return}
  const a=aggregate();
  internalWrite=true;
  setVal('totalAtk',baseline.baseEff.atk*(1+(a.atkPct+num('nonEchoAtkPct'))/100)+a.flatAtk);
  setVal('totalHp',baseline.baseEff.hp*(1+(a.hpPct+num('nonEchoHpPct'))/100)+a.flatHp);
  setVal('totalDef',baseline.baseEff.def*(1+(a.defPct+num('nonEchoDefPct'))/100)+a.flatDef);
  setVal('critRate',baseline.nonEcho.critRate+a.critRate);
  setVal('critDmg',baseline.nonEcho.critDmg+a.critDmg);
  setVal('energyRegen',baseline.nonEcho.energyRegen+a.energyRegen);
  internalWrite=false;
}
function suspend(ms=900){
  baseline=null;
  suspendedUntil=Date.now()+ms;
  scheduleCapture(ms+30);
}
function finishSavedLoad(){
  suspendedUntil=0;
  clearTimeout(captureTimer);
  captureTimer=setTimeout(()=>capture(),30);
}
function watchSavedLoad(){
  clearInterval(loadWatchTimer);
  const started=Date.now();
  loadWatchTimer=setInterval(()=>{
    const text=$('wuwaSaveStatus')?.textContent?.trim()||'';
    if(text.startsWith('已载入 ')||text.includes('载入失败')){
      clearInterval(loadWatchTimer);loadWatchTimer=0;
      finishSavedLoad();
      return;
    }
    if(Date.now()-started>3000){
      clearInterval(loadWatchTimer);loadWatchTimer=0;
      finishSavedLoad();
    }
  },25);
}
function bind(){
  document.addEventListener('input',e=>{
    if(internalWrite)return;
    if(PANEL_IDS.has(e.target?.id)){
      baseline=null;
      scheduleCapture(80);
    }
  },true);
  document.addEventListener('change',e=>{
    if(e.target?.closest?.('#equippedEchoes')){
      if(Date.now()<suspendedUntil)return;
      if(!baseline){capture();return}
      syncPanelToEchoes();
    }
  },true);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#wuwaLoadSaved')){suspend(3000);watchSavedLoad();return}
    if(e.target?.closest?.('#resetStatsBtn')){suspend(160);return}
    if(e.target?.closest?.('.character-card')){suspend(260);return}
  },true);
  const host=$('characterPick');
  if(host)new MutationObserver(()=>suspend(220)).observe(host,{childList:true,subtree:true});
  const echoes=$('equippedEchoes');
  if(echoes)new MutationObserver(()=>{if(!baseline)scheduleCapture(60)}).observe(echoes,{childList:true,subtree:true});
}
function init(){bind();scheduleCapture(700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
