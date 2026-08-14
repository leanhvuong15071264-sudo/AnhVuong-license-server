const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

let licenses = [];
let currentUser = null;
let adminLoggedIn = false;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `HTTP ${response.status}`);
  }
  return data;
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

function showToast(message, type = 'normal') {
  const toast = $('#toast');
  if (!toast) { console.log(message); return; }
  toast.textContent = String(message || '');
  toast.className = `show ${type}`;
  setTimeout(() => { toast.className = ''; }, 3000);
}

function formatDate(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('vi-VN'); } catch { return String(value); }
}

function openDialog(id) {
  const dialog = $(`#${id}`);
  if (dialog && typeof dialog.showModal === 'function') { dialog.showModal(); }
}

function closeDialog(id) {
  const dialog = $(`#${id}`);
  if (dialog && dialog.open) { dialog.close(); }
}

$$('[data-close]').forEach((button) => {
  button.addEventListener('click', () => { closeDialog(button.dataset.close); });
});

function showPublicPage(page) {
  $$('.page').forEach((element) => { element.classList.add('hidden'); });
  const target = $(`#${page}Page`);
  if (target) { target.classList.remove('hidden'); }
  $$('.nav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === page);
  });
  if (page === 'downloads') { loadPublicDownloads(); }
  if (page === 'account') { loadAccount(); }
}

$$('.nav-btn').forEach((button) => {
  button.addEventListener('click', () => { showPublicPage(button.dataset.page); });
});

$$('[data-page-target]').forEach((button) => {
  button.addEventListener('click', () => { showPublicPage(button.dataset.pageTarget); });
});

const loginBtn = $('#loginBtn');
if (loginBtn) {
  loginBtn.onclick = () => {
    const msg = $('#loginMsg');
    if (msg) { msg.textContent = ''; }
    const form = $('#loginForm');
    if (form) { form.reset(); }
    openDialog('loginDialog');
  };
}

const registerBtn = $('#registerBtn');
if (registerBtn) {
  registerBtn.onclick = () => {
    const msg = $('#registerMsg');
    if (msg) { msg.textContent = ''; }
    const form = $('#registerForm');
    if (form) { form.reset(); }
    openDialog('registerDialog');
  };
}

const heroRegister = $('#heroRegister');
if (heroRegister) {
  heroRegister.onclick = () => {
    if (currentUser) { showPublicPage('account'); return; }
    const msg = $('#registerMsg');
    if (msg) { msg.textContent = ''; }
    const form = $('#registerForm');
    if (form) { form.reset(); }
    openDialog('registerDialog');
  };
}

const switchRegister = $('#switchRegister');
if (switchRegister) {
  switchRegister.onclick = () => {
    closeDialog('loginDialog');
    setTimeout(() => { openDialog('registerDialog'); }, 150);
  };
}

const switchLogin = $('#switchLogin');
if (switchLogin) {
  switchLogin.onclick = () => {
    closeDialog('registerDialog');
    setTimeout(() => { openDialog('loginDialog'); }, 150);
  };
}

const loginForm = $('#loginForm');
if (loginForm) {
  loginForm.onsubmit = async (event) => {
    event.preventDefault();
    const username = $('#loginUsername')?.value.trim() || '';
    const password = $('#loginPassword')?.value || '';
    const message = $('#loginMsg');
    if (message) { message.textContent = 'Đang đăng nhập...'; }
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      currentUser = result;
      closeDialog('loginDialog');
      updateUserUI();
      showToast(`Đăng nhập thành công. Xin chào ${result.username}!`, 'success');
    } catch (error) {
      if (message) { message.textContent = error.message; }
    }
  };
}

const registerForm = $('#registerForm');
if (registerForm) {
  registerForm.onsubmit = async (event) => {
    event.preventDefault();
    const username = $('#registerUsername')?.value.trim() || '';
    const password = $('#registerPassword')?.value || '';
    const message = $('#registerMsg');
    if (message) { message.textContent = 'Đang tạo tài khoản...'; }
    try {
      const result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
      currentUser = result;
      closeDialog('registerDialog');
      updateUserUI();
      showToast('Đăng ký thành công!', 'success');
    } catch (error) {
      if (message) { message.textContent = error.message; }
    }
  };
}

function updateUserUI() {
  const guestActions = $('#guestActions');
  const userActions = $('#userActions');
  const accountNav = $('#accountNav');
  if (!currentUser) {
    guestActions?.classList.remove('hidden');
    userActions?.classList.add('hidden');
    accountNav?.classList.add('hidden');
    return;
  }
  guestActions?.classList.add('hidden');
  userActions?.classList.remove('hidden');
  accountNav?.classList.remove('hidden');
  const name = currentUser.username || 'User';
  const first = name.charAt(0).toUpperCase();
  if ($('#sideUsername')) { $('#sideUsername').textContent = name; }
  if ($('#userAvatar')) { $('#userAvatar').textContent = first; }
  if ($('#accountUsername')) { $('#accountUsername').textContent = name; }
  if ($('#accountNameInfo')) { $('#accountNameInfo').textContent = name; }
  if ($('#accountAvatar')) { $('#accountAvatar').textContent = first; }
}

const logoutBtn = $('#logoutBtn');
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      currentUser = null;
      updateUserUI();
      showPublicPage('home');
      showToast('Đã đăng xuất', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };
}

async function checkUser() {
  try {
    const result = await api('/api/auth/me');
    currentUser = result;
  } catch {
    currentUser = null;
  }
  updateUserUI();
}

async function getDownloads() {
  return await api('/api/downloads');
}

function downloadCard(item) {
  const image = item.image_url
    ? `<div class="download-image"><img src="${esc(item.image_url)}" alt="${esc(item.title)}" loading="lazy" onerror="this.parentElement.classList.add('image-error')"></div>`
    : `<div class="download-image no-image"><div class="download-placeholder-logo"><img src="/logo.png" alt="AnhVuong"></div></div>`;
  const version = item.version || item.version_name || item.app_version || '—';
  const fileSize = item.file_size || item.size || '—';
  const updatedAt = item.updated_at || item.created_at || null;
  return `
    <article class="download-card">
      ${image}
      <div class="download-body">
        <div class="download-title-row">
          <h3>${esc(item.title)}</h3>
          <span class="download-badge">SOFTWARE</span>
        </div>
        <div class="download-description">${esc(item.description || 'Chưa có mô tả.')}</div>
        <div class="download-details">
          <div class="download-detail"><span class="detail-label">Sản phẩm</span><strong>${esc(item.title)}</strong></div>
          <div class="download-detail"><span class="detail-label">Phiên bản</span><strong>${esc(version)}</strong></div>
          <div class="download-detail"><span class="detail-label">Dung lượng</span><strong>${esc(fileSize)}</strong></div>
          <div class="download-detail"><span class="detail-label">Trạng thái</span><strong class="detail-status">Sẵn sàng</strong></div>
          ${updatedAt ? `<div class="download-detail"><span class="detail-label">Cập nhật</span><strong>${formatDate(updatedAt)}</strong></div>` : ''}
        </div>
        <div class="download-card-footer">
          <button class="download-button" type="button" onclick="downloadItem(${Number(item.id)})">
            <span class="download-button-icon">↓</span><span>Tải xuống</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

async function loadPublicDownloads() {
  const containers = [$('#homeDownloads'), $('#downloadsList')];
  containers.forEach((container) => {
    if (container) { container.innerHTML = `<div class="loading-card">Đang tải dữ liệu...</div>`; }
  });
  try {
    const data = await getDownloads();
    const html = data.length ? data.map(downloadCard).join('') : `<div class="empty-card">Hiện chưa có phần mềm nào được đăng tải.</div>`;
    containers.forEach((container) => {
      if (container) { container.innerHTML = html; }
    });
  } catch (error) {
    console.error(error);
    containers.forEach((container) => {
      if (container) { container.innerHTML = `<div class="empty-card">Không thể tải danh sách.</div>`; }
    });
  }
}

let currentDetailItem = null;

window.downloadItem = async function (id) {
  if (!currentUser) {
    showToast('Bạn cần đăng ký hoặc đăng nhập để tải xuống.', 'error');
    openDialog('loginDialog');
    return;
  }
  try {
    const data = await api('/api/downloads');
    const item = data.find(x => Number(x.id) === Number(id));
    if (!item) { showToast('Không tìm thấy sản phẩm.', 'error'); return; }
    currentDetailItem = item;

    const img = $('#detailImage');
    if (img) {
      img.src = item.image_url || '';
      img.alt = item.title || '';
      if (!item.image_url) { img.parentElement.classList.add('image-error'); } else { img.parentElement.classList.remove('image-error'); }
    }

    const breadcrumb = $('#detailTitleBreadcrumb');
    if (breadcrumb) breadcrumb.textContent = item.title || 'Sản phẩm';

    const title = $('#detailTitleNew');
    if (title) title.textContent = item.title || 'Không có tên';

    const price = $('#detailPriceNew');
    if (price) price.textContent = 'MIỄN PHÍ';

    const metaPrice = $('#detailMetaPrice');
    if (metaPrice) metaPrice.textContent = 'MIỄN PHÍ';

    const desc = $('#detailDescriptionNew');
    if (desc) desc.textContent = item.description || 'Tài khoản của bạn có quyền truy cập vào sản phẩm này.';

    const version = $('#detailMetaVersion');
    if (version) version.textContent = item.version || item.version_name || '—';

    const files = $('#detailMetaFiles');
    if (files) files.textContent = '1 tập tin';

    const discord = $('#detailMetaDiscord');
    if (discord) discord.textContent = 'Vai trò + kênh';

    const keyDisplay = $('#detailKeyDisplayNew');
    if (keyDisplay) keyDisplay.textContent = 'VNT-XXXX-XXXX-XXXX';

    const downloadBtn = $('#detailDownloadBtnNew');
    if (downloadBtn) {
      downloadBtn.dataset.url = item.download_url || '';
      downloadBtn.onclick = function () {
        const url = this.dataset.url;
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
          showToast('Đang mở link tải xuống...', 'success');
          closeDialog('downloadDetailDialog');
        } else {
          showToast('Không có link tải xuống.', 'error');
        }
      };
    }

    const keyInput = $('#detailKeyInput');
    if (keyInput) keyInput.value = '';

    const keyMsg = $('#detailKeyMsg');
    if (keyMsg) keyMsg.textContent = '';

    openDialog('downloadDetailDialog');

  } catch (error) {
    showToast(error.message, 'error');
  }
};

const detailKeySubmitNew = $('#detailKeySubmitNew');
if (detailKeySubmitNew) {
  detailKeySubmitNew.onclick = function () {
    const input = $('#detailKeyInput');
    const msg = $('#detailKeyMsg');
    const key = input?.value?.trim() || '';
    if (!key) { if (msg) msg.textContent = 'Vui lòng nhập mã khóa.'; return; }
    if (msg) {
      msg.textContent = '✅ Khóa hợp lệ! (tính năng demo)';
      msg.style.color = '#45e28b';
    }
  };
}

async function loadAccount() {
  if (!currentUser) { showPublicPage('home'); openDialog('loginDialog'); return; }
  if ($('#accountUsername')) { $('#accountUsername').textContent = currentUser.username; }
  if ($('#accountNameInfo')) { $('#accountNameInfo').textContent = currentUser.username; }
  try {
    const logs = await api('/api/account/logs');
    if ($('#accountLogs')) {
      $('#accountLogs').innerHTML = logs.length
        ? logs.map((row) => `
            <tr><td>${formatDate(row.created_at)}</td><td>${esc(row.action)}</td><td>${esc(row.detail || '—')}</td><td>${esc(row.ip || '—')}</td></tr>
          `).join('')
        : `<tr><td colspan="4">Chưa có hoạt động.</td></tr>`;
    }
  } catch {
    if ($('#accountLogs')) { $('#accountLogs').innerHTML = `<tr><td colspan="4">Không thể tải nhật ký.</td></tr>`; }
  }
}

const adminBtn = $('#adminBtn');
if (adminBtn) {
  adminBtn.onclick = async () => {
    if (adminLoggedIn) { showAdmin(); return; }
    try {
      const me = await api('/api/admin/me');
      if (me && me.role === 'admin') { adminLoggedIn = true; showAdmin(); return; }
    } catch {}
    const message = $('#adminLoginMsg');
    if (message) { message.textContent = ''; }
    const form = $('#adminLoginForm');
    if (form) { form.reset(); }
    openDialog('adminLoginDialog');
  };
}

const adminLoginForm = $('#adminLoginForm');
if (adminLoginForm) {
  adminLoginForm.onsubmit = async (event) => {
    event.preventDefault();
    const message = $('#adminLoginMsg');
    if (message) { message.textContent = 'Đang kiểm tra...'; }
    const username = $('#adminUsernameInput')?.value.trim() || '';
    const password = $('#adminPasswordInput')?.value || '';
    try {
      const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      if (!result || result.role !== 'admin') { throw new Error('Không xác nhận được quyền Admin'); }
      adminLoggedIn = true;
      closeDialog('adminLoginDialog');
      showAdmin();
      showToast('Đăng nhập Admin thành công', 'success');
    } catch (error) {
      if (message) { message.textContent = error.message; }
    }
  };
}

async function checkAdmin() {
  try {
    const result = await api('/api/admin/me');
    if (result && result.role === 'admin') { adminLoggedIn = true; return true; }
  } catch { adminLoggedIn = false; }
  return false;
}

function showAdmin() {
  const publicApp = $('#publicApp');
  const adminApp = $('#adminApp');
  if (publicApp) { publicApp.classList.add('hidden'); }
  if (adminApp) { adminApp.classList.remove('hidden'); }
  loadAdminDashboard();
}

const backToWeb = $('#backToWeb');
if (backToWeb) {
  backToWeb.onclick = () => {
    $('#adminApp')?.classList.add('hidden');
    $('#publicApp')?.classList.remove('hidden');
    showPublicPage('home');
  };
}

$$('.admin-nav').forEach((button) => {
  button.addEventListener('click', () => {
    const page = button.dataset.adminPage;
    $$('.admin-page').forEach((section) => { section.classList.add('hidden'); });
    const targets = { dashboard: '#adminDashboard', keys: '#adminKeys', adminDownloads: '#adminDownloads', logs: '#adminLogs', api: '#adminApi' };
    const target = targets[page];
    if (target) { $(target)?.classList.remove('hidden'); }
    $$('.admin-nav').forEach((item) => { item.classList.remove('active'); });
    button.classList.add('active');
    if (page === 'dashboard') { loadAdminDashboard(); }
    if (page === 'keys') { loadKeys(); }
    if (page === 'adminDownloads') { loadAdminDownloads(); }
    if (page === 'logs') { loadAdminLogs(); }
  });
});

async function loadAdminDashboard() {
  try {
    const data = await api('/api/admin/stats');
    if ($('#sTotal')) { $('#sTotal').textContent = data.total ?? 0; }
    if ($('#sActive')) { $('#sActive').textContent = data.active ?? 0; }
    if ($('#sBanned')) { $('#sBanned').textContent = data.banned ?? 0; }
    if ($('#sBound')) { $('#sBound').textContent = data.bound ?? 0; }
  } catch (error) {
    if (error.message.includes('Admin') || error.message.includes('đăng nhập')) { adminLoggedIn = false; }
    showToast(error.message, 'error');
  }
}

async function loadKeys() {
  try {
    const searchValue = $('#search')?.value || '';
    const filterValue = $('#filter')?.value || 'all';
    licenses = await api('/api/admin/licenses?q=' + encodeURIComponent(searchValue) + '&status=' + encodeURIComponent(filterValue));
    const rows = $('#rows');
    if (!rows) { return; }
    rows.innerHTML = licenses.length
      ? licenses.map((row) => {
          const nextStatus = row.status === 'banned' ? 'active' : 'banned';
          const buttonText = row.status === 'banned' ? 'Mở khóa' : 'Khóa';
          return `
            <tr>
              <td><code>${esc(row.key)}</code><button class="small-btn copy-key" onclick="copyKey(${Number(row.id)})">Sao chép</button></td>
              <td><span class="status ${esc(row.status)}">${esc(row.status)}</span></td>
              <td>${row.expires_at ? formatDate(row.expires_at) : 'Vĩnh viễn'}</td>
              <td>${esc(row.hwid || '—')}</td>
              <td>${esc(row.note || '—')}</td>
              <td class="actions">
                <button class="small-btn" onclick="toggleKey(${Number(row.id)}, '${nextStatus}')">${buttonText}</button>
                <button class="small-btn" onclick="resetHwid(${Number(row.id)})">Reset HWID</button>
                <button class="small-btn danger-btn" onclick="deleteKey(${Number(row.id)})">Xóa</button>
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="6">Chưa có key.</td></tr>`;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

const searchInput = $('#search');
if (searchInput) { searchInput.oninput = loadKeys; }
const filterInput = $('#filter');
if (filterInput) { filterInput.onchange = loadKeys; }

window.copyKey = async function (id) {
  const row = licenses.find((item) => Number(item.id) === Number(id));
  if (!row) { return; }
  try {
    await navigator.clipboard.writeText(row.key);
    showToast('Đã sao chép key', 'success');
  } catch {
    prompt('Sao chép key:', row.key);
  }
};

function openLicenseForm(bulk = false) {
  if ($('#licenseDialogTitle')) { $('#licenseDialogTitle').textContent = bulk ? 'Tạo License Key hàng loạt' : 'Tạo License Key'; }
  if ($('#count')) { $('#count').value = bulk ? 10 : 1; }
  if ($('#created')) { $('#created').textContent = ''; }
  openDialog('licenseDialog');
}

const quickCreate = $('#quickCreate');
if (quickCreate) { quickCreate.onclick = () => openLicenseForm(false); }
const createKey = $('#createKey');
if (createKey) { createKey.onclick = () => openLicenseForm(false); }
const bulkCreate = $('#bulkCreate');
if (bulkCreate) { bulkCreate.onclick = () => openLicenseForm(true); }
const licenseCancel = $('#licenseCancel');
if (licenseCancel) { licenseCancel.onclick = () => closeDialog('licenseDialog'); }

const licenseForm = $('#licenseForm');
if (licenseForm) {
  licenseForm.onsubmit = async (event) => {
    event.preventDefault();
    const count = Math.max(1, Number($('#count')?.value || 1));
    const duration = Math.max(0, Number($('#duration')?.value || 0));
    const note = $('#note')?.value || '';
    try {
      const body = { count, duration_days: duration, note };
      let result;
      if (count > 1) {
        result = await api('/api/admin/licenses/bulk', { method: 'POST', body: JSON.stringify(body) });
      } else {
        result = await api('/api/admin/licenses', { method: 'POST', body: JSON.stringify(body) });
      }
      if ($('#created')) {
        if (result.licenses) { $('#created').textContent = result.licenses.map((item) => item.key).join('\n'); } else if (result.license) { $('#created').textContent = result.license.key; }
      }
      await loadAdminDashboard();
      await loadKeys();
      showToast('Tạo key thành công', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };
}

window.toggleKey = async function (id, status) {
  try {
    await api(`/api/admin/licenses/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await loadAdminDashboard();
    await loadKeys();
    await loadAdminLogs();
    showToast('Đã cập nhật trạng thái key', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.resetHwid = async function (id) {
  if (!confirm('Reset HWID của key này?')) { return; }
  try {
    await api(`/api/admin/licenses/${id}/reset-hwid`, { method: 'POST' });
    await loadKeys();
    await loadAdminLogs();
    showToast('Đã reset HWID', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.deleteKey = async function (id) {
  if (!confirm('Xóa key này?')) { return; }
  try {
    await api(`/api/admin/licenses/${id}`, { method: 'DELETE' });
    await loadAdminDashboard();
    await loadKeys();
    await loadAdminLogs();
    showToast('Đã xóa key', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

async function loadAdminLogs() {
  try {
    const data = await api('/api/admin/logs');
    const rows = $('#logsRows');
    if (!rows) { return; }
    rows.innerHTML = data.length
      ? data.map((row) => `
          <tr><td>${formatDate(row.created_at)}</td><td>${esc(row.action)}</td><td>${esc(row.key || '—')}</td><td>${esc(row.detail || '—')}</td><td>${esc(row.ip || '—')}</td></tr>
        `).join('')
      : `<tr><td colspan="5">Chưa có nhật ký.</td></tr>`;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadAdminDownloads() {
  try {
    const data = await api('/api/admin/downloads');
    const list = $('#adminDownloadList');
    if (!list) { return; }
    list.innerHTML = data.length
      ? data.map((item) => `
          <article class="download-card">
            ${item.image_url ? `<div class="download-image"><img src="${esc(item.image_url)}" alt="${esc(item.title)}" onerror="this.parentElement.classList.add('image-error')"></div>` : `<div class="download-image no-image"><span>AV</span></div>`}
            <div class="download-body">
              <div class="download-title-row"><h3>${esc(item.title)}</h3><span class="download-badge">SOFTWARE</span></div>
              <div class="download-description">${esc(item.description || 'Không có mô tả')}</div>
              <div class="download-details">
                <div class="download-detail"><span class="detail-label">Sản phẩm</span><strong>${esc(item.title)}</strong></div>
                <div class="download-detail"><span class="detail-label">Phiên bản</span><strong>—</strong></div>
                <div class="download-detail"><span class="detail-label">Dung lượng</span><strong>—</strong></div>
                <div class="download-detail"><span class="detail-label">Trạng thái</span><strong class="detail-status">Sẵn sàng</strong></div>
                ${item.updated_at ? `<div class="download-detail"><span class="detail-label">Cập nhật</span><strong>${formatDate(item.updated_at)}</strong></div>` : ''}
              </div>
              <div class="admin-download-actions">
                <button class="small-btn" onclick="editDownload(${Number(item.id)})">Sửa</button>
                <button class="small-btn danger-btn" onclick="deleteDownload(${Number(item.id)})">Xóa</button>
              </div>
            </div>
          </article>
        `).join('')
      : `<div class="empty-card">Chưa có mục tải xuống.</div>`;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function openDownloadForm(item = null) {
  if ($('#downloadDialogTitle')) { $('#downloadDialogTitle').textContent = item ? 'Sửa mục tải xuống' : 'Thêm mục tải xuống'; }
  if ($('#downloadId')) { $('#downloadId').value = item?.id || ''; }
  if ($('#downloadTitle')) { $('#downloadTitle').value = item?.title || ''; }
  if ($('#downloadDescription')) { $('#downloadDescription').value = item?.description || ''; }
  if ($('#downloadImage')) { $('#downloadImage').value = item?.image_url || ''; }
  if ($('#downloadUrl')) { $('#downloadUrl').value = item?.download_url || ''; }
  openDialog('downloadDialog');
}

const addDownload = $('#addDownload');
if (addDownload) { addDownload.onclick = () => openDownloadForm(); }

const downloadCancel = $('#downloadCancel');
if (downloadCancel) { downloadCancel.onclick = () => closeDialog('downloadDialog'); }

const downloadForm = $('#downloadForm');
if (downloadForm) {
  downloadForm.onsubmit = async (event) => {
    event.preventDefault();
    const id = $('#downloadId')?.value || '';
    const body = {
      title: $('#downloadTitle')?.value || '',
      description: $('#downloadDescription')?.value || '',
      image_url: $('#downloadImage')?.value || '',
      download_url: $('#downloadUrl')?.value || ''
    };
    try {
      await api('/api/admin/downloads' + (id ? `/${id}` : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      closeDialog('downloadDialog');
      await loadAdminDownloads();
      await loadPublicDownloads();
      showToast(id ? 'Đã cập nhật mục tải xuống' : 'Đã thêm mục tải xuống', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };
}

window.editDownload = async function (id) {
  console.log('editDownload called with id:', id);
  try {
    const data = await api('/api/admin/downloads');
    console.log('downloads data:', data);
    const item = data.find((x) => Number(x.id) === Number(id));
    if (item) { openDownloadForm(item); } else { showToast('Không tìm thấy mục này', 'error'); }
  } catch (error) {
    console.error(error);
    showToast(error.message, 'error');
  }
};

window.deleteDownload = async function (id) {
  if (!confirm('Xóa mục tải xuống này?')) { return; }
  try {
    await api(`/api/admin/downloads/${id}`, { method: 'DELETE' });
    await loadAdminDownloads();
    await loadPublicDownloads();
    showToast('Đã xóa mục tải xuống', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

const adminLogout = $('#adminLogout');
if (adminLogout) {
  adminLogout.onclick = async () => {
    try {
      await api('/api/admin/logout', { method: 'POST' });
      adminLoggedIn = false;
      $('#adminApp')?.classList.add('hidden');
      $('#publicApp')?.classList.remove('hidden');
      showPublicPage('home');
      showToast('Đã đăng xuất Admin', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };
}

(async function init() {
  await checkUser();
  await checkAdmin();
  await loadPublicDownloads();
})();