// HighBrainnet — shared UI helpers (auth state, navbar, toast)

(function () {
  function bahts(n) {
    return '฿' + Number(n || 0).toLocaleString('th-TH');
  }

  function toast(message, type = 'info') {
    let root = document.getElementById('hbn-toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'hbn-toast-root';
      root.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;';
      document.body.appendChild(root);
    }
    const el = document.createElement('div');
    const bg = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#0f172a';
    el.style.cssText = `background:${bg};color:white;padding:.7rem 1rem;border-radius:.6rem;font-size:.875rem;max-width:360px;box-shadow:0 10px 25px -10px rgba(0,0,0,.3);opacity:0;transform:translateY(-6px);transition:all .2s;`;
    el.textContent = message;
    root.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(() => el.remove(), 200);
    }, 3500);
  }

  // Update navbar based on login state
  function renderAuthArea() {
    const user = window.HBN.api.currentUser();
    document.querySelectorAll('[data-auth-only]').forEach((el) => {
      el.style.display = user ? '' : 'none';
    });
    document.querySelectorAll('[data-guest-only]').forEach((el) => {
      el.style.display = user ? 'none' : '';
    });
    document.querySelectorAll('[data-user-name]').forEach((el) => {
      if (user) el.textContent = user.nickname || user.fullName || user.email;
    });
    document.querySelectorAll('[data-admin-only]').forEach((el) => {
      el.style.display = (user?.role === 'ADMIN') ? '' : 'none';
    });
    document.querySelectorAll('[data-logout]').forEach((el) => {
      el.onclick = (e) => { e.preventDefault(); window.HBN.api.logout(); };
    });
  }

  function levelName(key) {
    return ({
      PRIMARY: 'ประถมปลาย',
      JUNIOR:  'มัธยมต้น',
      SENIOR:  'มัธยมปลาย',
    })[key] || key || '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderAuthArea();
    if (window.HBN.cart) window.HBN.cart.bindCountBadge();
  });

  window.HBN = window.HBN || {};
  window.HBN.ui = { bahts, toast, renderAuthArea, levelName };
})();
