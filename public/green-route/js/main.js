/* Green Route Costa Rica · main.js
   Handles: language toggle, mobile menu, header scroll, copyright year, smooth scroll, form. */

(function () {
  'use strict';

  const STORAGE_KEY = 'gr-lang';
  const DEFAULT_LANG = 'en';

  /* ---------- Copyright year ---------- */
  const yearEl = document.getElementById('copyrightYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Language toggle ---------- */
  const langToggle = document.getElementById('langToggle');
  const langFlag   = document.getElementById('langFlag');
  const langOther  = document.getElementById('langOther');

  function getInitialLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
    const browser = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (browser.startsWith('es')) return 'es';
    return DEFAULT_LANG;
  }

  function applyLang(lang) {
    const dict = window.GR_TRANSLATIONS && window.GR_TRANSLATIONS[lang];
    if (!dict) return;

    document.documentElement.setAttribute('lang', lang);

    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (dict[key] != null) {
        if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
          if (node.placeholder !== undefined) node.placeholder = dict[key];
        } else {
          node.textContent = dict[key];
        }
      }
    });

    if (langFlag && langOther) {
      langFlag.textContent  = lang === 'en' ? 'EN' : 'ES';
      langOther.textContent = lang === 'en' ? 'ES' : 'EN';
    }

    document.title = lang === 'es'
      ? 'Green Route Costa Rica · Tours Privados y Transporte'
      : 'Green Route Costa Rica · Private Tours & Transportation';

    localStorage.setItem(STORAGE_KEY, lang);
  }

  let currentLang = getInitialLang();
  applyLang(currentLang);

  if (langToggle) {
    langToggle.addEventListener('click', () => {
      currentLang = currentLang === 'en' ? 'es' : 'en';
      applyLang(currentLang);
    });
  }

  /* ---------- Header scroll state ---------- */
  const header = document.getElementById('siteHeader');
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 24) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');

  function closeMenu() {
    if (!menuBtn || !mobileMenu) return;
    menuBtn.classList.remove('open');
    mobileMenu.classList.remove('open');
    mobileMenu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  function openMenu() {
    if (!menuBtn || !mobileMenu) return;
    menuBtn.classList.add('open');
    mobileMenu.hidden = false;
    requestAnimationFrame(() => mobileMenu.classList.add('open'));
    menuBtn.setAttribute('aria-expanded', 'true');
  }

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const isOpen = menuBtn.classList.contains('open');
      isOpen ? closeMenu() : openMenu();
    });
    mobileMenu.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', closeMenu);
    });
  }

  /* ---------- Contact form (front-end only for now) ---------- */
  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = (data.get('name') || '').toString().trim();
      const message = (data.get('message') || '').toString().trim();
      const tour = (data.get('tour') || '').toString();
      const dates = (data.get('dates') || '').toString();
      const party = (data.get('party') || '').toString();

      const waMsg = encodeURIComponent(
        `Hi Randall, my name is ${name}.\nI'm interested in: ${tour}\nDates: ${dates}\nParty size: ${party}\n\n${message}`
      );
      window.open(`https://wa.me/50688888888?text=${waMsg}`, '_blank', 'noopener');
    });
  }

  /* ---------- Pay button placeholder (Stripe stub) ---------- */
  const payBtn = document.getElementById('payButton');
  if (payBtn) {
    payBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const lang = currentLang;
      alert(
        lang === 'es'
          ? 'El pago en línea con Stripe estará disponible pronto. Por favor contacta a Randall por WhatsApp para recibir un enlace de pago seguro.'
          : 'Online payment via Stripe is coming soon. Please contact Randall on WhatsApp to receive a secure payment link.'
      );
    });
  }

  /* ---------- Smooth-scroll offset for fixed header on anchor jumps ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const headerH = (header && header.offsetHeight) || 76;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH + 1;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
