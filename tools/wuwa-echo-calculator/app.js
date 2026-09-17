(()=>{'use strict';

const $=id=>document.getElementById(id);
const num=id=>Number($(id)?.value||0);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const pct=x=>`${x>=0?'+':''}${x.toFixed(2)}%`;

const LABEL={
  critRate:'暴击率',critDmg:'暴击伤害',atkPct:'攻击力%',flatAtk:'固定攻击',
  hpPct:'生命值%',flatHp:'固定生命',defPct:'防御力%',flatDef:'固定防御',
  energyRegen:'共鸣效率',basicDmg:'普攻伤害',heavyDmg:'重击伤害',
  skillDmg:'共鸣技能伤害',liberationDmg:'共鸣解放伤害',
  elementDmg:'属性伤害',globalDmg:'全伤害',healing:'治疗效果'
};
const DAMAGE_KEY={basic:'basicDmg',heavy:'heavyDmg',skill:'skillDmg',liberation:'liberationDmg'};
const SUB_TYPES=['','critRate','critDmg','atkPct','flatAtk','hpPct','flatHp','defPct','flatDef','energyRegen','basicDmg','heavyDmg','skillDmg','liberationDmg'];
const ROLLS={
  critRate:[6.3,6.9,7.5,8.1,8.7,9.3,9.9,10.5],
  critDmg:[12.6,13.8,15,16.2,17.4,18.6,19.8,21],
  atkPct:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  hpPct:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  basicDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  heavyDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  skillDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  liberationDmg:[6.4,7.1,7.9,8.6,9.4,10.1,10.9,11.6],
  defPct:[8.1,9,10,10.9,11.8,12.8,13.8,14.7],
  energyRegen:[6.8,7.6,8.4,9.2,10,10.8,11.6,12.4],
  flatHp:[320,360,390,430,470,510,540,580],
  flatAtk:[30,40,50,60],
  flatDef:[40,50,60,70]
};
const STD={
  critRate:8.4,critDmg:16.8,atkPct:9,hpPct:9,defPct:11.8,
  flatAtk:50,flatHp:470,flatDef:60,energyRegen:10,
  basicDmg:9,heavyDmg:9,skillDmg:9,liberationDmg:9
};
const MAIN_PRIMARY={
  4:[
    ['','— 选择主词条 —'],['critRate','暴击率 22%'],['critDmg','暴击伤害 44%'],
    ['atkPct','攻击力 33%'],['hpPct','生命值 33%'],['defPct','防御力 41.8%'],
    ['healing','治疗效果 26.4%']
  ],
  3:[
    ['','— 选择主词条 —'],['elementDmg','对应属性伤害 30%'],['energyRegen','共鸣效率 32%'],
    ['atkPct','攻击力 30%'],['hpPct','生命值 30%'],['defPct','防御力 38%']
  ],
  1:[
    ['','— 选择主词条 —'],['atkPct','攻击力 18%'],['hpPct','生命值 22.8%'],['defPct','防御力 18%']
  ]
};
const MAIN_VALUE={
  4:{critRate:22,critDmg:44,atkPct:33,hpPct:33,defPct:41.8,healing:26.4},
  3:{elementDmg:30,energyRegen:32,atkPct:30,hpPct:30,defPct:38},
  1:{atkPct:18,hpPct:22.8,defPct:18}
};
const FIXED_MAIN={4:{type:'flatAtk',value:150},3:{type:'flatAtk',value:100},1:{type:'flatHp',value:2280}};
const IMAGE_OVERRIDES={'今汐':'https://raw.githubusercontent.com/xinghuan22/WutheringWavesPic/main/1304/1304_1777616673463.webp'};

const FALLBACK=['景燃','清宵','穗穗','秧秧·玄翎','洛瑟菈','达妮娅','绯雪','西格莉卡','陆·赫斯','爱弥斯','莫宁','琳奈','千咲','仇远','嘉贝莉娜','尤诺','奥古斯塔','弗洛洛','露帕','卡提希娅','夏空','赞妮','坎特蕾拉','布兰特','菲比','洛可可','珂莱塔','椿','守岸人','相里要','折枝','长离','今汐','吟霖','忌炎','秧秧','散华','渊武','秋水','莫特斐','丹瑾','桃祈','维里奈','凌阳','卡卡罗','鉴心','安可'];
let roster=FALLBACK.map((name,i)=>({id:`f-${i}`,name,image:''}));
let mechanics={characters:{}};
let sonatas={sets:[]};
let selectedCharacter=null;

const blank=()=>({type:'',value:0});
const blankEcho=(cost=4)=>({cost,mainType:'',sub:[blank(),blank(),blank(),blank(),blank()]});
const defaultEchoes=()=>[blankEcho(4),blankEcho(3),blankEcho(3),blankEcho(1),blankEcho(1)];
let M={echoes:defaultEchoes(),candidate:blankEcho(4)};

function avg(a){return a?.length?a.reduce((x,y)=>x+y,0)/a.length:0}
function options(items,value){return items.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}
function subOpts(v){return SUB_TYPES.map(t=>`<option value="${t}" ${t===v?'selected':''}>${t?esc(LABEL[t]+(t.startsWith('flat')?'':' %')):'— 无 —'}</option>`).join('')}
function rollOpts(t,cur){const a=ROLLS[t]||[];if(!t)return '<option value="0">—</option>';const n=Number(cur),v=a.includes(n)?n:(a[Math.floor((a.length-1)/2)]||0);return a.map(x=>`<option value="${x}" ${x===v?'selected':''}>${x}${t.startsWith('flat')?'':'%'}</option>`).join('')}
function avatar(c){const src=IMAGE_OVERRIDES[c?.name]||c?.image||'';return src?`<span class="portrait"><img src="${esc(src)}" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.textContent='${esc((c.name||'?')[0])}'"></span>`:`<span class="portrait placeholder">${esc((c?.name||'?')[0])}</span>`}
function profile(){return selectedCharacter?mechanics.characters?.[selectedCharacter.name]||null:null}

async function loadData(){
  const urls=['/wuwa/data/characters.json','/wuwa/data/character-mechanics.json','/wuwa/data/character-mechanics-extra.json','/wuwa/data/sonata-effects.json'];
  const r=await Promise.allSettled(urls.map(u=>fetch(u,{cache:'no-store'}).then(x=>x.ok?x.json():Promise.reject())));
  if(r[0].status==='fulfilled'){const a=Array.isArray(r[0].value)?r[0].value:r[0].value.characters;if(Array.isArray(a))roster=a.filter(x=>x?.name).map((x,i)=>({id:String(x.id||i),name:String(x.name).trim(),image:x.image||''}))}
  if(r[1].status==='fulfilled'&&r[1].value?.characters)mechanics=r[1].value;
  if(r[2].status==='fulfilled'&&r[2].value?.characters)mechanics.characters={...(mechanics.characters||{}),...r[2].value.characters};
  if(r[3].status==='fulfilled'&&Array.isArray(r[3].value?.sets))sonatas=r[3].value;
  renderCharacters();refreshGearOptions({keepMain:true,keepPieces:true,keepSecondary:true});
}
function renderCharacters(q=''){q=q.trim().toLowerCase();$('characterGrid').innerHTML=roster.filter(c=>!q||c.name.toLowerCase().includes(q)).map(c=>`<button class="character-card" data-char-id="${esc(c.id)}" type="button">${avatar(c)}<span>${esc(c.name)}</span>${mechanics.characters?.[c.name]?'':'<em class="nomodel">未建模</em>'}</button>`).join('')}
function renderMain(e,root){const f=FIXED_MAIN[e.cost];root.innerHTML=`<div class="echo-row main-primary"><select class="echo-type">${options(MAIN_PRIMARY[e.cost]||MAIN_PRIMARY[4],e.mainType)}</select><select class="echo-value" disabled><option>${e.mainType?(MAIN_VALUE[e.cost]?.[e.mainType]||0):0}${e.mainType&&!e.mainType.startsWith('flat')?'%':''}</option></select></div><div class="echo-row fixed-main"><select class="echo-type" disabled><option>${esc(LABEL[f.type])}</option></select><select class="echo-value" disabled><option>${f.value}</option></select></div>`}
function renderSubs(lines,root){root.innerHTML=lines.map((x,i)=>`<div class="echo-row" data-i="${i}"><select class="echo-type">${subOpts(x.type)}</select><select class="echo-value">${rollOpts(x.type,x.value)}</select></div>`).join('')}
function echoCards(){const host=$('equippedEchoes');host.innerHTML=M.echoes.map((e,i)=>`<div class="echo-card" data-echo="${i}"><div class="echo-card-head"><b>声骸 ${i+1}</b><select class="cost-select echo-cost"><option value="4" ${e.cost===4?'selected':''}>4 COST</option><option value="3" ${e.cost===3?'selected':''}>3 COST</option><option value="1" ${e.cost===1?'selected':''}>1 COST</option></select></div><div class="echo-section-label">主词条</div><div class="main-rows"></div><div class="echo-section-label">副词条</div><div class="sub-rows"></div><div class="echo-mini-score"><span>词条评分</span><strong id="miniScore${i}">—</strong><span class="echo-mini-grade" id="miniGrade${i}">D</span></div></div>`).join('');host.querySelectorAll('.echo-card').forEach(c=>{const e=M.echoes[+c.dataset.echo];renderMain(e,c.querySelector('.main-rows'));renderSubs(e.sub,c.querySelector('.sub-rows'))})}
function candidateRows(){renderMain(M.candidate,$('candidateMainRows'));renderSubs(M.candidate.sub,$('candidateSubRows'))}
function pullEchoes(){document.querySelectorAll('.echo-card').forEach(c=>{const e=M.echoes[+c.dataset.echo];e.cost=+c.querySelector('.echo-cost').value;e.mainType=c.querySelector('.main-primary .echo-type').value;e.sub=[...c.querySelectorAll('.sub-rows .echo-row')].map(r=>({type:r.querySelector('.echo-type').value,value:+r.querySelector('.echo-value').value||0}))});M.candidate.cost=+$('candidateCost').value||4;M.candidate.mainType=document.querySelector('#candidateMainRows .main-primary .echo-type')?.value||'';M.candidate.sub=[...$('candidateSubRows').querySelectorAll('.echo-row')].map(r=>({type:r.querySelector('.echo-type').value,value:+r.querySelector('.echo-value').value||0}))}

function clearCharacterData(){M={echoes:defaultEchoes(),candidate:blankEcho(4)};$('chainLevel').value='0';['totalAtk','totalHp','totalDef','critRate','critDmg','energyRegen'].forEach(id=>$(id).value='');['elementDmg','globalDmg','globalAmp','nonEchoAtkPct','nonEchoHpPct','nonEchoDefPct'].forEach(id=>{if($(id))$(id).value='0'});$('replaceSlot').value='0';$('candidateCost').value='4';echoCards();candidateRows();resetResults()}
function resetResults(){['overallGain','candidateScore','critFactor','bestStandard'].forEach(id=>$(id).textContent='—');$('critState').textContent='—';$('bestStandardNote').textContent='填写角色与当前面板后生成推荐';if($('buildScore'))$('buildScore').textContent='—';if($('buildTier'))$('buildTier').textContent='录入声骸后评估毕业度';$('lineMarginals').innerHTML='';$('standardBars').innerHTML=''}
function selectCharacter(c){if(!c)return;const changed=selectedCharacter?.name!==c.name;if(changed)clearCharacterData();selectedCharacter=c;$('characterPick').innerHTML=`${avatar(c)}<span class="pick-copy"><b id="characterName">${esc(c.name)}</b><small>角色数据已匹配</small></span>`;$('characterBrowser').hidden=true;const p=profile();if(p?.scaler){$('scaler').value=p.scaler;$('scaler').disabled=true}else $('scaler').disabled=false;applyDefaults(p);calculate()}

const ALIAS={eternal5:'此间永驻之光',eternal2:'此间永驻之光',lingering5:'不绝余音',lingering2:'不绝余音',moonlit2:'轻云出月',rejuv5:'隐世回光',elem5:'',elem2:''};
function setHas(s,p){return Array.isArray(s?.[`p${p}`])&&s[`p${p}`].length>0}
function setByName(n){return(sonatas.sets||[]).find(s=>s.name===n)}
function validPieces(s){if(!s)return[];const out=[];if(setHas(s,5))out.push('5');if(setHas(s,3))out.push('3');if(setHas(s,1))out.push('1');return out}
function mountGear(){if($('gearAutoConfig'))return;const host=document.querySelector('.intro-panel .profile-grid');if(!host)return;const d=document.createElement('div');d.id='gearAutoConfig';d.className='gear-auto-config';d.innerHTML=`<div class="gear-auto-grid"><label>武器被动<select id="weaponMode"><option value="none">不计专武被动</option></select></label><label>主套装<select id="sonataMain"><option value="">— 选择套装 —</option></select></label><label>主套件数<select id="sonataPieces" disabled><option value="none">— 先选主套装 —</option></select></label><label>2件副套（仅主套3件时）<select id="sonataSecondary" disabled><option value="">— 主套3件时可选 —</option></select></label></div>`;host.insertAdjacentElement('afterend',d);$('weaponMode').addEventListener('change',calculate);$('sonataMain').addEventListener('change',()=>{refreshGearOptions({keepMain:true,keepPieces:false,keepSecondary:false});calculate()});$('sonataPieces').addEventListener('change',()=>{refreshGearOptions({keepMain:true,keepPieces:true,keepSecondary:false});calculate()});$('sonataSecondary').addEventListener('change',calculate)}
function refreshGearOptions(opts={}){if(!$('sonataMain'))return;const keepMain=opts.keepMain!==false,keepPieces=opts.keepPieces!==false,keepSecondary=opts.keepSecondary!==false;const mainEl=$('sonataMain'),piecesEl=$('sonataPieces'),secondaryEl=$('sonataSecondary');const oldMain=keepMain?mainEl.value:'',oldPieces=keepPieces?piecesEl.value:'none',oldSecondary=keepSecondary?secondaryEl.value:'';const all=(sonatas.sets||[]).filter(s=>validPieces(s).length);mainEl.innerHTML='<option value="">— 选择套装 —</option>'+all.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');if(oldMain&&all.some(s=>s.name===oldMain))mainEl.value=oldMain;const main=setByName(mainEl.value),valid=validPieces(main);piecesEl.disabled=!main;if(!main){piecesEl.innerHTML='<option value="none">— 先选主套装 —</option>'}else{piecesEl.innerHTML=valid.map(p=>`<option value="${p}">${p} 件</option>`).join('');piecesEl.value=valid.includes(oldPieces)?oldPieces:(valid[0]||'none')}const isThree=piecesEl.value==='3';const p2=(sonatas.sets||[]).filter(s=>setHas(s,2)&&s.name!==mainEl.value);secondaryEl.innerHTML='<option value="">— 选择2件副套 —</option>'+p2.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');secondaryEl.disabled=!isThree;if(!isThree){secondaryEl.value='';secondaryEl.title='主套选择3件时才可选择副套装'}else{secondaryEl.title='';if(oldSecondary&&p2.some(s=>s.name===oldSecondary))secondaryEl.value=oldSecondary}}
function applyDefaults(p){const w=$('weaponMode');w.innerHTML='<option value="none">不计专武被动</option>'+(p?.signature_weapon?.name?`<option value="signature">${esc(p.signature_weapon.name)}（专武）</option>`:'');w.value=p?.signature_weapon?.verified?'signature':'none';$('sonataMain').value='';refreshGearOptions({keepMain:false,keepPieces:false,keepSecondary:false});const raw=p?.defaults?.sonata||'',name=ALIAS[raw]??raw;if(!name)return;const s=setByName(name);if(!s)return;$('sonataMain').value=name;refreshGearOptions({keepMain:true,keepPieces:false,keepSecondary:false});const valid=validPieces(s);const preferred=raw.endsWith('5')&&valid.includes('5')?'5':raw.endsWith('3')&&valid.includes('3')?'3':valid.includes('5')?'5':valid.includes('3')?'3':valid[0];if(preferred)$('sonataPieces').value=preferred;refreshGearOptions({keepMain:true,keepPieces:true,keepSecondary:false})}

function echoLines(e){const out=[],f=FIXED_MAIN[e.cost];if(e.mainType)out.push({type:e.mainType,value:MAIN_VALUE[e.cost]?.[e.mainType]||0});out.push({...f});e.sub.forEach(x=>{if(x.type&&x.value)out.push(x)});return out}
function aggregate(echoes,extra=[]){const a={atkPct:0,flatAtk:0,hpPct:0,flatHp:0,defPct:0,flatDef:0,critRate:0,critDmg:0,energyRegen:0,elementDmg:0,basicDmg:0,heavyDmg:0,skillDmg:0,liberationDmg:0,healing:0};[...echoes.flatMap(echoLines),...extra].forEach(x=>{const k=x.type||x.kind;if(k in a)a[k]+=+x.value||0});return a}
function panel(){return{atk:num('totalAtk'),hp:num('totalHp'),def:num('totalDef'),critRate:num('critRate'),critDmg:num('critDmg'),energyRegen:num('energyRegen'),extraElementDmg:num('elementDmg'),globalDmg:num('globalDmg'),globalAmp:num('globalAmp'),nonEchoAtkPct:num('nonEchoAtkPct'),nonEchoHpPct:num('nonEchoHpPct'),nonEchoDefPct:num('nonEchoDefPct')}}
function context(){const p=panel(),a=aggregate(M.echoes),pr=profile(),chain=+$('chainLevel').value||0;return{panel:p,curAgg:a,profile:pr,chain,baseEff:{atk:Math.max(1,(p.atk-a.flatAtk)/Math.max(.01,1+(a.atkPct+p.nonEchoAtkPct)/100)),hp:Math.max(1,(p.hp-a.flatHp)/Math.max(.01,1+(a.hpPct+p.nonEchoHpPct)/100)),def:Math.max(1,(p.def-a.flatDef)/Math.max(.01,1+(a.defPct+p.nonEchoDefPct)/100))},nonEcho:{critRate:p.critRate-a.critRate,critDmg:p.critDmg-a.critDmg,energyRegen:p.energyRegen-a.energyRegen,extraElementDmg:p.extraElementDmg}}}
function chainEffects(pr,lv){const out=[];(pr?.innate||[]).forEach(e=>{if(e.apply!=='panel')out.push(e)});(pr?.chains||[]).filter(x=>x.level<=lv).forEach(x=>(x.effects||[]).forEach(e=>{if(e.apply!=='panel')out.push(e)}));return out}
function sonataEffects(ctx){const pieces=$('sonataPieces')?.value||'none',main=setByName($('sonataMain')?.value),sec=setByName($('sonataSecondary')?.value),out=[];const add=(s,p)=>{(s?.[`p${p}`]||[]).forEach(e=>{if(e.condition==='er250'){const er=ctx.nonEcho.energyRegen+ctx.curAgg.energyRegen+(s.p2||[]).filter(z=>z.kind==='energyRegen').reduce((n,z)=>n+(+z.value||0),0);if(er<250)return}out.push(e)})};if(pieces==='5'){add(main,2);add(main,5)}else if(pieces==='3'){add(main,3);add(sec,2)}else if(pieces==='1'){add(main,1)}return out}
function autoEffects(ctx){const out=[...chainEffects(ctx.profile,ctx.chain),...sonataEffects(ctx)];if($('weaponMode')?.value==='signature')out.push(...(ctx.profile?.signature_weapon?.effects||[]));return out}
function bucket(ctx){const a={atkPct:0,hpPct:0,defPct:0,critRate:0,critDmg:0,energyRegen:0,elementDmg:0,globalDmg:0,globalAmp:0,basicDmg:0,heavyDmg:0,skillDmg:0,liberationDmg:0};autoEffects(ctx).forEach(e=>{const k=e.kind||e.type;if(k in a)a[k]+=+e.value||0});return a}
function model(ctx,a){const z=bucket(ctx);return{atk:ctx.baseEff.atk*(1+(a.atkPct+z.atkPct+ctx.panel.nonEchoAtkPct)/100)+a.flatAtk,hp:ctx.baseEff.hp*(1+(a.hpPct+z.hpPct+ctx.panel.nonEchoHpPct)/100)+a.flatHp,def:ctx.baseEff.def*(1+(a.defPct+z.defPct+ctx.panel.nonEchoDefPct)/100)+a.flatDef,critRate:ctx.nonEcho.critRate+a.critRate+z.critRate,critDmg:ctx.nonEcho.critDmg+a.critDmg+z.critDmg,energyRegen:ctx.nonEcho.energyRegen+a.energyRegen+z.energyRegen,elementDmg:ctx.nonEcho.extraElementDmg+a.elementDmg+z.elementDmg,globalDmg:ctx.panel.globalDmg+z.globalDmg,globalAmp:ctx.panel.globalAmp+z.globalAmp,typeDmg:{basic:a.basicDmg+z.basicDmg,heavy:a.heavyDmg+z.heavyDmg,skill:a.skillDmg+z.skillDmg,liberation:a.liberationDmg+z.liberationDmg}}}
function weights(pr){const lv=+$('chainLevel').value||0,w=pr?.chain_type_weights?.[String(lv)]||pr?.type_weights;if(!w)return{other:1};const sum=Object.values(w).reduce((n,v)=>n+(+v||0),0);if(!(sum>0))return{other:1};return Object.fromEntries(Object.entries(w).map(([k,v])=>[k,(+v||0)/sum]))}
function factorAgg(ctx,a){const s=model(ctx,a),stat=Math.max(1e-6,s[$('scaler').value]),cr=clamp(s.critRate/100,0,1),cd=Math.max(1,s.critDmg/100),crit=1+cr*(cd-1),amp=Math.max(1e-6,1+s.globalAmp/100);let dm=0;for(const[k,w]of Object.entries(weights(ctx.profile))){const t=k==='other'?0:+s.typeDmg[k]||0;dm+=w*Math.max(1e-6,1+(s.globalDmg+s.elementDmg+t)/100)}return stat*crit*amp*dm}
function factorSet(ctx,echoes,extra=[]){return factorAgg(ctx,aggregate(echoes,extra))}
function gainExtra(ctx,type,value){const b=factorSet(ctx,M.echoes);return(factorSet(ctx,M.echoes,[{type,value}])/b-1)*100}
function relevant(ctx){return Object.entries(weights(ctx.profile)).filter(([k,w])=>k!=='other'&&w>=.025).map(([k])=>DAMAGE_KEY[k]).filter(Boolean)}
function standards(ctx){const sc=$('scaler').value,p=sc==='atk'?'atkPct':sc==='hp'?'hpPct':'defPct',f=sc==='atk'?'flatAtk':sc==='hp'?'flatHp':'flatDef';const types=['critRate','critDmg',p,f,...relevant(ctx)];return [...new Set(types)].map(type=>({type,value:STD[type],gain:gainExtra(ctx,type,STD[type])})).sort((a,b)=>b.gain-a.gain)}
function grade(s){return s>=100?'SSS':s>=90?'SS':s>=80?'S':s>=65?'A':s>=50?'B':s>=35?'C':'D'}
// 词条评分口径学习自 WuwaEchoTool（GQin404，已开源停更）：
// 每类副词条一个角色相关的静态系数，单条得分 = 数值 × 系数，
// 单只声骸 = Σ得分 / 该角色理论最优五条满档词条 × 100。
// 完全静态：只依赖角色伤害构成，不随面板或其他声骸变化。
const COEF_UNIKE=.9;
function coefTable(ctx){
  const sc=$('scaler').value,w=weights(ctx.profile);
  const c={critRate:1.8,critDmg:.9,energyRegen:.5,elementDmg:1};
  if(sc==='hp'){c.hpPct=1;c.flatHp=.01}
  else if(sc==='def'){c.defPct=1.2;c.flatDef=.09}
  else{c.atkPct=1;c.flatAtk=.1}
  c.basicDmg=COEF_UNIKE*(w.basic||0);c.heavyDmg=COEF_UNIKE*(w.heavy||0);c.skillDmg=COEF_UNIKE*(w.skill||0);c.liberationDmg=COEF_UNIKE*(w.liberation||0);
  return c;
}
function echoScoreCap(c){return SUB_TYPES.filter(Boolean).map(t=>Math.max(...(ROLLS[t]||[0]))*(c[t]||0)).filter(x=>x>0).sort((a,b)=>b-a).slice(0,5).reduce((a,b)=>a+b,0)}
function scoreEcho(ctx,e){
  const c=coefTable(ctx),cap=echoScoreCap(c);
  if(!(cap>0))return 0;
  let s=0;e.sub.forEach(l=>{if(l.type&&l.value)s+=(+l.value)*(c[l.type]||0)});
  return s/cap*100;
}
// 整套毕业度：主词条+固定主词条+副词条全部计分，除以理论满配（WuwaEchoTool 同口径）。
function echoPoints(e,c){
  let s=0;
  if(e.mainType)s+=(MAIN_VALUE[e.cost]?.[e.mainType]||0)*(c[e.mainType]||0);
  const f=FIXED_MAIN[e.cost];s+=f.value*(c[f.type]||0);
  e.sub.forEach(l=>{if(l.type&&l.value)s+=(+l.value)*(c[l.type]||0)});
  return s;
}
function slotCap(cost,c){
  const best=Math.max(0,...Object.entries(MAIN_VALUE[cost]||{}).map(([t,v])=>v*(c[t]||0)));
  const f=FIXED_MAIN[cost];
  return best+f.value*(c[f.type]||0)+echoScoreCap(c);
}
function buildScore(ctx){
  const c=coefTable(ctx);
  const cap=M.echoes.reduce((s,e)=>s+slotCap(e.cost,c),0);
  if(!(cap>0))return 0;
  return M.echoes.reduce((s,e)=>s+echoPoints(e,c),0)/cap*100;
}
function byzt(s){return s>90?'完美毕业':s>80?'大毕业':s>70?'中毕业':s>60?'小毕业':s>50?'接近毕业':'咸鱼一条'}
const MIX_LABEL={basic:'普攻',heavy:'重击',skill:'共鸣技能',liberation:'共鸣解放',other:'其他 / 声骸'};
function renderProfilePanel(ctx){
  const body=$('profileBody'),hint=$('profileHint');
  if(!body)return;
  if(!selectedCharacter){body.innerHTML='<div class="micro">选择角色后，这里会显示伤害构成、生效中的机制加成与数据来源。</div>';if(hint)hint.textContent='选择角色后生成';return}
  const p=ctx.profile,w=weights(p);
  const mixRows=Object.entries(MIX_LABEL).map(([k,label])=>({label,share:(w[k]||0)*100})).filter(x=>x.share>=.5);
  const mx=Math.max(1,...mixRows.map(x=>x.share));
  const mixHtml=mixRows.length?mixRows.map(x=>`<div class="bar-row"><div class="bar-label">${esc(x.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${(x.share/mx*100).toFixed(1)}%"></div></div><div class="bar-value">${x.share.toFixed(0)}%</div></div>`).join(''):'<div class="micro">该角色尚未建模，按通用口径（无类型伤权重）计算。</div>';
  const fx=autoEffects(ctx);
  const fxSource=s=>{if(!s)return'';if(/^weapon/.test(s))return'专武';if(/^sonata/.test(s))return'套装';if(/^innate/.test(s))return'固有';return s.replace('-preview','·前瞻')};
  const fxHtml=fx.length?`<div class="fx-list">${fx.map(e=>{const src=fxSource(e.source);return `<span class="fx-chip">${esc(LABEL[e.kind||e.type]||e.kind||'')} <em>+${esc(e.value)}%</em>${src?` · ${esc(src)}`:''}</span>`}).join('')}</div>`:'<div class="micro">当前没有生效中的共鸣链 / 套装 / 专武修正。</div>';
  const conf=({measured:'实测数据',derived:'攻略推导',estimated:'前瞻推断'})[p?.confidence]||(p?'社区数据':'未建模 · 通用口径');
  const note=p?.notes?`<div class="profile-note">${esc(p.notes)}</div>`:'';
  body.innerHTML=`<div class="profile-head">${avatar(selectedCharacter)}<div><b>${esc(selectedCharacter.name)}</b><small>主倍率 ${esc(($('scaler').value||'atk').toUpperCase())} · ${esc(conf)}${p?.preview?' · 3.7 前瞻':''}</small></div></div>
  <div><div class="profile-section-label">伤害构成</div><div class="bars" style="margin-top:7px">${mixHtml}</div></div>
  <div><div class="profile-section-label">生效中的机制加成</div><div style="margin-top:7px">${fxHtml}</div></div>${note}`;
  if(hint)hint.textContent=p?`按 ${ctx.chain} 链口径`:'通用口径';
}
function renderBars(root,rows,numeric=true){const mx=Math.max(.000001,...rows.map(x=>Math.max(0,x.gain)));root.innerHTML=rows.map(x=>`<div class="bar-row"><div class="bar-label">${esc(x.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.max(0,x.gain)/mx*100)}%"></div></div><div class="bar-value">${numeric?pct(x.gain):esc(x.tag||'')}</div></div>`).join('')||'<div class="micro">暂无数据。</div>'}
function barsWithNote(root,note,rows,numeric=true){if(!root)return;root.innerHTML=`<div class="micro bars-note">${note}</div><div class="bars"></div>`;renderBars(root.querySelector('.bars'),rows,numeric)}
function lineGainProxy(line,pure){const r=pure.get(line.type)||0,st=STD[line.type]||avg(ROLLS[line.type])||1;return r*(line.value/st)}
function actionable(ctx,std){const pure=new Map(std.map(x=>[x.type,x.gain])),out=[];for(const x of std){const max=Math.max(...(ROLLS[x.type]||[0])),av=avg(ROLLS[x.type])||x.value,st=STD[x.type]||av;let best=null;for(let i=0;i<M.echoes.length;i++){const e=M.echoes[i],have=e.sub.find(l=>l.type===x.type);if(have){const rem=Math.max(0,max-have.value);if(rem>1e-6){const g=x.gain*(rem/st);if(!best||g>best.gain)best={type:x.type,gain:g,slot:i,mode:'upgrade'}}}else{const lines=e.sub.filter(l=>l.type&&l.value);if(!lines.length)continue;const weakest=lines.map(l=>({l,cost:lineGainProxy(l,pure)})).sort((a,b)=>a.cost-b.cost)[0];const g=x.gain*(av/st)-weakest.cost;if(g>1e-6&&(!best||g>best.gain))best={type:x.type,gain:g,slot:i,mode:'replace'}}}if(best)out.push(best)}return out.sort((a,b)=>b.gain-a.gain)}
function hasAnyCurrentSubstat(){return M.echoes.some(e=>e.sub.some(l=>l.type&&Number(l.value)>0))}
function calculate(){pullEchoes();const ctx=context();renderProfilePanel(ctx);if(!(ctx.panel.atk||ctx.panel.hp||ctx.panel.def)){resetResults();return}const slot=+$('replaceSlot').value||0,next=clone(M.echoes);next[slot]=clone(M.candidate);const gain=(factorSet(ctx,next)/factorSet(ctx,M.echoes)-1)*100;$('overallGain').textContent=pct(gain);const cs=scoreEcho(ctx,M.candidate);$('candidateScore').textContent=cs.toFixed(1);const cg=$('candidateGrade');if(cg)cg.textContent=`评级 ${grade(cs)}`;if(hasAnyCurrentSubstat()){const bs=buildScore(ctx);if($('buildScore'))$('buildScore').textContent=bs.toFixed(1);if($('buildTier'))$('buildTier').textContent=byzt(bs)}else{if($('buildScore'))$('buildScore').textContent='—';if($('buildTier'))$('buildTier').textContent='录入声骸后评估毕业度'}const s=model(ctx,aggregate(M.echoes)),cr=clamp(s.critRate/100,0,1),cd=Math.max(1,s.critDmg/100);$('critFactor').textContent=(1+cr*(cd-1)).toFixed(3);$('critState').textContent=`战斗态 ${s.critRate.toFixed(1)} / ${s.critDmg.toFixed(1)}`;const std=standards(ctx);if(!hasAnyCurrentSubstat()){$('bestStandard').textContent='等待录入词条';$('bestStandardNote').textContent='录入当前5只声骸的副词条后生成可实现建议';$('standardBars').innerHTML='<div class="micro bars-note">尚未录入声骸副词条。</div>'}else{const act=actionable(ctx,std);if(act.length){const t=act[0];$('bestStandard').textContent=LABEL[t.type];$('bestStandardNote').textContent=`当前可实现边际提升最高 · 声骸 ${t.slot+1} · ${t.mode==='upgrade'?'仍有提档空间':'可通过替换弱词条改善'}`;barsWithNote($('standardBars'),'基于当前 5 只声骸的真实提档 / 替换空间排序：',act.map(x=>({label:LABEL[x.type],gain:x.gain,tag:x.mode==='upgrade'?'可提档':'可替换'})),false)}else{$('bestStandard').textContent='暂无可实现升级';$('bestStandardNote').textContent='当前已录入词条没有可继续提升的合法空间';$('standardBars').innerHTML='<div class="micro bars-note">当前词条已饱和或没有正收益替换项。</div>'}}const lr=[];M.candidate.sub.forEach((l,j)=>{if(!l.type||!l.value)return;const r=clone(next);r[slot].sub[j]={type:'',value:0};lr.push({label:LABEL[l.type],gain:(factorSet(ctx,next)/factorSet(ctx,r)-1)*100})});
if(lr.length)barsWithNote($('lineMarginals'),'候选声骸每条副词条对当前整套的真实边际提升：',lr,true);
else barsWithNote($('lineMarginals'),'尚未填写候选副词条 · 先展示各词条的理论边际收益（平均档）：',std.map(x=>({label:`${LABEL[x.type]} ${x.value}${x.type.startsWith('flat')?'':'%'}`,gain:x.gain})),true);M.echoes.forEach((e,i)=>{const score=scoreEcho(ctx,e);$('miniScore'+i).textContent=score.toFixed(1);$('miniGrade'+i).textContent=grade(score)})}

function bind(){
  $('characterPick').onclick=()=>{$('characterBrowser').hidden=false;$('characterSearch').focus()};$('closeCharacterBrowser').onclick=()=>{$('characterBrowser').hidden=true};$('characterSearch').oninput=e=>renderCharacters(e.target.value);$('characterGrid').onclick=e=>{const b=e.target.closest('[data-char-id]');if(!b)return;selectCharacter(roster.find(x=>x.id===b.dataset.charId))};$('chainLevel').onchange=calculate;$('scaler').onchange=calculate;['totalAtk','totalHp','totalDef','critRate','critDmg','energyRegen','elementDmg','globalDmg','globalAmp','nonEchoAtkPct','nonEchoHpPct','nonEchoDefPct'].forEach(id=>$(id)?.addEventListener('input',calculate));
  $('equippedEchoes').addEventListener('change',e=>{const c=e.target.closest('.echo-card');if(!c)return;const i=+c.dataset.echo,ec=M.echoes[i];if(e.target.classList.contains('echo-cost')){pullEchoes();ec.cost=+e.target.value;ec.mainType='';renderMain(ec,c.querySelector('.main-rows'));renderSubs(ec.sub,c.querySelector('.sub-rows'));calculate();return}if(e.target.closest('.main-primary')&&e.target.classList.contains('echo-type')){ec.mainType=e.target.value;renderMain(ec,c.querySelector('.main-rows'));calculate();return}if(e.target.closest('.sub-rows')&&e.target.classList.contains('echo-type')){const r=e.target.closest('.echo-row'),v=r.querySelector('.echo-value');v.innerHTML=rollOpts(e.target.value,+v.value||0)}calculate()});
  $('candidateCost').onchange=()=>{pullEchoes();M.candidate.cost=+$('candidateCost').value;M.candidate.mainType='';candidateRows();calculate()};$('candidateMainRows').addEventListener('change',e=>{if(e.target.classList.contains('echo-type')){M.candidate.mainType=e.target.value;renderMain(M.candidate,$('candidateMainRows'))}calculate()});$('candidateSubRows').addEventListener('change',e=>{if(e.target.classList.contains('echo-type')){const r=e.target.closest('.echo-row'),v=r.querySelector('.echo-value');v.innerHTML=rollOpts(e.target.value,+v.value||0)}calculate()});$('replaceSlot').onchange=calculate;$('calculateBtn').onclick=calculate;$('resetStatsBtn').onclick=()=>{Object.entries({totalAtk:2300,totalHp:21000,totalDef:1500,critRate:75,critDmg:250,energyRegen:125,elementDmg:0,globalDmg:0,globalAmp:0,nonEchoAtkPct:0,nonEchoHpPct:0,nonEchoDefPct:0}).forEach(([k,v])=>{if($(k))$(k).value=v});calculate()}
}
function init(){echoCards();candidateRows();mountGear();bind();loadData().finally(calculate)}
window.WuwaEchoV2={calculate,clearCharacterData,selectCharacter,refreshGearOptions};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();