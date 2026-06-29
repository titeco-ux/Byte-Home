'use strict';
/* ==========================================================================
   ByteNana Design System — INTERACTIONS & ANIMATIONS
   Vanilla JS, no dependencies. Each block is a self-contained IIFE and
   no-ops if its markup is absent — safe to load on any page.

   Modules:
     A. Floating navbar (scroll state + collapse/expand) + mobile menu
     B. Rotating headline
     C. Tabbed orbit (tech stack tabs)
     D. Step carousel (slide + flip) with dots / swipe / auto-advance
     E. Molecular globe hub(s)  [data-globe]
     F. Forms (validation + Netlify POST) + booking modal
   All motion respects prefers-reduced-motion.
   ========================================================================== */

const SCROLL_THRESHOLD = 60;
function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

/* ---- A. Navbar + mobile menu ------------------------------------------- */
(function () {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const navToggle  = document.getElementById('nav-toggle');
  const painSection = document.querySelector('[data-nav-collapse-anchor]') || document.getElementById('pain');

  function setNavExpanded(on) {
    navbar.classList.toggle('expanded', on);
    if (navToggle) navToggle.setAttribute('aria-expanded', String(on));
  }
  function handleNavbarScroll() {
    const y = window.scrollY;
    navbar.classList.toggle('scrolled', y > SCROLL_THRESHOLD);
    const collapsePoint = painSection ? painSection.offsetTop - 140 : Infinity;
    const shouldCollapse = y >= collapsePoint;
    navbar.classList.toggle('collapsed', shouldCollapse);
    if (!shouldCollapse) setNavExpanded(false);
  }
  function closeMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    if (navbar.classList.contains('collapsed')) setNavExpanded(false);
  }
  function toggleMobileMenu() {
    if (!mobileMenu) return;
    const isOpen = mobileMenu.classList.toggle('open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', String(isOpen));
    if (navbar.classList.contains('collapsed')) setNavExpanded(isOpen);
  }

  if (navToggle) navToggle.addEventListener('click', (e) => { e.stopPropagation(); setNavExpanded(!navbar.classList.contains('expanded')); });
  if (menuToggle) menuToggle.addEventListener('click', toggleMobileMenu);
  navbar.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', () => setNavExpanded(false)));
  document.querySelectorAll('.mobile-menu a').forEach((l) => l.addEventListener('click', closeMobileMenu));
  document.addEventListener('click', (e) => {
    if (navbar.contains(e.target)) return;
    if (navbar.classList.contains('expanded')) setNavExpanded(false);
    closeMobileMenu();
  });
  window.addEventListener('scroll', debounce(handleNavbarScroll, 10));
  window.addEventListener('resize', debounce(handleNavbarScroll, 50));
  document.addEventListener('DOMContentLoaded', handleNavbarScroll);

  // expose for the booking module
  window.__bnCloseMobileMenu = closeMobileMenu;
})();

/* ---- B. Rotating headline ---------------------------------------------- */
(function () {
  const list = document.querySelector('.rotator__list');
  if (!list) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const rotator = list.parentElement;
  const items = list.children;
  const HOLD = 2200, SLIDE = 600, EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  let index = 0, step = 0;

  function lockHeight() {
    rotator.style.height = 'auto';
    for (let i = 0; i < items.length; i++) items[i].style.height = 'auto';
    let max = 0;
    for (let i = 0; i < items.length; i++) max = Math.max(max, items[i].offsetHeight);
    for (let i = 0; i < items.length; i++) items[i].style.height = max + 'px';
    rotator.style.height = max + 'px';
    step = max;
  }
  function advance() {
    index++;
    list.style.transition = 'transform ' + SLIDE + 'ms ' + EASE;
    list.style.transform = 'translateY(' + (-index * step) + 'px)';
    if (index === items.length - 1) {              // landed on the clone of item 1
      setTimeout(() => { list.style.transition = 'none'; index = 0; list.style.transform = 'translateY(0)'; }, SLIDE);
    }
  }
  lockHeight();
  window.addEventListener('resize', () => { list.style.transition = 'none'; lockHeight(); list.style.transform = 'translateY(' + (-index * step) + 'px)'; });
  setInterval(advance, HOLD + SLIDE);
})();

/* ---- C. Tabbed orbit (tech stack) -------------------------------------- */
(function () {
  const tabs = Array.prototype.slice.call(document.querySelectorAll('.stack-tab'));
  const panels = Array.prototype.slice.call(document.querySelectorAll('.stack-panel'));
  if (!tabs.length || !panels.length) return;

  function select(i) {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
    });
    panels.forEach((p, k) => {
      const on = k === i;
      p.classList.remove('is-active');
      p.hidden = !on;
      if (on) { void p.offsetWidth; p.classList.add('is-active'); }   // restart fade-in
    });
  }
  tabs.forEach((t, k) => {
    t.addEventListener('click', () => select(k));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); const n = (k + 1) % tabs.length; select(n); tabs[n].focus(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); const p = (k - 1 + tabs.length) % tabs.length; select(p); tabs[p].focus(); }
    });
  });
  select(0);
})();

/* ---- D. Step carousel -------------------------------------------------- */
(function () {
  const roots = Array.prototype.slice.call(document.querySelectorAll('.steps-carousel'));
  if (!roots.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  roots.forEach((root) => {
    const track = root.querySelector('.steps-track');
    const slides = Array.prototype.slice.call(root.querySelectorAll('.step'));
    const dots = Array.prototype.slice.call(root.querySelectorAll('.steps-dot'));
    const prevBtn = root.querySelector('[data-step-prev]');
    const nextBtn = root.querySelector('[data-step-next]');
    if (!track || slides.length < 2) return;

    const DWELL = 4500;
    let index = 0, timer = null;

    function lockHeight() {
      let max = 0;
      slides.forEach((s) => { max = Math.max(max, s.offsetHeight); });
      if (max) track.style.minHeight = max + 'px';
    }
    function render() {
      slides.forEach((s, i) => s.classList.toggle('is-active', i === index));
      dots.forEach((d, i) => { d.classList.toggle('is-active', i === index); d.setAttribute('aria-selected', i === index ? 'true' : 'false'); });
    }
    function go(i) { index = (i + slides.length) % slides.length; render(); }
    function start() { if (reduce) return; stop(); timer = setInterval(() => go(index + 1), DWELL); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    dots.forEach((d, i) => d.addEventListener('click', () => { go(i); start(); }));
    if (prevBtn) prevBtn.addEventListener('click', () => { go(index - 1); start(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { go(index + 1); start(); });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);

    const swipeArea = root.querySelector('.steps-viewport') || root;
    swipeArea.style.touchAction = 'pan-y';
    let startX = 0, startY = 0, swiping = false;
    swipeArea.addEventListener('pointerdown', (e) => { startX = e.clientX; startY = e.clientY; swiping = true; stop(); });
    swipeArea.addEventListener('pointerup', (e) => {
      if (!swiping) return; swiping = false;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
      start();
    });
    swipeArea.addEventListener('pointercancel', () => { swiping = false; start(); });

    window.addEventListener('resize', lockHeight);
    window.addEventListener('load', lockHeight);
    lockHeight(); render(); start();
  });
})();

/* ---- E. Molecular globe hub(s) ----------------------------------------- */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D2R = Math.PI / 180;
  // default bond list for a 25-node CTA hub; override per-hub with data-edges="0-1,0-2,..."
  const CTA_EDGES = [
    [0,1],[0,2],[0,3],[0,4],[1,2],[2,3],[3,5],[4,5],[1,6],[2,7],[3,8],[5,9],[4,10],[0,11],
    [11,12],[11,13],[11,14],[11,15],[11,16],[12,13],[14,15],
    [10,17],[4,17],[8,18],[13,18],[18,19],[19,20],[7,20],[3,20],
    [5,21],[15,21],[9,22],[12,22],[21,22],[2,23],[5,23],[10,24],[1,24],[17,24]
  ];

  function initGlobe(hub) {
    const canvas = hub.querySelector('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const nodes = Array.prototype.slice.call(hub.querySelectorAll('.hub-node')).map((el) => ({
      el, lon: parseFloat(el.dataset.lon) * D2R, lat: parseFloat(el.dataset.lat) * D2R, sx: 0, sy: 0, z: 0
    }));
    const edges = hub.dataset.edges ? hub.dataset.edges.split(',').map((s) => s.split('-').map(Number)) : CTA_EDGES;
    const bond = (getComputedStyle(hub).getPropertyValue('--bond').trim() || '242, 183, 5');
    const spin = parseFloat(hub.dataset.spin || '0.00018');
    const rFactor = parseFloat(hub.dataset.radius || '0.336');
    // Optional dashed bonds: data-dash="alt" (every other edge) or a comma list of edge indices.
    const dashRaw = (hub.dataset.dash || '').trim();
    let isDashed = function () { return false; };
    if (dashRaw === 'alt') isDashed = function (i) { return i % 2 === 1; };
    else if (dashRaw) { const set = new Set(dashRaw.split(',').map(Number)); isDashed = function (i) { return set.has(i); }; }
    let w = 0, h = 0, cx = 0, cy = 0, R = 0, pxr = 1;

    function resize() {
      pxr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = hub.getBoundingClientRect();
      w = rect.width; h = rect.height;
      if (!w || !h) return;
      canvas.width = Math.round(w * pxr); canvas.height = Math.round(h * pxr);
      ctx.setTransform(pxr, 0, 0, pxr, 0, 0);
      cx = w / 2; cy = h / 2; R = Math.min(w, h) * rFactor;
    }
    function frame(t) {
      const rot = t * spin;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const theta = n.lon + rot, cosLat = Math.cos(n.lat);
        const x = cosLat * Math.sin(theta), y = Math.sin(n.lat), z = cosLat * Math.cos(theta);
        n.sx = cx + x * R; n.sy = cy - y * R; n.z = z;
        const depth = (z + 1) / 2;
        n.el.style.left = n.sx + 'px';
        n.el.style.top = n.sy + 'px';
        n.el.style.setProperty('--s', (0.5 + 0.6 * depth).toFixed(3));
        n.el.style.opacity = (0.12 + 0.88 * depth).toFixed(3);
        n.el.style.zIndex = String(Math.round(depth * 100));
      }
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.2;
      for (let e = 0; e < edges.length; e++) {
        const a = nodes[edges[e][0]], b = nodes[edges[e][1]];
        if (!a || !b) continue;
        const vis = ((a.z + 1) / 2 + (b.z + 1) / 2) / 2;
        ctx.setLineDash(isDashed(e) ? [5, 5] : []);
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
        ctx.strokeStyle = 'rgba(' + bond + ', ' + (0.06 + 0.34 * vis).toFixed(3) + ')';
        ctx.stroke();
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', () => { resize(); if (reduce) frame(0); });
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => { resize(); if (reduce) frame(0); }); ro.observe(hub); }
    if (reduce) frame(0); else requestAnimationFrame(frame);
  }
  /* Icosahedron mode: data-globe data-shape="ico".
     12 icon nodes sit on the vertices. Edges on the silhouette draw as a thick
     solid outline; interior/back edges draw dashed. Front faces fill at 10%. */
  function initIco(hub) {
    const canvas = hub.querySelector('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const nodes = Array.prototype.slice.call(hub.querySelectorAll('.hub-node'));

    const PHI = (1 + Math.sqrt(5)) / 2;
    const NRM = Math.hypot(1, PHI, 0);
    const V = [
      [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
      [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
      [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]
    ].map((v) => [v[0] / NRM, v[1] / NRM, v[2] / NRM]);
    const F = [
      [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
      [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
      [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
      [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
    ];
    // unique edges, each tagged with its two adjacent face indices
    const emap = new Map();
    F.forEach((f, fi) => {
      for (let i = 0; i < 3; i++) {
        const a = f[i], b = f[(i + 1) % 3];
        const key = a < b ? a + '_' + b : b + '_' + a;
        if (!emap.has(key)) emap.set(key, { a: Math.min(a, b), b: Math.max(a, b), faces: [] });
        emap.get(key).faces.push(fi);
      }
    });
    const E = Array.from(emap.values());

    const spin = parseFloat(hub.dataset.spin || '0.00018');
    const rFactor = parseFloat(hub.dataset.radius || '0.40');
    const bond = (getComputedStyle(hub).getPropertyValue('--bond').trim() || '242, 183, 5');
    const TILT = 0.40;                       // fixed pitch so the 3D form reads
    let w = 0, h = 0, cx = 0, cy = 0, R = 0, pxr = 1;
    const rot = [];

    function resize() {
      pxr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = hub.getBoundingClientRect();
      w = rect.width; h = rect.height;
      if (!w || !h) return;
      canvas.width = Math.round(w * pxr); canvas.height = Math.round(h * pxr);
      ctx.setTransform(pxr, 0, 0, pxr, 0, 0);
      cx = w / 2; cy = h / 2; R = Math.min(w, h) * rFactor;
    }
    function frame(t) {
      const ay = t * spin, cYaw = Math.cos(ay), sYaw = Math.sin(ay);
      const cT = Math.cos(TILT), sT = Math.sin(TILT);
      for (let i = 0; i < 12; i++) {
        const v = V[i];
        const x1 = v[0] * cYaw + v[2] * sYaw;     // yaw about Y
        const z1 = -v[0] * sYaw + v[2] * cYaw;
        const y1 = v[1] * cT - z1 * sT;            // tilt about X
        const z2 = v[1] * sT + z1 * cT;
        rot[i] = [x1, y1, z2];
      }
      const P = rot.map((v) => [cx + v[0] * R, cy - v[1] * R, v[2]]);
      // icon nodes on the vertices
      for (let i = 0; i < nodes.length && i < 12; i++) {
        const depth = (rot[i][2] + 1) / 2;
        nodes[i].style.left = P[i][0] + 'px';
        nodes[i].style.top = P[i][1] + 'px';
        nodes[i].style.setProperty('--s', (0.55 + 0.55 * depth).toFixed(3));
        nodes[i].style.opacity = (0.2 + 0.8 * depth).toFixed(3);
        nodes[i].style.zIndex = String(Math.round(depth * 100));
      }
      // front-facing test via outward normal (CCW faces) toward viewer (+z)
      const front = F.map((f) => {
        const A = rot[f[0]], B = rot[f[1]], C = rot[f[2]];
        const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
        const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
        return (ux * vy - uy * vx) > 0;            // z of (u × v)
      });
      ctx.clearRect(0, 0, w, h);
      // faces at 10% (front only) — kept subtle so the edges read clearly on top
      ctx.setLineDash([]);
      F.forEach((f, fi) => {
        if (!front[fi]) return;
        ctx.beginPath();
        ctx.moveTo(P[f[0]][0], P[f[0]][1]);
        ctx.lineTo(P[f[1]][0], P[f[1]][1]);
        ctx.lineTo(P[f[2]][0], P[f[2]][1]);
        ctx.closePath();
        ctx.fillStyle = 'rgba(' + bond + ', 0.10)';
        ctx.fill();
      });
      // edges: silhouette = thick solid outline (with a soft glow so it pops on the
      // tinted fill), interior + hidden = dashed.
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      E.forEach((e) => {
        const fc = e.faces.reduce((n, fi) => n + (front[fi] ? 1 : 0), 0);
        const a = P[e.a], b = P[e.b];
        if (fc === 1) { ctx.setLineDash([]); ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(' + bond + ', 1)'; ctx.shadowColor = 'rgba(' + bond + ', 0.9)'; ctx.shadowBlur = 8; }
        else if (fc === 2) { ctx.setLineDash([6, 5]); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(' + bond + ', 0.7)'; ctx.shadowBlur = 0; }
        else { ctx.setLineDash([4, 6]); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(' + bond + ', 0.32)'; ctx.shadowBlur = 0; }
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      });
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      if (!reduce) requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', () => { resize(); if (reduce) frame(0); });
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => { resize(); if (reduce) frame(0); }); ro.observe(hub); }
    if (reduce) frame(0); else requestAnimationFrame(frame);
  }

  Array.prototype.slice.call(document.querySelectorAll('[data-globe]')).forEach(function (hub) {
    if ((hub.dataset.shape || '') === 'ico') initIco(hub);
    else initGlobe(hub);
  });
})();

/* ---- F. Forms + booking modal ------------------------------------------ */
(function () {
  function validateForm(form) {
    let valid = true;
    form.querySelectorAll('[required]').forEach((field) => {
      field.classList.remove('error');
      const empty = !field.value.trim();
      const badEmail = field.type === 'email' && field.value && !field.value.includes('@');
      if (empty || badEmail) { field.classList.add('error'); valid = false; }
    });
    return valid;
  }
  // POST url-encoded to Netlify Forms. Swap the endpoint for any other backend.
  function postToNetlify(form) {
    const body = new URLSearchParams(new FormData(form)).toString();
    return fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  }
  function trackCtaClick(label) {
    if (typeof window.dataLayer !== 'undefined') window.dataLayer.push({ event: 'cta_click', label });
  }

  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target, submitBtn = form.querySelector('button[type="submit"]');
      if (!validateForm(form)) return;
      submitBtn.textContent = 'Sending…'; submitBtn.disabled = true;
      postToNetlify(form)
        .then(() => { submitBtn.textContent = "Sent! We'll be in touch soon."; form.reset(); })
        .catch(() => { submitBtn.textContent = 'Something went wrong — please try again'; submitBtn.disabled = false; });
    });
  }
  document.querySelectorAll('.btn-primary').forEach((btn) => btn.addEventListener('click', () => trackCtaClick(btn.textContent.trim())));

  // Booking modal: name/email gate → external calendar. Set the URL on the modal
  // via data-booking-url, or fall back to the constant below.
  const bookingModal = document.getElementById('booking-modal');
  const bookingForm  = document.getElementById('booking-form');
  const BOOKING_URL  = (bookingModal && bookingModal.dataset.bookingUrl) || 'https://example.com/book';
  let bookingTrigger = null;

  function openBookingModal(trigger) {
    if (!bookingModal) return;
    bookingTrigger = trigger || null;
    bookingModal.hidden = false; document.body.classList.add('modal-open');
    const firstInput = bookingModal.querySelector('input');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }
  function closeBookingModal() {
    if (!bookingModal) return;
    bookingModal.hidden = true; document.body.classList.remove('modal-open');
    if (bookingTrigger && typeof bookingTrigger.focus === 'function') bookingTrigger.focus();
  }
  document.querySelectorAll('.js-book').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof window.__bnCloseMobileMenu === 'function') window.__bnCloseMobileMenu();
    openBookingModal(el);
  }));
  if (bookingModal) {
    bookingModal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeBookingModal));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bookingModal.hidden) closeBookingModal(); });
  }
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateForm(bookingForm)) return;
      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      submitBtn.textContent = 'Opening calendar…'; submitBtn.disabled = true;
      trackCtaClick('booking_modal_submit');
      postToNetlify(bookingForm).finally(() => {
        window.open(BOOKING_URL, '_blank', 'noopener');
        closeBookingModal();
        setTimeout(() => { submitBtn.textContent = 'Continue to calendar →'; submitBtn.disabled = false; bookingForm.reset(); }, 600);
      });
    });
  }
})();
