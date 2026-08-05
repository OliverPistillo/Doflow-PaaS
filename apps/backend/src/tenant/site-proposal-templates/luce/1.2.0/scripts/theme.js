
(() => {
  const get = (obj, path) => path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    const k = /^\d+$/.test(key) ? Number(key) : key;
    return acc[k];
  }, obj);
  let cfg = {};
  try { cfg = JSON.parse(document.getElementById('template-config').textContent); } catch (e) { console.error(e); }
  document.querySelectorAll('[data-doflow-slot]').forEach(el => {
    const value = get(cfg, el.dataset.doflowSlot);
    if (value === undefined || value === null) return;
    const attr = el.dataset.doflowAttr;
    if (attr) {
      if (value === '') return;
      el.setAttribute(attr, value);
      if (el.classList.contains('logo-image')) {
        el.hidden = false;
        const fallback = el.parentElement.querySelector('.logo-fallback');
        if (fallback) fallback.hidden = true;
      }
    } else {
      el.textContent = value;
    }
  });
  document.querySelectorAll('[data-config-href]').forEach(el => {
    const path = el.dataset.configHref;
    let value = get(cfg, path);
    if (!value) return;
    if (path.endsWith('.email') && !/^mailto:/i.test(value)) value = `mailto:${value}`;
    if ((path.endsWith('.phoneDisplay') || path.endsWith('.phoneHref')) && !/^tel:/i.test(value)) {
      value = `tel:${String(value).replace(/[^\d+]/g, '')}`;
    }
    el.href = value;
  });
  document.querySelectorAll('[data-feature]').forEach(el => {
    const enabled = get(cfg, `features.${el.dataset.feature}`);
    if (enabled === false) el.hidden = true;
  });
  const header = document.querySelector('.site-header');
  const syncHeader = () => header && header.classList.toggle('is-scrolled', window.scrollY > 18);
  syncHeader(); window.addEventListener('scroll', syncHeader, {passive:true});
  const menuButton = document.querySelector('.menu-toggle');
  const panel = document.querySelector('.mobile-panel');
  if (menuButton && panel) {
    menuButton.addEventListener('click', () => {
      const open = document.body.classList.toggle('menu-open');
      menuButton.setAttribute('aria-expanded', String(open));
      panel.setAttribute('aria-hidden', String(!open));
    });
    panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded','false'); panel.setAttribute('aria-hidden','true');
    }));
  }
  document.querySelectorAll('[data-demo-form]').forEach(form => form.addEventListener('submit', e => {
    e.preventDefault();
    const note = form.querySelector('.form-note');
    if (note) note.textContent = 'Modulo dimostrativo: collegare al CRM o al sistema di prenotazione.';
  }));

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
    }, {threshold:.12, rootMargin:'0px 0px -6% 0px'});
    revealItems.forEach(el => observer.observe(el));
  } else { revealItems.forEach(el => el.classList.add('is-visible')); }
})();
