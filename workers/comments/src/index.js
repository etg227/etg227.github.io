// 花澪博客评论服务：Cloudflare Workers + D1，零依赖。
//
// 公开接口
//   GET  /api/comments?path=/xxx/      某页已通过的评论（按时间正序，前端按 root_id 分楼）
//   POST /api/comments                 发表评论 { path, nick, email?, link?, content, parent_id?, turnstile? }
//   GET  /api/counts?paths=/a/,/b/     多个页面的评论数
// 管理接口（Authorization: Bearer <ADMIN_TOKEN>）
//   GET    /api/admin/comments?status=pending|approved|spam|all&limit=&offset=
//   PATCH  /api/admin/comments/:id     { status }
//   DELETE /api/admin/comments/:id     连同其下所有回复一起删除
//   POST   /api/comments 带上管理口令时以博主身份发表，跳过验证与限频
// 管理后台页面：GET /admin
//
// 评论一律按纯文本存储与返回，前端只用 textContent 渲染，不解析 HTML。

import { ADMIN_CSP, ADMIN_HTML } from './admin.js';

const LIMITS = { nick: 32, email: 100, link: 200, content: 2000, path: 200, ua: 300 };
const STATUSES = ['approved', 'pending', 'spam'];
const RATE_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_FIELDS = 'id, path, parent_id, root_id, nick, link, content, is_admin, created_at';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (url.pathname === '/' || url.pathname === '/admin') {
        if (url.pathname === '/') return text('花澪博客评论服务运行正常。管理后台：/admin', 200, cors);
        const site = (env.SITE_URL || '').replace(/\/$/, '').replace(/[^\w:/.-]/g, '');
        return new Response(ADMIN_HTML.replace('__SITE_URL__', site), {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': ADMIN_CSP, 'Cache-Control': 'no-store', ...SECURITY_HEADERS },
        });
      }
      const route = `${request.method} ${url.pathname.replace(/\/\d+$/, '/:id')}`;
      const id = Number((url.pathname.match(/\/(\d+)$/) || [])[1]);
      switch (route) {
        case 'GET /api/comments': return await listComments(url, env, cors);
        case 'POST /api/comments': return await createComment(request, env, ctx, cors);
        case 'GET /api/counts': return await countComments(url, env, cors);
        case 'GET /api/admin/comments': return await requireAdmin(request, env, cors, () => adminList(url, env, cors));
        case 'PATCH /api/admin/comments/:id': return await requireAdmin(request, env, cors, () => adminSetStatus(id, request, env, cors));
        case 'DELETE /api/admin/comments/:id': return await requireAdmin(request, env, cors, () => adminDelete(id, env, cors));
        default: return json({ error: '接口不存在' }, 404, cors);
      }
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status, cors);
      console.error(err);
      return json({ error: '服务器出错了，请稍后再试' }, 500, cors);
    }
  },
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...cors },
  });
}

function text(body, status, cors) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS, ...cors } });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// ---------- 输入整理 ----------

function normalizePath(raw) {
  if (typeof raw !== 'string') return null;
  let path = raw.trim().split(/[?#]/)[0];
  try { path = decodeURI(path); } catch { return null; }
  path = path.replace(/^\/preview(?=\/)/, '').replace(/index\.html$/, '');
  if (!path.startsWith('/') || path.length > LIMITS.path || /[\s<>"'\\]/.test(path) || path.includes('//')) return null;
  return path.endsWith('/') ? path : path + '/';
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // 去掉控制字符（保留换行与制表），统一换行，裁掉首尾空白
  return value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '').trim().slice(0, max + 1);
}

function cleanLink(value) {
  const raw = cleanText(value, LIMITS.link);
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.href.length <= LIMITS.link ? u.href : null;
  } catch {
    return null;
  }
}

function cleanEmail(value) {
  const raw = cleanText(value, LIMITS.email).toLowerCase();
  if (!raw) return null;
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(raw) && raw.length <= LIMITS.email ? raw : undefined;
}

async function sha256Hex(input) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

const MIN_ADMIN_TOKEN = 16;
const adminConfigured = (env) => typeof env.ADMIN_TOKEN === 'string' && env.ADMIN_TOKEN.length >= MIN_ADMIN_TOKEN;

function isAdmin(request, env) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  return adminConfigured(env) && Boolean(token) && timingSafeEqual(token, env.ADMIN_TOKEN);
}

async function requireAdmin(request, env, cors, handler) {
  if (!adminConfigured(env)) {
    throw new HttpError(503, `管理口令未设置或少于 ${MIN_ADMIN_TOKEN} 位，管理功能已停用。请在 Cloudflare 的“变量和机密”里把 ADMIN_TOKEN 设为至少 ${MIN_ADMIN_TOKEN} 位后再登录。`);
  }
  if (!isAdmin(request, env)) throw new HttpError(401, '管理口令不正确');
  return handler();
}

async function readJson(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, '请求格式不正确');
  const body = await request.text();
  if (body.length > 20000) throw new HttpError(413, '内容太长了');
  try {
    const data = JSON.parse(body);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
    return data;
  } catch {
    throw new HttpError(400, '请求格式不正确');
  }
}

// ---------- 公开接口 ----------

async function listComments(url, env, cors) {
  const path = normalizePath(url.searchParams.get('path'));
  if (!path) throw new HttpError(400, '页面路径不正确');
  const { results } = await env.DB.prepare(
    `SELECT ${PUBLIC_FIELDS} FROM comments WHERE path = ? AND status = 'approved' ORDER BY created_at ASC, id ASC LIMIT 1000`
  ).bind(path).all();
  return json({ path, count: results.length, comments: results.map(publicComment) }, 200, cors);
}

async function countComments(url, env, cors) {
  const paths = [...new Set((url.searchParams.get('paths') || '').split(',').map(normalizePath).filter(Boolean))].slice(0, 50);
  const counts = Object.fromEntries(paths.map((p) => [p, 0]));
  if (paths.length) {
    const { results } = await env.DB.prepare(
      `SELECT path, COUNT(*) AS n FROM comments WHERE status = 'approved' AND path IN (${paths.map(() => '?').join(',')}) GROUP BY path`
    ).bind(...paths).all();
    for (const row of results) counts[row.path] = row.n;
  }
  return json({ counts }, 200, cors);
}

function publicComment(row) {
  return {
    id: row.id,
    path: row.path,
    parent_id: row.parent_id,
    root_id: row.root_id,
    nick: row.nick,
    link: row.link,
    content: row.content,
    is_admin: Boolean(row.is_admin),
    created_at: row.created_at,
  };
}

async function verifyTurnstile(token, ip, env) {
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== 'string' || !token || token.length > 4096) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  return data.success === true;
}

async function createComment(request, env, ctx, cors) {
  const data = await readJson(request);
  const admin = isAdmin(request, env);
  const ip = request.headers.get('CF-Connecting-IP') || '';

  // 蜜罐字段：真人看不到，机器人往往会填
  if (typeof data.homepage === 'string' && data.homepage.trim()) throw new HttpError(400, '提交失败，请刷新页面后重试');

  const path = normalizePath(data.path);
  if (!path) throw new HttpError(400, '页面路径不正确');
  const nick = admin ? (env.ADMIN_NICK || '博主') : cleanText(data.nick, LIMITS.nick);
  const content = cleanText(data.content, LIMITS.content);
  const email = admin ? null : cleanEmail(data.email);
  const link = admin ? null : cleanLink(data.link);
  if (!nick) throw new HttpError(400, '请填写昵称');
  if (nick.length > LIMITS.nick) throw new HttpError(400, `昵称不能超过 ${LIMITS.nick} 个字`);
  if (!content) throw new HttpError(400, '评论内容不能为空');
  if (content.length > LIMITS.content) throw new HttpError(400, `评论不能超过 ${LIMITS.content} 个字`);
  if (email === undefined) throw new HttpError(400, '邮箱格式不正确');
  if (!admin && env.ADMIN_NICK && nick.toLowerCase() === env.ADMIN_NICK.toLowerCase()) {
    throw new HttpError(400, '这个昵称是博主专用的，换一个吧');
  }

  const ipHash = ip ? (await sha256Hex(`${env.IP_SALT || ''}:${ip}`)).slice(0, 32) : null;
  const now = Date.now();

  if (!admin) {
    if (!(await verifyTurnstile(data.turnstile, ip, env))) throw new HttpError(403, '人机验证没有通过，请重试');
    const limit = Number(env.RATE_LIMIT_PER_10MIN) || 5;
    if (ipHash) {
      const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at > ?')
        .bind(ipHash, now - RATE_WINDOW_MS).first('n');
      if (recent >= limit) throw new HttpError(429, '评论太频繁了，请过几分钟再试');
    }
    const dup = await env.DB.prepare('SELECT id FROM comments WHERE path = ? AND content = ? AND created_at > ? LIMIT 1')
      .bind(path, content, now - RATE_WINDOW_MS).first('id');
    if (dup) throw new HttpError(409, '这条评论已经发过了');
  }

  let parentId = null;
  let rootId = null;
  if (data.parent_id !== undefined && data.parent_id !== null && data.parent_id !== '') {
    const parent = await env.DB.prepare("SELECT id, root_id, path FROM comments WHERE id = ? AND status = 'approved'")
      .bind(Number(data.parent_id)).first();
    if (!parent || parent.path !== path) throw new HttpError(400, '要回复的评论不存在');
    parentId = parent.id;
    rootId = parent.root_id || parent.id;
  }

  const moderated = (env.MODERATION || 'off').toLowerCase() === 'on';
  const status = admin || !moderated ? 'approved' : 'pending';
  const ua = cleanText(request.headers.get('User-Agent') || '', LIMITS.ua).slice(0, LIMITS.ua);
  const row = await env.DB.prepare(
    `INSERT INTO comments (path, parent_id, root_id, nick, email, link, content, is_admin, status, ip_hash, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${PUBLIC_FIELDS}, status`
  ).bind(path, parentId, rootId, nick, email, link, content, admin ? 1 : 0, status, ipHash, ua, now).first();

  if (!admin) ctx.waitUntil(notifyOwner(env, row, status).catch((err) => console.error('notify failed', err)));
  return json({ comment: publicComment(row), status }, 201, cors);
}

// ---------- 管理接口 ----------

async function adminList(url, env, cors) {
  const status = url.searchParams.get('status') || 'all';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  if (status !== 'all' && !STATUSES.includes(status)) throw new HttpError(400, '状态不正确');
  const where = status === 'all' ? '' : 'WHERE status = ?';
  const binds = status === 'all' ? [] : [status];
  const { results } = await env.DB.prepare(
    `SELECT id, path, parent_id, root_id, nick, email, link, content, is_admin, status, ip_hash, user_agent, created_at
     FROM comments ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();
  const { results: totals } = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM comments GROUP BY status').all();
  return json({ comments: results, totals: Object.fromEntries(totals.map((t) => [t.status, t.n])) }, 200, cors);
}

async function adminSetStatus(id, request, env, cors) {
  const { status } = await readJson(request);
  if (!STATUSES.includes(status)) throw new HttpError(400, '状态不正确');
  const row = await env.DB.prepare('UPDATE comments SET status = ? WHERE id = ? RETURNING id, status').bind(status, id).first();
  if (!row) throw new HttpError(404, '评论不存在');
  return json(row, 200, cors);
}

async function adminDelete(id, env, cors) {
  // 先查出整棵回复树再逐条删除，不依赖数据库的级联删除，返回的数量也准确
  const { results } = await env.DB.prepare(
    `WITH RECURSIVE doomed(id) AS (
       SELECT id FROM comments WHERE id = ?
       UNION ALL SELECT c.id FROM comments c JOIN doomed d ON c.parent_id = d.id
     ) SELECT id FROM doomed`
  ).bind(id).all();
  if (!results.length) throw new HttpError(404, '评论不存在');
  const ids = results.map((r) => r.id).sort((a, b) => b - a);
  const chunks = [];
  for (let i = 0; i < ids.length; i += 90) chunks.push(ids.slice(i, i + 90));
  await env.DB.batch(chunks.map((c) => env.DB.prepare(`DELETE FROM comments WHERE id IN (${c.map(() => '?').join(',')})`).bind(...c)));
  return json({ deleted: ids }, 200, cors);
}

// ---------- 新评论邮件提醒（可选，需要 Cloudflare Email Routing） ----------

// RFC 2047 编码，按字符切成不超过 42 字节的段，加上 "Subject: " 前缀每行也不超过 78 字符，段之间折行
function encodeHeader(value) {
  const words = [];
  let chunk = [];
  let size = 0;
  for (const ch of value) {
    const bytes = new TextEncoder().encode(ch);
    if (size + bytes.length > 42 && chunk.length) {
      words.push(chunk);
      chunk = [];
      size = 0;
    }
    chunk.push(...bytes);
    size += bytes.length;
  }
  if (chunk.length) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${btoa(String.fromCharCode(...w))}?=`).join('\r\n ');
}

function base64Lines(value) {
  const bytes = new TextEncoder().encode(value);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/.{1,76}/g, '$&\r\n');
}

async function notifyOwner(env, comment, status) {
  if (!env.NOTIFY || !env.NOTIFY_FROM || !env.NOTIFY_TO) return;
  const { EmailMessage } = await import('cloudflare:email');
  const site = (env.SITE_URL || '').replace(/\/$/, '');
  const subject = `${status === 'pending' ? '[待审核] ' : ''}${comment.nick} 在 ${comment.path} 发表了评论`;
  const body = [
    `${comment.nick}${comment.link ? `（${comment.link}）` : ''} 说：`,
    '',
    comment.content,
    '',
    `页面：${site}${comment.path}`,
    `状态：${status === 'pending' ? '等待审核' : '已显示'}`,
    `管理：${env.WORKER_URL ? env.WORKER_URL.replace(/\/$/, '') + '/admin' : '评论服务地址/admin'}`,
  ].join('\r\n');
  const raw = [
    `From: ${encodeHeader('博客评论')} <${env.NOTIFY_FROM}>`,
    `To: <${env.NOTIFY_TO}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Message-ID: <comment-${comment.id}-${Date.now()}@${env.NOTIFY_FROM.split('@')[1]}>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(body),
  ].join('\r\n');
  await env.NOTIFY.send(new EmailMessage(env.NOTIFY_FROM, env.NOTIFY_TO, raw));
}
