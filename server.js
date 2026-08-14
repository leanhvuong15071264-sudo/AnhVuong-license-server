require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { query, pool } = require('./db');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1);

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

/* =========================================================
   DATABASE
========================================================= */

async function initDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS licenses (
      id BIGSERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at TIMESTAMPTZ,
      hwid TEXT,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      license_id BIGINT,
      key TEXT,
      detail TEXT NOT NULL DEFAULT '',
      ip TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS downloads (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      download_url TEXT NOT NULL,
      price TEXT NOT NULL DEFAULT 'MIỄN PHÍ',
      version TEXT NOT NULL DEFAULT '',
      file_size TEXT NOT NULL DEFAULT '1 tập tin',
      discord_info TEXT NOT NULL DEFAULT 'Vai trò + kênh',
      extra_title TEXT NOT NULL DEFAULT 'GIỚI THIỆU VỀ BẢN MOD NÀY',
      extra_description TEXT NOT NULL DEFAULT 'Thạch Chi Khong Biet',
      license_key_display TEXT NOT NULL DEFAULT 'VNT-XXXX-XXXX-XXXX',
      shipping_info TEXT NOT NULL DEFAULT 'truy cập tức',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'guest',
      created_at TIMESTAMPTZ NOT NULL,
      last_login TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      ip TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS download_history (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      download_id BIGINT NOT NULL,
      download_title TEXT NOT NULL,
      download_image TEXT NOT NULL DEFAULT '',
      download_price TEXT NOT NULL DEFAULT 'MIỄN PHÍ',
      download_version TEXT NOT NULL DEFAULT '',
      downloaded_at TIMESTAMPTZ NOT NULL
    )
  `);

  console.log('PostgreSQL database initialized');
}

/* =========================================================
   LOGGING
========================================================= */

async function audit(req, action, row, detail = '') {
  await query(`
    INSERT INTO audit_logs
    (action, license_id, key, detail, ip, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    action,
    row?.id || null,
    row?.key || null,
    detail,
    ip(req),
    now()
  ]);
}

async function userLog(req, userId, action, detail = '') {
  await query(`
    INSERT INTO user_logs
    (user_id, action, detail, ip, created_at)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    userId,
    action,
    detail,
    ip(req),
    now()
  ]);
}

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

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
    (
      req.session.role === 'guest' ||
      req.session.role === 'admin'
    )
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

/* =========================================================
   HEALTH
========================================================= */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: now()
  });
});

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post('/api/admin/login', async (req, res) => {
  try {
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

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Không thể đăng nhập Admin'
    });
  }
});

/* =========================================================
   GUEST REGISTER
========================================================= */

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(
      req.body.username || ''
    ).trim();

    const password = String(
      req.body.password || ''
    );

    if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
      return res.status(400).json({
        error:
          'Tên tài khoản phải từ 3-32 ký tự, chỉ gồm chữ, số và _'
      });
    }

    if (
      password.length < 6 ||
      password.length > 100
    ) {
      return res.status(400).json({
        error: 'Mật khẩu phải từ 6-100 ký tự'
      });
    }

    const exists = await query(
      'SELECT id FROM users WHERE username=$1',
      [username]
    );

    if (exists.rows.length) {
      return res.status(409).json({
        error: 'Tên tài khoản đã tồn tại'
      });
    }

    const hash = await bcrypt.hash(
      password,
      12
    );

    const result = await query(`
      INSERT INTO users
      (username, password_hash, role, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [
      username,
      hash,
      'guest',
      now()
    ]);

    const userId = Number(
      result.rows[0].id
    );

    req.session.userId = userId;
    req.session.username = username;
    req.session.role = 'guest';
    req.session.admin = false;

    await userLog(
      req,
      userId,
      'register',
      'Tạo tài khoản khách'
    );

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

/* =========================================================
   GUEST LOGIN
========================================================= */

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(
      req.body.username || ''
    ).trim();

    const password = String(
      req.body.password || ''
    );

    const result = await query(`
      SELECT *
      FROM users
      WHERE username=$1
    `, [username]);

    const user = result.rows[0];

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

    await query(`
      UPDATE users
      SET last_login=$1
      WHERE id=$2
    `, [
      loginTime,
      user.id
    ]);

    req.session.userId = Number(user.id);
    req.session.username = user.username;
    req.session.role = 'guest';
    req.session.admin = false;

    await userLog(
      req,
      user.id,
      'login',
      'Đăng nhập tài khoản khách'
    );

    req.session.save(err => {
      if (err) {
        console.error(err);

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

/* =========================================================
   CURRENT USER
========================================================= */

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

/* =========================================================
   LOGOUT
========================================================= */

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.post(
  '/api/admin/logout',
  requireAdmin,
  (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  }
);

app.get(
  '/api/admin/me',
  requireAdmin,
  (req, res) => {
    res.json({
      ok: true,
      username:
        req.session.username ||
        adminUsername(),
      role: 'admin'
    });
  }
);

/* =========================================================
   GUEST LOGS
========================================================= */

app.get(
  '/api/account/logs',
  requireUser,
  async (req, res) => {
    try {
      const result = await query(`
        SELECT
          id,
          action,
          detail,
          ip,
          created_at
        FROM user_logs
        WHERE user_id=$1
        ORDER BY id DESC
        LIMIT 200
      `, [
        req.session.userId
      ]);

      res.json(result.rows);

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Không thể lấy lịch sử'
      });
    }
  }
);

/* =========================================================
   DOWNLOAD HISTORY API
========================================================= */

app.get(
  '/api/history',
  requireUser,
  async (req, res) => {
    try {
      const result = await query(`
        SELECT
          id,
          download_title,
          download_image,
          download_price,
          download_version,
          downloaded_at
        FROM download_history
        WHERE user_id=$1
        ORDER BY downloaded_at DESC
      `, [
        req.session.userId
      ]);

      res.json(result.rows);

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Không thể lấy lịch sử tải xuống'
      });
    }
  }
);

/* =========================================================
   PUBLIC DOWNLOADS
========================================================= */

app.get(
  '/api/downloads',
  async (req, res) => {
    try {
      const result = await query(`
        SELECT
          id,
          title,
          description,
          image_url,
          download_url,
          price,
          version,
          file_size,
          discord_info,
          extra_title,
          extra_description,
          license_key_display,
          shipping_info,
          created_at,
          updated_at
        FROM downloads
        ORDER BY id DESC
      `);

      res.json(result.rows);

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Không thể lấy danh sách tải xuống'
      });
    }
  }
);

app.get(
  '/api/downloads/:id/access',
  requireDownloadAccess,
  async (req, res) => {
    try {
      const result = await query(`
        SELECT *
        FROM downloads
        WHERE id=$1
      `, [req.params.id]);

      const item = result.rows[0];

      if (!item) {
        return res.status(404).json({
          error: 'Không tìm thấy mục tải xuống'
        });
      }

      // Ghi vào lịch sử tải xuống
      if (
        req.session.role === 'guest' &&
        req.session.userId
      ) {
        await query(`
          INSERT INTO download_history
          (
            user_id,
            download_id,
            download_title,
            download_image,
            download_price,
            download_version,
            downloaded_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          req.session.userId,
          item.id,
          item.title,
          item.image_url || '',
          item.price || 'MIỄN PHÍ',
          item.version || '',
          now()
        ]);

        await userLog(
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

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Không thể tải xuống'
      });
    }
  }
);

/* =========================================================
   ADMIN DOWNLOADS
========================================================= */

app.get(
  '/api/admin/downloads',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await query(`
        SELECT *
        FROM downloads
        ORDER BY id DESC
      `);

      res.json(result.rows);

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Không thể lấy danh sách download'
      });
    }
  }
);

app.post(
  '/api/admin/downloads',
  requireAdmin,
  async (req, res) => {
    try {
      const title = String(
        req.body.title || ''
      )
        .trim()
        .slice(0, 120);

      const description = String(
        req.body.description || ''
      )
        .trim()
        .slice(0, 2000);

      const image_url = String(
        req.body.image_url || ''
      )
        .trim()
        .slice(0, 2000);

      const download_url = String(
        req.body.download_url || ''
      )
        .trim()
        .slice(0, 2000);

      const price = String(
        req.body.price || 'MIỄN PHÍ'
      ).trim().slice(0, 50);

      const version = String(
        req.body.version || ''
      ).trim().slice(0, 50);

      const file_size = String(
        req.body.file_size || '1 tập tin'
      ).trim().slice(0, 50);

      const discord_info = String(
        req.body.discord_info || 'Vai trò + kênh'
      ).trim().slice(0, 200);

      const extra_title = String(
        req.body.extra_title || 'GIỚI THIỆU VỀ BẢN MOD NÀY'
      ).trim().slice(0, 100);

      const extra_description = String(
        req.body.extra_description || 'Thạch Chi Khong Biet'
      ).trim().slice(0, 500);

      const license_key_display = String(
        req.body.license_key_display || 'VNT-XXXX-XXXX-XXXX'
      ).trim().slice(0, 50);

      const shipping_info = String(
        req.body.shipping_info || 'truy cập tức'
      ).trim().slice(0, 100);

      if (!title || !download_url) {
        return res.status(400).json({
          error:
            'Tên và link tải xuống là bắt buộc'
        });
      }

      try {
        new URL(download_url);

        if (image_url) {
          new URL(image_url);
        }

      } catch {
        return res.status(400).json({
          error: 'Link không hợp lệ'
        });
      }

      const t = now();

      const result = await query(`
        INSERT INTO downloads
        (
          title,
          description,
          image_url,
          download_url,
          price,
          version,
          file_size,
          discord_info,
          extra_title,
          extra_description,
          license_key_display,
          shipping_info,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *
      `, [
        title,
        description,
        image_url,
        download_url,
        price,
        version,
        file_size,
        discord_info,
        extra_title,
        extra_description,
        license_key_display,
        shipping_info,
        t,
        t
      ]);

      res.json({
        download: result.rows[0]
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Không thể tạo mục tải xuống'
      });
    }
  }
);

app.patch(
  '/api/admin/downloads/:id',
  requireAdmin,
  async (req, res) => {
    try {
      const oldResult = await query(
        'SELECT * FROM downloads WHERE id=$1',
        [req.params.id]
      );

      const old = oldResult.rows[0];

      if (!old) {
        return res.status(404).json({
          error: 'Không tìm thấy mục tải xuống'
        });
      }

      const title = String(
        req.body.title ?? old.title
      )
        .trim()
        .slice(0, 120);

      const description = String(
        req.body.description ??
        old.description
      )
        .trim()
        .slice(0, 2000);

      const image_url = String(
        req.body.image_url ??
        old.image_url
      )
        .trim()
        .slice(0, 2000);

      const download_url = String(
        req.body.download_url ??
        old.download_url
      )
        .trim()
        .slice(0, 2000);

      const price = String(
        req.body.price ?? old.price
      ).trim().slice(0, 50);

      const version = String(
        req.body.version ?? old.version
      ).trim().slice(0, 50);

      const file_size = String(
        req.body.file_size ?? old.file_size
      ).trim().slice(0, 50);

      const discord_info = String(
        req.body.discord_info ?? old.discord_info
      ).trim().slice(0, 200);

      const extra_title = String(
        req.body.extra_title ?? old.extra_title
      ).trim().slice(0, 100);

      const extra_description = String(
        req.body.extra_description ?? old.extra_description
      ).trim().slice(0, 500);

      const license_key_display = String(
        req.body.license_key_display ?? old.license_key_display
      ).trim().slice(0, 50);

      const shipping_info = String(
        req.body.shipping_info ?? old.shipping_info
      ).trim().slice(0, 100);

      if (!title || !download_url) {
        return res.status(400).json({
          error:
            'Tên và link tải xuống là bắt buộc'
        });
      }

      try {
        new URL(download_url);

        if (image_url) {
          new URL(image_url);
        }

      } catch {
        return res.status(400).json({
          error: 'Link không hợp lệ'
        });
      }

      const result = await query(`
        UPDATE downloads
        SET
          title=$1,
          description=$2,
          image_url=$3,
          download_url=$4,
          price=$5,
          version=$6,
          file_size=$7,
          discord_info=$8,
          extra_title=$9,
          extra_description=$10,
          license_key_display=$11,
          shipping_info=$12,
          updated_at=$13
        WHERE id=$14
        RETURNING *
      `, [
        title,
        description,
        image_url,
        download_url,
        price,
        version,
        file_size,
        discord_info,
        extra_title,
        extra_description,
        license_key_display,
        shipping_info,
        now(),
        old.id
      ]);

      res.json({
        download: result.rows[0]
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Không thể cập nhật download'
      });
    }
  }
);

app.delete(
  '/api/admin/downloads/:id',
  requireAdmin,
  async (req, res) => {
    try {
      const oldResult = await query(
        'SELECT * FROM downloads WHERE id=$1',
        [req.params.id]
      );

      const row = oldResult.rows[0];

      if (!row) {
        return res.status(404).json({
          error: 'Không tìm thấy mục tải xuống'
        });
      }

      await query(
        'DELETE FROM downloads WHERE id=$1',
        [row.id]
      );

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Không thể xóa download'
      });
    }
  }
);

/* =========================================================
   ADMIN STATS
========================================================= */

app.get(
  '/api/admin/stats',
  requireAdmin,
  async (req, res) => {
    try {
      const total = await query(`
        SELECT COUNT(*)::int AS c
        FROM licenses
      `);

      const active = await query(`
        SELECT COUNT(*)::int AS c
        FROM licenses
        WHERE status='active'
        AND (
          expires_at IS NULL
          OR expires_at > $1
        )
      `, [now()]);

      const banned = await query(`
        SELECT COUNT(*)::int AS c
        FROM licenses
        WHERE status='banned'
      `);

      const bound = await query(`
        SELECT COUNT(*)::int AS c
        FROM licenses
        WHERE hwid IS NOT NULL
        AND hwid!=''
      `);

      res.json({
        total: total.rows[0].c,
        active: active.rows[0].c,
        banned: banned.rows[0].c,
        bound: bound.rows[0].c
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Không thể lấy thống kê'
      });
    }
  }
);

/* =========================================================
   ADMIN LICENSES
========================================================= */

app.get(
  '/api/admin/licenses',
  requireAdmin,
  async (req, res) => {
    try {
      let sql = `
        SELECT *
        FROM licenses
        WHERE 1=1
      `;

      const args = [];

      const q = String(
        req.query.q || ''
      ).trim();

      const status = String(
        req.query.status || 'all'
      );

      if (q) {
        sql += `
          AND (
            key ILIKE $1
            OR hwid ILIKE $1
            OR note ILIKE $1
          )
        `;

        args.push(`%${q}%`);
      }

      if (
        ['active', 'banned', 'disabled']
          .includes(status)
      ) {
        args.push(status);

        sql += `
          AND status=$${args.length}
        `;
      }

      sql += `
        ORDER BY id DESC
        LIMIT 1000
      `;

      const result = await query(
        sql,
        args
      );

      res.json(result.rows);

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Không thể lấy danh sách key'
      });
    }
  }
);

/* =========================================================
   LICENSE KEY GENERATOR
========================================================= */

function makeKey() {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const part = () =>
    Array.from(
      { length: 5 },
      () =>
        chars[
          crypto.randomInt(
            0,
            chars.length
          )
        ]
    ).join('');

  return `${part()}-${part()}-${part()}-${part()}`;
}

/* =========================================================
   CREATE LICENSE
========================================================= */

async function createLicense(
  req,
  days,
  note,
  client = null
) {
  const dbQuery = client
    ? client.query.bind(client)
    : query;

  let key;

  do {
    key = makeKey();

    const exists = await dbQuery(
      'SELECT 1 FROM licenses WHERE key=$1',
      [key]
    );

    if (!exists.rows.length) {
      break;
    }

  } while (true);

  const expires =
    days > 0
      ? new Date(
          Date.now() +
          days * 86400000
        ).toISOString()
      : null;

  const result = await dbQuery(`
    INSERT INTO licenses
    (
      key,
      status,
      expires_at,
      note,
      created_at
    )
    VALUES ($1,'active',$2,$3,$4)
    RETURNING *
  `, [
    key,
    expires,
    note,
    now()
  ]);

  const row = result.rows[0];

  await audit(
    req,
    'create',
    row,
    `duration_days=${days}`
  );

  return row;
}

/* =========================================================
   CREATE LICENSE
========================================================= */

app.post(
  '/api/admin/licenses',
  requireAdmin,
  async (req, res) => {
    try {
      const days = Math.max(
        0,
        Math.min(
          36500,
          Number(
            req.body.duration_days || 0
          )
        )
      );

      const note = String(
        req.body.note || ''
      ).slice(0, 500);

      const license =
        await createLicense(
          req,
          days,
          note
        );

      res.json({
        license
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Không thể tạo key'
      });
    }
  }
);

/* =========================================================
   BULK CREATE LICENSE
========================================================= */

app.post(
  '/api/admin/licenses/bulk',
  requireAdmin,
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const count = Math.max(
        1,
        Math.min(
          500,
          Number(
            req.body.count || 1
          )
        )
      );

      const days = Math.max(
        0,
        Math.min(
          36500,
          Number(
            req.body.duration_days || 0
          )
        )
      );

      const note = String(
        req.body.note || ''
      ).slice(0, 500);

      await client.query(
        'BEGIN'
      );

      const result = [];

      for (
        let i = 0;
        i < count;
        i++
      ) {
        result.push(
          await createLicense(
            req,
            days,
            note,
            client
          )
        );
      }

      await client.query(
        'COMMIT'
      );

      res.json({
        licenses: result
      });

    } catch (err) {
      await client.query(
        'ROLLBACK'
      );

      console.error(err);

      res.status(500).json({
        error:
          'Không thể tạo nhiều key'
      });

    } finally {
      client.release();
    }
  }
);

/* =========================================================
   UPDATE LICENSE STATUS
========================================================= */

app.patch(
  '/api/admin/licenses/:id',
  requireAdmin,
  async (req, res) => {
    try {
      const oldResult =
        await query(
          'SELECT * FROM licenses WHERE id=$1',
          [req.params.id]
        );

      let row =
        oldResult.rows[0];

      const status = String(
        req.body.status || ''
      );

      if (!row) {
        return res.status(404).json({
          error: 'Không tìm thấy key'
        });
      }

      if (
        ![
          'active',
          'banned',
          'disabled'
        ].includes(status)
      ) {
        return res.status(400).json({
          error:
            'Trạng thái không hợp lệ'
        });
      }

      const updated =
        await query(`
          UPDATE licenses
          SET status=$1
          WHERE id=$2
          RETURNING *
        `, [
          status,
          row.id
        ]);

      row =
        updated.rows[0];

      await audit(
        req,
        `status_${status}`,
        row
      );

      res.json({
        license: row
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Không thể cập nhật key'
      });
    }
  }
);

/* =========================================================
   RESET HWID
========================================================= */

app.post(
  '/api/admin/licenses/:id/reset-hwid',
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await query(
          'SELECT * FROM licenses WHERE id=$1',
          [req.params.id]
        );

      const row =
        result.rows[0];

      if (!row) {
        return res.status(404).json({
          error:
            'Không tìm thấy key'
        });
      }

      await query(`
        UPDATE licenses
        SET hwid=NULL
        WHERE id=$1
      `, [
        row.id
      ]);

      await audit(
        req,
        'reset_hwid',
        row
      );

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Không thể reset HWID'
      });
    }
  }
);

/* =========================================================
   DELETE LICENSE
========================================================= */

app.delete(
  '/api/admin/licenses/:id',
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await query(
          'SELECT * FROM licenses WHERE id=$1',
          [req.params.id]
        );

      const row =
        result.rows[0];

      if (!row) {
        return res.status(404).json({
          error:
            'Không tìm thấy key'
        });
      }

      await query(
        'DELETE FROM licenses WHERE id=$1',
        [row.id]
      );

      await audit(
        req,
        'delete',
        row
      );

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Không thể xóa key'
      });
    }
  }
);

/* =========================================================
   ADMIN LOGS
========================================================= */

app.get(
  '/api/admin/logs',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await query(`
        SELECT *
        FROM audit_logs
        ORDER BY id DESC
        LIMIT 500
      `);

      res.json(
        result.rows
      );

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Không thể lấy logs'
      });
    }
  }
);

/* =========================================================
   LICENSE API
========================================================= */

async function validateLicense(
  req,
  res,
  action
) {
  try {
    const key = String(
      req.body.key || ''
    )
      .trim()
      .toUpperCase();

    const hwid = String(
      req.body.hwid || ''
    ).trim();

    if (!key || !hwid) {
      return res.status(400).json({
        ok: false,
        error:
          'Thiếu key hoặc HWID'
      });
    }

    const result =
      await query(
        'SELECT * FROM licenses WHERE key=$1',
        [key]
      );

    let row =
      result.rows[0];

    if (!row) {
      return res.status(404).json({
        ok: false,
        error:
          'Key không tồn tại'
      });
    }

    if (
      row.status !== 'active'
    ) {
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
      new Date(row.expires_at) <=
        new Date()
    ) {
      return res.status(403).json({
        ok: false,
        error:
          'Key đã hết hạn'
      });
    }

    if (
      row.hwid &&
      row.hwid !== hwid
    ) {
      return res.status(403).json({
        ok: false,
        error:
          'Key đã được liên kết với thiết bị khác'
      });
    }

    if (!row.hwid) {
      const updated =
        await query(`
          UPDATE licenses
          SET hwid=$1
          WHERE id=$2
          RETURNING *
        `, [
          hwid,
          row.id
        ]);

      row =
        updated.rows[0];

      await audit(
        req,
        'hwid_bound',
        row
      );
    }

    await audit(
      req,
      action,
      row
    );

    res.json({
      ok: true,
      key: row.key,
      status: row.status,
      expires_at:
        row.expires_at,
      hwid_bound: true
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      ok: false,
      error:
        'Lỗi máy chủ'
    });
  }
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

/* =========================================================
   SPA
========================================================= */

app.get(/.*/, (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      'public',
      'index.html'
    )
  );
});

/* =========================================================
   START
========================================================= */

async function start() {
  try {
    await initDatabase();

    app.listen(
      PORT,
      '0.0.0.0',
      () => {
        console.log(
          `AnhVuong License Server running on port ${PORT}`
        );
      }
    );

  } catch (err) {
    console.error(
      'Database initialization failed:',
      err
    );

    process.exit(1);
  }
}

start();