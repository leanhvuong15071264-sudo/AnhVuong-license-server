const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let licenses = [];
let currentUser = null;
let adminLoggedIn = false;


/* =========================
   API
========================= */

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
    throw new Error(data.error || data.message || 'Có lỗi xảy ra');
  }

  return data;
}


/* =========================
   UTILITIES
========================= */

function esc(value) {
  value = String(value == null ? '' : value);

  return value.replace(/[&<>"']/g, function (char) {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}


function showToast(message, type) {
  const toast = document.querySelector('#toast');

  if (!toast) {
    console.log(message);
    return;
  }

  if (!type) {
    type = 'normal';
  }

  toast.textContent = String(message == null ? '' : message);
  toast.className = 'show ' + type;

  setTimeout(function () {
    toast.className = '';
  }, 3000);
}


function formatDate(value) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch (error) {
    return String(value);
  }
}


/* =========================
   PUBLIC NAVIGATION
========================= */

function showPublicPage(page) {
  $$('.page').forEach(function (x) {
    x.classList.add('hidden');
  });

  const target = document.querySelector('#' + page + 'Page');

  if (target) {
    target.classList.remove('hidden');
  }

  $$('.nav-btn').forEach(function (btn) {
    btn.classList.toggle(
      'active',
      btn.dataset.page === page
    );
  });

  if (page === 'downloads') {
    loadPublicDownloads();
  }

  if (page === 'account') {
    loadAccount();
  }
}


$$('.nav-btn').forEach(function (button) {
  button.addEventListener('click', function () {
    showPublicPage(button.dataset.page);
  });
});


$$('[data-page-target]').forEach(function (button) {
  button.addEventListener('click', function () {
    showPublicPage(button.dataset.pageTarget);
  });
});


/* =========================
   DIALOGS
========================= */

function openDialog(id) {
  const dialog = document.querySelector('#' + id);

  if (dialog) {
    dialog.showModal();
  }
}


function closeDialog(id) {
  const dialog = document.querySelector('#' + id);

  if (dialog) {
    dialog.close();
  }
}


$$('[data-close]').forEach(function (button) {
  button.addEventListener('click', function () {
    closeDialog(button.dataset.close);
  });
});


/* =========================
   LOGIN
========================= */

const loginBtn = $('#loginBtn');

if (loginBtn) {
  loginBtn.onclick = function () {
    $('#loginMsg').textContent = '';
    $('#loginForm').reset();
    openDialog('loginDialog');
  };
}


const heroRegister = $('#heroRegister');

if (heroRegister) {
  heroRegister.onclick = function () {
    if (currentUser) {
      showPublicPage('account');
      return;
    }

    $('#registerMsg').textContent = '';
    $('#registerForm').reset();
    openDialog('registerDialog');
  };
}


const registerBtn = $('#registerBtn');

if (registerBtn) {
  registerBtn.onclick = function () {
    $('#registerMsg').textContent = '';
    $('#registerForm').reset();
    openDialog('registerDialog');
  };
}


const switchRegister = $('#switchRegister');

if (switchRegister) {
  switchRegister.onclick = function () {
    closeDialog('loginDialog');

    setTimeout(function () {
      openDialog('registerDialog');
    }, 150);
  };
}


const switchLogin = $('#switchLogin');

if (switchLogin) {
  switchLogin.onclick = function () {
    closeDialog('registerDialog');

    setTimeout(function () {
      openDialog('loginDialog');
    }, 150);
  };
}


const loginForm = $('#loginForm');

if (loginForm) {
  loginForm.onsubmit = async function (event) {
    event.preventDefault();

    const username = $('#loginUsername').value.trim();
    const password = $('#loginPassword').value;

    $('#loginMsg').textContent = 'Đang đăng nhập...';

    try {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username,
          password: password
        })
      });

      currentUser = result;

      closeDialog('loginDialog');

      updateUserUI();

      showToast(
        'Đăng nhập thành công. Xin chào ' +
        result.username +
        '!',
        'success'
      );

    } catch (error) {
      $('#loginMsg').textContent = error.message;
    }
  };
}


/* =========================
   REGISTER
========================= */

const registerForm = $('#registerForm');

if (registerForm) {
  registerForm.onsubmit = async function (event) {
    event.preventDefault();

    const username = $('#registerUsername').value.trim();
    const password = $('#registerPassword').value;

    $('#registerMsg').textContent = 'Đang tạo tài khoản...';

    try {
      const result = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: username,
          password: password
        })
      });

      currentUser = result;

      closeDialog('registerDialog');

      updateUserUI();

      showToast(
        'Đăng ký thành công!',
        'success'
      );

    } catch (error) {
      $('#registerMsg').textContent = error.message;
    }
  };
}


/* =========================
   USER UI
========================= */

function updateUserUI() {
  const guestActions = $('#guestActions');
  const userActions = $('#userActions');
  const accountNav = $('#accountNav');

  if (!currentUser) {
    if (guestActions) {
      guestActions.classList.remove('hidden');
    }

    if (userActions) {
      userActions.classList.add('hidden');
    }

    if (accountNav) {
      accountNav.classList.add('hidden');
    }

    return;
  }

  if (guestActions) {
    guestActions.classList.add('hidden');
  }

  if (userActions) {
    userActions.classList.remove('hidden');
  }

  if (accountNav) {
    accountNav.classList.remove('hidden');
  }

  const name = currentUser.username || 'User';
  const first = name.charAt(0).toUpperCase();

  if ($('#sideUsername')) {
    $('#sideUsername').textContent = name;
  }

  if ($('#userAvatar')) {
    $('#userAvatar').textContent = first;
  }

  if ($('#accountUsername')) {
    $('#accountUsername').textContent = name;
  }

  if ($('#accountNameInfo')) {
    $('#accountNameInfo').textContent = name;
  }

  if ($('#accountAvatar')) {
    $('#accountAvatar').textContent = first;
  }
}


/* =========================
   LOGOUT
========================= */

const logoutBtn = $('#logoutBtn');

if (logoutBtn) {
  logoutBtn.onclick = async function () {
    try {
      await api('/api/auth/logout', {
        method: 'POST'
      });

      currentUser = null;

      updateUserUI();

      showPublicPage('home');

      showToast(
        'Đã đăng xuất',
        'success'
      );

    } catch (error) {
      showToast(error.message, 'error');
    }
  };
}


/* =========================
   CURRENT USER
========================= */

async function checkUser() {
  try {
    const result = await api('/api/auth/me');

    currentUser = result;

    updateUserUI();

  } catch (error) {
    currentUser = null;

    updateUserUI();
  }
}


/* =========================
   PUBLIC DOWNLOADS
========================= */

async function getDownloads() {
  return await api('/api/downloads');
}


function downloadCard(item) {
  const image = item.image_url
    ? `
      <div class="download-image">
        <img
          src="${esc(item.image_url)}"
          alt="${esc(item.title)}"
          onerror="this.parentElement.classList.add('image-error')"
        >
      </div>
    `
    : `
      <div class="download-image no-image">
        <span>AV</span>
      </div>
    `;

  return `
    <article class="download-card">

      ${image}

      <div class="download-body">

        <div class="download-title-row">
          <h3>${esc(item.title)}</h3>
          <span class="download-badge">SOFTWARE</span>
        </div>

        <p>
          ${esc(item.description || 'Chưa có mô tả.')}
        </p>

        <button
          class="download-button"
          onclick="downloadItem(${item.id})"
        >
          <span>↓</span>
          Tải xuống
        </button>

      </div>

    </article>
  `;
}


async function loadPublicDownloads() {
  const containers = [
    $('#homeDownloads'),
    $('#downloadsList')
  ];

  containers.forEach(function (container) {
    if (container) {
      container.innerHTML = `
        <div class="loading-card">
          Đang tải dữ liệu...
        </div>
      `;
    }
  });

  try {
    const data = await getDownloads();

    const html = data.length
      ? data.map(downloadCard).join('')
      : `
        <div class="empty-card">
          Hiện chưa có phần mềm nào được đăng tải.
        </div>
      `;

    containers.forEach(function (container) {
      if (container) {
        container.innerHTML = html;
      }
    });

  } catch (error) {
    containers.forEach(function (container) {
      if (container) {
        container.innerHTML = `
          <div class="empty-card">
            Không thể tải danh sách.
          </div>
        `;
      }
    });
  }
}


/* =========================
   DOWNLOAD ACCESS
========================= */

window.downloadItem = async function (id) {
  if (!currentUser) {
    showToast(
      'Bạn cần đăng ký hoặc đăng nhập để tải xuống.',
      'error'
    );

    openDialog('loginDialog');

    return;
  }

  try {
    const result = await api(
      `/api/downloads/${id}/access`
    );

    if (result.download_url) {
      window.open(
        result.download_url,
        '_blank',
        'noopener'
      );

      showToast(
        'Đang mở link tải xuống...',
        'success'
      );
    }

  } catch (error) {
    if (
      error.message.includes('đăng nhập') ||
      error.message.includes('tài khoản')
    ) {
      currentUser = null;

      updateUserUI();

      openDialog('loginDialog');

      return;
    }

    showToast(
      error.message,
      'error'
    );
  }
};


/* =========================
   ACCOUNT
========================= */

async function loadAccount() {
  if (!currentUser) {
    showPublicPage('home');

    openDialog('loginDialog');

    return;
  }

  if ($('#accountUsername')) {
    $('#accountUsername').textContent =
      currentUser.username;
  }

  if ($('#accountNameInfo')) {
    $('#accountNameInfo').textContent =
      currentUser.username;
  }

  try {
    const logs = await api(
      '/api/account/logs'
    );

    if ($('#accountLogs')) {
      $('#accountLogs').innerHTML =
        logs.length
          ? logs.map(function (row) {
              return `
                <tr>
                  <td>${formatDate(row.created_at)}</td>
                  <td>${esc(row.action)}</td>
                  <td>${esc(row.detail || '—')}</td>
                  <td>${esc(row.ip || '—')}</td>
                </tr>
              `;
            }).join('')
          : `
            <tr>
              <td colspan="4">
                Chưa có hoạt động.
              </td>
            </tr>
          `;
    }

  } catch (error) {
    if ($('#accountLogs')) {
      $('#accountLogs').innerHTML = `
        <tr>
          <td colspan="4">
            Không thể tải nhật ký.
          </td>
        </tr>
      `;
    }
  }
}


/* =========================
   ADMIN LOGIN
========================= */

const adminBtn = $('#adminBtn');

if (adminBtn) {
  adminBtn.onclick = function () {
    if (adminLoggedIn) {
      showAdmin();
      return;
    }

    $('#adminLoginMsg').textContent = '';
    $('#adminLoginForm').reset();

    openDialog('adminLoginDialog');
  };
}


const adminLoginForm = $('#adminLoginForm');

if (adminLoginForm) {
  adminLoginForm.onsubmit = async function (event) {
    event.preventDefault();

    $('#adminLoginMsg').textContent =
      'Đang kiểm tra...';

    try {
      const result = await api(
        '/api/admin/login',
        {
          method: 'POST',
          body: JSON.stringify({
            username:
              $('#adminUsernameInput').value.trim(),

            password:
              $('#adminPasswordInput').value
          })
        }
      );

      adminLoggedIn = true;

      closeDialog('adminLoginDialog');

      showAdmin();

      showToast(
        'Đăng nhập Admin thành công',
        'success'
      );

    } catch (error) {
      $('#adminLoginMsg').textContent =
        error.message;
    }
  };
}


/* =========================
   SHOW ADMIN
========================= */

function showAdmin() {
  $('#publicApp').classList.add('hidden');
  $('#adminApp').classList.remove('hidden');

  loadAdminDashboard();
}


/* =========================
   BACK TO WEB
========================= */

const backToWeb = $('#backToWeb');

if (backToWeb) {
  backToWeb.onclick = function () {
    $('#adminApp').classList.add('hidden');
    $('#publicApp').classList.remove('hidden');

    showPublicPage('home');
  };
}


/* =========================
   ADMIN NAVIGATION
========================= */

$$('.admin-nav').forEach(function (button) {
  button.addEventListener('click', function () {
    const page = button.dataset.adminPage;

    $$('.admin-page').forEach(function (section) {
      section.classList.add('hidden');
    });

    const target = {
      dashboard: '#adminDashboard',
      keys: '#adminKeys',
      adminDownloads: '#adminDownloads',
      logs: '#adminLogs',
      api: '#adminApi'
    }[page];

    if (target) {
      const element = $(target);

      if (element) {
        element.classList.remove('hidden');
      }
    }

    $$('.admin-nav').forEach(function (x) {
      x.classList.remove('active');
    });

    button.classList.add('active');

    if (page === 'dashboard') {
      loadAdminDashboard();
    }

    if (page === 'keys') {
      loadKeys();
    }

    if (page === 'adminDownloads') {
      loadAdminDownloads();
    }

    if (page === 'logs') {
      loadAdminLogs();
    }
  });
});


/* =========================
   ADMIN DASHBOARD
========================= */

async function loadAdminDashboard() {
  try {
    const data =
      await api('/api/admin/stats');

    if ($('#sTotal')) {
      $('#sTotal').textContent =
        data.total ?? 0;
    }

    if ($('#sActive')) {
      $('#sActive').textContent =
        data.active ?? 0;
    }

    if ($('#sBanned')) {
      $('#sBanned').textContent =
        data.banned ?? 0;
    }

    if ($('#sBound')) {
      $('#sBound').textContent =
        data.bound ?? 0;
    }

  } catch (error) {
    if (error.message.includes('Admin')) {
      adminLoggedIn = false;
    }
  }
}


/* =========================
   ADMIN KEYS
========================= */

async function loadKeys() {
  try {
    const searchElement = $('#search');
    const filterElement = $('#filter');

    const searchValue =
      searchElement ? searchElement.value : '';

    const filterValue =
      filterElement ? filterElement.value : '';

    licenses = await api(
      '/api/admin/licenses?q=' +
      encodeURIComponent(searchValue) +
      '&status=' +
      encodeURIComponent(filterValue)
    );

    if (!$('#rows')) {
      return;
    }

    $('#rows').innerHTML =
      licenses.length
        ? licenses.map(function (row) {
            return `
              <tr>

                <td>
                  <code>${esc(row.key)}</code>

                  <button
                    class="small-btn copy-key"
                    onclick="copyKey(${row.id})"
                  >
                    Sao chép
                  </button>
                </td>

                <td>
                  <span class="status ${esc(row.status)}">
                    ${esc(row.status)}
                  </span>
                </td>

                <td>
                  ${
                    row.expires_at
                      ? formatDate(row.expires_at)
                      : 'Vĩnh viễn'
                  }
                </td>

                <td>
                  ${esc(row.hwid || '—')}
                </td>

                <td>
                  ${esc(row.note || '—')}
                </td>

                <td class="actions">

                  <button
                    class="small-btn"
                    onclick="toggleKey(
                      ${row.id},
                      '${row.status === 'banned' ? 'active' : 'banned'}'
                    )"
                  >
                    ${
                      row.status === 'banned'
                        ? 'Mở khóa'
                        : 'Khóa'
                    }
                  </button>

                  <button
                    class="small-btn"
                    onclick="resetHwid(${row.id})"
                  >
                    Reset HWID
                  </button>

                  <button
                    class="small-btn danger-btn"
                    onclick="deleteKey(${row.id})"
                  >
                    Xóa
                  </button>

                </td>

              </tr>
            `;
          }).join('')
        : `
          <tr>
            <td colspan="6">
              Chưa có key.
            </td>
          </tr>
        `;

  } catch (error) {
    showToast(
      error.message,
      'error'
    );
  }
}


const searchInput = $('#search');

if (searchInput) {
  searchInput.oninput = loadKeys;
}


const filterInput = $('#filter');

if (filterInput) {
  filterInput.onchange = loadKeys;
}


/* =========================
   COPY KEY
========================= */

window.copyKey = async function (id) {
  const row =
    licenses.find(function (x) {
      return x.id === id;
    });

  if (!row) {
    return;
  }

  try {
    await navigator.clipboard.writeText(
      row.key
    );

    showToast(
      'Đã sao chép key',
      'success'
    );

  } catch (error) {
    prompt(
      'Sao chép key:',
      row.key
    );
  }
};


/* =========================
   CREATE KEY
========================= */

function openLicenseForm(bulk) {
  if (!bulk) {
    bulk = false;
  }

  if ($('#licenseDialogTitle')) {
    $('#licenseDialogTitle').textContent =
      bulk
        ? 'Tạo License Key hàng loạt'
        : 'Tạo License Key';
  }

  if ($('#count')) {
    $('#count').value =
      bulk ? 10 : 1;
  }

  if ($('#created')) {
    $('#created').textContent = '';
  }

  openDialog('licenseDialog');
}


const quickCreate = $('#quickCreate');

if (quickCreate) {
  quickCreate.onclick =
    function () {
      openLicenseForm(false);
    };
}


const createKey = $('#createKey');

if (createKey) {
  createKey.onclick =
    function () {
      openLicenseForm(false);
    };
}


const bulkCreate = $('#bulkCreate');

if (bulkCreate) {
  bulkCreate.onclick =
    function () {
      openLicenseForm(true);
    };
}


const licenseCancel = $('#licenseCancel');

if (licenseCancel) {
  licenseCancel.onclick =
    function () {
      closeDialog('licenseDialog');
    };
}


const licenseForm = $('#licenseForm');

if (licenseForm) {
  licenseForm.onsubmit =
    async function (event) {
      event.preventDefault();

      const count =
        Number($('#count').value);

      const duration =
        Number($('#duration').value);

      const note =
        $('#note').value;

      try {
        const body = {
          count: count,
          duration_days: duration,
          note: note
        };

        const result =
          count > 1
            ? await api(
                '/api/admin/licenses/bulk',
                {
                  method: 'POST',
                  body: JSON.stringify(body)
                }
              )
            : await api(
                '/api/admin/licenses',
                {
                  method: 'POST',
                  body: JSON.stringify(body)
                }
              );

        if ($('#created')) {
          $('#created').textContent =
            result.licenses
              ? result.licenses
                  .map(function (x) {
                    return x.key;
                  })
                  .join('\n')
              : result.license.key;
        }

        await loadAdminDashboard();
        await loadKeys();

        showToast(
          'Tạo key thành công',
          'success'
        );

      } catch (error) {
        showToast(
          error.message,
          'error'
        );
      }
    };
}


/* =========================
   KEY ACTIONS
========================= */

window.toggleKey = async function (id, status) {
  try {
    await api(
      `/api/admin/licenses/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: status
        })
      }
    );

    await loadAdminDashboard();
    await loadKeys();
    await loadAdminLogs();

  } catch (error) {
    showToast(
      error.message,
      'error'
    );
  }
};


window.resetHwid = async function (id) {
  if (!confirm('Reset HWID của key này?')) {
    return;
  }

  try {
    await api(
      `/api/admin/licenses/${id}/reset-hwid`,
      {
        method: 'POST'
      }
    );

    await loadKeys();
    await loadAdminLogs();

    showToast(
      'Đã reset HWID',
      'success'
    );

  } catch (error) {
    showToast(
      error.message,
      'error'
    );
  }
};


window.deleteKey = async function (id) {
  if (!confirm('Xóa key này?')) {
    return;
  }

  try {
    await api(
      `/api/admin/licenses/${id}`,
      {
        method: 'DELETE'
      }
    );

    await loadAdminDashboard();
    await loadKeys();
    await loadAdminLogs();

    showToast(
      'Đã xóa key',
      'success'
    );

  } catch (error) {
    showToast(
      error.message,
      'error'
    );
  }
};


/* =========================
   ADMIN LOGS
========================= */

async function loadAdminLogs() {
  try {
    const data =
      await api('/api/admin/logs');

    if (!$('#logsRows')) {
      return;
    }

    $('#logsRows').innerHTML =
      data.length
        ? data.map(function (row) {
            return `
              <tr>
                <td>${formatDate(row.created_at)}</td>
                <td>${esc(row.action)}</td>
                <td>${esc(row.key || '—')}</td>
                <td>${esc(row.detail || '—')}</td>
                <td>${esc(row.ip || '—')}</td>
              </tr>
            `;
          }).join('')
        : `
          <tr>
            <td colspan="5">
              Chưa có nhật ký.
            </td>
          </tr>
        `;

  } catch (error) {
    showToast(
      error.message,
      'error'
    );
  }
}


/* =========================
   ADMIN DOWNLOADS
========================= */

async function loadAdminDownloads() {
  try {
    const data =
      await api('/api/admin/downloads');

    if (!$('#adminDownloadList')) {
      return;
    }

    $('#adminDownloadList').innerHTML =
      data.length
        ? data.map(function (item) {
            return `
              <article class="download-card">

                ${
                  item.image_url
                    ? `
                      <div class="download-image">
                        <img
                          src="${esc(item.image_url)}"
                          alt="${esc(item.title)}"
                        >
                      </div>
                    `
                    : `
                      <div class="download-image no-image">
                        <span>AV</span>
                      </div>
                    `
                }

                <div class="download-body">

                  <div class="download-title-row">
                    <h3>${esc(item.title)}</h3>

                    <span class="download-badge">
                      SOFTWARE
                    </span>
                  </div>

                  <p>
                    ${esc(
                      item.description ||
                      'Không có mô tả'
                    )}
                  </p>

                  <div class="admin-download-actions">

                    <button
                      class="small-btn"
                      onclick="editDownload(${item.id})"
                    >
                      Sửa
                    </button>

                    <button
                      class="small-btn danger-btn"
                      onclick="deleteDownload(${item.id})"
                    >
                      Xóa
                    </button>

                  </div>

                </div>

              </article>
            `;
          }).join('')
        : `
          <div class="empty-card">
            Chưa có mục tải xuống.
          </div>
        `;

  } catch (error) {
    showToast(
      error.message,
      'error'
    );
  }
}


function openDownloadForm(item) {
  if (!item) {
    item = null;
  }

  if ($('#downloadDialogTitle')) {
    $('#downloadDialogTitle').textContent =
      item
        ? 'Sửa mục tải xuống'
        : 'Thêm mục tải xuống';
  }

  if ($('#downloadId')) {
    $('#downloadId').value =
      item ? item.id : '';
  }

  if ($('#downloadTitle')) {
    $('#downloadTitle').value =
      item ? item.title : '';
  }

  if ($('#downloadDescription')) {
    $('#downloadDescription').value =
      item ? item.description : '';
  }

  if ($('#downloadImage')) {
    $('#downloadImage').value =
      item ? item.image_url : '';
  }

  if ($('#downloadUrl')) {
    $('#downloadUrl').value =
      item ? item.download_url : '';
  }

  openDialog('downloadDialog');
}


const addDownload = $('#addDownload');

if (addDownload) {
  addDownload.onclick =
    function () {
      openDownloadForm();
    };
}


const downloadCancel = $('#downloadCancel');

if (downloadCancel) {
  downloadCancel.onclick =
    function () {
      closeDialog('downloadDialog');
    };
}


const downloadForm = $('#downloadForm');

if (downloadForm) {
  downloadForm.onsubmit =
    async function (event) {
      event.preventDefault();

      const id =
        $('#downloadId').value;

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

      try {
        await api(
          '/api/admin/downloads' +
          (id ? `/${id}` : ''),
          {
            method: id ? 'PATCH' : 'POST',
            body: JSON.stringify(body)
          }
        );

        closeDialog('downloadDialog');

        await loadAdminDownloads();
        await loadPublicDownloads();

        showToast(
          id
            ? 'Đã cập nhật mục tải xuống'
            : 'Đã thêm mục tải xuống',
          'success'
        );

      } catch (error) {
        showToast(
          error.message,
          'error'
        );
      }
    };
}


window.editDownload = async function (id) {
  try {
    const data =
      await api('/api/admin/downloads');

    const item =
      data.find(function (x) {
        return x.id === id;
      });

    if (item) {
      openDownloadForm(item);
    }

  } catch (error) {
    showToast(
      error.message,
      'error'
    );
  }
};


window.deleteDownload = async function (id) {
  if (!confirm('Xóa mục tải xuống này?')) {
    return;
  }

  try {
    await api(
      `/api/admin/downloads/${id}`,
      {
        method: 'DELETE'
      }
    );

    await loadAdminDownloads();
    await loadPublicDownloads();

    showToast(
      'Đã xóa mục tải xuống',
      'success'
    );

  } catch (error) {
    showToast(
      error.message,
      'error'
    );
  }
};


/* =========================
   ADMIN LOGOUT
========================= */

const adminLogout = $('#adminLogout');

if (adminLogout) {
  adminLogout.onclick =
    async function () {
      try {
        await api(
          '/api/admin/logout',
          {
            method: 'POST'
          }
        );

        adminLoggedIn = false;

        $('#adminApp').classList.add('hidden');
        $('#publicApp').classList.remove('hidden');

        showPublicPage('home');

        showToast(
          'Đã đăng xuất Admin',
          'success'
        );

      } catch (error) {
        showToast(
          error.message,
          'error'
        );
      }
    };
}


/* =========================
   INIT
========================= */

(async function init() {
  await checkUser();
  await loadPublicDownloads();
})();