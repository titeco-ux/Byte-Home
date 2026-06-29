'use strict';
/* ==========================================================================
   PAGE-SPECIFIC JS — ByteNana homepage
   Only the bits the design-kit's animations.js doesn't already cover:
     - Section 05 content tabs (Staff Augmentation / Product Teams)
     - Section 04 chooser cards deep-linking into the matching tab
   ========================================================================== */
(function () {
  const tabs   = Array.prototype.slice.call(document.querySelectorAll('.engage-tab'));
  const panels = Array.prototype.slice.call(document.querySelectorAll('.engage-panel'));
  if (!tabs.length || !panels.length) return;

  function selectTab(name) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach((p) => {
      const on = p.dataset.panel === name;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
  }

  tabs.forEach((t) => {
    t.addEventListener('click', () => selectTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(t);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); const n = tabs[(i + 1) % tabs.length]; selectTab(n.dataset.tab); n.focus(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); const p = tabs[(i - 1 + tabs.length) % tabs.length]; selectTab(p.dataset.tab); p.focus(); }
    });
  });

  // Chooser cards (section 04): open the matching tab, then let the anchor scroll.
  document.querySelectorAll('.js-engage').forEach((card) => {
    card.addEventListener('click', () => {
      const name = card.dataset.tab;
      if (name) selectTab(name);
    });
  });

  // Deep link support: #how-we-engage?tab=product (or hash already handled by anchor)
  const params = new URLSearchParams((location.hash.split('?')[1]) || '');
  if (params.get('tab')) selectTab(params.get('tab'));
})();
