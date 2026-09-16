(()=>{
'use strict';
if(window.__wuwaRecommendationUiLoaded)return;
window.__wuwaRecommendationUiLoaded=true;

const $=id=>document.getElementById(id);

function syncRecommendation(){
  const root=$('standardBars');
  const title=$('bestStandard');
  const note=$('bestStandardNote');
  if(!root||!title||!note)return;

  const first=root.querySelector('.bar-row');
  if(!first){
    title.textContent='—';
    note.textContent='填写角色与当前面板后生成推荐';
    return;
  }

  const label=first.querySelector('.bar-label')?.textContent?.trim()||'';
  const gain=first.querySelector('.bar-value')?.textContent?.trim()||'—';
  const match=label.match(/^(.*?)(?:\s+)([-+]?\d+(?:\.\d+)?%?)$/);
  const stat=match?.[1]?.trim()||label||'—';
  const roll=match?.[2]?.trim()||'';

  title.textContent=stat;
  note.textContent=`${roll?`平均档 ${roll} · `:''}当前边际提升 ${gain}`;
}

function init(){
  const root=$('standardBars');
  if(!root)return;
  const observer=new MutationObserver(()=>queueMicrotask(syncRecommendation));
  observer.observe(root,{childList:true,subtree:true,characterData:true});
  syncRecommendation();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
