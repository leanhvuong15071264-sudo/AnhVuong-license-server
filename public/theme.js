(function () {
  const root = document.documentElement;
  const button = document.getElementById('themeToggle');
  const icon = document.getElementById('themeToggleIcon');
  const label = document.getElementById('themeToggleLabel');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem('anhvuong-theme', theme);

    if (theme === 'light') {
      icon.textContent = '☾';
      label.textContent = 'Giao diện tối';
      button.title = 'Chuyển sang giao diện tối';
    } else {
      icon.textContent = '☀';
      label.textContent = 'Giao diện sáng';
      button.title = 'Chuyển sang giao diện sáng';
    }
  }

  const saved = localStorage.getItem('anhvuong-theme');
  applyTheme(saved === 'light' ? 'light' : 'dark');

  button.addEventListener('click', function () {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
  });
})();