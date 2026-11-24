# 博客评论服务（Cloudflare Workers + D1）

花澪博客的评论后端：一个 Cloudflare Worker 加一个 D1 数据库，零依赖。前端代码在
`enhancements/blog.js` 的 `ETG227_COMMENTS` 一段，样式在 `enhancements/blog.css`。

- 评论只按纯文本保存和显示，不解析 HTML，没有 XSS 风险。
- 支持楼中楼回复、博主身份回复、先审后发、同 IP 限频、重复内容拦截、蜜罐字段。
- 可选：Cloudflare Turnstile 人机验证、Cloudflare Email Routing 新评论邮件提醒。
- 管理后台在 Worker 地址的 `/admin`，用管理口令登录。
- 访客邮箱不公开，只在后台可见；IP 只保存加盐哈希，用于限频。

## 免费额度

Workers 免费版每天 10 万次请求、单次请求 10 毫秒 CPU；D1 免费版每天读 500 万行、写 10 万行，
单库 500 MB。个人博客的评论量用不完。

## 部署

需要 Node.js 20 或以上，以及一个 Cloudflare 账号。以下命令都在本目录（`workers/comments`）执行。

1. 安装依赖并登录 Cloudflare：

   ```sh
   npm install
   npx wrangler login
   ```

2. 创建数据库，把输出里的 `database_id` 填进 `wrangler.toml`，然后建表。`--location apac` 把数据库放在亚太区，
   离国内和香港的读者更近（不指定的话 Cloudflare 可能放在美国）：

   ```sh
   npx wrangler d1 create blog-comments --location apac
   npm run db:init
   ```

3. 设置两个机密值（会提示你输入，不会写进文件）：

   ```sh
   npx wrangler secret put ADMIN_TOKEN   # 管理口令，至少 16 位，可用 openssl rand -hex 24 生成
   npx wrangler secret put IP_SALT       # 任意随机串，同样可用 openssl rand -hex 24 生成
   ```

4. 绑定自定义域名。`*.workers.dev` 在国内有 DNS 污染，访客会连不上，所以 `wrangler.toml` 里已经关掉了它，
   并绑定了 `comments.etg227.com`（域名要托管在 Cloudflare 上）。换域名时改这一行：

   ```toml
   routes = [{ pattern = "comments.etg227.com", custom_domain = true }]
   ```

5. 部署：

   ```sh
   npm run deploy
   ```

   打开 `https://comments.etg227.com/` 应看到“评论服务运行正常”，`/admin` 能用管理口令登录。

6. 在 `enhancements/blog.js` 的 `ETG227_COMMENTS` 段把 `const API = ''` 改成
   `const API = 'https://comments.etg227.com'`（`preview/enhancements/blog.js` 同样修改），
   推送后评论区就会出现。别忘了同时更新隐私说明页。

## 可选功能

**先审后发**：把 `wrangler.toml` 里的 `MODERATION` 改成 `"on"` 再部署。新评论先进入后台“待审核”，
通过后才显示。

**Turnstile 人机验证**：在 Cloudflare 控制台创建一个 Turnstile 小组件，域名填 `blog.etg227.com`。
把站点密钥（site key）填进 `blog.js` 的 `TURNSTILE_SITEKEY`，密钥（secret key）用
`npx wrangler secret put TURNSTILE_SECRET` 设置。它在国内能否稳定加载未经实测，建议先不开，
遇到垃圾评论再开。

**新评论邮件提醒**：在该域名开启 Cloudflare Email Routing 并验证你的收件邮箱，然后取消
`wrangler.toml` 末尾 `[[send_email]]` 一段的注释，填好收件地址和 `NOTIFY_FROM`、`NOTIFY_TO`、
`WORKER_URL`，重新部署。博主自己的评论不会触发提醒。

## 本地开发与测试

```sh
cp .dev.vars.example .dev.vars
npm run db:init:local
npm run dev        # http://127.0.0.1:8787
npm test           # 接口冒烟测试，会写入并删除测试评论
```

## 备份

D1 自带 7 天内任意时间点恢复（Time Travel）。需要导出时：

```sh
npx wrangler d1 export blog-comments --remote --output=comments-backup.sql
```
