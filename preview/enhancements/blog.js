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
    if(copy&&!copy.dataset.ready){copy.dataset.ready='true';copy.addEventListener('click',async()=>{const status=document.querySelector('[data-copy-status]');status.textContent='正在复制…';let timer;try{await Promise.race([navigator.clipboard.writeText(location.href),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),4000);})]);status.textContent='链接已复制';}catch{status.textContent='未能复制，请复制浏览器地址栏中的链接。';}finally{clearTimeout(timer);}});}
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



/* ETG227_POST_AI_AND_OUTDATE */
(() => {
  if (window.etgPostAiReady) return;
  window.etgPostAiReady = true;

  const OUTDATE_DAYS = 365;
  const TYPE_INTERVAL_MS = 28;
  const PREFIX = location.pathname.startsWith('/preview/') ? '/preview' : '';
  const INTRO = '我是花澪的文章摘要助手，由 DeepSeek 驱动。本站的摘要在文章发布时离线生成，随页面一起发布；你阅读文章时，不会有任何信息被发送给 AI。';
  const DAY_MS = 86400000;

  let summariesPromise;
  const getSummaries = () => {
    if (!summariesPromise) {
      summariesPromise = fetch('/enhancements/ai-summaries.json', { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => {
          summariesPromise = null;
          return {};
        });
    }
    return summariesPromise;
  };

  const currentKey = () => {
    let path = location.pathname;
    try { path = decodeURIComponent(path); } catch (e) { /* keep raw path */ }
    if (PREFIX && path.startsWith(PREFIX)) path = path.slice(PREFIX.length);
    path = path.replace(/index\.html$/, '');
    return path.endsWith('/') ? path : path + '/';
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const go = (url) => {
    if (window.pjax && typeof window.pjax.loadUrl === 'function') window.pjax.loadUrl(url);
    else location.href = url;
  };

  const addOutdateNotice = (container) => {
    if (container.querySelector('.post-outdate-notice')) return;
    const time = document.querySelector('#post-meta time.post-meta-date-updated')
      || document.querySelector('#post-meta time.post-meta-date-created');
    const stamp = time && Date.parse(time.getAttribute('datetime'));
    if (!stamp) return;
    const days = Math.floor((Date.now() - stamp) / DAY_MS);
    if (days < OUTDATE_DAYS) return;
    const notice = el('div', 'post-outdate-notice', `距离上次更新已经过去了 ${days} 天，文章的内容可能已经过时。`);
    container.insertBefore(notice, container.firstChild);
  };

  const buildCard = (container, entry, all, key) => {
    const card = el('div', 'post-ai-description');
    const title = el('div', 'ai-title');
    title.append(el('i', 'anzhiyufont anzhiyu-icon-bilibili'), el('div', 'ai-title-text', 'AI-摘要'));
    const replay = el('i', 'anzhiyufont anzhiyu-icon-arrow-rotate-right');
    replay.title = '重新生成';
    const tag = el('div', '', 'DeepSeek');
    tag.id = 'ai-tag';
    tag.style.marginLeft = 'auto';
    tag.title = `由 ${entry.model || 'DeepSeek'} 生成于 ${(entry.generated || '').slice(0, 10)}`;
    title.append(replay, tag);

    const output = el('div', 'ai-explanation', 'AI初始化中...');
    const buttons = el('div', 'ai-btn-box');
    const addButton = (label, onClick) => {
      const b = el('div', 'ai-btn-item', label);
      b.setAttribute('role', 'button');
      b.tabIndex = 0;
      b.addEventListener('click', onClick);
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } });
      buttons.append(b);
    };

    let timer = null;
    const type = (text) => {
      clearTimeout(timer);
      output.replaceChildren();
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { output.textContent = text; return; }
      const textNode = document.createTextNode('');
      const cursor = el('span', 'ai-cursor');
      output.append(textNode, cursor);
      const chars = Array.from(text);
      let i = 0;
      const step = () => {
        if (!output.isConnected) return;
        textNode.data += chars[i++] || '';
        if (i < chars.length) timer = setTimeout(step, TYPE_INTERVAL_MS);
        else timer = setTimeout(() => cursor.remove(), 600);
      };
      step();
    };

    const recommend = () => {
      clearTimeout(timer);
      const others = Object.entries(all).filter(([k]) => k !== key);
      if (!others.length) {
        type('暂时还没有其他文章可以推荐，作者正在努力更新中。');
        return;
      }
      others.sort(() => Math.random() - 0.5);
      output.replaceChildren(el('div', '', '推荐文章：'));
      const list = el('div', 'ai-recommend');
      others.slice(0, 4).forEach(([k, v], idx) => {
        const item = el('div', 'ai-recommend-item');
        item.append(el('span', 'index', `${idx + 1}：`));
        const a = el('a', '', v.title || k);
        a.href = PREFIX + k;
        a.addEventListener('click', (e) => { e.preventDefault(); go(PREFIX + k); });
        item.append(a);
        item.addEventListener('click', () => go(PREFIX + k));
        list.append(item);
      });
      output.append(list);
    };

    addButton('介绍自己 🙈', () => type(INTRO));
    addButton('生成本文简介 👋', () => type(entry.summary));
    addButton('推荐相关文章 📖', recommend);
    addButton('前往主页 🏠', () => go(PREFIX + '/'));
    replay.addEventListener('click', () => type(entry.summary));

    card.append(title, output, buttons);
    container.insertBefore(card, container.firstChild);

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((records) => {
        if (records.some((r) => r.isIntersecting)) {
          io.disconnect();
          type(entry.summary);
        }
      });
      io.observe(card);
    } else {
      type(entry.summary);
    }
  };

  const init = async () => {
    const container = document.querySelector('#post #article-container');
    if (!container || container.dataset.etgPostAi === '1') return;
    container.dataset.etgPostAi = '1';

    addOutdateNotice(container);

    const key = currentKey();
    const all = await getSummaries();
    const entry = all && all[key];
    if (!entry || !entry.summary || !container.isConnected) return;
    if (container.querySelector('.post-ai-description')) return;
    buildCard(container, entry, all, key);
  };

  const boot = () => setTimeout(init, 0);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  document.addEventListener('pjax:complete', boot);
})();


/* ETG227_WUWATOOL_EFFECTS */
(() => {
  if (window.etgEffectsReady) return;
  window.etgEffectsReady = true;

  const root = document.documentElement;
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const THEME_TOGGLE = '#darkmode, .darkmode_switchbutton, #menu-darkmode';
  const PRESS = [
    '.categoryButton', '.ai-btn-item', '.research-button', '#rightside button', '.console-btn-item a',
    '.card-tag-cloud a', '#tag-page-tags a', '.category-lists a', '.pagination a', '.menus_items .site-page',
    '.post-meta__tags', 'button:not(:disabled)'
  ].join(',');

  // 点击反馈：按下轻微收缩、松手弹簧回弹，并从按下的位置漾开一圈光
  document.addEventListener('pointerdown', (e) => {
    if (e.button || reduced()) return;
    const el = e.target.closest(PRESS);
    if (!el || el.matches(THEME_TOGGLE)) return;
    el.animate?.([{ scale: 1 }, { scale: 0.965 }], { duration: 110, easing: 'ease-out', fill: 'forwards' });
    const up = () => {
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      el.animate?.([{ scale: 0.965 }, { scale: 1 }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' });
    };
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);

    const r = el.getBoundingClientRect();
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const box = document.createElement('etg-press-light');
    box.setAttribute('aria-hidden', 'true');
    const dot = document.createElement('etg-dot');
    const s = Math.min(Math.max(r.width, r.height) * 2.2, 200);
    dot.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${s}px;height:${s}px`;
    box.appendChild(dot);
    el.appendChild(box);
    setTimeout(() => box.remove(), 700);
  }, { passive: true });

  // 切换深色模式：先拦下点击，再把主题原来的切换放进 View Transition，新主题从按钮位置圆形铺开
  let replaying = false;
  document.addEventListener('click', (e) => {
    if (replaying) return;
    const btn = e.target.closest(THEME_TOGGLE);
    if (!btn || !document.startViewTransition || reduced()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.dataset.etgVt = 'theme';
    const vt = document.startViewTransition(() => {
      replaying = true;
      try { btn.click(); } finally { replaying = false; }
    });
    vt.finished.finally(() => { if (root.dataset.etgVt === 'theme') delete root.dataset.etgVt; });
    vt.ready.then(() => root.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
      { duration: 620, easing: 'cubic-bezier(.45,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
    )).catch(() => {});
  }, true);

  // 卡片浮入：滚到视野里才播，每张只播一次；同一批出现的卡片依次错开
  const FLOAT = '#recent-posts > .recent-post-item, #aside-content .card-widget, #archive .article-sort-item:not(.year)';
  let io = null;
  const scan = () => {
    if (reduced() || !('IntersectionObserver' in window)) return;
    if (!io) {
      io = new IntersectionObserver((records) => {
        records.filter((r) => r.isIntersecting).forEach((r, i) => {
          const el = r.target;
          io.unobserve(el);
          el.style.setProperty('--etg-delay', `${Math.min(i, 4) * 70}ms`);
          el.classList.remove('etg-float-wait');
          el.classList.add('etg-float-in');
          const done = (ev) => {
            if (ev.target !== el || ev.animationName !== 'etg-float-in') return;
            el.removeEventListener('animationend', done);
            el.classList.remove('etg-float-in');
            el.style.removeProperty('--etg-delay');
          };
          el.addEventListener('animationend', done);
        });
      }, { threshold: 0.08 });
    }
    document.querySelectorAll(FLOAT).forEach((el) => {
      if (el.dataset.etgFloat) return;
      el.dataset.etgFloat = '1';
      el.classList.add('etg-float-wait');
    });
    document.querySelectorAll('.etg-float-wait').forEach((el) => io.observe(el));
  };
  const boot = () => setTimeout(scan, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  document.addEventListener('pjax:send', () => { io?.disconnect(); io = null; });
  document.addEventListener('pjax:complete', boot);
})();
