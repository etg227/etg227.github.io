(()=>{'use strict';
const $=id=>document.getElementById(id);
const num=id=>Number($(id)?.value||0);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const clone=o=>JSON.parse(JSON.stringify(o));
const pct=x=>`${x>=0?'+':''}${x.toFixed(2)}%`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

const TYPE_LABELS={
  critRate:'暴击率',critDmg:'暴击伤害',atkPct:'攻击力%',flatAtk:'固定攻击',hpPct:'生命值%',flatHp:'固定生命',defPct:'防御力%',flatDef:'固定防御',energyRegen:'共鸣效率',
  basicDmg:'普攻伤害',heavyDmg:'重击伤害',skillDmg:'共鸣技能伤害',liberationDmg:'共鸣解放伤害',elementDmg:'属性伤害',healing:'治疗效果'
};
const DAMAGE_KEY={basic:'basicDmg',heavy:'heavyDmg',skill:'skillDmg',liberation:'liberationDmg'};
const DAMAGE_LABEL={basic:'普攻',heavy:'重击',skill:'共鸣技能',liberation:'共鸣解放'};
const SUB_TYPES=['','critRate','critDmg','atkPct','flatAtk','hpPct','flatHp','defPct','flatDef','energyRegen','basicDmg','heavyDmg','skillDmg','liberationDmg'];
const SUB_ROLLS={
  critRate:[6.3,6.9,7.5,8.1,8.7,9.3,9.9,10.5],
  critDmg:[12.6,13.8,15.0,16.2,17.4,18.6,19.8,21.0],
  atkPct:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6], hpPct:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  basicDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6], heavyDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6], skillDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6], liberationDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  defPct:[8.1,9.0,10.0,10.9,11.8,12.8,13.8,14.7],
  energyRegen:[6.8,7.6,8.4,9.2,10.0,10.8,11.6,12.4],
  flatHp:[320,360,390,430,470,510,540,580], flatAtk:[30,40,50,60], flatDef:[40,50,60,70]
};
const STANDARD_ROLL={critRate:8.4,critDmg:16.8,atkPct:9,hpPct:9,defPct:11.8,flatAtk:50,flatHp:470,flatDef:60,energyRegen:10,basicDmg:9,heavyDmg:9,skillDmg:9,liberationDmg:9};

const MAIN_PRIMARY={
  4:[['','— 选择主词条 —'],['critRate','暴击率 22%'],['critDmg','暴击伤害 44%'],['atkPct','攻击力 33%'],['hpPct','生命值 33%'],['defPct','防御力 41.8%'],['healing','治疗效果 26.4%']],
  3:[['','— 选择主词条 —'],['elementDmg','对应属性伤害 30%'],['energyRegen','共鸣效率 32%'],['atkPct','攻击力 30%'],['hpPct','生命值 30%'],['defPct','防御力 38%']],
  1:[['','— 选择主词条 —'],['atkPct','攻击力 18%'],['hpPct','生命值 22.8%'],['defPct','防御力 18%']]
};
const MAIN_VALUE={4:{critRate:22,critDmg:44,atkPct:33,hpPct:33,defPct:41.8,healing:26.4},3:{elementDmg:30,energyRegen:32,atkPct:30,hpPct:30,defPct:38},1:{atkPct:18,hpPct:22.8,defPct:18}};
const FIXED_MAIN={4:{type:'flatAtk',value:150},3:{type:'flatAtk',value:100},1:{type:'flatHp',value:2280}};

const FALLBACK_NAMES=['景燃','清宵','穗穗','秧秧·玄翎','洛瑟菈','达妮娅','绯雪','西格莉卡','陆·赫斯','爱弥斯','莫宁','琳奈','千咲','仇远','嘉贝莉娜','尤诺','奥古斯塔','弗洛洛','露帕','卡提希娅','夏空','赞妮','坎特蕾拉','布兰特','菲比','洛可可','珂莱塔','椿','守岸人','相里要','折枝','长离','今汐','吟霖','忌炎','秧秧','散华','渊武','秋水','莫特斐','丹瑾','桃祈','维里奈','凌阳','卡卡罗','鉴心','安可','漂泊者'];
let roster=FALLBACK_NAMES.map((name,i)=>({id:`fallback-${i}`,name,image:''}));
let mechanics={characters:{}};
let selectedCharacter=null;
const blankLine=()=>({type:'',value:0});
const blankEcho=(cost=4)=>({cost,mainType:'',sub:[blankLine(),blankLine(),blankLine(),blankLine(),blankLine()]});
let M={echoes:[blankEcho(4),blankEcho(3),blankEcho(3),blankEcho(1),blankEcho(1)],candidate:blankEcho(4)};

function optionHtml(items,value){return items.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}
function subTypeOptions(value){return SUB_TYPES.map(t=>`<option value="${t}" ${t===value?'selected':''}>${t?esc(TYPE_LABELS[t]+' '+(t.includes('flat')?'':'%')):'— 无 —'}</option>`).join('')}
function rollOptions(type,current){const vals=SUB_ROLLS[type]||[];if(!type)return '<option value="0">—</option>';const chosen=vals.includes(Number(current))?Number(current):vals[Math.floor((vals.length-1)/2)]||0;return vals.map(v=>`<option value="${v}" ${v===chosen?'selected':''}>${v}${type.startsWith('flat')?'':'%'}</option>`).join('')}
function mainPrimaryOptions(cost,current){return optionHtml(MAIN_PRIMARY[cost]||MAIN_PRIMARY[4],current)}
function mainValue(cost,type){return MAIN_VALUE[cost]?.[type]||0}

async function loadData(){
  const jobs=[
    fetch('/wuwa/data/characters.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()),
    fetch('/wuwa/data/character-mechanics.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject())
  ];
  const [r,m]=await Promise.allSettled(jobs);
  if(r.status==='fulfilled'){
    const arr=Array.isArray(r.value)?r.value:r.value.characters;
    if(Array.isArray(arr)&&arr.length) roster=arr.filter(x=>x?.name).map((x,i)=>({id:String(x.id||i),name:String(x.name).trim(),image:x.image||''}));
  }
  if(m.status==='fulfilled'&&m.value?.characters) mechanics=m.value;
  $('rosterSource').textContent=`库街区角色库 · ${roster.length} 名角色`;
  renderCharacters();
}
function avatar(c){if(c?.image)return `<span class="portrait"><img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.textContent='${esc((c.name||'?').slice(0,1))}'"></span>`;return `<span class="portrait placeholder">${esc((c?.name||'?').slice(0,1))}</span>`}
function renderCharacters(filter=''){const q=filter.trim().toLowerCase();$('characterGrid').innerHTML=roster.filter(c=>!q||c.name.toLowerCase().includes(q)).map(c=>`<button class="character-card" data-char-id="${esc(c.id)}" type="button">${avatar(c)}<span>${esc(c.name)}</span></button>`).join('')}
function currentProfile(){return selectedCharacter?mechanics.characters?.[selectedCharacter.name]||null:null}
function selectCharacter(c){
  selectedCharacter=c;
  $('characterPick').innerHTML=`${avatar(c)}<span class="pick-copy"><b id="characterName">${esc(c.name)}</b><small id="rosterSource">库街区角色库</small></span>`;
  $('characterBrowser').hidden=true;
  const p=currentProfile();
  if(p?.scaler){$('scaler').value=p.scaler;$('scaler').disabled=true}else{$('scaler').disabled=false}
  renderMechanics();calculate();
}
function chainEffects(profile,chain){const out=[];(profile?.innate||[]).forEach(e=>{if(e.apply!=='panel')out.push({...e,source:'innate'})});(profile?.chains||[]).filter(x=>x.level<=chain).forEach(x=>(x.effects||[]).forEach(e=>{if(e.apply!=='panel')out.push({...e,source:`S${x.level}`})}));return out}
function renderMechanics(){
  const p=currentProfile(),chain=Number($('chainLevel').value||0);
  if(!selectedCharacter){$('mechanicSummary').textContent='选择角色后显示。';$('mechanicTags').innerHTML='';$('chainSummary').innerHTML='';$('mechanicSource').textContent='';return}
  if(!p?.verified){
    $('mechanicSummary').innerHTML=`<strong>${esc(selectedCharacter.name)}</strong> 的角色机制尚未完成校验。为了避免误判，普攻/重击/技能/解放伤害词条暂不计为有效词条；双暴、主要倍率属性与共鸣效率仍可计算。`;
    $('mechanicTags').innerHTML='<span class="mechanic-tag">机制待校验</span>';
    $('chainSummary').innerHTML='<div class="micro">当前共鸣链只记录，不自动猜测链效果。</div>';
    $('mechanicSource').textContent='数据源：库街区角色目录；角色机制详情待补齐。';
    $('characterModelStatus').innerHTML='<strong>角色机制：</strong>该角色尚未完成详情校验，类型伤害词条会保守地排除，避免像“把赞妮重击算无效”这样的错误。';
    return;
  }
  $('mechanicSummary').innerHTML=`<strong>${esc(selectedCharacter.name)}</strong> · ${esc(p.summary||'')}`;
  const weights=p.type_weights||{};
  $('mechanicTags').innerHTML=Object.entries(weights).filter(([,w])=>w>0.001).sort((a,b)=>b[1]-a[1]).map(([k,w],i)=>`<span class="mechanic-tag ${i===0?'core':''}">${esc(DAMAGE_LABEL[k]||k)}${i===0?' · 核心':' · 有效'}</span>`).join('');
  const unlocked=(p.chains||[]).filter(x=>x.level<=chain);
  $('chainSummary').innerHTML=unlocked.length?unlocked.map(x=>`<div class="chain-item"><b>${x.level}链</b><span>${esc(x.label)}</span></div>`).join(''):'<div class="micro">0链：没有共鸣链额外修正。</div>';
  $('mechanicSource').innerHTML=`角色技能/共鸣链来源：<a href="${esc(p.source_url||'https://wiki.kurobbs.com/mc/home')}" target="_blank" rel="noreferrer">库街区《鸣潮》WIKI</a>。类型权重由技能的实际伤害标签与标准输出模型生成；常驻面板型共鸣链不重复叠加。`;
  $('characterModelStatus').innerHTML=`<strong>角色机制已校验：</strong>${esc(p.type_notes?.heavy||p.summary||'')} 共鸣链会随上方链数自动加入计算。`;
}

function renderMainRows(e,root){
  const fixed=FIXED_MAIN[e.cost];
  root.innerHTML=`
    <div class="echo-row main-primary"><select class="echo-type">${mainPrimaryOptions(e.cost,e.mainType)}</select><select class="echo-value" disabled><option>${e.mainType?mainValue(e.cost,e.mainType):0}${e.mainType&&!e.mainType.startsWith('flat')?'%':''}</option></select></div>
    <div class="echo-row fixed-main"><select class="echo-type" disabled><option>${esc(TYPE_LABELS[fixed.type])}</option></select><select class="echo-value" disabled><option>${fixed.value}</option></select></div>`;
}
function renderSubRows(lines,root){root.innerHTML=lines.map((r,i)=>`<div class="echo-row" data-i="${i}"><select class="echo-type">${subTypeOptions(r.type)}</select><select class="echo-value">${rollOptions(r.type,r.value)}</select></div>`).join('')}
function echoCards(){
  $('equippedEchoes').innerHTML=M.echoes.map((e,i)=>`<div class="echo-card" data-echo="${i}"><div class="echo-card-head"><b>声骸 ${i+1}</b><select class="cost-select echo-cost"><option value="4" ${e.cost===4?'selected':''}>4 COST</option><option value="3" ${e.cost===3?'selected':''}>3 COST</option><option value="1" ${e.cost===1?'selected':''}>1 COST</option></select></div><div class="echo-section-label">主词条</div><div class="main-rows"></div><div class="echo-section-label">副词条</div><div class="sub-rows"></div><div class="echo-mini-score"><span>本站边际评分</span><strong id="miniScore${i}">—</strong></div></div>`).join('');
  document.querySelectorAll('.echo-card').forEach(card=>{const e=M.echoes[Number(card.dataset.echo)];renderMainRows(e,card.querySelector('.main-rows'));renderSubRows(e.sub,card.querySelector('.sub-rows'))});
}
function candidateRows(){renderMainRows(M.candidate,$('candidateMainRows'));renderSubRows(M.candidate.sub,$('candidateSubRows'))}
function syncRowValue(row){const t=row.querySelector('.echo-type')?.value||'',v=row.querySelector('.echo-value');if(!v)return;v.innerHTML=rollOptions(t,Number(v.value||0))}
function pullEchoes(){
  document.querySelectorAll('.echo-card').forEach(card=>{
    const i=Number(card.dataset.echo),e=M.echoes[i];e.cost=Number(card.querySelector('.echo-cost').value);e.mainType=card.querySelector('.main-primary .echo-type').value;
    e.sub=[...card.querySelectorAll('.sub-rows .echo-row')].map(row=>({type:row.querySelector('.echo-type').value,value:Number(row.querySelector('.echo-value').value||0)}));
  });
  M.candidate.cost=Number($('candidateCost').value||4);M.candidate.mainType=$('candidateMainRows .main-primary .echo-type')?.value||'';
  M.candidate.sub=[...$('candidateSubRows').querySelectorAll('.echo-row')].map(row=>({type:row.querySelector('.echo-type').value,value:Number(row.querySelector('.echo-value').value||0)}));
}

function echoLines(e){const fixed=FIXED_MAIN[e.cost];const out=[];if(e.mainType)out.push({type:e.mainType,value:mainValue(e.cost,e.mainType),main:true});out.push({...fixed,main:true});(e.sub||[]).forEach(x=>{if(x.type&&Number(x.value))out.push({...x,main:false})});return out}
function aggregate(echoes,extra=[]){
  const a={atkPct:0,flatAtk:0,hpPct:0,flatHp:0,defPct:0,flatDef:0,critRate:0,critDmg:0,energyRegen:0,elementDmg:0,basicDmg:0,heavyDmg:0,skillDmg:0,liberationDmg:0};
  [...echoes.flatMap(echoLines),...extra].forEach(x=>{if(a[x.type]!==undefined)a[x.type]+=Number(x.value||0)});return a;
}
function panelState(){return{atk:num('totalAtk'),hp:num('totalHp'),def:num('totalDef'),critRate:num('critRate'),critDmg:num('critDmg'),energyRegen:num('energyRegen'),elementDmg:num('elementDmg'),globalDmg:num('globalDmg'),globalAmp:num('globalAmp')}}
function makeContext(){
  const panel=panelState(),curAgg=aggregate(M.echoes),profile=currentProfile(),chain=Number($('chainLevel').value||0);
  const baseEff={
    atk:Math.max(1,(panel.atk-curAgg.flatAtk)/Math.max(.01,1+curAgg.atkPct/100)),
    hp:Math.max(1,(panel.hp-curAgg.flatHp)/Math.max(.01,1+curAgg.hpPct/100)),
    def:Math.max(1,(panel.def-curAgg.flatDef)/Math.max(.01,1+curAgg.defPct/100))
  };
  const nonEcho={
    critRate:panel.critRate-curAgg.critRate,critDmg:panel.critDmg-curAgg.critDmg,energyRegen:panel.energyRegen-curAgg.energyRegen,
    elementDmg:panel.elementDmg-curAgg.elementDmg
  };
  return{panel,curAgg,profile,chain,baseEff,nonEcho};
}
function modelFromAggregate(ctx,a){
  const auto={atkPct:0,hpPct:0,defPct:0,critRate:0,critDmg:0,elementDmg:0,globalDmg:0,globalAmp:0};
  chainEffects(ctx.profile,ctx.chain).forEach(e=>{if(auto[e.kind]!==undefined)auto[e.kind]+=Number(e.value||0)});
  const stats={
    atk:ctx.baseEff.atk*(1+(a.atkPct+auto.atkPct)/100)+a.flatAtk,
    hp:ctx.baseEff.hp*(1+(a.hpPct+auto.hpPct)/100)+a.flatHp,
    def:ctx.baseEff.def*(1+(a.defPct+auto.defPct)/100)+a.flatDef,
    critRate:ctx.nonEcho.critRate+a.critRate+auto.critRate,
    critDmg:ctx.nonEcho.critDmg+a.critDmg+auto.critDmg,
    energyRegen:ctx.nonEcho.energyRegen+a.energyRegen,
    elementDmg:ctx.nonEcho.elementDmg+a.elementDmg+auto.elementDmg,
    globalDmg:ctx.panel.globalDmg+auto.globalDmg,
    globalAmp:ctx.panel.globalAmp+auto.globalAmp,
    typeDmg:{basic:a.basicDmg,heavy:a.heavyDmg,skill:a.skillDmg,liberation:a.liberationDmg}
  };
  return stats;
}
function normalizedWeights(profile){const w=profile?.verified?profile.type_weights:null;if(!w)return{other:1};const sum=Object.values(w).reduce((a,b)=>a+Number(b||0),0)||1;return Object.fromEntries(Object.entries(w).map(([k,v])=>[k,Number(v||0)/sum]))}
function factorFromAgg(ctx,a){
  const s=modelFromAggregate(ctx,a),scaler=$('scaler').value,stat=Math.max(1e-6,s[scaler]);
  const cr=clamp(s.critRate/100,0,1),cd=Math.max(1,s.critDmg/100),crit=1+cr*(cd-1),amp=Math.max(1e-6,1+s.globalAmp/100);
  const weights=normalizedWeights(ctx.profile);let dmgMix=0;
  for(const [k,w] of Object.entries(weights)){
    const typeBonus=k==='other'?0:Number(s.typeDmg[k]||0);dmgMix+=w*Math.max(1e-6,1+(s.globalDmg+s.elementDmg+typeBonus)/100);
  }
  return stat*crit*amp*dmgMix;
}
function factorSet(ctx,echoes,extra=[]){return factorFromAgg(ctx,aggregate(echoes,extra))}
function compareSets(ctx,a,b){return(factorSet(ctx,b)/factorSet(ctx,a)-1)*100}
function gainExtra(ctx,type,value){const base=factorSet(ctx,M.echoes),next=factorSet(ctx,M.echoes,[{type,value}]);return(next/base-1)*100}
function relevantTypeStats(ctx){if(!ctx.profile?.verified)return[];return Object.entries(normalizedWeights(ctx.profile)).filter(([k,w])=>k!=='other'&&w>=.025).map(([k])=>DAMAGE_KEY[k]).filter(Boolean)}
function standardCandidates(ctx){
  const scaler=$('scaler').value,pctType=scaler==='atk'?'atkPct':scaler==='hp'?'hpPct':'defPct',flatType=scaler==='atk'?'flatAtk':scaler==='hp'?'flatHp':'flatDef';
  const rows=[['critRate',STANDARD_ROLL.critRate],['critDmg',STANDARD_ROLL.critDmg],[pctType,STANDARD_ROLL[pctType]],[flatType,STANDARD_ROLL[flatType]]];
  relevantTypeStats(ctx).forEach(t=>rows.push([t,STANDARD_ROLL[t]]));
  return rows.map(([type,value])=>({type,value,label:`${TYPE_LABELS[type]} ${value}${type.startsWith('flat')?'':'%'}`,gain:gainExtra(ctx,type,value)})).sort((a,b)=>b.gain-a.gain);
}
function scoreEcho(ctx,echo,echoes,index,subOnly=true){
  const lines=(subOnly?echo.sub:echoLines(echo)).filter(x=>x.type&&Number(x.value));if(!lines.length)return{score:0,equiv:0};
  const standards=standardCandidates(ctx),ref=Math.max(.000001,(standards[0]?.gain||0)/100);let equiv=0;
  for(const line of lines){
    const reduced=clone(echoes);const target=reduced[index];
    if(subOnly){const j=target.sub.findIndex(x=>x.type===line.type&&Number(x.value)===Number(line.value));if(j>=0)target.sub[j]={type:'',value:0};}
    const full=factorSet(ctx,echoes),without=factorSet(ctx,reduced),g=Math.max(-.999999,full/without-1);equiv+=Math.log1p(g)/Math.log1p(ref);
  }
  return{score:equiv/5*100,equiv};
}
function grade(s){if(s>=100)return'SSS';if(s>=90)return'SS';if(s>=80)return'S';if(s>=65)return'A';if(s>=50)return'B';return'C'}
function bars(root,rows){const mx=Math.max(.01,...rows.map(x=>Math.abs(x.gain)));root.innerHTML=rows.map(x=>`<div class="bar-row ${x.gain<0?'negative':''}"><div class="bar-label">${esc(x.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.abs(x.gain)/mx*100)}%"></div></div><div class="bar-value">${pct(x.gain)}</div></div>`).join('')||'<div class="micro">暂无数据。</div>'}
function renderRollControls(){
  $('rollControls').innerHTML=[['critRate','标准暴击',STANDARD_ROLL.critRate],['critDmg','标准暴伤',STANDARD_ROLL.critDmg],['atkPct','标准攻/生%',STANDARD_ROLL.atkPct],['heavyDmg','标准类型伤',STANDARD_ROLL.heavyDmg]].map(([k,l,v])=>`<label>${l}<select disabled><option>${v}%</option></select></label>`).join('');
}
function calculate(){
  pullEchoes();const ctx=makeContext(),slot=Number($('replaceSlot').value||0),next=clone(M.echoes);next[slot]=clone(M.candidate);
  const gain=compareSets(ctx,M.echoes,next);$('overallGain').textContent=pct(gain);
  const nextCtx=ctx,candidateScore=scoreEcho(nextCtx,M.candidate,next,slot,true);$('candidateScore').textContent=`${candidateScore.score.toFixed(1)}`;
  const currentStats=modelFromAggregate(ctx,aggregate(M.echoes)),cr=clamp(currentStats.critRate/100,0,1),cd=Math.max(1,currentStats.critDmg/100),crit=1+cr*(cd-1);$('critFactor').textContent=crit.toFixed(3);$('critState').textContent=`战斗态 ${currentStats.critRate.toFixed(1)} / ${currentStats.critDmg.toFixed(1)}`;
  const standards=standardCandidates(ctx);$('bestStandard').textContent=standards[0]?.label||'—';$('bestStandardNote').textContent=ctx.profile?.verified?'已考虑角色伤害类型与共鸣链':'类型伤害词条待角色机制校验';
  bars($('standardBars'),standards.map(x=>({label:x.label,gain:x.gain})));
  const lineRows=[];M.candidate.sub.forEach((line,j)=>{if(!line.type||!Number(line.value))return;const reduced=clone(next);reduced[slot].sub[j]={type:'',value:0};lineRows.push({label:`${TYPE_LABELS[line.type]} ${line.value}${line.type.startsWith('flat')?'':'%'}`,gain:(factorSet(ctx,next)/factorSet(ctx,reduced)-1)*100})});bars($('lineMarginals'),lineRows);
  $('echoScoreCards').innerHTML=M.echoes.map((e,i)=>{const s=scoreEcho(ctx,e,M.echoes,i,true);const contribution=(()=>{const no=clone(M.echoes);no[i]=blankEcho(e.cost);return(factorSet(ctx,M.echoes)/factorSet(ctx,no)-1)*100})();$('miniScore'+i).textContent=s.score.toFixed(1);return `<div class="score-card"><div class="score-card-head"><div><small>声骸 ${i+1}</small><strong>${s.score.toFixed(1)}</strong></div><span class="grade">${grade(s.score)}</span></div><div class="score-contrib">整只相对空位贡献 ${pct(contribution)}</div></div>`}).join('');
  const scaler=$('scaler').value,pctType=scaler==='atk'?'atkPct':scaler==='hp'?'hpPct':'defPct',gCD=gainExtra(ctx,'critDmg',STANDARD_ROLL.critDmg),gCR=gainExtra(ctx,'critRate',STANDARD_ROLL.critRate),gStat=gainExtra(ctx,pctType,STANDARD_ROLL[pctType]);
  const eff=relevantTypeStats(ctx).map(t=>`${TYPE_LABELS[t]} ${pct(gainExtra(ctx,t,STANDARD_ROLL[t]))}`).join(' · ')||'角色机制未校验，暂不判定类型伤有效';
  $('boundaryCards').innerHTML=`<div class="boundary-card"><span>战斗态双暴</span><strong>${currentStats.critRate.toFixed(1)} / ${currentStats.critDmg.toFixed(1)}</strong><span>标准暴击 ${pct(gCR)}；标准暴伤 ${pct(gCD)}。</span></div><div class="boundary-card"><span>爆伤 vs 主要属性%</span><strong>${gCD>gStat?'暴伤当前更高':'主要属性%当前更高'}</strong><span>${TYPE_LABELS[pctType]} ${pct(gStat)} · 暴伤 ${pct(gCD)}</span></div><div class="boundary-card"><span>角色有效类型</span><strong>${ctx.profile?.verified?'自动识别':'待校验'}</strong><span>${esc(eff)}</span></div>`;
  $('scoreMethodNote').innerHTML=ctx.profile?.verified?`类型伤害词条按 <strong>${esc(selectedCharacter?.name||'当前角色')}</strong> 的机制模型自动加权；例如赞妮焚日模式的核心斩击会被识别为重击，因此重击伤害词条会进入有效词条评分。百分比 ATK/HP/DEF 当前采用“当前面板 + 已录入声骸”反推有效基线，后续接入武器/库街区面板后可进一步精确。`:'该角色机制尚未校验，因此类型伤害副词条不会被冒然计入评分。';
}

function rerenderEchoCard(card,e){renderMainRows(e,card.querySelector('.main-rows'));renderSubRows(e.sub,card.querySelector('.sub-rows'))}
function bind(){
  $('characterPick').addEventListener('click',()=>{$('characterBrowser').hidden=false;$('characterSearch').focus()});$('closeCharacterBrowser').addEventListener('click',()=>{$('characterBrowser').hidden=true});$('characterSearch').addEventListener('input',e=>renderCharacters(e.target.value));$('characterGrid').addEventListener('click',e=>{const b=e.target.closest('[data-char-id]');if(!b)return;const c=roster.find(x=>x.id===b.dataset.charId);if(c)selectCharacter(c)});
  $('chainLevel').addEventListener('change',()=>{renderMechanics();calculate()});$('scaler').addEventListener('change',calculate);
  ['totalAtk','totalHp','totalDef','critRate','critDmg','energyRegen','elementDmg','globalDmg','globalAmp'].forEach(id=>$(id).addEventListener('input',calculate));
  $('resetStatsBtn').addEventListener('click',()=>{Object.entries({totalAtk:2300,totalHp:21000,totalDef:1500,critRate:75,critDmg:250,energyRegen:125,elementDmg:0,globalDmg:0,globalAmp:0}).forEach(([k,v])=>$(k).value=v);calculate()});
  $('equippedEchoes').addEventListener('change',e=>{
    const card=e.target.closest('.echo-card');if(!card)return;const i=Number(card.dataset.echo),echo=M.echoes[i];
    if(e.target.classList.contains('echo-cost')){pullEchoes();echo.cost=Number(e.target.value);echo.mainType='';rerenderEchoCard(card,echo);calculate();return}
    if(e.target.closest('.main-primary')&&e.target.classList.contains('echo-type')){echo.mainType=e.target.value;renderMainRows(echo,card.querySelector('.main-rows'));calculate();return}
    if(e.target.closest('.sub-rows')&&e.target.classList.contains('echo-type')){syncRowValue(e.target.closest('.echo-row'));calculate();return}calculate();
  });
  $('candidateCost').addEventListener('change',()=>{pullEchoes();M.candidate.cost=Number($('candidateCost').value);M.candidate.mainType='';candidateRows();calculate()});
  $('candidateMainRows').addEventListener('change',e=>{if(e.target.classList.contains('echo-type')){M.candidate.mainType=e.target.value;renderMainRows(M.candidate,$('candidateMainRows'));calculate()}});
  $('candidateSubRows').addEventListener('change',e=>{if(e.target.classList.contains('echo-type'))syncRowValue(e.target.closest('.echo-row'));calculate()});
  $('replaceSlot').addEventListener('change',calculate);$('calculateBtn').addEventListener('click',calculate);
}
function init(){echoCards();candidateRows();renderRollControls();bind();loadData().finally(()=>{renderMechanics();calculate()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
