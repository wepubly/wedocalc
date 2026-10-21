/* Theme switching only. Search and navigation intentionally have no handlers. */
(() => {
  const root = document.documentElement;
  const toggle = document.querySelector('.theme-toggle');
  function apply(theme) {
    const dark = theme === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('.header-logo img, .footer-logo img').forEach(image => {
      image.src = 'assets/images/wedocalc-logo-' + (dark ? 'dark' : 'light') + '.png';
    });
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    toggle.title = toggle.getAttribute('aria-label');
    toggle.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/></svg>';
  }
  let saved = 'light';
  try { saved = localStorage.getItem('wedocalc-theme') || 'light'; } catch {}
  apply(saved);
  toggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem('wedocalc-theme', next); } catch {}
  });
})();
