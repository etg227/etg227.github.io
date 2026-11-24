// 接口冒烟测试：node test/smoke.mjs [服务地址]
// 默认测本地 `npx wrangler dev`（http://127.0.0.1:8787），管理口令取 .dev.vars 里的 ADMIN_TOKEN。
// 会写入并删除测试评论，只应对本地或测试库运行。
import { readFileSync } from 'node:fs';

const BASE = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/$/, '');
const TOKEN = process.env.ADMIN_TOKEN
  || (readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_TOKEN=(.*)$/m) || [])[1];
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:18080';
const RUN = Date.now().toString(36);
const PAGE = `/smoke-${RUN}/`;

let failures = 0;
let passes = 0;
const check = (name, cond, detail) => {
  if (cond) { passes++; console.log(`  ok   ${name}`); } else { failures++; console.log(`  FAIL ${name}${detail ? ` -> ${JSON.stringify(detail).slice(0, 300)}` : ''}`); }
};
let ipSeq = 0;
const freshIp = () => `203.0.113.${(++ipSeq % 250) + 1}`;

async function call(method, path, { body, ip = freshIp(), admin = false, headers = {}, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}),
      'CF-Connecting-IP': ip,
      ...(admin ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
const post = (body, opts) => call('POST', '/api/comments', { body, ...opts });

console.log(`# ${BASE}  page ${PAGE}`);

console.log('# 基本');
let r = await call('GET', '/');
check('首页可访问', r.status === 200, r);
r = await call('GET', `/api/comments?path=${encodeURIComponent(PAGE)}`);
check('新页面没有评论', r.status === 200 && r.data.count === 0 && r.data.path === PAGE, r);

console.log('# 发表与读取');
r = await post({ path: PAGE, nick: '路人甲', email: 'A@Example.com', link: 'example.com', content: '第一条评论\n第二行' });
check('发表成功并直接显示', r.status === 201 && r.data.status === 'approved', r);
const first = r.data.comment;
check('链接补全为 https', first?.link === 'https://example.com/', first);
check('公开结果不含邮箱和 IP', first && !('email' in first) && !('ip_hash' in first), first);
check('换行原样保留', first?.content === '第一条评论\n第二行', first);

const xss = '<img src=x onerror=alert(1)><script>alert(2)</script>';
r = await post({ path: PAGE, nick: '<b>坏人</b>', link: 'javascript:alert(1)', content: xss });
check('HTML 按纯文本原样存储', r.status === 201 && r.data.comment.content === xss && r.data.comment.nick === '<b>坏人</b>', r);
check('javascript: 链接被丢弃', r.data.comment?.link === null, r.data.comment);

r = await call('GET', `/api/comments?path=${encodeURIComponent('/preview' + PAGE)}`);
check('preview 路径与正式路径共用评论', r.status === 200 && r.data.path === PAGE && r.data.count === 2, r.data);
r = await call('GET', `/api/comments?path=${encodeURIComponent(PAGE.slice(0, -1) + '?a=1#x')}`);
check('路径会补斜杠并去掉查询串', r.status === 200 && r.data.path === PAGE && r.data.count === 2, r.data);

console.log('# 楼中楼');
r = await post({ path: PAGE, nick: '路人乙', content: '回复第一条', parent_id: first.id });
const reply = r.data.comment;
check('回复挂在第一条下', r.status === 201 && reply.parent_id === first.id && reply.root_id === first.id, r);
r = await post({ path: PAGE, nick: '路人丙', content: '回复回复', parent_id: reply.id });
check('回复的回复仍归在同一楼', r.status === 201 && r.data.comment.parent_id === reply.id && r.data.comment.root_id === first.id, r);
const nested = r.data.comment;
r = await post({ path: PAGE, nick: '路人丁', content: '回复不存在的评论', parent_id: 999999999 });
check('回复不存在的评论被拒', r.status === 400, r);
r = await post({ path: '/another-page/', nick: '路人丁', content: '跨页面回复', parent_id: first.id });
check('跨页面回复被拒', r.status === 400, r);

console.log('# 输入校验');
const bad = [
  ['没有昵称', { path: PAGE, nick: '  ', content: 'x' }, 400],
  ['昵称太长', { path: PAGE, nick: '长'.repeat(33), content: 'x' }, 400],
  ['没有内容', { path: PAGE, nick: '甲', content: ' \n ' }, 400],
  ['内容太长', { path: PAGE, nick: '甲', content: '字'.repeat(2001) }, 400],
  ['邮箱格式错', { path: PAGE, nick: '甲', email: 'not-an-email', content: 'x' }, 400],
  ['冒用博主昵称', { path: PAGE, nick: '花澪', content: 'x' }, 400],
  ['蜜罐字段被填', { path: PAGE, nick: '机器人', homepage: 'http://spam.example', content: 'buy now' }, 400],
  ['路径不合法', { path: 'https://evil.example/', nick: '甲', content: 'x' }, 400],
  ['路径含尖括号', { path: '/<script>/', nick: '甲', content: 'x' }, 400],
];
for (const [name, body, code] of bad) {
  r = await post(body);
  check(name, r.status === code, r);
}
r = await call('POST', '/api/comments', { raw: '{oops', headers: {} });
check('坏 JSON 被拒', r.status === 400, r);
r = await call('POST', '/api/comments', { raw: 'nick=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
check('非 JSON 请求被拒', r.status === 415, r);
r = await call('POST', '/api/comments', { raw: JSON.stringify({ path: PAGE, nick: 'a', content: 'x'.repeat(30000) }) });
check('超大请求体被拒', r.status === 413, r);

console.log('# 防刷');
r = await post({ path: PAGE, nick: '复读机', content: '回复第一条' });
check('10 分钟内同页重复内容被拒', r.status === 409, r);
const ip = freshIp();
const codes = [];
for (let i = 0; i < 6; i++) codes.push((await post({ path: PAGE, nick: '话痨', content: `第 ${i} 条 ${RUN}` }, { ip })).status);
check('同一 IP 前 5 条成功、第 6 条被限频', codes.slice(0, 5).every((c) => c === 201) && codes[5] === 429, codes);

console.log('# 跨域');
r = await call('OPTIONS', '/api/comments', { headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } });
check('允许的来源通过预检', r.status === 204 && r.headers.get('access-control-allow-origin') === ORIGIN, Object.fromEntries(r.headers));
r = await call('GET', `/api/comments?path=${PAGE}`, { headers: { Origin: 'https://evil.example' } });
check('其他来源不给跨域头', r.status === 200 && !r.headers.get('access-control-allow-origin'), Object.fromEntries(r.headers));

console.log('# 评论数');
r = await call('GET', `/api/counts?paths=${encodeURIComponent(PAGE + ',/no-comments-here/')}`);
check('评论数接口', r.status === 200 && r.data.counts[PAGE] === 9 && r.data.counts['/no-comments-here/'] === 0, r.data);

console.log('# 管理');
r = await call('GET', '/api/admin/comments');
check('没有口令被拒', r.status === 401, r);
r = await call('GET', '/api/admin/comments', { headers: { Authorization: 'Bearer wrong-token-wrong-token' } });
check('错误口令被拒', r.status === 401, r);
r = await call('GET', '/api/admin/comments?status=approved&limit=200', { admin: true });
const mine = r.data.comments?.filter((c) => c.path === PAGE) || [];
check('管理列表能看到邮箱（已转小写）', r.status === 200 && mine.some((c) => c.email === 'a@example.com'), r.data.totals);
r = await call('PATCH', `/api/admin/comments/${first.id}`, { body: { status: 'spam' }, admin: true });
check('标为垃圾', r.status === 200 && r.data.status === 'spam', r);
r = await call('GET', `/api/comments?path=${PAGE}`);
check('垃圾评论不再公开显示', !r.data.comments.some((c) => c.id === first.id), r.data.count);
r = await post({ path: PAGE, nick: '路人戊', content: '回复已隐藏的评论', parent_id: first.id });
check('不能回复已隐藏的评论', r.status === 400, r);
r = await call('PATCH', `/api/admin/comments/${first.id}`, { body: { status: 'approved' }, admin: true });
check('恢复显示', r.status === 200 && r.data.status === 'approved', r);
r = await call('PATCH', `/api/admin/comments/${first.id}`, { body: { status: 'deleted' }, admin: true });
check('非法状态被拒', r.status === 400, r);
r = await post({ path: PAGE, content: '博主的回复', parent_id: nested.id }, { admin: true });
check('管理口令发表显示为博主', r.status === 201 && r.data.comment.is_admin === true && r.data.comment.nick === '花澪', r);
r = await call('DELETE', `/api/admin/comments/${first.id}`, { admin: true });
check('删除一楼连带删除楼中楼', r.status === 200 && r.data.deleted.length === 4 && r.data.deleted.includes(nested.id), r.data);
r = await call('DELETE', `/api/admin/comments/${first.id}`, { admin: true });
check('重复删除返回 404', r.status === 404, r);
r = await call('GET', '/admin');
check('管理后台页面带安全策略', r.status === 200 && /default-src 'none'/.test(r.headers.get('content-security-policy') || '') && String(r.data).includes('评论管理'), r.status);

console.log('# 清理');
r = await call('GET', '/api/admin/comments?status=all&limit=200', { admin: true });
for (const c of r.data.comments.filter((c) => c.path === PAGE || c.path === '/another-page/')) {
  await call('DELETE', `/api/admin/comments/${c.id}`, { admin: true });
}
r = await call('GET', `/api/comments?path=${PAGE}`);
check('测试数据已清理', r.data.count === 0, r.data.count);

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
