-- 评论表。path 是页面路径（如 /2026/09/17/wuwa-echo-methodology/），
-- root_id 是所在楼层的第一条评论，楼中楼的回复都挂在同一个 root_id 下。
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  path       TEXT    NOT NULL,
  parent_id  INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  root_id    INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  nick       TEXT    NOT NULL,
  email      TEXT,
  link       TEXT,
  content    TEXT    NOT NULL,
  is_admin   INTEGER NOT NULL DEFAULT 0,
  status     TEXT    NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'spam')),
  ip_hash    TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_path   ON comments (path, status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments (status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_ip     ON comments (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_root   ON comments (root_id);
