const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let licenses = [];
let authMode = 'login';
let currentUser = null;

async function api(url, opt = {}) {
 const r = await fetch(url, {
  credentials: 'same-origin',
  headers: {
   'Content-Type': 'application/json',
   ...(opt.headers || {})
  },
  ...opt
 });

 const d = await r.json().catch(() => ({}));

 if (!r.ok) {
  throw Error(d.error || 'Có lỗi xảy ra');
 }

 return d;
}

const esc = v =>
 String(v ?? '').replace(
  /[&<>"']/g,
  m => ({
   '&': '&amp;',
   '<': '&lt;',
   '>': '&gt;',
   '"': '&quot;',
   "'": '&#39;'
  }[m])
 );

/* =========================
   PUBLIC
========================= */

async function loadPublicDownloads() {
 const items = await api('/api/downloads');

 const html = items.map(x => `
  <article class="download-card">

   ${
    x.image_url
     ? `<img
        src="${esc(x.image_url)}"
        alt="${esc(x.title)}"
        onerror="this.style.display='none'">`
     : ''
   }

   <div class="download-body">

    <h3>${esc(x.title)}</h3>

    <p>
     ${esc(
      x.description ||
      'Không có mô tả'
     )}
    </p>

    <div class="download-links">

     <button
      onclick="downloadItem(${x.id})">
      Cài đặt / Tải xuống
     </button>

    </div>

   </div>

  </article>
 `).join('');

 $('#publicDownloadList').innerHTML =
  html ||
  '<div class="panel empty-state">Chưa có phần mềm.</div>';
}

window.downloadItem = async id => {
 try {
  const d = await api(
   `/api/downloads/${id}/access`
  );

  window.open(
   d.download_url,
   '_blank',
   'noopener'
  );
 } catch (e) {

  if (e.message.includes('đăng nhập')) {
   openGuestLogin();
   return;
  }

  alert(e.message);
 }
};

function showPublicPage(page) {
 $('#homePage').classList.toggle(
  'hidden',
  page !== 'home'
 );

 $('#publicDownloadsPage').classList.toggle(
  'hidden',
  page !== 'downloads'
 );

 if (page === 'downloads') {
  loadPublicDownloads();
 }
}

/* =========================
   GUEST AUTH
========================= */

function openGuestLogin() {
 authMode = 'login';

 $('#authTitle').textContent =
  'Đăng nhập tài khoản khách';

 $('#authDescription').textContent =
  'Đăng nhập để tải phần mềm.';

 $('#authSubmit').textContent =
  'Đăng nhập';

 $('#authMsg').textContent = '';

 $('#authUsername').value = '';
 $('#authPassword').value = '';

 $('#authDialog').showModal();
}

function openGuestRegister() {
 authMode = 'register';

 $('#authTitle').textContent =
  'Tạo tài khoản khách';

 $('#authDescription').textContent =
  'Đăng ký miễn phí để tải phần mềm.';

 $('#authSubmit').textContent =
  'Đăng ký';

 $('#authMsg').textContent = '';

 $('#authUsername').value = '';
 $('#authPassword').value = '';

 $('#authDialog').showModal();
}

$('#guestLoginBtn').onclick =
 openGuestLogin;

$('#guestRegisterBtn').onclick =
 openGuestRegister;

$('#authCancel').onclick =
 () => $('#authDialog').close();

$('#authForm').onsubmit = async e => {
 e.preventDefault();

 const username =
  $('#authUsername').value.trim();

 const password =
  $('#authPassword').value;

 $('#authMsg').textContent =
  'Đang xử lý...';

 try {

  const endpoint =
   authMode === 'register'
    ? '/api/auth/register'
    : '/api/auth/login';

  const d = await api(
   endpoint,
   {
    method: 'POST',
    body: JSON.stringify({
     username,
     password
    })
   }
  );

  $('#authDialog').close();

  await loadCurrentUser();

  if (d.role === 'guest') {
   showGuest();
  }

 } catch (e) {
  $('#authMsg').textContent =
   e.message;
 }
};

/* =========================
   ADMIN LOGIN
========================= */

$('#adminLoginBtn').onclick =
 () => $('#adminLoginDialog').showModal();

$('#adminLoginCancel').onclick =
 () => $('#adminLoginDialog').close();

$('#adminLoginForm').onsubmit =
 async e => {

  e.preventDefault();

  $('#adminLoginMsg').textContent =
   'Đang đăng nhập...';

  try {

   await api(
    '/api/admin/login',
    {
     method: 'POST',
     body: JSON.stringify({
      username:
       $('#adminUsername').value,
      password:
       $('#adminPassword').value
     })
    }
   );

   $('#adminLoginDialog').close();

   await loadCurrentUser();

   showAdmin();

  } catch (e) {

   $('#adminLoginMsg').textContent =
    e.message;
  }
 };

/* =========================
   CURRENT USER
========================= */

async function loadCurrentUser() {
 try {
  currentUser =
   await api('/api/auth/me');

  return currentUser;

 } catch {
  currentUser = null;
  return null;
 }
}

/* =========================
   VIEW SWITCHING
========================= */

function showPublic() {

 $('#publicView')
  .classList.remove('hidden');

 $('#guestView')
  .classList.add('hidden');

 $('#adminView')
  .classList.add('hidden');
}

function showGuest() {

 $('#publicView')
  .classList.add('hidden');

 $('#guestView')
  .classList.remove('hidden');

 $('#adminView')
  .classList.add('hidden');

 $('#guestUsername').textContent =
  currentUser?.username || '';

 showGuestPage('downloads');

 loadGuestDownloads();
}

function showAdmin() {

 $('#publicView')
  .classList.add('hidden');

 $('#guestView')
  .classList.add('hidden');

 $('#adminView')
  .classList.remove('hidden');

 loadAdmin();

}

/* =========================
   GUEST PAGES
========================= */

function showGuestPage(page) {

 $('#guestDownloadsPage')
  .classList.toggle(
   'hidden',
   page !== 'downloads'
  );

 $('#accountPage')
  .classList.toggle(
   'hidden',
   page !== 'account'
  );

 $('#guestLogsPage')
  .classList.toggle(
   'hidden',
   page !== 'logs'
  );

 if (page === 'downloads')
  loadGuestDownloads();

 if (page === 'logs')
  loadGuestLogs();
}

$('#guestDownloadsNav').onclick =
 () => showGuestPage('downloads');

$('#guestAccountNav').onclick =
 () => showGuestPage('account');

$('#guestLogsNav').onclick =
 () => showGuestPage('logs');

$('#guestLogout').onclick =
 async () => {

  await api(
   '/api/auth/logout',
   { method: 'POST' }
  );

  currentUser = null;

  showPublic();
  showPublicPage('home');
 };

/* =========================
   GUEST DOWNLOADS
========================= */

async function loadGuestDownloads() {

 const items =
  await api('/api/downloads');

 const html =
  items.map(x => `

   <article class="download-card">

    ${
     x.image_url
      ? `<img
         src="${esc(x.image_url)}"
         alt="${esc(x.title)}"
         onerror="this.style.display='none'">`
      : ''
    }

    <div class="download-body">

     <h3>
      ${esc(x.title)}
     </h3>

     <p>
      ${esc(
       x.description ||
       'Không có mô tả'
      )}
     </p>

     <div class="download-links">

      <button
       onclick="downloadItem(${x.id})">
       Cài đặt / Tải xuống
      </button>

     </div>

    </div>

   </article>

  `).join('');

 $('#guestDownloadList').innerHTML =
  html ||
  '<div class="panel empty-state">Chưa có phần mềm.</div>';
}

/* =========================
   GUEST LOGS
========================= */

async function loadGuestLogs() {

 const rows =
  await api('/api/account/logs');

 $('#guestLogsRows').innerHTML =
  rows.map(x => `

   <tr>
    <td>
     ${esc(
      x.created_at
       .replace('T', ' ')
       .slice(0, 19)
     )}
    </td>

    <td>
     ${esc(x.action)}
    </td>

    <td>
     ${esc(x.detail)}
    </td>

    <td>
     ${esc(x.ip)}
    </td>
   </tr>

  `).join('') ||
  '<tr><td colspan="4">Chưa có nhật ký</td></tr>';
}

/* =========================
   PUBLIC NAV
========================= */

$('#publicHomeBtn').onclick =
 () => showPublicPage('home');

$('#publicDownloadsBtn').onclick =
 () => showPublicPage('downloads');

$('#heroDownloadBtn').onclick =
 () => showPublicPage('downloads');

/* =========================
   ADMIN
========================= */

async function loadAdmin() {

 try {
  await stats();
  await loadKeys();
 } catch (e) {
  console.error(e);
 }
}

async function stats() {

 const d =
  await api('/api/admin/stats');

 for (
  const k of [
   'Total',
   'Active',
   'Banned',
   'Bound'
  ]
 ) {
  const el =
   $('#s' + k);

  if (el) {
   el.textContent =
    d[k.toLowerCase()] ?? 0;
  }
 }
}

async function loadKeys() {

 licenses =
  await api(
   '/api/admin/licenses?q=' +
   encodeURIComponent(
    $('#search').value
   ) +
   '&status=' +
   $('#filter').value
  );

 $('#rows').innerHTML =
  licenses.map(r => `

   <tr>

    <td>
     <code>${esc(r.key)}</code>

     <button
      class="copy-key"
      onclick="copyKey(${r.id})">
      📋 Sao chép
     </button>
    </td>

    <td>
     ${esc(r.status)}
    </td>

    <td>
     ${
      r.expires_at
       ? new Date(
          r.expires_at
         ).toLocaleString('vi-VN')
       : 'Vĩnh viễn'
     }
    </td>

    <td>
     ${esc(r.hwid || '—')}
    </td>

    <td>
     ${esc(r.note)}
    </td>

    <td class="actions">

     <button
      onclick="toggleKey(
       ${r.id},
       '${r.status === 'banned'
        ? 'active'
        : 'banned'}'
      )">

      ${
       r.status === 'banned'
        ? 'Mở khóa'
        : 'Khóa'
      }

     </button>

     <button
      onclick="resetHwid(${r.id})">
      Reset HWID
     </button>

     <button
      onclick="delKey(${r.id})">
      Xóa
     </button>

    </td>

   </tr>

  `).join('') ||
  '<tr><td colspan="6">Chưa có key</td></tr>';
}

/* =========================
   ADMIN DOWNLOADS
========================= */

async function loadDownloads() {

 const d =
  await api('/api/admin/downloads');

 $('#downloadList').innerHTML =
  d.map(x => `

   <article class="download-card">

    ${
     x.image_url
      ? `<img
         src="${esc(x.image_url)}"
         alt="${esc(x.title)}"
         onerror="this.style.display='none'">`
      : ''
    }

    <div class="download-body">

     <h3>
      ${esc(x.title)}
     </h3>

     <p>
      ${esc(
       x.description ||
       'Không có mô tả'
      )}
     </p>

     <div class="download-links">

      <a
       href="${esc(x.download_url)}"
       target="_blank"
       rel="noopener">
       Tải xuống ↗
      </a>

      <button
       onclick="editDownload(${x.id})">
       Sửa
      </button>

      <button
       onclick="deleteDownload(${x.id})">
       Xóa
      </button>

     </div>

    </div>

   </article>

  `).join('') ||
  '<div class="panel empty-state">Chưa có mục tải xuống.</div>';
}

function openDownloadForm(item = null) {

 $('#downloadDialogTitle').textContent =
  item
   ? 'Sửa mục tải xuống'
   : 'Thêm mục tải xuống';

 $('#downloadId').value =
  item?.id || '';

 $('#downloadTitle').value =
  item?.title || '';

 $('#downloadDescription').value =
  item?.description || '';

 $('#downloadImage').value =
  item?.image_url || '';

 $('#downloadUrl').value =
  item?.download_url || '';

 $('#downloadDialog').showModal();
}

window.editDownload =
 async id => {

  const d =
   await api('/api/admin/downloads');

  openDownloadForm(
   d.find(x => x.id === id)
  );
 };

window.deleteDownload =
 async id => {

  if (
   !confirm(
    'Xóa mục tải xuống này?'
   )
  ) return;

  await api(
   '/api/admin/downloads/' + id,
   { method: 'DELETE' }
  );

  await loadDownloads();
 };

$('#addDownload').onclick =
 () => openDownloadForm();

$('#downloadCancel').onclick =
 () => $('#downloadDialog').close();

$('#downloadForm').onsubmit =
 async e => {

  e.preventDefault();

  try {

   const body = {
    title:
     $('#downloadTitle').value,

    description:
     $('#downloadDescription').value,

    image_url:
     $('#downloadImage').value,

    download_url:
     $('#downloadUrl').value
   };

   const id =
    $('#downloadId').value;

   await api(
    '/api/admin/downloads' +
    (id ? '/' + id : ''),
    {
     method: id
      ? 'PATCH'
      : 'POST',

     body:
      JSON.stringify(body)
    }
   );

   $('#downloadDialog').close();

   await loadDownloads();

  } catch (e) {
   alert(e.message);
  }
 };

/* =========================
   ADMIN LICENSE CREATE
========================= */

function create(bulk = false) {

 $('#dialogTitle').textContent =
  bulk
   ? 'Tạo Key hàng loạt'
   : 'Tạo License Key';

 $('#count').value =
  bulk ? 10 : 1;

 $('#created').textContent = '';

 $('#dialog').showModal();
}

$('#form').onsubmit =
 async e => {

  e.preventDefault();

  try {

   const body = {
    count:
     +$('#count').value,

    duration_days:
     +$('#duration').value,

    note:
     $('#note').value
   };

   const d =
    body.count > 1
     ? await api(
        '/api/admin/licenses/bulk',
        {
         method: 'POST',
         body:
          JSON.stringify(body)
        }
       )
     : await api(
        '/api/admin/licenses',
        {
         method: 'POST',
         body:
          JSON.stringify(body)
        }
       );

   $('#created').textContent =
    d.licenses
     ? d.licenses
       .map(x => x.key)
       .join('\n')
     : d.license.key;

   await stats();
   await loadKeys();
   await logs();

  } catch (e) {
   alert(e.message);
  }
 };

$('#cancel').onclick =
 () => $('#dialog').close();

$('#quickCreate').onclick =
 () => create();

$('#createKey').onclick =
 () => create();

$('#bulkCreate').onclick =
 () => create(true);

$('#search').oninput =
 loadKeys;

$('#filter').onchange =
 loadKeys;

/* =========================
   COPY / LICENSE ACTIONS
========================= */

window.copyKey =
 async id => {

  const row =
   licenses.find(
    x => x.id === id
   );

  if (!row) return;

  try {

   await navigator.clipboard
    .writeText(row.key);

   alert('Đã sao chép key');

  } catch {

   prompt(
    'Sao chép key:',
    row.key
   );
  }
 };

window.toggleKey =
 async (id, status) => {

  await api(
   '/api/admin/licenses/' + id,
   {
    method: 'PATCH',
    body:
     JSON.stringify({ status })
   }
  );

  await stats();
  await loadKeys();
  await logs();
 };

window.resetHwid =
 async id => {

  if (!confirm('Reset HWID?'))
   return;

  await api(
   '/api/admin/licenses/' +
   id +
   '/reset-hwid',
   { method: 'POST' }
  );

  await loadKeys();
  await logs();
 };

window.delKey =
 async id => {

  if (!confirm('Xóa key?'))
   return;

  await api(
   '/api/admin/licenses/' + id,
   { method: 'DELETE' }
  );

  await stats();
  await loadKeys();
  await logs();
 };

/* =========================
   ADMIN NAV
========================= */

$$('.nav').forEach(b => {

 b.onclick = () => {

  $$('.nav').forEach(x =>
   x.classList.remove('active')
  );

  b.classList.add('active');

  $$('.page').forEach(x =>
   x.classList.add('hidden')
  );

  const page =
   $('#' + b.dataset.page);

  page.classList.remove('hidden');

  $('#title').textContent =
   b.textContent.trim();

  if (
   b.dataset.page === 'keys'
  )
   loadKeys();

  if (
   b.dataset.page === 'logs'
  )
   logs();

  if (
   b.dataset.page === 'downloads'
  )
   loadDownloads();
 };
});

$('#adminLogout').onclick =
 async () => {

  await api(
   '/api/admin/logout',
   { method: 'POST' }
  );

  currentUser = null;

  showPublic();
  showPublicPage('home');
 };

/* =========================
   ADMIN LOGS
========================= */

async function logs() {

 const d =
  await api('/api/admin/logs');

 $('#logsRows').innerHTML =
  d.map(x => `

   <tr>

    <td>
     ${esc(
      x.created_at
       .replace('T', ' ')
       .slice(0, 19)
     )}
    </td>

    <td>
     ${esc(x.action)}
    </td>

    <td>
     ${esc(x.key || '—')}
    </td>

    <td>
     ${esc(x.detail)}
    </td>

    <td>
     ${esc(x.ip)}
    </td>

   </tr>

  `).join('');
}

/* =========================
   START
========================= */

(async () => {

 await loadPublicDownloads();

 try {

  const user =
   await api('/api/auth/me');

  currentUser = user;

  if (
   user.role === 'admin'
  ) {
   showAdmin();

  } else if (
   user.role === 'guest'
  ) {
   showGuest();

  } else {
   showPublic();
  }

 } catch {

  showPublic();
  showPublicPage('home');
 }

})();