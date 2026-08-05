
(() => {
  'use strict';
  const configNode = document.getElementById('template-config');
  if (!configNode) return;
  let config;
  try { config = JSON.parse(configNode.textContent); } catch (error) { console.error('Invalid template config', error); return; }
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const get = (path) => path.split('.').reduce((value, key) => value == null ? undefined : value[key], config);
  const setTextSlots = () => all('[data-doflow-slot]').forEach((node) => {
    const path = node.dataset.doflowSlot;
    if (path.startsWith('images.') || path.startsWith('brand.logo') || path.startsWith('business.social')) return;
    const value = get(path);
    if (typeof value === 'string' || typeof value === 'number') node.textContent = String(value);
  });
  const applyPalette = () => Object.entries(config.palette || {}).forEach(([key, value]) => {
    const cssName = '--' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
    document.documentElement.style.setProperty(cssName, value);
  });
  const applyImage = (slot) => {
    const data = config.images?.[slot];
    all(`[data-image-slot="${slot}"]`).forEach((image) => {
      if (data?.src) { image.src = data.src; image.alt = data.alt || ''; image.hidden = false; }
      else { image.removeAttribute('src'); image.hidden = true; }
    });
  };
  const applyLogo = (slot) => {
    const data = config.images?.[slot];
    all(`[data-logo-slot="${slot}"]`).forEach((image) => {
      const brand = image.closest('.brand');
      if (data?.src) {
        image.src = data.src; image.alt = data.alt || config.brand?.name || 'Logo'; image.hidden = false;
        image.classList.add('is-visible'); brand?.classList.add('has-logo');
      } else { image.hidden = true; image.classList.remove('is-visible'); brand?.classList.remove('has-logo'); }
    });
  };
  const applySocials = () => all('[data-social-key]').forEach((link) => {
    const url = config.business?.[link.dataset.socialKey];
    if (url) { link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.hidden = false; }
    else { link.hidden = true; link.removeAttribute('href'); }
  });
  const validActionUrl = (value) => typeof value === 'string' && value.trim() && value !== '#';
  const applyContactLinks = () => {
    const phoneHref = config.business?.phoneHref || '';
    const whatsappHref = config.business?.whatsappHref || '';
    const emailHref = config.business?.email ? `mailto:${config.business.email}` : '';
    all('.phone-link').forEach(link => { link.href = phoneHref || '#contatti'; link.hidden = !validActionUrl(phoneHref); });
    all('.whatsapp-link').forEach(link => { link.href = whatsappHref || '#contatti'; link.hidden = !validActionUrl(whatsappHref); });
    all('.email-link,.footer-email').forEach(link => { link.href = emailHref || '#contatti'; });
    all('.footer-phone').forEach(link => { link.href = phoneHref || '#contatti'; });
    all('.header-cta,.hero .btn-dark,.consultation .text-link,.review-cta .btn,.process-btn,.footer-cta,.mobile-book').forEach(link => link.href = '#contatti');
    const developerLink = document.querySelector('.developer-credit');
    if (developerLink) developerLink.href = config.business?.developerUrl || 'https://doflow.it/';
  };
  const applyFeatures = () => {
    const features = config.features || {};
    document.body.dataset.pageMode = config.personalization?.pageMode || 'homepage';
    const setVisible = (selector, visible) => all(selector).forEach(node => node.hidden = !visible);
    setVisible('[data-feature="account"]', features.showAccount === true);
    setVisible('[data-feature="cart"]', features.showCart === true);
    setVisible('[data-optional-section="products"]', features.showProducts === true);
    setVisible('[data-optional-section="reviews"]', features.showReviews !== false);
    setVisible('[data-optional-section="faq"]', features.showFaq !== false);
    setVisible('[data-feature="contact-form"]', features.showContactForm !== false);
    setVisible('[data-feature="mobile-cta"]', features.showMobileCta !== false);
    setVisible('.review-demo-badge', (features.reviewsMode || 'demo') === 'demo');
    if ((features.reviewsMode || 'demo') !== 'demo') {
      all('.review-source').forEach(node => node.hidden = true);
      all('.read-more').forEach(node => node.textContent = 'Leggi di più');
    } else {
      all('.read-more').forEach(node => node.textContent = 'Contenuto di esempio');
    }
  };

  applyPalette();
  document.title = config.seo?.title || document.title;
  setTextSlots();
  ['hero','consultation','feature'].forEach(applyImage);
  ['logoDefault','logoLight'].forEach(applyLogo);
  applySocials();
  applyFeatures();
  applyContactLinks();

  const header = document.querySelector('.site-header');
  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
  updateHeader();
  window.addEventListener('scroll', updateHeader, {passive:true});

  const body = document.body;
  const trigger = document.querySelector('.menu-trigger');
  const panel = document.querySelector('.mobile-panel');
  const closeMenu = () => {
    body.classList.remove('menu-open');
    trigger?.setAttribute('aria-expanded','false');
    panel?.setAttribute('aria-hidden','true');
  };
  trigger?.addEventListener('click', () => {
    const open = !body.classList.contains('menu-open');
    body.classList.toggle('menu-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    panel?.setAttribute('aria-hidden', String(!open));
  });
  all('.mobile-panel a').forEach(link => link.addEventListener('click', closeMenu));

  all('.faq-question').forEach(button => button.addEventListener('click', () => {
    const item = button.closest('.faq-item');
    const willOpen = !item.classList.contains('open');
    all('.faq-item.open').forEach(openItem => {
      if (openItem !== item) { openItem.classList.remove('open'); openItem.querySelector('.faq-question')?.setAttribute('aria-expanded','false'); }
    });
    item.classList.toggle('open', willOpen);
    button.setAttribute('aria-expanded', String(willOpen));
  }));

  const track = document.getElementById('reviewsTrack');
  const distance = () => {
    const card = track?.querySelector('.review-card');
    if (!card || !track) return 417;
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || '22') || 22;
    return card.getBoundingClientRect().width + gap;
  };
  document.querySelector('.review-prev')?.addEventListener('click', () => track?.scrollBy({left:-distance(),behavior:'smooth'}));
  document.querySelector('.review-next')?.addEventListener('click', () => track?.scrollBy({left:distance(),behavior:'smooth'}));

  const form = document.getElementById('leadForm');
  const status = document.getElementById('formStatus');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    form.closest('.form-card')?.classList.add('form-success');
    if (status) status.textContent = config.content?.contact?.success || 'Richiesta dimostrativa acquisita.';
    form.reset();
  });

  all('a[href="#"]').forEach(link => link.addEventListener('click', event => event.preventDefault()));
})();
