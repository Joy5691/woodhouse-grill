/* =========================================================
   WOODHOUSE GRILL — interactions & motion
   GSAP + ScrollTrigger on NATIVE scrolling (fast & smooth on every device)
   ========================================================= */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const MOBILE = window.matchMedia('(max-width: 760px)').matches;
  const D = window.WH;
  const fmt = n => typeof n === 'number' ? n.toLocaleString('en-US') : n;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);

  /* ---------------- scrolling helpers (native) ---------------- */
  const navH = () => ($('#nav') ? $('#nav').offsetHeight : 70);
  function scrollTo(target, opts = {}) {
    let y = typeof target === 'number' ? target : (typeof target === 'string' ? $(target) : target).getBoundingClientRect().top + window.scrollY + (opts.offset || 0);
    y = Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight));
    window.scrollTo({ top: y, behavior: REDUCE ? 'auto' : 'smooth' });
    if (opts.onComplete) {
      let done = false, last = -1, still = 0;
      const finish = () => { if (done) return; done = true; opts.onComplete(); };
      const check = () => { if (done) return; if (Math.abs(window.scrollY - last) < 1) { if (++still > 3) return finish(); } else still = 0; last = window.scrollY; requestAnimationFrame(check); };
      requestAnimationFrame(check); setTimeout(finish, 1800);
    }
  }

  /* =========================================================
     SMOKEHOUSE BENTO
     ========================================================= */
  (function bento() {
    const wrap = $('#smokeBento');
    D.smoked.forEach((s, i) => {
      const a = document.createElement('article');
      a.className = 'tile' + (i === 0 ? ' tile--lg' : '');
      a.setAttribute('data-jump', ''); a.dataset.item = s.id; a.tabIndex = 0; a.setAttribute('role', 'link');
      a.setAttribute('aria-label', `${s.name} — view price`);
      a.innerHTML = `
        <img loading="lazy" decoding="async" src="https://images.unsplash.com/photo-${s.img}?w=${i === 0 ? 1100 : 700}&q=72&auto=format&fit=crop" alt="${esc(s.name)}">
        <span class="tile__badge"><svg viewBox="0 0 64 64"><use href="#i-flame"/></svg>${s.id === 'duo' ? 'Sharing platter' : '6+ hrs smoked'}</span>
        <div class="tile__body">
          <span class="tile__w">${esc(s.weight)}</span>
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.desc)}</p>
          <span class="tile__price">View price <svg><use href="#i-arrow"/></svg></span>
        </div>`;
      wrap.appendChild(a);
    });
  })();

  /* =========================================================
     MENU & PRICES — compact: tabs, one category at a time,
     arrows / swipe to move, search across everything
     ========================================================= */
  const ICONS = {
    flame: '<svg viewBox="0 0 64 64"><use href="#i-flame" fill="currentColor"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><use href="#i-clock"/></svg>',
    smoke: '<svg viewBox="0 0 24 24"><path d="M8 20c-3 0-4-3-2-5s0-4-1-5M13 20c-3 0-4-3-2-5s0-4-1-5M18 20c-3 0-4-3-2-5s0-4-1-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    wave: '<svg viewBox="0 0 24 24"><path d="M2 12c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    chilli: '<svg viewBox="0 0 24 24"><path d="M15 6c3 1 5 4 3 8-2 5-9 8-14 7 5-2 8-6 8-11 0-2 1-3 3-4zM15 6c0-2 1-3 3-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    glass: '<svg viewBox="0 0 24 24"><path d="M6 3h12l-1 8a5 5 0 0 1-10 0zM12 16v5M8 21h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    cup: '<svg viewBox="0 0 24 24"><path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v2M12 3v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    drop: '<svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    search: '<svg viewBox="0 0 24 24"><use href="#i-search"/></svg>'
  };
  const M = { cat: D.menu[0].id, q: '' };
  // dish photos (cropped from the restaurant's own printed menu)
  const DISH_IMG = {
    ribeye: 'ribeye', tomahawk: 'tomahawk', picanha: 'picanha', hanger: 'hanger', sirloin: 'sirloin', rump: 'rump',
    tbone: 'eastL', cheese: 'eastR', philly: 'eastM', pepper: 'eastL', mushroom: 'eastM',
    broncho: 'broncho', shortFull: 'shortribs', shortHalf: 'shortribs', duo: 'duo', brisket1000: 'brisket', brisket500: 'brisket', austin: 'austin',
    surf: 'surf', surfjr: 'surfjr', pescado: 'pescado', fajitas: 'fajitas', hangman: 'hangman', rusty: 'rusty',
    trifle: 'trifle', brulee: 'brulee', churros: 'churros'
  };
  const SHORT = { west: 'West Texas', east: 'East Texas', smoke: 'Smokehouse', sea: 'Surf & Turf', texmex: 'Tex-Mex', dessert: 'Desserts', chillers: 'Chillers', coffee: 'Coffee', soda: 'Soda' };
  const catIndex = id => D.menu.findIndex(c => c.id === id);
  const itemHTML = (it, cat, q) => {
    let name = esc(it.name);
    if (q) { const i = it.name.toLowerCase().indexOf(q); if (i >= 0) name = esc(it.name.slice(0, i)) + '<mark>' + esc(it.name.slice(i, i + q.length)) + '</mark>' + esc(it.name.slice(i + q.length)); }
    // 3D-style render of every dish (pre-rendered, ~9 KB each — see tools/render-dishes.html)
    const thumb = `<button type="button" class="mitem__img" data-preview="${it.id}" data-title="${esc(it.name)}" aria-label="See ${esc(it.name)}"><img src="assets/dishes3d/${it.id}.webp" alt="" loading="lazy" decoding="async" width="80" height="80"></button>`;
    return `<li class="mitem" data-id="${it.id}">
      ${thumb}
      <h4 class="mitem__name">${name}${it.w ? `<span class="mitem__w">${esc(it.w)}</span>` : ''}${it.tag ? `<span class="mitem__tag">${esc(it.tag)}</span>` : ''}${q ? `<span class="mitem__cat">${esc(cat.title)}</span>` : ''}</h4>
      <span class="mitem__price"><small>৳</small>${fmt(it.p)}</span>
      ${it.d ? `<p class="mitem__d">${esc(it.d)}</p>` : ''}
    </li>`;
  };

  function paintMenu(dir = 0, animate = true) {
    const grid = $('#menuGrid'), q = M.q;
    let items, title, note, icon, count;
    if (q) {
      items = [];
      D.menu.forEach(c => c.items.forEach(it => { if ((it.name + ' ' + (it.w || '') + ' ' + (it.d || '') + ' ' + c.title).toLowerCase().includes(q)) items.push([it, c]); }));
      title = `Results for “${q}”`; note = `${items.length} dish${items.length === 1 ? '' : 'es'} across the menu`; icon = ICONS.search; count = '';
    } else {
      const c = D.menu[catIndex(M.cat)];
      items = c.items.map(it => [it, c]); title = c.title; note = c.note; icon = ICONS[c.icon] || ''; count = `${catIndex(M.cat) + 1} / ${D.menu.length}`;
    }
    const apply = () => {
      $('#mpTitle').textContent = title; $('#mpNote').textContent = note || ''; $('#mpIcon').innerHTML = icon; $('#mpCount').textContent = count;
      grid.innerHTML = items.map(([it, c]) => itemHTML(it, c, q)).join('');
      $('#menuEmpty').hidden = items.length > 0; $('#menuQ').textContent = q;
      $$('.mtab').forEach(t => t.setAttribute('aria-selected', String(!q && t.dataset.cat === M.cat)));
    };
    if (!animate || !window.gsap || REDUCE) { apply(); return; }
    gsap.to(grid, { opacity: 0, x: dir * -24, duration: .16, ease: 'power2.in', onComplete: () => {
      apply();
      gsap.fromTo(grid, { opacity: 0, x: dir * 24 }, { opacity: 1, x: 0, duration: .35, ease: 'power3.out' });
      gsap.fromTo($$('.mitem', grid), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .35, stagger: .025, ease: 'power2.out', clearProps: 'transform' });
    } });
  }
  function goCat(id, dir) {
    if (M.q) { M.q = ''; $('#menuSearch').value = ''; }
    if (id === M.cat && !dir) return paintMenu(0);
    const d = dir != null ? dir : Math.sign(catIndex(id) - catIndex(M.cat));
    M.cat = id; paintMenu(d);
  }
  function stepCat(d) { const i = (catIndex(M.cat) + d + D.menu.length) % D.menu.length; goCat(D.menu[i].id, d); }

  (function initMenu() {
    $('#menuTabs').innerHTML = D.menu.map(c => `<button type="button" role="tab" class="mtab" data-cat="${c.id}" aria-selected="false">${ICONS[c.icon] || ''}<span class="mtab__l">${esc(c.title)}</span><span class="mtab__s">${esc(SHORT[c.id] || c.title)}</span><i>${c.items.length}</i></button>`).join('');
    // photo preview
    const pv = document.createElement('div');
    pv.className = 'mpreview'; pv.hidden = true;
    pv.innerHTML = '<div class="mpreview__card" role="dialog" aria-modal="true"><img alt=""><p></p><button type="button" class="mpreview__x" aria-label="Close">×</button></div>';
    document.body.appendChild(pv);
    const closePv = () => { pv.classList.remove('is-open'); setTimeout(() => { pv.hidden = true; }, 250); };
    pv.addEventListener('click', e => { if (e.target === pv || e.target.closest('.mpreview__x')) closePv(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pv.hidden) closePv(); });
    $('#menuGrid').addEventListener('click', e => {
      const b = e.target.closest('[data-preview]'); if (!b) return;
      $('img', pv).src = `assets/dishes3d/${b.dataset.preview}.webp`; $('p', pv).textContent = b.dataset.title;
      pv.hidden = false; requestAnimationFrame(() => pv.classList.add('is-open'));
    });
    $('#sidesList').innerHTML = D.sides.map(s => `<li>${esc(s)}</li>`).join('');
    $('#saucesList').innerHTML = D.sauces.map(s => `<li>${esc(s)}</li>`).join('');
    paintMenu(0, false);
    $('#menuTabs').addEventListener('click', e => { const b = e.target.closest('.mtab'); if (b) goCat(b.dataset.cat); });
    $('#mpPrev').addEventListener('click', () => stepCat(-1));
    $('#mpNext').addEventListener('click', () => stepCat(1));
    // swipe between categories on touch screens
    const panel = $('#menuPanel'); let sx = 0, sy = 0, tracking = false;
    panel.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tracking = true; }, { passive: true });
    panel.addEventListener('touchend', e => {
      if (!tracking || M.q) return; tracking = false;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) stepCat(dx < 0 ? 1 : -1);
    }, { passive: true });
    const input = $('#menuSearch'); let tmr;
    input.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { M.q = input.value.trim().toLowerCase(); paintMenu(0); }, 120); });
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); scrollTo('#menu', { offset: -navH() + 4, onComplete: () => input.focus({ preventScroll: true }) }); }
    });
  })();
  function applySearch() {} // kept for compatibility

  /* =========================================================
     RESERVATION FORM
     ========================================================= */
  (function form() {
    const f = $('#reserveForm'); if (!f) return;
    const sel = f.elements.time;
    for (let m = 13 * 60; m <= 23 * 60; m += 30) {
      const h = Math.floor(m / 60), mm = m % 60, h12 = h > 12 ? h - 12 : h;
      const o = document.createElement('option'); o.value = o.textContent = `${h12}:${String(mm).padStart(2, '0')} PM`; sel.appendChild(o);
    }
    const d = f.elements.date, dk = new Date(Date.now() + 6 * 3600e3);
    d.min = dk.toISOString().slice(0, 10); d.value = d.min;
    let guests = 2; const out = $('#guestsOut');
    f.addEventListener('click', e => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      guests = Math.max(1, Math.min(40, guests + +b.dataset.g)); out.textContent = guests;
    });
    f.addEventListener('submit', e => {
      e.preventDefault();
      let ok = true;
      ['name', 'phone', 'date', 'time'].forEach(n => {
        const el = f.elements[n], bad = !el.value.trim() || (n === 'phone' && el.value.replace(/\D/g, '').length < 10);
        el.closest('.field').classList.toggle('is-error', bad); if (bad) ok = false;
      });
      const msg = $('#reserveMsg');
      if (!ok) { msg.textContent = 'Please add your name, phone, date and time.'; return; }
      const dt = new Date(d.value + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      const text = `Hello Woodhouse Grill! I'd like to reserve a table.\n\nName: ${f.elements.name.value}\nPhone: ${f.elements.phone.value}\nDate: ${dt}\nTime: ${sel.value}\nGuests: ${guests}` + (f.elements.notes.value ? `\nNotes: ${f.elements.notes.value}` : '');
      window.open(`https://wa.me/${D.whatsapp}?text=` + encodeURIComponent(text), '_blank', 'noopener');
      msg.textContent = 'Opening WhatsApp — just press send to confirm.';
    });
  })();

  /* =========================================================
     OPENING HOURS — live Dhaka clock, status, countdown, day picker
     ========================================================= */
  (function hours() {
    const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const JS2BD = [1, 2, 3, 4, 5, 6, 0]; // JS getUTCDay (Sun=0) -> index in DAYS (Sat first)
    const O = D.hours.open, C = D.hours.close;
    const wk = $('#week'), info = $('#weekInfo');
    let selected = null, todayIdx = 0;
    if (wk) wk.innerHTML = DAYS.map((d, i) => `<button type="button" role="tab" data-d="${i}" aria-selected="false">${d.slice(0, 3)}</button>`).join('');
    const fmt12 = (h, m) => { const hh = h % 12 || 12; return `${hh}:${String(m).padStart(2, '0')} ${h >= 12 && h < 24 ? 'PM' : 'AM'}`; };
    const dhaka = () => { const t = new Date(Date.now() + 6 * 3600e3); return { h: t.getUTCHours(), m: t.getUTCMinutes(), s: t.getUTCSeconds(), wd: JS2BD[t.getUTCDay()] }; };
    function dayInfo(i) {
      const name = DAYS[i];
      if (i === todayIdx) {
        const { h, m } = dhaka(), t = h + m / 60;
        const st = t >= O && t < C ? '<b>Open now</b> — kitchen fires until 12:00 AM' : t < O ? `<b>Opens today at 1:00 PM</b>` : '<b>Closed for tonight</b> — back tomorrow at 1:00 PM';
        return `Today (${name}): ${st}`;
      }
      return `<b>${name}</b>: open 1:00 PM – 12:00 AM. Walk in or reserve below.`;
    }
    function select(i) {
      selected = i;
      $$('button', wk).forEach(b => b.setAttribute('aria-selected', String(+b.dataset.d === i)));
      info.innerHTML = dayInfo(i);
    }
    wk && wk.addEventListener('click', e => { const b = e.target.closest('button'); if (b) select(+b.dataset.d); });

    function update() {
      const { h, m, wd } = dhaka(), t = h + m / 60;
      todayIdx = wd;
      const open = t >= O && t < C;
      const mins = open ? Math.round((C - t) * 60) : Math.round(((t < O ? O : O + 24) - t) * 60);
      const span = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      const text = open ? (mins <= 60 ? `Closing soon · in ${mins}m` : 'Open now · until 12 AM') : 'Closed now · opens 1 PM';
      $$('[data-live-text]').forEach(el => el.textContent = text);
      $$('[data-live-dot]').forEach(el => el.classList.toggle('is-closed', !open));
      const st = $('#liveStatus'); st && st.classList.toggle('is-closed', !open);
      const clock = $('#dhakaClock'); if (clock) clock.textContent = fmt12(h, m);
      const cnt = $('#hoursCount'); if (cnt) cnt.textContent = open ? `Kitchen closes in ${span}` : `Opens in ${span}`;
      const p = Math.max(0, Math.min(1, (t - O) / (C - O)));
      const fill = $('#hoursFill'), now = $('#hoursNow'), lbl = $('#hoursNowLbl');
      if (fill) fill.style.transform = `scaleX(${open ? p : 0})`;
      if (now) { now.style.display = open ? 'block' : 'none'; now.style.left = (p * 100) + '%'; }
      if (lbl) lbl.textContent = 'Now ' + fmt12(h, m);
      $$('button', wk).forEach(b => b.classList.toggle('is-today', +b.dataset.d === wd));
      if (selected === null) select(wd); else if (selected === wd) info.innerHTML = dayInfo(wd);
    }
    update(); setInterval(update, 30000);
  })();

  $('#copyAddr') && $('#copyAddr').addEventListener('click', async e => {
    const label = $('span', e.currentTarget);
    try { await navigator.clipboard.writeText(D.address); label.textContent = 'Copied!'; } catch (err) { label.textContent = 'Copy failed'; }
    setTimeout(() => { label.textContent = 'Copy address'; }, 1800);
  });
  $('#year').textContent = new Date().getFullYear();

  (function fitBadge() {
    const t = $('#badgeText'), p = $('#badgeCircle'); if (!t || !p) return;
    const fit = () => { t.style.letterSpacing = '0px'; const nat = t.getComputedTextLength(), n = t.textContent.length; if (nat && n) t.style.letterSpacing = Math.max(0, (p.getTotalLength() - nat) / n) + 'px'; };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(fit);
  })();

  /* ---------------- price jumps + back pill ---------------- */
  const back = $('#backpill');
  let backY = null, backTimer = null;
  function showBack(y) { backY = y; back.hidden = false; clearTimeout(backTimer); backTimer = setTimeout(hideBack, 15000); }
  function hideBack() { back.hidden = true; }
  back.addEventListener('click', () => { if (backY != null) scrollTo(backY); hideBack(); });
  function jumpToItem(id) {
    const from = window.scrollY, input = $('#menuSearch');
    // open the category that holds this dish (instantly), then scroll to it
    const cat = id && D.menu.find(c => c.items.some(it => it.id === id));
    if (input.value || (cat && cat.id !== M.cat)) { input.value = ''; M.q = ''; if (cat) M.cat = cat.id; paintMenu(0, false); }
    const el = id && $(`.mitem[data-id="${id}"]`);
    if (el) scrollTo(el, { offset: -(innerHeight / 2) + el.offsetHeight / 2, onComplete: () => { el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash'); } });
    else scrollTo('#menu', { offset: -navH() + 4 });
    if (from < $('#menu').getBoundingClientRect().top + window.scrollY - 200) showBack(from);
  }
  window.WHJump = jumpToItem;
  document.addEventListener('click', e => { const j = e.target.closest('[data-jump]'); if (!j) return; e.preventDefault(); jumpToItem(j.dataset.item); });
  document.addEventListener('keydown', e => { if (e.key !== 'Enter') return; const j = e.target.closest && e.target.closest('.tile[data-jump]'); if (j) jumpToItem(j.dataset.item); });

  /* ---------------- anchor links ---------------- */
  $$('[data-scroll]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); if (!id || id[0] !== '#') return;
    e.preventDefault(); closeMnav();
    if (id === '#top') return scrollTo(0);
    scrollTo(id, { offset: id === '#cuts' ? 0 : -navH() + 4 });
  }));

  /* ---------------- nav, progress, FAB (rAF-throttled) ---------------- */
  const nav = $('#nav'), progress = $('#scrollProgress'), fab = $('#fab'), burger = $('#burger'), mnav = $('#mnav');
  let lastY = 0, inMenu = false, inFooter = false, scrollVel = 0, sTick = false;
  function onScroll() {
    const y = window.scrollY;
    scrollVel = y - lastY;
    nav.classList.toggle('is-scrolled', y > 40);
    if (!html.classList.contains('mnav-open')) {
      if (y > lastY + 4 && y > 500) nav.classList.add('is-hidden');
      else if (y < lastY - 4) nav.classList.remove('is-hidden');
    }
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    fab.classList.toggle('is-on', y > innerHeight * .8 && !inMenu && !inFooter);
  }
  window.addEventListener('scroll', () => { if (sTick) return; sTick = true; requestAnimationFrame(() => { sTick = false; onScroll(); }); }, { passive: true });
  function closeMnav() { if (!mnav.classList.contains('is-open')) return; mnav.classList.remove('is-open'); html.classList.remove('mnav-open'); burger.setAttribute('aria-expanded', 'false'); mnav.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
  mnav.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeMnav(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMnav(); });

  /* ---------------- swipe carousels: touch, mouse-drag, arrows, dots ---------------- */
  function carousel(track) {
    if (!track) return;
    const cards = () => Array.from(track.children);
    const ctrl = document.createElement('div');
    ctrl.className = 'cnav';
    ctrl.innerHTML = '<button type="button" class="cnav__btn cnav__prev" aria-label="Previous"><svg><use href="#i-arrow"/></svg></button><div class="cnav__dots"></div><button type="button" class="cnav__btn cnav__next" aria-label="Next"><svg><use href="#i-arrow"/></svg></button>';
    track.after(ctrl);
    const dots = ctrl.querySelector('.cnav__dots');
    dots.innerHTML = cards().map((_, i) => `<button type="button" aria-label="Go to slide ${i + 1}"></button>`).join('');
    const pad = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const step = () => { const c = cards(); return c.length > 1 ? c[1].offsetLeft - c[0].offsetLeft : track.clientWidth; };
    const index = () => Math.round(track.scrollLeft / step());
    const go = i => { const c = cards(); i = Math.max(0, Math.min(c.length - 1, i)); track.scrollTo({ left: c[i].offsetLeft - pad() - (track.clientWidth - c[i].offsetWidth) / 2 + pad(), behavior: REDUCE ? 'auto' : 'smooth' }); };
    const sync = () => {
      const i = index();
      Array.from(dots.children).forEach((d, k) => d.classList.toggle('is-on', k === i));
      ctrl.querySelector('.cnav__prev').disabled = i <= 0;
      ctrl.querySelector('.cnav__next').disabled = i >= cards().length - 1;
    };
    let raf = 0; track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
    ctrl.querySelector('.cnav__prev').addEventListener('click', () => go(index() - 1));
    ctrl.querySelector('.cnav__next').addEventListener('click', () => go(index() + 1));
    dots.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(Array.from(dots.children).indexOf(b)); });
    // mouse drag (touch already scrolls natively)
    let down = false, moved = false, sx = 0, sl = 0;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || track.scrollWidth <= track.clientWidth) return;
      down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; track.classList.add('is-dragging');
    });
    window.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx; if (Math.abs(dx) > 5) moved = true;
      track.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return; down = false; track.classList.remove('is-dragging');
      if (moved) go(index());
    });
    track.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    track.addEventListener('dragstart', e => e.preventDefault());
    sync(); window.addEventListener('resize', sync);
  }
  carousel($('#smokeBento'));
  carousel($('.press__grid'));

  burger.addEventListener('click', () => {
    if (mnav.classList.contains('is-open')) return closeMnav();
    mnav.classList.add('is-open'); html.classList.add('mnav-open'); burger.setAttribute('aria-expanded', 'true'); mnav.setAttribute('aria-hidden', 'false'); nav.classList.remove('is-hidden'); document.body.style.overflow = 'hidden';
  });

  /* ---------------- no GSAP fallback ---------------- */
  if (!window.gsap || !window.ScrollTrigger) {
    $('#loader') && $('#loader').remove(); html.classList.remove('is-loading');
    document.dispatchEvent(new CustomEvent('wh:ready'));
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });
  ScrollTrigger.config({ ignoreMobileResize: true });

  ScrollTrigger.create({ trigger: '#menu', start: 'top 70%', end: 'bottom 30%', onToggle: s => { inMenu = s.isActive; onScroll(); if (!s.isActive && s.direction > 0) hideBack(); } });
  ScrollTrigger.create({ trigger: '.footer', start: 'top 85%', end: 'bottom top', onToggle: s => { inFooter = s.isActive; onScroll(); } });
  ['story', 'cuts', 'smokehouse', 'menu', 'visit'].forEach(id => ScrollTrigger.create({
    trigger: '#' + id, start: 'top 50%', end: 'bottom 50%',
    onToggle: s => { const a = $(`.nav__links a[href="#${id}"]`); a && a.classList.toggle('is-active', s.isActive); }
  }));

  /* ---------------- FX (light) ---------------- */
  const loaderEmbers = new FX.Embers($('#loaderEmbers'), { count: MOBILE ? 36 : 56, originX: .5, spread: 1.2, speed: .9 });
  const heroEmbers = new FX.Embers($('#heroEmbers'), { count: MOBILE ? 22 : 38, originX: .62, spread: 1.6, speed: .8 });
  const heroSmoke = new FX.Smoke($('#heroSmoke'), { count: MOBILE ? 5 : 8, alpha: .06 });
  const studioEmbers = new FX.Embers($('#studioEmbers'), { count: MOBILE ? 14 : 26, originX: .5, spread: 1.4, speed: .7 });
  const footerEmbers = new FX.Embers($('#footerEmbers'), { count: MOBILE ? 12 : 22, speed: .6, size: .9 });

  /* ---------------- split text ---------------- */
  function splitWords(el, wrap) {
    const walk = node => Array.from(node.childNodes).forEach(ch => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach(p => { if (!p) return; frag.appendChild(/^\s+$/.test(p) ? document.createTextNode(' ') : wrap(p)); });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
    });
    walk(el);
  }
  const maskWord = t => { const o = document.createElement('span'); o.className = 'sw'; const i = document.createElement('span'); i.className = 'si'; i.textContent = t; o.appendChild(i); return o; };
  const plainWord = t => { const s = document.createElement('span'); s.className = 'mw'; s.textContent = t; return s; };
  function splitChars(el) { const t = el.textContent; el.textContent = ''; [...t].forEach(ch => { const s = document.createElement('span'); s.className = 'sc'; s.textContent = ch; el.appendChild(s); }); return $$('.sc', el); }
  const heroChars = $$('.hero__line:not(.hero__line--italic) .hero__word').map(splitChars);
  $$('[data-split-lines]').forEach(el => splitWords(el, maskWord));
  $$('[data-words]').forEach(el => splitWords(el, plainWord));

  /* ---------------- HERO intro ---------------- */
  gsap.set(heroChars.flat(), { yPercent: 115 });
  gsap.set('.hero__line--italic .hero__word', { yPercent: 115 });
  gsap.set('[data-hero]', { opacity: 0, y: 26 });
  gsap.set('#heroImg', { scale: 1.2 });
  gsap.set('#nav', { yPercent: -120 });
  function heroIntro() {
    heroEmbers.start(); heroSmoke.start();
    return gsap.timeline()
      .to('#heroImg', { scale: 1, duration: 2.2, ease: 'expo.out' }, 0)
      .to(heroChars[0], { yPercent: 0, duration: 1, stagger: .035, ease: 'expo.out' }, .05)
      .to(heroChars[1], { yPercent: 0, duration: 1, stagger: .035, ease: 'expo.out' }, .15)
      .to('.hero__line--italic .hero__word', { yPercent: 0, duration: 1.1, ease: 'expo.out' }, .28)
      .to('[data-hero]', { opacity: 1, y: 0, duration: .9, stagger: .07 }, .35)
      .to('#nav', { yPercent: 0, duration: .9, ease: 'expo.out' }, .4);
  }

  /* ---------------- LOADER (logo animation) ---------------- */
  const loader = $('#loader');
  function runLoader() {
    const L = s => $(s, loader);
    const ring = L('.ll--ring'), spark = L('#ringSpark'), disc = L('.ll--disc'), flame = L('.ll--flame'),
      fork = L('.ll--fork'), knife = L('.ll--knife'), word = L('.ll--word'), line = L('.ll--line'),
      grill = L('.ll--grill'), shine = L('.ll-shine'), shock = L('.loader__shock'), halo = L('.loader__halo'),
      logo = L('#loaderLogo'), heat = L('.loader__heat'), countEl = L('#loaderCount'), bar = L('#loaderBar'),
      label = L('#loaderLabel'), edge = L('#loaderEdge');
    loaderEmbers.start();
    const imgs = $$('img', loader);
    let loaded = 0; const total = imgs.length + 1;
    imgs.forEach(i => { if (i.complete) loaded++; else i.addEventListener('load', () => loaded++, { once: true }), i.addEventListener('error', () => loaded++, { once: true }); });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => loaded++);
    const t0 = performance.now();
    const ringP = { a: 0 };
    const burstAt = (fx, fy, n, p) => { const r = logo.getBoundingClientRect(), e = $('#loaderEmbers').getBoundingClientRect(); loaderEmbers.burst(r.left - e.left + r.width * fx, r.top - e.top + r.height * fy, n, p); };
    const SPEED = 1.35; // faster build than before
    const tl = gsap.timeline();
    tl.to(heat, { opacity: 1, duration: 1.6, ease: 'power2.out' }, 0)
      .to(L('.loader__tag'), { opacity: 1, duration: 1 }, .2)
      .set(spark, { opacity: 1 }, .15)
      .to(ringP, { a: 360, duration: 1.15, ease: 'power2.inOut', onUpdate: () => { ring.style.setProperty('--a', ringP.a + 'deg'); spark.style.transform = `translate(-50%,-50%) rotate(${ringP.a - 90}deg)`; } }, .15)
      .to(spark, { opacity: 0, duration: .25 }, 1.2)
      .to(halo, { opacity: 1, scale: 1, duration: 1.4, ease: 'power2.out' }, .6)
      .to(disc, { clipPath: 'circle(75% at 49.5% 50.5%)', duration: .95, ease: 'power3.inOut' }, .75)
      .fromTo(flame, { opacity: 0, scaleY: 0, scaleX: .5 }, { opacity: 1, scaleY: 1, scaleX: 1, duration: .75, ease: 'back.out(2.4)', onStart: () => { label.textContent = 'Igniting the flame'; burstAt(.495, .3, 30, .7); }, onComplete: () => { gsap.set(flame, { clearProps: 'transform' }); flame.classList.add('is-live'); } }, 1.15)
      .fromTo(fork, { opacity: 0, xPercent: 30 }, { opacity: 1, xPercent: 0, duration: .8, ease: 'expo.out' }, 1.45)
      .fromTo(knife, { opacity: 0, xPercent: -30 }, { opacity: 1, xPercent: 0, duration: .8, ease: 'expo.out', onStart: () => { label.textContent = 'Sharpening the knives'; } }, 1.52)
      .to(fork, { yPercent: -1.4, duration: .07, yoyo: true, repeat: 1 }, 2.02)
      .to(knife, { yPercent: 1.4, duration: .07, yoyo: true, repeat: 1 }, 2.02)
      .fromTo(word, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1, duration: .5, ease: 'power4.in', onStart: () => { label.textContent = 'Branding the house'; } }, 2.05)
      .add(() => burstAt(.5, .61, 60, 1.1), 2.55)
      .to(logo, { keyframes: { x: [-9, 8, -6, 4, -2, 0], y: [5, -4, 3, -2, 1, 0] }, duration: .45, ease: 'none' }, 2.55)
      .to(line, { scaleX: 1, duration: .7, ease: 'expo.out' }, 2.6)
      .fromTo(grill, { opacity: 0, yPercent: 6 }, { opacity: 1, yPercent: 0, duration: .8, ease: 'power3.out' }, 2.72)
      .fromTo(shock, { opacity: 1, scale: .92 }, { opacity: 0, scale: 1.55, duration: 1.2, ease: 'expo.out', onStart: () => { label.textContent = 'Ready to serve'; } }, 3.05)
      .fromTo(shine, { opacity: 1, backgroundPosition: '130% 0' }, { backgroundPosition: '-40% 0', duration: 1.1, ease: 'power2.inOut' }, 3.1)
      .to(shine, { opacity: 0, duration: .2 }, 4.1);
    tl.timeScale(SPEED);
    const BUILD = 3.3 / SPEED;
    let shown = 0;
    const tick = (time, dtMs) => {
      const elapsed = (performance.now() - t0) / 1000;
      const target = Math.min(elapsed / BUILD, elapsed > 5 ? 1 : loaded / total) * 100;
      shown += (target - shown) * (1 - Math.pow(0.84, (dtMs || 16.7) / 16.7));
      if (target >= 100 && shown > 99.2) shown = 100;
      countEl.textContent = String(Math.floor(shown)).padStart(3, '0');
      bar.style.transform = `scaleX(${shown / 100})`;
      if (shown >= 100 && elapsed > BUILD + .35) { gsap.ticker.remove(tick); exit(); }
    };
    gsap.ticker.add(tick);
    function exit() {
      if (!location.hash) window.scrollTo(0, 0);
      document.body.appendChild(edge); Object.assign(edge.style, { position: 'fixed', zIndex: 1001 });
      gsap.set(loader, { clipPath: 'inset(0% 0% 0% 0%)' });
      gsap.timeline({ onComplete: () => { loader.remove(); edge.remove(); loaderEmbers.stop(); html.classList.remove('is-loading'); ScrollTrigger.refresh(); document.dispatchEvent(new CustomEvent('wh:ready')); } })
        .to(logo, { scale: .86, opacity: 0, duration: .55, ease: 'power3.in' }, 0)
        .to([L('.loader__meta'), L('.loader__bar'), L('.loader__tag')], { opacity: 0, duration: .3 }, 0)
        .set(edge, { opacity: 1 }, .35)
        .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: .95, ease: 'expo.inOut' }, .35)
        .fromTo(edge, { bottom: '0%' }, { bottom: '100%', duration: .95, ease: 'expo.inOut' }, .35)
        .to(edge, { opacity: 0, duration: .2 }, 1.2)
        .add(heroIntro(), .65);
    }
  }
  if (REDUCE || !loader) {
    loader && loader.remove(); html.classList.remove('is-loading');
    gsap.set(heroChars.flat().concat($$('.hero__line--italic .hero__word')), { yPercent: 0 });
    gsap.set('[data-hero]', { opacity: 1, y: 0 }); gsap.set('#heroImg', { scale: 1 }); gsap.set('#nav', { yPercent: 0 });
    setTimeout(() => document.dispatchEvent(new CustomEvent('wh:ready')), 50);
  } else runLoader();

  /* ---------------- scroll-linked motion (transform/opacity only) ---------------- */
  const heroST = { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: .4 };
  gsap.to('.hero__media', { yPercent: 12, ease: 'none', scrollTrigger: heroST });
  gsap.to('.hero__content', { yPercent: -14, opacity: .2, ease: 'none', scrollTrigger: heroST });
  ScrollTrigger.create({ trigger: '#hero', start: 'top top', end: 'bottom top', onToggle: s => { if (s.isActive) { heroEmbers.start(); heroSmoke.start(); } else { heroEmbers.stop(); heroSmoke.stop(); } } });

  $$('[data-split-lines]').forEach(el => gsap.from($$('.si', el), { yPercent: 110, duration: 1, stagger: .05, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
  gsap.set('[data-reveal]', { opacity: 0, y: 34 });
  ScrollTrigger.batch('[data-reveal]', { start: 'top 92%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: .9, stagger: .07, ease: 'expo.out' }) });
  $$('[data-words]').forEach(el => gsap.to($$('.mw', el), { opacity: 1, stagger: .12, ease: 'none', scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 50%', scrub: .5 } }));
  $$('[data-parallax]').forEach(img => gsap.fromTo(img, { yPercent: 0 }, { yPercent: +img.dataset.parallax, ease: 'none', scrollTrigger: { trigger: img.closest('[data-parallax-wrap]') || img, start: 'top bottom', end: 'bottom top', scrub: .4 } }));
  $$('[data-count]').forEach(el => {
    const to = +el.dataset.count, from = +(el.dataset.from || 0), o = { v: from }; el.textContent = from;
    ScrollTrigger.create({ trigger: el, start: 'top 94%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1.8, ease: 'expo.out', onUpdate: () => el.textContent = Math.round(o.v) }) });
  });
  ScrollTrigger.create({ trigger: '#cuts', start: 'top bottom', end: 'bottom top', onToggle: s => s.isActive ? studioEmbers.start() : studioEmbers.stop() });
  gsap.set('.tile', { opacity: 0, y: 40 });
  ScrollTrigger.batch('.tile', { start: 'top 94%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: .9, stagger: .07, ease: 'expo.out' }) });
  /* ---------------- footer doodle: letters pop out from below ---------------- */
  (function doodle() {
    const box = $('#doodle'), word = $('#doodleWord'); if (!word) return;
    const text = word.textContent.trim();
    word.innerHTML = [...text].map(ch => `<span class="dl"><span>${ch}</span></span>`).join('');
    const letters = $$('.dl', word);
    const fit = () => {
      word.style.fontSize = '100px';
      const w = word.scrollWidth, avail = box.clientWidth * .98;
      if (w) word.style.fontSize = Math.min(190, 100 * avail / w) + 'px';
    };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fit(); ScrollTrigger.refresh(); });
    window.addEventListener('resize', fit); fit();
    gsap.set(letters, { yPercent: 115, rotate: i => (i % 2 ? 14 : -14), scale: .7 });
    const pop = () => {
      box.classList.add('is-drawn');
      gsap.to(letters, { yPercent: 0, rotate: 0, scale: 1, duration: .9, ease: 'back.out(2.2)', stagger: { each: .06, from: 'center' }, overwrite: true });
    };
    const hide = () => {
      box.classList.remove('is-drawn');
      gsap.to(letters, { yPercent: 115, rotate: i => (i % 2 ? 14 : -14), scale: .7, duration: .4, ease: 'power2.in', overwrite: true });
    };
    ScrollTrigger.create({ trigger: box, start: 'top 92%', onEnter: pop, onLeaveBack: hide });
    // tap a letter on phones to make it jump
    letters.forEach(l => l.addEventListener('pointerdown', () => gsap.fromTo(l, { yPercent: 0 }, { yPercent: -22, duration: .18, yoyo: true, repeat: 1, ease: 'power2.out' })));
  })();
  ScrollTrigger.create({ trigger: '.footer', start: 'top bottom', onToggle: s => s.isActive ? footerEmbers.start() : footerEmbers.stop() });

  /* ---------------- marquee & reel loops (pause off-screen) ---------------- */
  function loopTrack(track, speed, dir) {
    const base = track.innerHTML;
    while (track.scrollWidth < innerWidth * 1.3) track.innerHTML += base;
    track.innerHTML += track.innerHTML;
    let x = 0, half = track.scrollWidth / 2, visible = false, boost = 0;
    window.addEventListener('resize', () => { half = track.scrollWidth / 2; });
    $$('img', track).forEach(i => i.addEventListener('load', () => { half = track.scrollWidth / 2; }));
    new IntersectionObserver(([e]) => visible = e.isIntersecting).observe(track);
    gsap.ticker.add((t, dt) => {
      if (!visible || REDUCE) return;
      boost += (Math.min(40, Math.abs(scrollVel)) * .25 - boost) * .1; scrollVel *= .9;
      x -= (speed + boost) * dir * (dt / 16.67);
      if (x <= -half) x += half; if (x > 0) x -= half;
      track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    });
  }
  loopTrack($('#marquee1'), 1, 1);
  $$('.reel__row').forEach(r => loopTrack($('.reel__track', r), .5, -(+r.dataset.dir)));

  /* ---------------- desktop niceties: cursor, magnetic, press tilt ---------------- */
  if (FINE && !REDUCE) {
    const cur = $('#cursor'), ring = $('.cursor__ring', cur), dot = $('.cursor__dot', cur), lab = $('#cursorLabel');
    const rx = gsap.quickTo(ring, 'x', { duration: .35, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: .35, ease: 'power3' });
    addEventListener('mousemove', e => { rx(e.clientX); ry(e.clientY); dot.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`; }, { passive: true });
    document.addEventListener('mouseleave', () => cur.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cur.classList.remove('is-hidden'));
    document.addEventListener('mouseover', e => {
      const t = e.target.closest('[data-cursor], a, button, .tile, input, select, .studio__stage');
      const isText = t && /INPUT|SELECT/.test(t.tagName);
      let label = (t && t.dataset.cursor) || '';
      if (!label && t && t.classList.contains('tile')) label = 'Price';
      if (!label && t && t.classList.contains('studio__stage')) label = 'Drag';
      cur.classList.toggle('is-hover', !!t && !isText);
      cur.classList.toggle('is-label', !!label); lab.textContent = label;
    });
    $$('[data-magnetic]').forEach(el => {
      const xTo = gsap.quickTo(el, 'x', { duration: .5, ease: 'elastic.out(1,.4)' }), yTo = gsap.quickTo(el, 'y', { duration: .5, ease: 'elastic.out(1,.4)' });
      el.addEventListener('mousemove', e => { const r = el.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * .22); yTo((e.clientY - r.top - r.height / 2) * .3); });
      el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
    });
    $$('[data-tilt]').forEach(el => {
      const rxT = gsap.quickTo(el, 'rotationX', { duration: .6, ease: 'power3' }), ryT = gsap.quickTo(el, 'rotationY', { duration: .6, ease: 'power3' });
      el.addEventListener('mousemove', e => { const r = el.getBoundingClientRect(); ryT(((e.clientX - r.left) / r.width - .5) * 8); rxT(-((e.clientY - r.top) / r.height - .5) * 6); });
      el.addEventListener('mouseleave', () => { rxT(0); ryT(0); });
    });
  }

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
