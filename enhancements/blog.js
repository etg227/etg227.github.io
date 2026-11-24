(() => {
  if (window.flowerBlogEnhancements) return;
  window.flowerBlogEnhancements = true;
  let indexPromise;
  function getIndex() {
    if (!indexPromise) indexPromise = fetch('/enhancements/search.json').then(r => {if(!r.ok) throw Error('index');return r.json();}).catch(e=>{indexPromise=null;throw e;});
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
      a.id = 'flower-search-link'; a.href = '/search/'; a.textContent = '搜索';
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



/* ETG227_COMMENTS */
(() => {
  if (window.etgCommentsReady) return;
  window.etgCommentsReady = true;

  // 评论服务地址（Cloudflare Worker），例如 https://comments.etg227.com。留空时评论区保持“评论暂未开放”。
  const API = 'https://comments.etg227.com';
  // 可选：Cloudflare Turnstile 的站点密钥（site key），与 Worker 的 TURNSTILE_SECRET 成对开启
  const TURNSTILE_SITEKEY = '';

  const PREFIX = location.pathname.startsWith('/preview/') ? '/preview' : '';
  const PROFILE_KEY = 'etg-comment-profile';
  const MAX_LENGTH = 2000;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const pagePath = () => {
    let path = location.pathname;
    try { path = decodeURI(path); } catch (e) { /* keep raw */ }
    if (PREFIX && path.startsWith(PREFIX + '/')) path = path.slice(PREFIX.length);
    path = path.replace(/index\.html$/, '');
    return path.endsWith('/') ? path : path + '/';
  };

  const loadProfile = () => {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch (e) { return {}; }
  };
  const saveProfile = (p) => {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { /* storage unavailable */ }
  };

  const relativeTime = (ms) => {
    const diff = (Date.now() - ms) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`;
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const hue = (s) => {
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.codePointAt(0)) % 360;
    return h;
  };

  let turnstileScript;
  const loadTurnstile = () => {
    if (!TURNSTILE_SITEKEY) return Promise.resolve(null);
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (!turnstileScript) {
      turnstileScript = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = () => resolve(window.turnstile);
        s.onerror = () => { turnstileScript = null; reject(new Error('turnstile')); };
        document.head.appendChild(s);
      });
    }
    return turnstileScript;
  };

  async function request(method, url, body) {
    const res = await fetch(API.replace(/\/$/, '') + url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
    return data;
  }

  function mount(box) {
    const path = pagePath();
    const profile = loadProfile();
    let replyTo = null;
    let turnstileId = null;
    let comments = [];

    box.querySelector('.blog-note')?.remove();
    const root = el('div', 'etg-cm');
    const privacy = box.querySelector('a[href$="/privacy/"]');
    if (privacy) box.insertBefore(root, privacy); else box.append(root);

    // ---------- 表单 ----------
    const form = el('form', 'etg-cm-form');
    form.noValidate = true;
    const field = (name, label, attrs) => {
      const wrap = el('label', 'etg-cm-field');
      wrap.append(el('span', '', label));
      const input = el('input');
      Object.assign(input, { name, ...attrs });
      wrap.append(input);
      return [wrap, input];
    };
    const [nickWrap, nick] = field('nick', '昵称', { maxLength: 32, required: true, autocomplete: 'nickname', value: profile.nick || '' });
    const [mailWrap, email] = field('email', '邮箱（选填，不公开）', { type: 'email', maxLength: 100, autocomplete: 'email', value: profile.email || '' });
    const [linkWrap, link] = field('link', '网址（选填）', { type: 'url', maxLength: 200, autocomplete: 'url', placeholder: 'https://', value: profile.link || '' });
    const fields = el('div', 'etg-cm-fields');
    fields.append(nickWrap, mailWrap, linkWrap);

    const honeypot = el('input');
    Object.assign(honeypot, { name: 'homepage', tabIndex: -1, autocomplete: 'off', className: 'etg-cm-hp' });
    honeypot.setAttribute('aria-hidden', 'true');

    const replyBar = el('div', 'etg-cm-replybar');
    replyBar.hidden = true;
    const replyText = el('span');
    const cancelReply = el('button', 'etg-cm-link', '取消回复');
    cancelReply.type = 'button';
    replyBar.append(replyText, cancelReply);

    const textarea = el('textarea', 'etg-cm-text');
    Object.assign(textarea, { name: 'content', maxLength: MAX_LENGTH, rows: 4, placeholder: '说点什么吧…（Ctrl + Enter 发送）' });
    textarea.setAttribute('aria-label', '评论内容');

    const captcha = el('div', 'etg-cm-captcha');
    const footer = el('div', 'etg-cm-footer');
    const counter = el('span', 'etg-cm-counter', `0 / ${MAX_LENGTH}`);
    const submit = el('button', 'etg-cm-submit', '发送');
    submit.type = 'submit';
    footer.append(counter, submit);
    const status = el('p', 'etg-cm-status');
    status.setAttribute('role', 'status');
    form.append(fields, honeypot, replyBar, textarea, captcha, footer, status);

    // ---------- 列表 ----------
    const countLine = el('div', 'etg-cm-count');
    const list = el('ol', 'etg-cm-list');
    root.append(form, countLine, list);

    const setStatus = (text, kind) => {
      status.textContent = text || '';
      status.dataset.kind = kind || '';
    };

    const setReply = (c) => {
      replyTo = c;
      replyBar.hidden = !c;
      replyText.textContent = c ? `回复 @${c.nick}` : '';
      if (c) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        textarea.focus({ preventScroll: true });
      }
    };
    cancelReply.addEventListener('click', () => setReply(null));

    const renderComment = (c, byId) => {
      const li = el('li', 'etg-cm-item');
      li.id = `comment-${c.id}`;
      const avatar = el('span', 'etg-cm-avatar', Array.from(c.nick)[0] || '?');
      avatar.style.setProperty('--h', hue(c.nick));
      avatar.setAttribute('aria-hidden', 'true');
      const body = el('div', 'etg-cm-body');
      const head = el('div', 'etg-cm-head');
      let name;
      if (c.link) {
        name = el('a', 'etg-cm-nick', c.nick);
        name.href = c.link;
        name.target = '_blank';
        name.rel = 'noopener noreferrer nofollow ugc';
      } else {
        name = el('span', 'etg-cm-nick', c.nick);
      }
      head.append(name);
      if (c.is_admin) head.append(el('span', 'etg-cm-badge', '博主'));
      const parent = c.parent_id && c.parent_id !== c.root_id ? byId.get(c.parent_id) : null;
      if (parent) head.append(el('span', 'etg-cm-to', `回复 @${parent.nick}`));
      const time = el('time', 'etg-cm-time', relativeTime(c.created_at));
      time.dateTime = new Date(c.created_at).toISOString();
      time.title = new Date(c.created_at).toLocaleString('zh-CN', { hour12: false });
      head.append(time);
      const content = el('div', 'etg-cm-content', c.content);
      const actions = el('div', 'etg-cm-actions');
      const reply = el('button', 'etg-cm-link', '回复');
      reply.type = 'button';
      reply.addEventListener('click', () => setReply(c));
      actions.append(reply);
      body.append(head, content, actions);
      li.append(avatar, body);
      return li;
    };

    const render = () => {
      const byId = new Map(comments.map((c) => [c.id, c]));
      const roots = comments.filter((c) => !c.root_id || !byId.has(c.root_id));
      const replies = new Map();
      for (const c of comments) {
        if (c.root_id && byId.has(c.root_id)) {
          if (!replies.has(c.root_id)) replies.set(c.root_id, []);
          replies.get(c.root_id).push(c);
        }
      }
      list.replaceChildren();
      for (const r of roots.slice().reverse()) {
        const item = renderComment(r, byId);
        const children = replies.get(r.id);
        if (children) {
          const sub = el('ol', 'etg-cm-replies');
          children.forEach((c) => sub.append(renderComment(c, byId)));
          item.querySelector('.etg-cm-body').append(sub);
        }
        list.append(item);
      }
      countLine.textContent = comments.length ? `${comments.length} 条评论` : '还没有评论，来抢沙发吧';
    };

    const load = async () => {
      countLine.textContent = '评论加载中…';
      try {
        const data = await request('GET', `/api/comments?path=${encodeURIComponent(path)}`);
        comments = data.comments;
        render();
        if (location.hash.startsWith('#comment-')) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'center' });
      } catch (e) {
        countLine.replaceChildren(document.createTextNode('评论加载失败。'));
        const retry = el('button', 'etg-cm-link', '重试');
        retry.type = 'button';
        retry.addEventListener('click', load);
        countLine.append(retry);
      }
    };

    textarea.addEventListener('input', () => { counter.textContent = `${textarea.value.length} / ${MAX_LENGTH}`; });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
    });
    textarea.addEventListener('focus', () => {
      if (!TURNSTILE_SITEKEY || turnstileId !== null) return;
      loadTurnstile().then((ts) => {
        if (ts && turnstileId === null && captcha.isConnected) turnstileId = ts.render(captcha, { sitekey: TURNSTILE_SITEKEY, size: 'flexible', language: 'zh-cn' });
      }).catch(() => setStatus('人机验证加载失败，请刷新页面重试', 'error'));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        path,
        nick: nick.value.trim(),
        email: email.value.trim(),
        link: link.value.trim(),
        content: textarea.value.trim(),
        homepage: honeypot.value,
        parent_id: replyTo ? replyTo.id : undefined,
      };
      if (!payload.nick) { setStatus('请填写昵称', 'error'); nick.focus(); return; }
      if (!payload.content) { setStatus('评论内容不能为空', 'error'); textarea.focus(); return; }
      if (TURNSTILE_SITEKEY) {
        payload.turnstile = turnstileId !== null && window.turnstile ? window.turnstile.getResponse(turnstileId) : '';
        if (!payload.turnstile) { setStatus('请先完成人机验证', 'error'); textarea.dispatchEvent(new Event('focus')); return; }
      }
      submit.disabled = true;
      setStatus('发送中…');
      try {
        const data = await request('POST', '/api/comments', payload);
        saveProfile({ nick: payload.nick, email: payload.email, link: payload.link });
        textarea.value = '';
        counter.textContent = `0 / ${MAX_LENGTH}`;
        setReply(null);
        if (data.status === 'approved') {
          comments.push(data.comment);
          render();
          setStatus('发表成功', 'ok');
          document.getElementById(`comment-${data.comment.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          setStatus('评论已提交，审核通过后会显示', 'ok');
        }
      } catch (err) {
        setStatus(err.message, 'error');
      } finally {
        submit.disabled = false;
        if (turnstileId !== null && window.turnstile) window.turnstile.reset(turnstileId);
      }
    });

    load();
  }

  const init = () => {
    if (!API) return;
    const box = document.querySelector('#post-comment');
    if (!box || box.dataset.etgComments === '1') return;
    box.dataset.etgComments = '1';
    mount(box);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  document.addEventListener('pjax:complete', () => setTimeout(init, 0));
})();
