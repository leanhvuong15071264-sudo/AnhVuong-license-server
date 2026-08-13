require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const db = new Database('/data/licenses.db');

app.set('trust proxy', 1);

db.pragma('journal_mode=WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS licenses(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 key TEXT UNIQUE NOT NULL,
 status TEXT NOT NULL DEFAULT 'active',
 expires_at TEXT,
 hwid TEXT,
 note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 action TEXT NOT NULL,
 license_id INTEGER,
 key TEXT,
 detail TEXT NOT NULL DEFAULT '',
 ip TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS downloads(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 image_url TEXT NOT NULL DEFAULT '',
 download_url TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'guest',
 created_at TEXT NOT NULL,
 last_login TEXT
);

CREATE TABLE IF NOT EXISTS user_logs(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 detail TEXT NOT NULL DEFAULT '',
 ip TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
`);

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false }));

app.use(session({
 secret: process.env.SESSION_SECRET || 'change-this-secret',
 resave: false,
 saveUninitialized: false,
 cookie: {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  maxAge: 8 * 60 * 60 * 1000
 }
}));

app.use(express.static(path.join(__dirname, 'public')));

const now = () => new Date().toISOString();

const ip = req =>
 String(
  req.headers['x-forwarded-for'] ||
  req.socket.remoteAddress ||
  ''
 ).split(',')[0].trim();

const adminUsername = () =>
 String(process.env.ADMIN_USERNAME || 'admin');

function audit(req, action, row, detail = '') {
 db.prepare(`
  INSERT INTO audit_logs
  (action,license_id,key,detail,ip,created_at)
  VALUES(?,?,?,?,?,?)
 `).run(
  action,
  row?.id || null,
  row?.key || null,
  detail,
  ip(req),
  now()
 );
}

function userLog(req, userId, action, detail = '') {
 db.prepare(`
  INSERT INTO user_logs
  (user_id,action,detail,ip,created_at)
  VALUES(?,?,?,?,?)
 `).run(userId, action, detail, ip(req), now());
}

/* =========================
   AUTH
========================= */

function requireAdmin(req, res, next) {
 if (
  req.session &&
  req.session.role === 'admin' &&
  req.session.admin === true
 ) {
  return next();
 }

 return res.status(401).json({
  error: 'Bạn cần đăng nhập Admin'
 });
}

function requireUser(req, res, next) {
 if (
  req.session &&
  req.session.userId &&
  (req.session.role === 'guest' || req.session.role === 'admin')
 ) {
  return next();
 }

 return res.status(401).json({
  error: 'Bạn cần đăng nhập tài khoản khách'
 });
}

function requireDownloadAccess(req, res, next) {
 if (
  req.session &&
  (
   req.session.role === 'admin' ||
   req.session.role === 'guest'
  )
 ) {
  return next();
 }

 return res.status(401).json({
  error: 'Vui lòng đăng ký hoặc đăng nhập để tải xuống'
 });
}

/* =========================
   HEALTH
========================= */

app.get('/api/health', (req, res) => {
 res.json({
  ok: true,
  time: now()
 });
});

/* =========================
   ADMIN LOGIN
========================= */

app.post('/api/admin/login', async (req, res) => {
 const username = String(req.body.username || '').trim();
 const password = String(req.body.password || '');

 const expectedUser = adminUsername();
 const expectedPassword = String(
  process.env.ADMIN_PASSWORD || ''
 );

 if (!expectedPassword) {
  return res.status(500).json({
   error: 'ADMIN_PASSWORD chưa được cấu hình'
  });
 }

 if (
  username !== expectedUser ||
  password !== expectedPassword
 ) {
  return res.status(401).json({
   error: 'Sai tài khoản hoặc mật khẩu Admin'
  });
 }

 req.session.admin = true;
 req.session.role = 'admin';
 req.session.username = username;
 req.session.userId = null;

 req.session.save(err => {
  if (err) {
   console.error(err);
   return res.status(500).json({
    error: 'Không thể lưu phiên đăng nhập'
   });
  }

  res.json({
   ok: true,
   username,
   role: 'admin'
  });
 });
});

/* =========================
   GUEST REGISTER
========================= */

app.post('/api/auth/register', async (req, res) => {
 try {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
   return res.status(400).json({
    error: 'Tên tài khoản phải từ 3-32 ký tự, chỉ gồm chữ, số và _'
   });
  }

  if (password.length < 6 || password.length > 100) {
   return res.status(400).json({
    error: 'Mật khẩu phải từ 6-100 ký tự'
   });
  }

  const exists = db.prepare(
   'SELECT id FROM users WHERE username=?'
  ).get(username);

  if (exists) {
   return res.status(409).json({
    error: 'Tên tài khoản đã tồn tại'
   });
  }

  const hash = await bcrypt.hash(password, 12);

  const result = db.prepare(`
   INSERT INTO users
   (username,password_hash,role,created_at)
   VALUES(?,?,?,?)
  `).run(
   username,
   hash,
   'guest',
   now()
  );

  const userId = Number(result.lastInsertRowid);

  req.session.userId = userId;
  req.session.username = username;
  req.session.role = 'guest';
  req.session.admin = false;

  userLog(req, userId, 'register', 'Tạo tài khoản khách');

  req.session.save(err => {
   if (err) {
    return res.status(500).json({
     error: 'Không thể lưu phiên đăng nhập'
    });
   }

   res.json({
    ok: true,
    username,
    role: 'guest'
   });
  });
 } catch (err) {
  console.error(err);
  res.status(500).json({
   error: 'Không thể đăng ký tài khoản'
  });
 }
});

/* =========================
   GUEST LOGIN
========================= */

app.post('/api/auth/login', async (req, res) => {
 try {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  const user = db.prepare(`
   SELECT *
   FROM users
   WHERE username=?
  `).get(username);

  if (!user) {
   return res.status(401).json({
    error: 'Sai tài khoản hoặc mật khẩu'
   });
  }

  const valid = await bcrypt.compare(
   password,
   user.password_hash
  );

  if (!valid) {
   return res.status(401).json({
    error: 'Sai tài khoản hoặc mật khẩu'
   });
  }

  const loginTime = now();

  db.prepare(`
   UPDATE users
   SET last_login=?
   WHERE id=?
  `).run(loginTime, user.id);

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = 'guest';
  req.session.admin = false;

  userLog(
   req,
   user.id,
   'login',
   'Đăng nhập tài khoản khách'
  );

  req.session.save(err => {
   if (err) {
    return res.status(500).json({
     error: 'Không thể lưu phiên đăng nhập'
    });
   }

   res.json({
    ok: true,
    username: user.username,
    role: 'guest'
   });
  });
 } catch (err) {
  console.error(err);
  res.status(500).json({
   error: 'Không thể đăng nhập'
  });
 }
});

/* =========================
   CURRENT USER
========================= */

app.get('/api/auth/me', (req, res) => {
 if (!req.session || !req.session.role) {
  return res.status(401).json({
   error: 'Chưa đăng nhập'
  });
 }

 res.json({
  ok: true,
  username: req.session.username,
  role: req.session.role
 });
});

/* =========================
   LOGOUT
========================= */

app.post('/api/auth/logout', (req, res) => {
 req.session.destroy(() => {
  res.json({ ok: true });
 });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
 req.session.destroy(() => {
  res.json({ ok: true });
 });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
 res.json({
  ok: true,
  username: req.session.username || adminUsername(),
  role: 'admin'
 });
});

/* =========================
   GUEST LOGS
========================= */

app.get('/api/account/logs', requireUser, (req, res) => {
 const rows = db.prepare(`
  SELECT id,action,detail,ip,created_at
  FROM user_logs
  WHERE user_id=?
  ORDER BY id DESC
  LIMIT 200
 `).all(req.session.userId);

 res.json(rows);
});

/* =========================
   PUBLIC DOWNLOADS
========================= */

app.get('/api/downloads', (req, res) => {
 const rows = db.prepare(`
  SELECT
   id,
   title,
   description,
   image_url,
   created_at,
   updated_at
  FROM downloads
  ORDER BY id DESC
 `).all();

 res.json(rows);
});

/*
 Người chưa đăng nhập chỉ xem được nội dung.
 Muốn lấy download_url phải đăng nhập.
*/

app.get(
 '/api/downloads/:id/access',
 requireDownloadAccess,
 (req, res) => {
  const item = db.prepare(`
   SELECT *
   FROM downloads
   WHERE id=?
  `).get(req.params.id);

  if (!item) {
   return res.status(404).json({
    error: 'Không tìm thấy mục tải xuống'
   });
  }

  if (req.session.role === 'guest') {
   userLog(
    req,
    req.session.userId,
    'download',
    `Tải xuống: ${item.title}`
   );
  }

  res.json({
   ok: true,
   download_url: item.download_url
  });
});

/* =========================
   ADMIN DOWNLOADS
========================= */

app.get('/api/admin/downloads', requireAdmin, (req, res) => {
 res.json(
  db.prepare(`
   SELECT *
   FROM downloads
   ORDER BY id DESC
  `).all()
 );
});

app.post('/api/admin/downloads', requireAdmin, (req, res) => {
 const title = String(req.body.title || '')
  .trim()
  .slice(0, 120);

 const description = String(req.body.description || '')
  .trim()
  .slice(0, 2000);

 const image_url = String(req.body.image_url || '')
  .trim()
  .slice(0, 2000);

 const download_url = String(req.body.download_url || '')
  .trim()
  .slice(0, 2000);

 if (!title || !download_url) {
  return res.status(400).json({
   error: 'Tên và link tải xuống là bắt buộc'
  });
 }

 try {
  new URL(download_url);
  if (image_url) new URL(image_url);
 } catch {
  return res.status(400).json({
   error: 'Link không hợp lệ'
  });
 }

 const t = now();

 const result = db.prepare(`
  INSERT INTO downloads
  (title,description,image_url,download_url,created_at,updated_at)
  VALUES(?,?,?,?,?,?)
 `).run(
  title,
  description,
  image_url,
  download_url,
  t,
  t
 );

 res.json({
  download: db.prepare(
   'SELECT * FROM downloads WHERE id=?'
  ).get(result.lastInsertRowid)
 });
});

app.patch('/api/admin/downloads/:id', requireAdmin, (req, res) => {
 const old = db.prepare(
  'SELECT * FROM downloads WHERE id=?'
 ).get(req.params.id);

 if (!old) {
  return res.status(404).json({
   error: 'Không tìm thấy mục tải xuống'
  });
 }

 const title = String(
  req.body.title ?? old.title
 ).trim().slice(0, 120);

 const description = String(
  req.body.description ?? old.description
 ).trim().slice(0, 2000);

 const image_url = String(
  req.body.image_url ?? old.image_url
 ).trim().slice(0, 2000);

 const download_url = String(
  req.body.download_url ?? old.download_url
 ).trim().slice(0, 2000);

 if (!title || !download_url) {
  return res.status(400).json({
   error: 'Tên và link tải xuống là bắt buộc'
  });
 }

 try {
  new URL(download_url);
  if (image_url) new URL(image_url);
 } catch {
  return res.status(400).json({
   error: 'Link không hợp lệ'
  });
 }

 db.prepare(`
  UPDATE downloads
  SET title=?,description=?,image_url=?,download_url=?,updated_at=?
  WHERE id=?
 `).run(
  title,
  description,
  image_url,
  download_url,
  now(),
  old.id
 );

 res.json({
  download: db.prepare(
   'SELECT * FROM downloads WHERE id=?'
  ).get(old.id)
 });
});

app.delete('/api/admin/downloads/:id', requireAdmin, (req, res) => {
 const row = db.prepare(
  'SELECT * FROM downloads WHERE id=?'
 ).get(req.params.id);

 if (!row) {
  return res.status(404).json({
   error: 'Không tìm thấy mục tải xuống'
  });
 }

 db.prepare(
  'DELETE FROM downloads WHERE id=?'
 ).run(row.id);

 res.json({ ok: true });
});

/* =========================
   ADMIN STATS
========================= */

app.get('/api/admin/stats', requireAdmin, (req, res) => {
 const t = now();

 res.json({
  total: db.prepare(
   'SELECT COUNT(*) c FROM licenses'
  ).get().c,

  active: db.prepare(`
   SELECT COUNT(*) c
   FROM licenses
   WHERE status='active'
   AND (expires_at IS NULL OR expires_at>?)
  `).get(t).c,

  banned: db.prepare(`
   SELECT COUNT(*) c
   FROM licenses
   WHERE status='banned'
  `).get().c,

  bound: db.prepare(`
   SELECT COUNT(*) c
   FROM licenses
   WHERE hwid IS NOT NULL
   AND hwid!=''
  `).get().c
 });
});

/* =========================
   ADMIN LICENSES
========================= */

app.get('/api/admin/licenses', requireAdmin, (req, res) => {
 let sql = 'SELECT * FROM licenses WHERE 1=1';
 const args = [];

 const q = String(req.query.q || '').trim();
 const status = String(req.query.status || 'all');

 if (q) {
  sql += ' AND(key LIKE ? OR hwid LIKE ? OR note LIKE ?)';
  const x = `%${q}%`;
  args.push(x, x, x);
 }

 if (
  ['active', 'banned', 'disabled'].includes(status)
 ) {
  sql += ' AND status=?';
  args.push(status);
 }

 sql += ' ORDER BY id DESC LIMIT 1000';

 res.json(
  db.prepare(sql).all(...args)
 );
});

function makeKey() {
 const chars =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

 const part = () =>
  Array.from(
   { length: 5 },
   () => chars[crypto.randomInt(0, chars.length)]
  ).join('');

 return `${part()}-${part()}-${part()}-${part()}`;
}

function createLicense(req, days, note) {
 let key;

 do {
  key = makeKey();
 } while (
  db.prepare(
   'SELECT 1 FROM licenses WHERE key=?'
  ).get(key)
 );

 const expires =
  days > 0
   ? new Date(
      Date.now() + days * 86400000
     ).toISOString()
   : null;

 const result = db.prepare(`
  INSERT INTO licenses
  (key,status,expires_at,note,created_at)
  VALUES(?,'active',?,?,?)
 `).run(
  key,
  expires,
  note,
  now()
 );

 const row = db.prepare(
  'SELECT * FROM licenses WHERE id=?'
 ).get(result.lastInsertRowid);

 audit(
  req,
  'create',
  row,
  `duration_days=${days}`
 );

 return row;
}

app.post('/api/admin/licenses', requireAdmin, (req, res) => {
 const days = Math.max(
  0,
  Math.min(
   36500,
   Number(req.body.duration_days || 0)
  )
 );

 const note = String(
  req.body.note || ''
 ).slice(0, 500);

 res.json({
  license: createLicense(
   req,
   days,
   note
  )
 });
});

app.post('/api/admin/licenses/bulk', requireAdmin, (req, res) => {
 const count = Math.max(
  1,
  Math.min(
   500,
   Number(req.body.count || 1)
  )
 );

 const days = Math.max(
  0,
  Math.min(
   36500,
   Number(req.body.duration_days || 0)
  )
 );

 const note = String(
  req.body.note || ''
 ).slice(0, 500);

 const transaction = db.transaction(() => {
  const result = [];

  for (let i = 0; i < count; i++) {
   result.push(
    createLicense(
     req,
     days,
     note
    )
   );
  }

  return result;
 });

 res.json({
  licenses: transaction()
 });
});

app.patch(
 '/api/admin/licenses/:id',
 requireAdmin,
 (req, res) => {
  let row = db.prepare(
   'SELECT * FROM licenses WHERE id=?'
  ).get(req.params.id);

  const status = String(
   req.body.status || ''
  );

  if (!row) {
   return res.status(404).json({
    error: 'Không tìm thấy key'
   });
  }

  if (
   !['active', 'banned', 'disabled'].includes(status)
  ) {
   return res.status(400).json({
    error: 'Trạng thái không hợp lệ'
   });
  }

  db.prepare(`
   UPDATE licenses
   SET status=?
   WHERE id=?
  `).run(status, row.id);

  row = db.prepare(
   'SELECT * FROM licenses WHERE id=?'
  ).get(row.id);

  audit(
   req,
   `status_${status}`,
   row
  );

  res.json({
   license: row
  });
});

app.post(
 '/api/admin/licenses/:id/reset-hwid',
 requireAdmin,
 (req, res) => {
  const row = db.prepare(
   'SELECT * FROM licenses WHERE id=?'
  ).get(req.params.id);

  if (!row) {
   return res.status(404).json({
    error: 'Không tìm thấy key'
   });
  }

  db.prepare(`
   UPDATE licenses
   SET hwid=NULL
   WHERE id=?
  `).run(row.id);

  audit(
   req,
   'reset_hwid',
   row
  );

  res.json({ ok: true });
 }
);

app.delete(
 '/api/admin/licenses/:id',
 requireAdmin,
 (req, res) => {
  const row = db.prepare(
   'SELECT * FROM licenses WHERE id=?'
  ).get(req.params.id);

  if (!row) {
   return res.status(404).json({
    error: 'Không tìm thấy key'
   });
  }

  db.prepare(
   'DELETE FROM licenses WHERE id=?'
  ).run(row.id);

  audit(
   req,
   'delete',
   row
  );

  res.json({ ok: true });
 }
);

app.get('/api/admin/logs', requireAdmin, (req, res) => {
 res.json(
  db.prepare(`
   SELECT *
   FROM audit_logs
   ORDER BY id DESC
   LIMIT 500
  `).all()
 );
});

/* =========================
   LICENSE API
========================= */

function validateLicense(req, res, action) {
 const key = String(
  req.body.key || ''
 ).trim().toUpperCase();

 const hwid = String(
  req.body.hwid || ''
 ).trim();

 let row = db.prepare(
  'SELECT * FROM licenses WHERE key=?'
 ).get(key);

 if (!key || !hwid) {
  return res.status(400).json({
   ok: false,
   error: 'Thiếu key hoặc HWID'
  });
 }

 if (!row) {
  return res.status(404).json({
   ok: false,
   error: 'Key không tồn tại'
  });
 }

 if (row.status !== 'active') {
  return res.status(403).json({
   ok: false,
   error:
    row.status === 'banned'
     ? 'Key đã bị khóa'
     : 'Key đã bị vô hiệu hóa'
  });
 }

 if (
  row.expires_at &&
  new Date(row.expires_at) <= new Date()
 ) {
  return res.status(403).json({
   ok: false,
   error: 'Key đã hết hạn'
  });
 }

 if (
  row.hwid &&
  row.hwid !== hwid
 ) {
  return res.status(403).json({
   ok: false,
   error: 'Key đã được liên kết với thiết bị khác'
  });
 }

 if (!row.hwid) {
  db.prepare(`
   UPDATE licenses
   SET hwid=?
   WHERE id=?
  `).run(hwid, row.id);

  row.hwid = hwid;

  audit(
   req,
   'hwid_bound',
   row
  );
 }

 audit(
  req,
  action,
  row
 );

 res.json({
  ok: true,
  key: row.key,
  status: row.status,
  expires_at: row.expires_at,
  hwid_bound: true
 });
}

app.post(
 '/api/license/activate',
 (req, res) =>
  validateLicense(
   req,
   res,
   'activate'
  )
);

app.post(
 '/api/license/validate',
 (req, res) =>
  validateLicense(
   req,
   res,
   'validate'
  )
);

/* =========================
   SPA
========================= */

app.get('*', (req, res) => {
 res.sendFile(
  path.join(
   __dirname,
   'public',
   'index.html'
  )
 );
});

app.listen(
 PORT,
 '0.0.0.0',
 () => console.log(
  `AnhVuong License Server running on port ${PORT}`
 )
);