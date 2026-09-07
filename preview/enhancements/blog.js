(() => {
  if (window.flowerBlogEnhancements) return;
  window.flowerBlogEnhancements = true;
  let indexPromise;
  function getIndex() {
    if (!indexPromise) indexPromise = fetch('/preview/enhancements/search.json').then(r => {if(!r.ok) throw Error('index');return r.json();}).catch(e=>{indexPromise=null;throw e;});
    return indexPromise;
  }
  function highlighted(target,text,terms) {
    const lower=text.toLocaleLowerCase(); let cursor=0;
    while(cursor<text.length) {
      let start=-1,term='';
      for(const t of terms) {const i=lower.indexOf(t,cursor);if(i>=0&&(start<0||i<start||(i===start&&t.length>term.length))){start=i;term=t;}}
      if(start<0){target.append(document.createTextNode(text.slice(cursor)));break;}
      target.append(document.createTextNode(text.slice(cursor,start)));
      const mark=document.createElement('mark');mark.textContent=text.slice(start,start+term.length);target.append(mark);cursor=start+term.length;
    }
  }
  function setup() {
    const copy=document.querySelector('[data-copy-page]');
    if(copy&&!copy.dataset.ready){copy.dataset.ready='true';copy.addEventListener('click',async()=>{const status=document.querySelector('[data-copy-status]');try{await navigator.clipboard.writeText(location.href);status.textContent='链接已复制';}catch{status.textContent='未能复制，请复制浏览器地址栏中的链接。';}});}
    const music = document.querySelector('#anMusic-page');
    if (music && !document.querySelector('[data-music-status]')) {
      const note = document.createElement('p');
      note.dataset.musicStatus = ''; note.className = 'blog-music-status';
      note.setAttribute('role','status'); note.textContent = '正在加载你的网易云歌单…';
      music.before(note);
      const update = () => { if (music.querySelector('.aplayer-list li')) note.hidden = true; };
      const observer = new MutationObserver(update);
      observer.observe(music,{childList:true,subtree:true}); update();
      const timeout = setTimeout(() => { if (!note.hidden) note.textContent = '歌单服务暂时未响应，可以通过上方链接在网易云打开原歌单。'; },12000);
      document.addEventListener('pjax:send', () => { observer.disconnect(); clearTimeout(timeout); }, {once:true});
    }
    const nav = document.querySelector('#nav-right');
    if (nav && !document.getElementById('flower-search-link')) {
      const a = document.createElement('a');
      a.id = 'flower-search-link'; a.href = '/preview/search/'; a.textContent = '搜索';
      a.className = 'site-page'; a.setAttribute('aria-label', '搜索文章'); nav.prepend(a);
    }
    const input = document.querySelector('[data-blog-search]');
    if (!input || input.dataset.ready) return;
    input.dataset.ready = 'true';
    const results = document.querySelector('[data-blog-results]');
    const status = document.querySelector('[data-blog-status]');
    let posts = [];
    let loaded = false;
    input.value = new URL(location.href).searchParams.get('q') || '';
    function render() {
      if(!loaded)return;
      const query = input.value.trim().toLocaleLowerCase();
      const terms = query.split(/\s+/).filter(Boolean);
      const matches = posts.filter(p => terms.every(t => (p.title + ' ' + p.text).toLocaleLowerCase().includes(t)));
      results.replaceChildren(); status.textContent = query ? `找到 ${matches.length} 篇文章` : `共 ${posts.length} 篇文章`;
      for (const p of matches) {
        const section = document.createElement('section'); section.className = 'blog-result';
        const link = document.createElement('a'); link.href = p.url; highlighted(link,p.title,terms);
        const meta=document.createElement('div');meta.className='blog-result-meta';meta.textContent=`${p.date || ''} · 约 ${p.minutes || 1} 分钟阅读`;
        const excerpt = document.createElement('p');
        const pos = terms.length ? Math.max(0,p.text.toLocaleLowerCase().indexOf(terms[0])-35) : 0;
        highlighted(excerpt,(pos ? '…' : '') + p.text.slice(pos,pos+180) + (p.text.length > pos+180 ? '…' : ''),terms);
        section.append(link,meta,excerpt); results.append(section);
      }
      if(!matches.length){const note=document.createElement('p');note.className='blog-note';note.textContent='试试更短的关键词，或清空搜索查看全部文章。';results.append(note);}
      const url=new URL(location.href);if(input.value.trim())url.searchParams.set('q',input.value.trim());else url.searchParams.delete('q');history.replaceState(history.state,'',url);
    }
    input.addEventListener('input',render);
    input.closest('form')?.addEventListener('submit',e=>{e.preventDefault();render();});
    document.querySelector('[data-search-clear]')?.addEventListener('click',()=>{input.value='';render();input.focus();});
    const load=()=>{status.textContent='正在加载文章…';results.replaceChildren();getIndex().then(data=>{if(!input.isConnected)return;posts=data;loaded=true;render();}).catch(()=>{if(!input.isConnected)return;status.textContent='搜索暂时无法加载。';const retry=document.createElement('button');retry.type='button';retry.className='blog-search-retry';retry.textContent='重新加载';retry.addEventListener('click',load,{once:true});results.append(retry);});};
    load();
  }
  document.addEventListener('DOMContentLoaded',setup);
  document.addEventListener('pjax:complete',setup);
  setup();
})();
