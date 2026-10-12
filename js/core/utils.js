/* Общие помощники. Все модули сайта живут в глобальном объекте K,
   чтобы сайт открывался двойным кликом по index.html, без сервера. */
window.K = window.K || {};

(function (K) {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const icon = (name, cls = '') => `<svg class="icon ${cls}"><use href="#i-${name}"/></svg>`;

  // plural(5, ['бой', 'боя', 'боёв'])
  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONTHS_FULL = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  // Даты храним строкой YYYY-MM-DD
  const parseISO = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayISO = () => toISO(new Date());
  const fmtDateShort = s => { const d = parseISO(s); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '—'; };
  const fmtDateLong = s => { const d = parseISO(s); return d ? `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}` : '—'; };
  const fmtYearDay = s => { const d = parseISO(s); return d ? `${d.getFullYear()}, ${WEEKDAYS[d.getDay()]}` : ''; };
  const fmtDMY = s => { const d = parseISO(s); return d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}` : ''; };
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

  // Секунды → «2:00»
  const fmtClock = sec => { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  // «2:00», «90», «1.30» → секунды
  function parseClock(str) {
    const s = String(str).trim().replace(/[.,]/g, ':');
    if (/^\d+$/.test(s)) return +s;
    const m = s.match(/^(\d+):(\d{1,2})$/);
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }

  const fmtWeight = w => (w == null || isNaN(w)) ? '—' : (Math.round(w * 10) / 10).toFixed(1);
  const fmtWeightRu = w => fmtWeight(w).replace('.', ',');

  const params = () => Object.fromEntries(new URLSearchParams(location.search));
  const url = (page, p) => page + '?' + new URLSearchParams(Object.entries(p).filter(([, v]) => v != null && v !== '')).toString();

  const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // Буквы для ID боёв: A, B, … Z, AA, AB, …
  function letterFor(i) {
    let s = '';
    i += 1;
    while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }
  // Пользователь может набрать ID кириллицей: «А1» → «A1»
  const normalizeCode = s => String(s).trim().toUpperCase()
    .replace(/[АВЕКМНОРСТХ]/g, c => ({ А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X' }[c]))
    .replace(/\s+/g, '');

  /* ---------- Модальные окна ---------- */
  function openModal(el) {
    el.classList.add('open');
    const f = el.querySelector('[autofocus], input:not([type=checkbox]), select');
    if (f) setTimeout(() => f.focus(), 30);
  }
  function closeModal(el) { el.classList.remove('open'); }
  function bindModal(el) {
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-close]')) closeModal(el);
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal-backdrop.open').forEach(closeModal);
  });

  /* ---------- Уведомления ---------- */
  function toast(text, kind = '') {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = text;
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  function confirmBox(text) { return window.confirm(text); }

  /* ---------- Выпадающее меню ---------- */
  // items: [{label, icon, danger, onClick}] | 'sep'
  function menu(anchor, items) {
    closeMenus();
    const m = document.createElement('div');
    m.className = 'menu';
    m.innerHTML = items.map((it, i) => it === 'sep' ? '<div class="menu-sep"></div>'
      : `<button class="menu-item ${it.danger ? 'danger' : ''} ${it.active ? 'on' : ''}" data-i="${i}">${it.icon ? icon(it.icon, 'icon-sm') : ''}<span>${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`).join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const left = Math.min(r.left, window.innerWidth - m.offsetWidth - 8);
    m.style.left = left + 'px';
    m.style.top = (r.bottom + 6 + window.scrollY) + 'px';
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      closeMenus();
      items[+b.dataset.i].onClick();
    });
    setTimeout(() => document.addEventListener('click', closeMenus, { once: true }), 0);
  }
  function closeMenus() { $$('.menu').forEach(m => m.remove()); }

  // Сжимаем картинку обложки, чтобы она поместилась в localStorage
  function imageToDataURL(file, maxW = 800, maxH = 336) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result; };
      reader.onerror = reject;
      img.onload = () => {
        const k = Math.max(maxW / img.width, maxH / img.height);
        const c = document.createElement('canvas');
        c.width = maxW; c.height = maxH;
        const w = img.width * k, h = img.height * k;
        c.getContext('2d').drawImage(img, (maxW - w) / 2, (maxH - h) / 2, w, h);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  K.u = {
    $, $$, esc, icon, plural, parseISO, toISO, todayISO, fmtDateShort, fmtDateLong, fmtYearDay, fmtDMY, daysBetween,
    fmtClock, parseClock, fmtWeight, fmtWeightRu, params, url, debounce, letterFor, normalizeCode,
    openModal, closeModal, bindModal, toast, confirmBox, menu, closeMenus, imageToDataURL,
  };
})(window.K);
