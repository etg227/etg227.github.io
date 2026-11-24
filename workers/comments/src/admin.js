// 管理后台：由 Worker 在 /admin 提供，与接口同源。评论内容一律用 textContent 渲染。
export const ADMIN_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export const ADMIN_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>评论管理</title>
<style>
:root{--bg:#f6f7fb;--card:#fff;--text:#1f2330;--muted:#6b7183;--line:#e3e6ee;--main:#425aef;--danger:#d64545;--warn:#b7791f;--ok:#2f855a}
@media (prefers-color-scheme:dark){:root{--bg:#16171c;--card:#202128;--text:#e8e9ee;--muted:#9a9fb0;--line:#30323c;--main:#f2b94b;--danger:#ff7676;--warn:#f6c26b;--ok:#68d391}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:22px;margin:0 0 16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:12px}
input,textarea,select{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 10px;width:100%}
textarea{min-height:80px;resize:vertical}
button{font:inherit;border:0;border-radius:8px;padding:6px 14px;cursor:pointer;background:var(--main);color:#fff}
button.ghost{background:transparent;color:var(--text);border:1px solid var(--line)}
button.danger{background:var(--danger)}
button:disabled{opacity:.5;cursor:default}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tabs button{background:transparent;color:var(--muted);border:1px solid var(--line)}
.tabs button[aria-pressed="true"]{background:var(--main);color:#fff;border-color:var(--main)}
.meta{color:var(--muted);font-size:13px;word-break:break-all}
.content{white-space:pre-wrap;word-break:break-word;margin:8px 0}
.badge{display:inline-block;font-size:12px;border-radius:4px;padding:0 6px;border:1px solid currentColor}
.s-pending{color:var(--warn)}.s-spam{color:var(--danger)}.s-approved{color:var(--ok)}
.msg{min-height:1.6em;margin:0 0 12px;color:var(--muted)}
.reply{margin-top:8px}
a{color:var(--main)}
</style>
</head>
<body data-site="__SITE_URL__">
<div class="wrap">
  <h1>评论管理</h1>
  <p class="msg" id="msg" role="status"></p>
  <div class="card" id="login">
    <div class="row">
      <input id="token" type="password" placeholder="管理口令（ADMIN_TOKEN）" autocomplete="current-password" style="flex:1;min-width:200px">
      <button id="enter">进入</button>
    </div>
    <p class="meta">口令只保存在本标签页，关闭标签页即清除。</p>
  </div>
  <div id="panel" hidden>
    <div class="row tabs" style="margin-bottom:12px">
      <button data-status="pending">待审核 <span data-total="pending"></span></button>
      <button data-status="approved">已显示 <span data-total="approved"></span></button>
      <button data-status="spam">垃圾 <span data-total="spam"></span></button>
      <button data-status="all">全部</button>
      <span style="flex:1"></span>
      <button class="ghost" id="logout">退出</button>
    </div>
    <div id="list"></div>
    <button class="ghost" id="more" hidden>加载更多</button>
  </div>
</div>
<script>
(() => {
  const $ = (id) => document.getElementById(id);
  const KEY = 'etg-comment-admin-token';
  const PAGE = 50;
  const SITE = document.body.dataset.site || '';
  let token = '';
  let status = 'pending';
  let offset = 0;
  try { token = sessionStorage.getItem(KEY) || ''; } catch {}

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const say = (t) => { $('msg').textContent = t || ''; };
  const STATUS_TEXT = { approved: '已显示', pending: '待审核', spam: '垃圾' };

  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 503) { logout(); throw new Error(data.error || '管理口令不正确'); }
    if (!res.ok) throw new Error(data.error || ('请求失败 ' + res.status));
    return data;
  }

  function logout() {
    token = '';
    try { sessionStorage.removeItem(KEY); } catch {}
    $('panel').hidden = true;
    $('login').hidden = false;
  }

  function render(c) {
    const card = el('div', 'card');
    const head = el('div', 'row');
    const nick = c.link ? el('a', '', c.nick) : el('strong', '', c.nick);
    if (c.link) { nick.href = c.link; nick.target = '_blank'; nick.rel = 'noopener noreferrer nofollow'; }
    head.append(nick);
    if (c.is_admin) head.append(el('span', 'badge', '博主'));
    head.append(el('span', 'badge s-' + c.status, STATUS_TEXT[c.status] || c.status));
    const meta = el('div', 'meta');
    meta.append(
      document.createTextNode(new Date(c.created_at).toLocaleString('zh-CN', { hour12: false }) + ' · #' + c.id + (c.parent_id ? ' 回复 #' + c.parent_id : '') + ' · '),
    );
    const page = el('a', '', c.path);
    page.href = SITE + c.path;
    page.target = '_blank';
    page.rel = 'noopener noreferrer';
    meta.append(page, document.createTextNode((c.email ? ' · ' + c.email : '') + (c.ip_hash ? ' · IP ' + c.ip_hash.slice(0, 8) : '')));
    const actions = el('div', 'row');
    const act = (label, cls, fn) => { const b = el('button', cls, label); b.addEventListener('click', async () => { b.disabled = true; try { await fn(); } catch (e) { say(e.message); } b.disabled = false; }); actions.append(b); };
    if (c.status !== 'approved') act('通过', '', async () => { await api('/api/admin/comments/' + c.id, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) }); say('已通过 #' + c.id); load(true); });
    if (c.status !== 'spam') act('标为垃圾', 'ghost', async () => { await api('/api/admin/comments/' + c.id, { method: 'PATCH', body: JSON.stringify({ status: 'spam' }) }); say('已标为垃圾 #' + c.id); load(true); });
    act('删除', 'danger', async () => {
      if (!confirm('删除 #' + c.id + ' 以及它下面的所有回复？此操作不能撤销。')) return;
      const r = await api('/api/admin/comments/' + c.id, { method: 'DELETE' });
      say('已删除 ' + r.deleted.length + ' 条');
      load(true);
    });
    if (c.status === 'approved') act('回复', 'ghost', async () => {
      if (card.querySelector('.reply')) return;
      const box = el('div', 'reply');
      const ta = el('textarea');
      ta.placeholder = '以博主身份回复 ' + c.nick;
      const send = el('button', '', '发送回复');
      send.addEventListener('click', async () => {
        if (!ta.value.trim()) return;
        send.disabled = true;
        try {
          await api('/api/comments', { method: 'POST', body: JSON.stringify({ path: c.path, parent_id: c.id, content: ta.value }) });
          say('已回复 #' + c.id);
          box.remove();
          load(true);
        } catch (e) { say(e.message); send.disabled = false; }
      });
      box.append(ta, el('div', 'row'));
      box.lastChild.append(send);
      card.append(box);
      ta.focus();
    });
    card.append(head, meta, el('div', 'content', c.content), actions);
    return card;
  }

  async function load(reset) {
    if (reset) { offset = 0; $('list').replaceChildren(); }
    say('加载中…');
    try {
      const data = await api('/api/admin/comments?status=' + status + '&limit=' + PAGE + '&offset=' + offset);
      for (const s of ['pending', 'approved', 'spam']) document.querySelector('[data-total="' + s + '"]').textContent = data.totals[s] ? '(' + data.totals[s] + ')' : '';
      data.comments.forEach((c) => $('list').append(render(c)));
      offset += data.comments.length;
      $('more').hidden = data.comments.length < PAGE;
      say(offset ? '' : '这里还没有评论。');
      $('login').hidden = true;
      $('panel').hidden = false;
    } catch (e) { say(e.message); if (!token) $('login').hidden = false; }
  }

  function setTab(s) {
    status = s;
    document.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === s)));
    load(true);
  }

  $('enter').addEventListener('click', () => {
    token = $('token').value.trim();
    if (!token) { say('请输入管理口令'); return; }
    try { sessionStorage.setItem(KEY, token); } catch {}
    setTab('pending');
  });
  $('token').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('enter').click(); });
  $('logout').addEventListener('click', logout);
  $('more').addEventListener('click', () => load(false));
  document.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.status)));
  if (token) setTab('pending');
})();
</script>
</body>
</html>`;
