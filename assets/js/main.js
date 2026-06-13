// HighBrainnet — Shared interactions
document.addEventListener('DOMContentLoaded', () => {
  // ----- Mobile menu -----
  const menuBtn = document.querySelector('[data-menu-toggle]');
  const menu    = document.querySelector('[data-mobile-menu]');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => menu.classList.toggle('hidden'));
  }

  // ----- Tabs -----
  document.querySelectorAll('[data-tabs]').forEach(group => {
    const btns   = group.querySelectorAll('[data-tab]');
    const panels = document.querySelectorAll(`[data-panel][data-group="${group.dataset.tabs}"]`);
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;
        document.querySelector(`[data-panel="${target}"][data-group="${group.dataset.tabs}"]`)?.classList.add('active');
      });
    });
  });

  // ----- Accordion -----
  document.querySelectorAll('.accordion-header').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
  });

  // ----- Modal triggers -----
  document.querySelectorAll('[data-modal-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.modalOpen;
      document.getElementById(id)?.classList.add('open');
    });
  });
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-backdrop')?.classList.remove('open'));
  });
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
  });

  // ----- Star rating filter -----
  document.querySelectorAll('[data-star-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-star-filter]').forEach(b => b.classList.remove('active', 'border-brand', 'text-brand'));
      btn.classList.add('active', 'border-brand', 'text-brand');
    });
  });

  // ----- Quantity controls (cart) -----
  document.querySelectorAll('[data-qty-inc]').forEach(b => {
    b.addEventListener('click', () => {
      const inp = b.parentElement.querySelector('input');
      inp.value = parseInt(inp.value || '1') + 1;
    });
  });
  document.querySelectorAll('[data-qty-dec]').forEach(b => {
    b.addEventListener('click', () => {
      const inp = b.parentElement.querySelector('input');
      inp.value = Math.max(1, parseInt(inp.value || '1') - 1);
    });
  });

  // ----- Slip file preview -----
  const slipInput = document.getElementById('slipFile');
  const slipPreview = document.getElementById('slipPreview');
  if (slipInput && slipPreview) {
    slipInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => {
          slipPreview.src = ev.target.result;
          slipPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // ----- Quiz interactions -----
  document.querySelectorAll('[data-quiz-option]').forEach(opt => {
    opt.addEventListener('click', () => {
      const q = opt.dataset.quizQ;
      document.querySelectorAll(`[data-quiz-q="${q}"]`).forEach(o => {
        o.classList.remove('border-brand', 'bg-brand-soft');
      });
      opt.classList.add('border-brand', 'bg-brand-soft');
    });
  });

  // ----- Lucide icons -----
  if (window.lucide) window.lucide.createIcons();
});
